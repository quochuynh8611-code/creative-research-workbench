# ADR-007: Chiến Lược Hiện Thực Hóa Real Embedding Engine & Cơ Chế Khôi Phục (Phase 6.1 — Real Embedding Strategy)

> **Trạng thái:** PROPOSED (DRAFT — Pending Approval)
> **Ngày lập:** 2026-10-03
> **Người đề xuất:** Staff Software Engineer / Technical Architect
> **Căn cứ:** [ADR-001](docs/ADR-001-architecture.md), [ADR-002](docs/ADR/ADR-002-phase-6-7-foundation-and-canvas.md), [PROFESSIONAL_UPGRADE_ROADMAP.md](docs/PROFESSIONAL_UPGRADE_ROADMAP.md) (Phase 6.1), [PHASE_6_7_EXECUTION_SPEC.md](docs/PHASE_6_7_EXECUTION_SPEC.md)

---

## 1. Bối cảnh (Context)

Hệ thống Creative Research Workbench sử dụng kiến trúc tìm kiếm lai (Hybrid Search) hòa trộn giữa **Full-Text Search (FTS)** (PostgreSQL `tsvector` + `websearch_to_tsquery`) và **Vector Semantic Search** (PostgreSQL `pgvector` Cosine Distance `<=>`) qua thuật toán **Reciprocal Rank Fusion (RRF, $k=60$)**.

Tuy nhiên:
1. Trong giai đoạn khởi tạo (Phase 1–5), client mặc định là `MockEmbeddingClient` sinh toàn bộ zero-vectors (`[0.0] * 1536`). Điều này làm cho Vector Search Leg không có tín hiệu ngữ nghĩa thực tế, hệ thống suy biến hoàn toàn về Full-Text Search.
2. Để chuyển sang giai đoạn **AI-Augmented Research Studio (Phase 6)**, hệ thống cần kích hoạt **Real Embedding Engine** hỗ trợ các nhà cung cấp AI hàng đầu (OpenAI, Google Gemini) phục vụ cả Ingestion và Retrieval.
3. Việc tích hợp API bên ngoài (Third-party Cloud APIs) mang lại các rủi ro hệ thống: lỗi mạng, timeout, rate-limiting (HTTP 429), cạn quota, sai lệch kích thước vector không gian (dimension mismatch), hoặc rò rỉ secret key.

---

## 2. Phân Tích Các Lựa Chọn Kiến Trúc (Options Analysis)

### Option A: Trực tiếp gọi OpenAI/Gemini SDK cứng trong Service, chặn luồng khi lỗi (Tight Coupling, Fail-Closed)
* **Cơ chế:** Gắn cứng `openai.embeddings.create` vào `IngestionService` và `RetrievalService`. Nếu API lỗi $\rightarrow$ Ném ngoại lệ HTTP 500.
* **Nhược điểm & Rủi ro (Blast Radius rất cao):**
  * Làm tê liệt toàn bộ luồng tải tài liệu và tìm kiếm khi mất mạng hoặc hết quota.
  * Khó viết unit/integration tests offline.
  * Không thể chạy trên môi trường air-gapped hoặc CI/CD cục bộ.

### Option B: Local Embedding Server (Tự host Sentence-Transformers / Ollama / ONNX)
* **Cơ chế:** Nhúng mô hình HuggingFace cục bộ (ví dụ `all-MiniLM-L6-v2` hoặc `bge-m3`) trực tiếp trong container backend Python.
* **Ưu điểm:** Hoàn toàn offline, không phụ thuộc API key bên ngoài.
* **Nhược điểm:**
  * Làm tăng dung lượng Docker image thêm 1GB–3GB (PyTorch/Transformers).
  * Tiêu tốn lớn RAM/CPU khi chạy trên môi trường phát triển local thông thường.
  * Tốc độ suy luận CPU trên container có thể làm tăng độ trễ tìm kiếm (> 500ms).

### Option C: Polymorphic Factory + Standardized 1536-Dim + Graceful Degradation (Khuyến nghị cho Phase 6.1)
* **Cơ chế:**
  1. **Polymorphic Interface:** Tách biệt giao diện `EmbeddingClient` với 3 triển khai: `MockEmbeddingClient`, `OpenAIEmbeddingClient` (`text-embedding-3-small`), `GeminiEmbeddingClient` (`text-embedding-004`).
  2. **Kích thước Chuẩn tắc Toàn Hệ thống (Canonical Dimension):** Cố định `EMBEDDING_DIM = 1536` tương thích tuyệt đối với PostgreSQL `pgvector.Vector(1536)`.
  3. **Graceful Degradation (Fail-Open):** Khi thiếu API key hoặc lỗi mạng vượt quá retry backoff, client tự động hạ cấp về `MockEmbeddingClient` (zero-vectors) kèm warning log có cấu trúc.
  4. **Zero-Vector Quarantine tại Retrieval:** `RetrievalService` tự động phát hiện query vector hoặc corpus chunks là zero-vector để bỏ qua Leg 2 và phục vụ bằng 100% Full-Text Search, đảm bảo người dùng không bao giờ gặp lỗi 500.
  5. **Re-embedding Migration CLI:** Cung cấp công cụ dòng lệnh `reembed_chunks.py` có khả năng lọc `--only-zero`, chia batch, kiểm soát tốc độ và ghi nhật ký tiến độ.

---

## 3. Các Quyết Định Kiến Trúc Cốt Lõi (Decisions)

### 3.1. Cố Định Kích Thước Vector Chuẩn Tắc: 1536 Chiều (Canonical 1536-Dim)
* Cột `chunks.embedding` trong database và `EMBEDDING_DIM` trong toàn bộ backend được chuẩn hóa cố định là **1536**.
* **OpenAI:** Sử dụng model `text-embedding-3-small` (native 1536 dimensions, hoặc ép tham số `dimensions=1536`).
* **Gemini:** Sử dụng model `text-embedding-004` kết hợp tham số `outputDimensionality: 1536` qua REST API hoặc chuẩn hóa qua hàm `_standardize_dim` (pad zero / truncate nếu provider trả khác 1536).

### 3.2. Quy Tắc Cấm Trộn Lẫn Không Gian Vector (Strict No-Mixing Rule)
* **Nguyên lý toán học:** Phép đo Cosine Similarity ($1.0 - \text{distance}$) trong không gian vector chỉ có ý nghĩa khi **tất cả các vector được sinh ra từ cùng một model/version và cùng một không gian nhúng**.
* **Quy tắc hệ thống:**
  * Không được phép lưu trữ xen kẽ vector của OpenAI và vector của Gemini trong cùng một cơ sở tri thức đang phục vụ tìm kiếm.
  * Khi thay đổi `EMBEDDING_PROVIDER` (ví dụ từ `mock` sang `openai`, hoặc từ `openai` sang `gemini`), bắt buộc phải chạy script `reembed_chunks.py` để cập nhật đồng bộ toàn bộ chunks sang không gian vector mới.

### 3.3. Chính Sách Fallback & Cách Ly Zero-Vector (Zero-Vector Quarantine)
* Zero-vector (`[0.0] * 1536`) được định nghĩa là **vector giả lập không mang thông tin ngữ nghĩa (Quarantined/Placeholder Vector)**.
* Khi `query_vector` là zero-vector: `RetrievalService._vector_search` trả về mảng rỗng ngay lập tức mà không thực hiện câu lệnh SQL pgvector, tránh gây nhiễu điểm số RRF.
* Khi nạp tài liệu nếu API bên ngoài gặp sự cố: Hệ thống vẫn lưu thành công `Document` và `Chunk` với zero-vector, ghi nhận log cảnh báo để quản trị viên có thể re-embed sau qua CLI.

### 3.4. Chiến Lược Retry, Timeout & Quản Lý Secret
* **Timeout:** Thiết lập HTTP timeout tối đa **15.0 giây** cho mỗi API call.
* **Retry Policy:** Tối đa **2 lần retry** với exponential backoff (`0.5s`, `1.0s`).
* **Bảo mật:**
  * Đọc API keys từ `OPENAI_API_KEY` và `GEMINI_API_KEY` trong file cấu hình `.env` / Pydantic `Settings`.
  * Tuyệt đối không log chuỗi API key ra màn hình, file log hoặc API responses.

---

## 4. Đánh Giá Blast Radius & Khả Năng Đảo Ngược (Blast Radius & Reversibility)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            BLAST RADIUS MATRIX: PHASE 6.1                        │
├────────────────────┬───────────┬─────────────────────────────────────────────────┤
│ Thành phần         │ Mức độ    │ Phân tích chi tiết rủi ro & Chiến lược phòng vệ │
├────────────────────┼───────────┼─────────────────────────────────────────────────┤
│ Embedding Factory  │ THẤP      │ Độc lập hoàn toàn qua interface EmbeddingClient │
│ Ingestion Pipeline │ TRUNG BÌNH│ Tự động fallback Mock khi API lỗi, zero 500     │
│ Retrieval Pipeline │ THẤP      │ Tự động lọc zero-vector, suy biến an toàn FTS   │
│ Database Schema    │ RẤT THẤP  │ Cột Vector(1536) đã có sẵn từ Baseline 001      │
│ CLI Re-embed       │ TRUNG BÌNH│ Chạy batch theo yêu cầu, có rollback thủ công   │
└────────────────────┴───────────┴─────────────────────────────────────────────────┘
```

* **One-Way Decision (Khó đảo ngược):** Cố định kiểu dữ liệu `Vector(1536)` trong database. (Đã được thẩm định là phù hợp với chuẩn công nghiệp hiện nay).
* **Two-Way Decisions (Dễ dàng đảo ngược):** Lựa chọn provider qua biến môi trường `EMBEDDING_PROVIDER`, chuyển đổi linh hoạt giữa `mock`, `openai`, `gemini` mà không cần sửa code.

---

## 5. Ranh Giới Ngoài Phạm Vi (Explicit Out-of-Scope)

* Không thay đổi schema DDL của bảng `chunks` hoặc sửa baseline Alembic.
* Không tích hợp LLM Chatbot / Prompt Generation (thuộc Phase 6.2).
* Không thay đổi cấu trúc ma trận TRIZ 39x39 (thuộc Phase 6.3).
* Không tự động chạy re-embed toàn bộ database khi khởi động server backend.

---

## 6. Hướng Dẫn Vận Hành & Khôi Phục (Runbook & Rollback Plan)

1. **Khôi phục khẩn cấp khi API bên ngoài bị lỗi hoặc hết hạn:**
   * Cập nhật file `.env`: `EMBEDDING_PROVIDER=mock`.
   * Khởi động lại dịch vụ backend: Hệ thống ngay lập tức hoạt động bình thường ở chế độ Full-Text Search.
2. **Re-embed toàn bộ dữ liệu khi cấp mới API Key:**
   * Chạy lệnh CLI: `python -m app.scripts.reembed_chunks --provider openai --batch-size 50 --only-zero`.
