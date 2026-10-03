# 🧪 Phase 6.1 — Real Embedding Engine & Graceful Degradation Gherkin Test Matrix

> **Tài liệu:** BDD Test Matrix cho Phase 6.1
> **Căn cứ:** [PHASE_6_1_REAL_EMBEDDING_ENGINE_SPEC.md](docs/PHASE_6_1_REAL_EMBEDDING_ENGINE_SPEC.md), [ADR-007](docs/ADR/ADR-007-phase-6-1-real-embedding-strategy.md)

---

## 1. Feature: Polymorphic Factory & Provider Resolution

```gherkin
Feature: Embedding Client Factory & Provider Resolution

  Scenario: Factory creates MockEmbeddingClient when provider is mock
    Given cấu hình EMBEDDING_PROVIDER là "mock"
    When hệ thống gọi get_embedding_client()
    Then client trả về là một instance của MockEmbeddingClient
    And client sinh các vector có độ dài 1536 chứa toàn giá trị 0.0

  Scenario: Factory creates OpenAIEmbeddingClient when provider is openai
    Given cấu hình EMBEDDING_PROVIDER là "openai"
    When hệ thống gọi get_embedding_client()
    Then client trả về là một instance của OpenAIEmbeddingClient
    And model mặc định được cấu hình là "text-embedding-3-small"

  Scenario: Factory creates GeminiEmbeddingClient when provider is gemini
    Given cấu hình EMBEDDING_PROVIDER là "gemini"
    When hệ thống gọi get_embedding_client()
    Then client trả về là một instance của GeminiEmbeddingClient
    And model mặc định được cấu hình là "text-embedding-004"

  Scenario: Factory gracefully falls back to Mock on unknown provider configuration
    Given cấu hình EMBEDDING_PROVIDER là "unsupported_xyz_provider"
    When hệ thống gọi get_embedding_client()
    Then client trả về là một instance của MockEmbeddingClient
    And hệ thống ghi warning log cảnh báo cấu hình provider không hợp lệ
```

---

## 2. Feature: Resilience, Retry & Graceful Degradation

```gherkin
Feature: Embedding Client Resilience & Graceful Fallback

  Scenario: OpenAI client automatically falls back to mock on missing API key
    Given OpenAIEmbeddingClient được khởi tạo với api_key rỗng ""
    When gọi client.embed(["Nghiên cứu nguyên lý TRIZ"])
    Then hệ thống không ném ngoại lệ
    And kết quả trả về là danh sách vector 1536 chiều chứa toàn số 0.0
    And ghi log cảnh báo "OpenAI API key missing or empty"

  Scenario: OpenAI client retries with backoff and falls back when API raises errors
    Given OpenAIEmbeddingClient được cấu hình với max_retries = 2 và retry_delay = 0.01s
    And OpenAI API ném ngoại lệ HTTP 500 liên tiếp 3 lần
    When gọi client.embed(["Văn bản cần nhúng"])
    Then hệ thống thực hiện đúng 3 lần thử (1 initial + 2 retries)
    And tự động fallback trả về zero-vectors
    And không làm crash tiến trình ứng dụng

  Scenario: Gemini client handles non-1536 dimension and standardizes to 1536
    Given GeminiEmbeddingClient nhận phản hồi API với vector 768 chiều
    When gọi client.embed(["Văn bản ngắn"])
    Then vector trả về có chính xác 1536 chiều
    And 768 chiều đầu chứa đúng dữ liệu từ Gemini
    And 768 chiều sau được pad bằng giá trị 0.0

  Scenario: Gemini client falls back on HTTP 503 service unavailable
    Given GeminiEmbeddingClient gặp lỗi HTTP 503 từ máy chủ Google
    When gọi client.embed(["Đoạn văn bản kiểm thử"])
    Then hệ thống retry theo cấu hình và fallback về zero-vectors
```

---

## 3. Feature: Ingestion & Document Persistence Under Real/Degraded Embeddings

```gherkin
Feature: Ingestion Pipeline with Embedding Integration

  Scenario: Ingestion persists real non-zero vectors when provider is healthy
    Given IngestionService hoạt động với một Real/Deterministic Embedding Client
    And một file tài liệu Markdown kỹ thuật hợp lệ
    When gọi IngestionService.ingest(filepath)
    Then Document được lưu thành công vào PostgreSQL
    And tất cả các Chunks liên quan có trường embedding chứa các giá trị float khác 0.0
    And status kết quả trả về là "success"

  Scenario: Ingestion succeeds without 500 error when embedding provider fails
    Given IngestionService được cấu hình với OpenAIEmbeddingClient
    And OpenAI API đang mất kết nối
    When người dùng upload file tài liệu Markdown qua API POST /api/v1/documents/upload
    Then API trả về HTTP 200 OK với status "success"
    And Document và Chunks vẫn được lưu đầy đủ vào cơ sở dữ liệu
    And các Chunks được gán zero-vectors dự phòng để có thể re-embed sau
```

---

## 4. Feature: Retrieval Zero-Vector Quarantine & Hybrid Search

```gherkin
Feature: Retrieval Zero-Vector Quarantine & RRF Fusion

  Scenario: Retrieval ignores vector leg when query produces zero-vector
    Given cơ sở tri thức có các chunks với zero-vectors (Mock Mode)
    When người dùng gửi câu truy vấn tìm kiếm "mâu thuẫn thông số"
    Then RetrievalService phát hiện query vector là toàn số 0.0
    And bỏ qua Leg 2 Vector Search để tránh sinh nhiễu
    And trả về kết quả thuần túy dựa trên Full-Text Search (Leg 1)
    And điểm số RRF được tính toán hợp lệ từ thứ hạng FTS

  Scenario: Retrieval ranks semantically relevant documents higher with real vectors
    Given cơ sở dữ liệu có Document A (về TRIZ) và Document B (về SQL) với real embeddings
    When người dùng tìm kiếm câu truy vấn "nguyên tắc giải quyết mâu thuẫn sáng tạo"
    Then Document A được xếp hạng cao hơn Document B
    And điểm số similarity của Document A lớn hơn 0.0
```

---

## 5. Feature: Re-embedding CLI Tool (`reembed_chunks.py`)

```gherkin
Feature: Re-embedding CLI Script Operations

  Scenario: Re-embed chunks with --only-zero flag updates only unpopulated chunks
    Given database có 5 chunks đã có real vectors và 5 chunks mang zero-vectors
    When quản trị viên chạy lệnh "python -m app.scripts.reembed_chunks --provider openai --only-zero --batch-size 5"
    Then hệ thống chỉ gọi embedding API cho đúng 5 chunks mang zero-vectors
    And cập nhật vector mới cho 5 chunks đó
    And 5 chunks đã có real vectors giữ nguyên giá trị ban đầu

  Scenario: Re-embed full corpus updates all chunks in batches
    Given database có 10 chunks bất kỳ
    When chạy lệnh "python -m app.scripts.reembed_chunks --provider gemini --batch-size 5"
    Then toàn bộ 10 chunks được cập nhật vector mới theo từng đợt 5 chunks
    And mỗi đợt được commit transaction riêng biệt vào PostgreSQL
```
