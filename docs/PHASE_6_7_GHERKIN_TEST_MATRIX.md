# PHASE 6 & 7 GHERKIN TEST MATRIX & TEST-FIRST DESIGN

> **Tài liệu**: BDD Gherkin Test Scenarios & Integration Test Matrix (Refined)
> **Mục tiêu**: Thiết lập các bài kiểm thử thất bại trước (Failing Integration Tests - RED) trước khi viết bất kỳ dòng mã nguồn sản xuất nào.
> **Trạng thái**: Canonical Test Specification
> **Ngày**: 2026-09-30
> **Tham chiếu**: [`docs/GHERKIN_SCENARIOS.md`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/docs/GHERKIN_SCENARIOS.md), [`docs/TEST_PLAN.md`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/docs/TEST_PLAN.md)

---

## 1. Ma trận Kiểm thử Tích hợp (Test-First Matrix)

| Thứ Tự | Feature Track | File Test Tương Ứng | Trạng Thái Ban Đầu (Test-First) |
|---|---|---|---|
| **Track 0** | Two-Stage Alembic Migrations (001 Baseline & 002 Features) | `backend/tests/integration/test_alembic_migrations.py` | 🔴 **RED** (Chưa có cấu hình alembic & migration scripts) |
| **Track 1** | Full TRIZ 39×39 Matrix & 39 Parameters (Deterministic) | `backend/tests/integration/test_triz_full_matrix.py` | 🔴 **RED** (Chưa có JSON 39x39 và 39 keywords mở rộng) |
| **Track 2** | Real Embedding Engine & Graceful Fallback | `backend/tests/integration/test_embedding_client.py` | 🔴 **RED** (Chưa có Real Clients/Factory & Fallback) |
| **Track 3** | Research Notes CRUD & AI Trust Contract Persistence | `backend/tests/integration/test_research_notes_api.py` | 🔴 **RED** (Chưa có ORM Model & API endpoints cho Notes) |
| **Track 4** | Research Notebook UI & Quick Notes Component | `apps/web/features/session/__tests__/research-notebook.test.tsx` | 🔴 **RED** (Chưa có Component & Client hooks) |
| **Track 5** | Session Export as Markdown Report | `backend/tests/integration/test_session_export.py` | 🔴 **RED** (Chưa có Export Service & endpoint) |

---

## 2. Gherkin Scenarios Chi tiết cho từng Feature

---

### Feature 0: Two-Stage Database Schema Migrations với Alembic
- **File test đích**: `backend/tests/integration/test_alembic_migrations.py`
- **Failing Test Condition**: Gọi `alembic upgrade 001` hoặc `alembic upgrade head` báo lỗi do chưa có thư mục `alembic` và các file `001_baseline_schema.py`, `002_add_research_notes_and_candidate_solutions.py`.

```gherkin
Feature: Two-Stage Database Schema Migrations với Alembic
  Để đảm bảo an toàn tuyệt đối và phân tách rạch ròi giữa schema baseline và bảng tính năng mới
  Là kỹ sư hệ thống
  Tôi cần kiểm thử tự động quy trình nâng cấp và hạ cấp schema qua 2 bước migration

  Scenario: Nâng cấp và hạ cấp tuần tự qua từng bản migration
    Given database PostgreSQL rỗng
    When chạy lệnh "alembic upgrade 001"
    Then đúng 5 bảng baseline được tạo: "documents", "chunks", "research_sessions", "problem_frames", "contradictions"
    And các bảng "research_notes", "candidate_solutions" CHƯA tồn tại
    When chạy lệnh "alembic upgrade 002" (hoặc "upgrade head")
    Then 2 bảng mới "research_notes" và "candidate_solutions" được tạo thành công
    And khóa ngoại Foreign Key tới "research_sessions(id)" có ràng buộc ON DELETE CASCADE
    When chạy lệnh "alembic downgrade 001"
    Then 2 bảng mới bị gỡ bỏ an toàn
    And 5 bảng baseline cùng dữ liệu bên trong vẫn nguyên vẹn
    When chạy lệnh "alembic downgrade base"
    Then toàn bộ database được dọn dẹp sạch sẽ không còn bảng nào
```

---

### Feature 1: Full TRIZ 39×39 Altshuller Matrix (Phase 6.3 - Deterministic)
- **File test đích**: `backend/tests/integration/test_triz_full_matrix.py`
- **Failing Test Condition**: Câu phát biểu chứa thông số thứ 9–39 (như "nhiệt độ", "thể tích", "độ sáng") trả về `ContradictionType.none` do `_PARAMETER_KEYWORDS` hiện tại chỉ có 8 thông số và ma trận chỉ có 10 cặp.

```gherkin
Feature: Full TRIZ 39×39 Altshuller Matrix
  Để cung cấp đầy đủ 40 nguyên tắc sáng tạo cho mọi cặp mâu thuẫn kỹ thuật kinh điển
  Là chuyên gia TRIZ
  Tôi cần hệ thống nhận diện đủ 39 thông số và tra cứu ma trận 39x39 đầy đủ

  Scenario: Nhận diện mâu thuẫn từ thông số ngoài top 8 cũ (VD: Nhiệt độ vs Độ bền)
    Given session đang ở trạng thái "active"
    When người dùng gửi Problem Statement: "Tăng nhiệt độ buồng đốt làm giảm độ bền cấu trúc của vật liệu cách nhiệt"
    Then hệ thống nhận diện improving_parameter = "temperature" (Thông số #17)
    And nhận diện worsening_parameter = "durability" (Thông số #14 - Độ bền vật thể tĩnh)
    And contradiction_type được phân loại là "technical"
    And danh sách gợi ý nguyên tắc trả về đúng các nguyên tắc Altshuller kinh điển (VD: 35, 10, 19)

  Scenario: Hiển thị đầy đủ thông tin giải thích và ví dụ của nguyên tắc sáng tạo
    Given session có mâu thuẫn đã được gợi ý nguyên tắc số 35 "Chuyển đổi thông số"
    When gọi MethodRecommender.recommend_methods(session_id)
    Then mỗi nguyên tắc trả về bao gồm:
      | Field        | Yêu cầu                                  |
      | id           | Số nguyên từ 1 đến 40                    |
      | title        | Tên nguyên tắc song ngữ Việt - Anh       |
      | description  | Định nghĩa chi tiết nguyên tắc           |
      | explanation  | Lý do tại sao nguyên tắc giải quyết cặp thông số này |
      | examples     | Danh sách ví dụ thực tế trong kỹ thuật   |
```

---

### Feature 2: Real Embedding Engine & Graceful Fallback (Phase 6.1)
- **File test đích**: `backend/tests/integration/test_embedding_client.py`
- **Failing Test Condition**: Gọi `get_embedding_client("openai")` hoặc `get_embedding_client("gemini")` throw `NotImplementedError`.

```gherkin
Feature: Real Embedding Engine & Graceful Fallback
  Để tăng độ chính xác của tìm kiếm ngữ nghĩa (Semantic Vector Search)
  Là hệ thống Retrieval
  Tôi cần nhúng vector ngữ nghĩa thật cho các đoạn văn bản với cơ chế dự phòng an toàn

  Scenario: Khởi tạo OpenAIEmbeddingClient thành công
    Given cấu hình "EMBEDDING_PROVIDER=openai" và "OPENAI_API_KEY" hợp lệ
    When gọi hàm embed(["Mâu thuẫn kỹ thuật trong thiết kế cơ khí"])
    Then hệ thống trả về 1 vector có đúng 1536 chiều
    And các giá trị float trong vector không đồng thời bằng 0.0

  Scenario: Tự động Fallback về Mock client khi mất kết nối mạng hoặc lỗi API Key
    Given cấu hình "EMBEDDING_PROVIDER=openai" nhưng API bên ngoài trả về mã lỗi 429 hoặc timeout
    When gọi IngestionService.ingest(filepath)
    Then hệ thống không throw uncaught exception (không sinh HTTP 500)
    And ghi log cảnh báo structured log "embedding_fallback_to_mock"
    And chunk vẫn được lưu với zero-vector dự phòng để tiếp tục phục vụ Full-Text Search
```

---

### Feature 3: Research Notes CRUD & AI Trust Contract (Phase 7.2)
- **File test đích**: `backend/tests/integration/test_research_notes_api.py`
- **Failing Test Condition**: Gửi `POST /api/v1/sessions/{id}/notes` trả về 404 do endpoint chưa tồn tại.

```gherkin
Feature: Research Notes CRUD & AI Trust Contract
  Để ghi chép và lưu giữ các phát hiện, giả thuyết mà không làm biến dạng dữ liệu bài toán gốc
  Là nhà nghiên cứu
  Tôi cần tạo, đọc, phân loại và xóa các Research Notes gắn với Session

  Scenario: Tạo Research Note mới thành công
    Given session "ef340f52-d0bd-4b39-8252-0e621318fc02" đang ở trạng thái active
    When gửi POST request tới "/api/v1/sessions/ef340f52-d0bd-4b39-8252-0e621318fc02/notes" với payload:
      """
      {
        "content": "Giả thuyết: Sử dụng vật liệu xốp có thể giảm 30% rung động mà không làm giảm độ cứng.",
        "note_type": "hypothesis"
      }
      """
    Then API trả về HTTP 201 Created
    And bản ghi note được lưu vào cơ sở dữ liệu với đúng session_id
    And note_type được lưu là "hypothesis"
    And timestamp created_at được thiết lập tự động

  Scenario: AI Trust Contract — Đề xuất AI không được tự ý ghi đè ProblemFrame
    Given session đã có ProblemFrame với normalized_statement ban đầu
    When người dùng kích hoạt AI Suggestion để sinh giả thuyết mới
    Then hệ thống trả về gợi ý trên API response kèm metadata "provenance: ai_hypothesis"
    And trường "normalized_statement" trong bảng "problem_frames" KHÔNG bị thay đổi
    When người dùng chủ động nhấn nút "Lưu thành Note"
    Then một bản ghi mới được thêm vào bảng "research_notes" chứ không ghi đè vào "problem_frames"

  Scenario: Xóa Research Note an toàn
    Given một Research Note tồn tại trong database với ID "note-123"
    When gửi DELETE request tới "/api/v1/sessions/{session_id}/notes/note-123"
    Then API trả về HTTP 200 OK
    And truy vấn lại GET "/api/v1/sessions/{session_id}/notes" không còn chứa note "note-123"
```

---

### Feature 4: Research Notebook UI Component (Phase 7.1 & 7.2 Frontend)
- **File test đích**: `apps/web/features/session/__tests__/research-notebook.test.tsx`
- **Failing Test Condition**: Component `ResearchNotebook` chưa tồn tại trong `apps/web/features/session/`.

```gherkin
Feature: Research Notebook UI Component
  Để tương tác mượt mà với các ghi chép nghiên cứu trên giao diện web
  Là người dùng
  Tôi cần giao diện Notebook cho phép nhập nhanh ghi chú, chọn loại note và xem danh sách trực quan

  Scenario: Người dùng nhập và lưu ghi chú mới từ giao diện
    Given người dùng đang ở tab "Ghi chép (Notebook)" trên màn hình Session Detail
    When người dùng nhập nội dung vào ô textarea: "Đã kiểm chứng mâu thuẫn tốc độ vs độ bền"
    And chọn loại note là "Insight"
    And nhấn nút "Lưu ghi chú"
    Then request POST "/api/v1/sessions/{id}/notes" được gửi đi
    And ghi chú mới xuất hiện ngay trên danh sách với badge màu tím "Insight"
    And form nhập liệu được reset về trạng thái trống
```

---

### Feature 5: Session Export ra Markdown (Phase 9.1 Quick-Win)
- **File test đích**: `backend/tests/integration/test_session_export.py`
- **Failing Test Condition**: Gửi `GET /api/v1/sessions/{id}/export?format=md` trả về 404.

```gherkin
Feature: Session Export ra Markdown
  Để chia sẻ kết quả nghiên cứu hoặc lưu trữ hồ sơ độc lập
  Là kỹ sư nghiên cứu
  Tôi cần xuất toàn bộ phiên làm việc thành tài liệu Markdown có cấu trúc hoàn chỉnh

  Scenario: Xuất session đầy đủ thông tin ra file Markdown
    Given session đã có ProblemFrame, 3 gợi ý TRIZ Principles và 2 Research Notes
    When gửi GET request tới "/api/v1/sessions/{session_id}/export?format=md"
    Then API trả về HTTP 200 OK
    And Header "Content-Type" là "text/markdown; charset=utf-8"
    And Header "Content-Disposition" chứa filename dạng "session_{id}.md"
    And nội dung trả về chứa YAML frontmatter (title, status, created_at)
    And nội dung chứa mục "# 1. BÀI TOÁN & PHÂN TÍCH MÂU THUẪN TRIZ"
    And nội dung chứa mục "# 2. NGUYÊN TẮC SÁNG TẠO ĐỀ XUẤT"
    And nội dung chứa mục "# 3. SỔ TAY GHI CHÉP NGHIÊN CỨU (RESEARCH NOTES)"
```
