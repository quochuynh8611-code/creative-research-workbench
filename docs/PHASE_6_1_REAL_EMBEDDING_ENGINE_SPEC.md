# 📋 Phase 6.1 — Real Embedding Engine & Graceful Degradation Execution Specification

> **Phiên bản:** 1.0.0
> **Trạng thái:** DRAFT — Chờ phê duyệt
> **Ngày lập:** 2026-10-03
> **Tác giả:** Staff Software Engineer / Technical Architect
> **Căn cứ:** [ADR-001](docs/ADR-001-architecture.md), [ADR-002](docs/ADR/ADR-002-phase-6-7-foundation-and-canvas.md), [ADR-007](docs/ADR/ADR-007-phase-6-1-real-embedding-strategy.md), [PROFESSIONAL_UPGRADE_ROADMAP.md](docs/PROFESSIONAL_UPGRADE_ROADMAP.md) (Phase 6.1), [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md)

---

## 1. Tổng Quan & Bối Cảnh Kỹ Thuật (Executive Summary)

Trong Creative Research Workbench, **Tìm kiếm Lai (Hybrid Search)** kết hợp giữa Full-Text Search (FTS) và Vector Semantic Search là xương sống để trích xuất bằng chứng (Evidence Retrieval) từ Knowledge Base.

Ở các giai đoạn trước:
* `MockEmbeddingClient` sinh toàn bộ zero-vectors (`[0.0] * 1536`) để phục vụ kiểm thử đơn vị và tích hợp cục bộ.
* Vector Leg trong `RetrievalService` không có tín hiệu phân tách ngữ nghĩa; RRF fusion chủ yếu dựa trên FTS rank.
* Để chuyển đổi sang nền tảng nghiên cứu thực sự thông minh, **Phase 6.1 (Real Embedding Engine)** chính thức chuẩn hóa, hoàn thiện và đóng gói các client tạo vector nhúng ngữ nghĩa (OpenAI, Gemini), thiết lập cơ chế tự phục hồi (Graceful Degradation) và cung cấp công cụ Re-embedding toàn diện.

---

## 2. Khảo Sát Hiện Trạng (Baseline Audit)

1. **Interface & Factory**:
   * Module [`backend/src/app/services/embedding_client.py`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/services/embedding_client.py) đã định nghĩa `EmbeddingClient`, `MockEmbeddingClient`, `OpenAIEmbeddingClient`, `GeminiEmbeddingClient`, và hàm factory `get_embedding_client()`.
2. **Kích thước Chuẩn Tắc**:
   * Toàn bộ hệ thống cố định `EMBEDDING_DIM = 1536`.
   * Cột `chunks.embedding Vector(1536)` đã được khởi tạo trong migration `001_baseline_schema.py`.
3. **Luồng Ingestion & Retrieval**:
   * `IngestionService` tự động chunking và gọi `embedding_client.embed(texts)`.
   * `RetrievalService` đã có guard zero-vector (`if all(v == 0.0 for v in query_vector): return []`).
4. **Khoảng trống cần hoàn thiện (Gaps to Address)**:
   * Cần hoàn thiện cơ chế retry có exponential backoff và chuẩn hóa chiều vector giữa OpenAI và Gemini.
   * Cần nâng cấp script CLI `reembed_chunks.py` với khả năng chia batch an toàn, cờ lọc `--only-zero`, xử lý rate limit và logging chi tiết.
   * Cần chuẩn hóa quy tắc cấm trộn lẫn không gian vector (Strict No-Mixing Rule) trong tài liệu vận hành.

---

## 3. Mục Tiêu (Goals) & Phạm Vi Loại Trừ (Non-Goals)

### A. Mục Tiêu (Goals)
1. **Polymorphic Real Embedding Clients**:
   * Hỗ trợ đầy đủ `openai` (`text-embedding-3-small`, 1536 dims) và `gemini` (`text-embedding-004`, 1536 dims chuẩn hóa).
   * Lựa chọn động qua biến môi trường `EMBEDDING_PROVIDER=mock|openai|gemini`.
2. **Fail-Open & Graceful Degradation (Không sập hệ thống)**:
   * Khi thiếu API key, sai key, vượt hạn mức (HTTP 429), timeout hoặc mất mạng: Client tự động chuyển sang `MockEmbeddingClient` kèm warning log có cấu trúc.
   * Đảm bảo các request người dùng (`POST /api/v1/documents/upload`, `POST /api/v1/search`) **không bao giờ trả về HTTP 500** do lỗi embedding service.
3. **Zero-Vector Quarantine**:
   * Duy trì bộ lọc zero-vector trong `RetrievalService` để tránh làm sai lệch bảng xếp hạng RRF fusion khi chạy ở chế độ degraded.
4. **Robust Re-embedding CLI**:
   * Hoàn thiện script `backend/src/app/scripts/reembed_chunks.py` cho phép quản trị viên re-embed theo batch, lọc `--only-zero`, và kiểm soát tốc độ (rate-limit backoff).
5. **No-Mixing Rule Assurance**:
   * Đảm bảo tính nhất quán của không gian vector trong cơ sở dữ liệu.

### B. Phạm Vi Loại Trừ (Non-Goals)
* Không thay đổi schema database hay sửa đổi migration Alembic (giữ nguyên kiểu `Vector(1536)`).
* Không tích hợp LLM Prompting / Chat Assistant (thuộc Phase 6.2).
* Không sửa đổi hay nạp dataset TRIZ 39x39 (thuộc Phase 6.3).
* Không tự động kích hoạt tiến trình re-embed nền khi khởi động ứng dụng mà không có sự kích hoạt từ người dùng/quản trị viên.

---

## 4. Đặc Tả Kỹ Thuật Chi Tiết (Technical Specifications)

### 4.1. Cấu Trúc Khởi Tạo & Quản Lý Cấu Hình (Configuration Matrix)

Tất cả cấu hình được quản lý tập trung tại `backend/src/app/core/config.py`:

| Tên Biến | Kiểu Dữ Liệu | Mặc Định | Mô Tả & Ý Nghĩa |
|---|---|---|---|
| `EMBEDDING_PROVIDER` | `str` | `"mock"` | Provider được kích hoạt: `"mock"`, `"openai"`, `"gemini"` |
| `OPENAI_API_KEY` | `str` | `""` | API Key OpenAI (bắt buộc khi provider là `openai`) |
| `GEMINI_API_KEY` | `str` | `""` | API Key Google Gemini (bắt buộc khi provider là `gemini`) |
| `EMBEDDING_MODEL_NAME` | `Optional[str]` | `None` | Tên model tùy chỉnh (nếu `None` sẽ dùng default của provider) |

### 4.2. Đặc Tả Hành Vi Của Từng Client

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               EMBEDDING CLIENT BEHAVIOR                                │
├──────────────────────┬──────────────────────┬──────────────────────────────────────────┤
│ Client               │ Model Mặc Định       │ Xử Lý Lỗi / Fallback                     │
├──────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ MockEmbeddingClient  │ N/A (Zero-vectors)   │ Trả về [0.0] * 1536 ngay lập tức         │
│ OpenAIEmbeddingClient│ text-embedding-3-sm  │ Retry 2 lần (backoff 0.5s) → Mock fallback│
│ GeminiEmbeddingClient│ text-embedding-004   │ Retry 2 lần (backoff 0.5s) → Mock fallback│
└──────────────────────┴──────────────────────┴──────────────────────────────────────────┘
```

#### Quy tắc Chuẩn Hóa Vector (`_standardize_dim`):
* Nếu độ dài vector bằng `1536`: Giữ nguyên và cast `float`.
* Nếu độ dài vector $< 1536$ (ví dụ Gemini trả về 768 chiều): Pad thêm `0.0` vào cuối để đạt đủ 1536 chiều.
* Nếu độ dài vector $> 1536$: Cắt lấy chính xác 1536 phần tử đầu tiên.

### 4.3. Đặc Tả Công Cụ CLI: `reembed_chunks.py`

* **Đường dẫn**: `backend/src/app/scripts/reembed_chunks.py`
* **Cú pháp thực thi**:
  ```bash
  python -m app.scripts.reembed_chunks [--provider openai|gemini|mock] [--batch-size 50] [--only-zero]
  ```
* **Tham số**:
  * `--provider`: Chỉ định provider cụ thể (nếu bỏ qua sẽ đọc từ `settings.EMBEDDING_PROVIDER`).
  * `--batch-size`: Số lượng chunks xử lý trong mỗi lượt gọi API và commit database (mặc định: `50`, tối thiểu: `1`, tối đa: `200`).
  * `--only-zero`: Chỉ truy vấn và cập nhật các chunk có `embedding IS NULL` hoặc toàn bộ giá trị bằng `0.0`.
* **Hành vi Transaction & Batching**:
  * Đọc danh sách chunks theo thứ tự `Chunk.created_at.asc()`.
  * Thực hiện flush và commit theo từng batch để giải phóng bộ nhớ và tránh lock database kéo dài.
  * Xuất log tiến độ phần trăm (`Processed X/Y chunks (Z%)`).

### 4.4. Quy Tắc Không Gian Vector Bất Biến (Strict No-Mixing Rule)

> [!IMPORTANT]
> Tuyệt đối không lưu trữ vector từ các mô hình nhúng khác nhau trong cùng một tập dữ liệu `chunks`. Việc tính khoảng cách Cosine giữa một vector của OpenAI và một vector của Gemini là hoàn toàn vô nghĩa và sẽ làm hỏng kết quả tìm kiếm ngữ nghĩa.

Khi chuyển đổi `EMBEDDING_PROVIDER` trên môi trường có dữ liệu thực tế:
1. Quản trị viên cập nhật cấu hình `EMBEDDING_PROVIDER` mới.
2. Chạy lệnh `python -m app.scripts.reembed_chunks` (không có cờ `--only-zero`) để re-embed toàn bộ corpus sang không gian vector mới.

---

## 5. Đánh Giá Blast Radius & Kế Hoạch Phòng Vệ (Blast Radius & Defense)

1. **Phòng vệ Ingestion**: Lỗi embedding API không được phép rollback transaction lưu `Document`. Chunks sẽ được gán zero-vector để bảo toàn toàn vẹn dữ liệu tài liệu.
2. **Phòng vệ Retrieval**: Truy vấn tìm kiếm với zero-vector sẽ được Leg 2 bỏ qua tự động, toàn bộ kết quả trả về từ Full-Text Search giúp người dùng luôn nhận được phản hồi nhanh chóng.
3. **Phòng vệ Bảo Mật**:
   * Không bao giờ in API key ra console hay file log.
   * Sử dụng dependency injection an toàn trong FastAPI endpoints.

---

## 6. Tiêu Chuẩn Hoàn Thành (Definition of Done)

* [ ] Tất cả Unit tests cho `MockEmbeddingClient`, `OpenAIEmbeddingClient`, `GeminiEmbeddingClient`, và Factory đạt trạng thái **GREEN**.
* [ ] Kiểm tra cơ chế Retry và Fallback khi mock lỗi mạng hoặc thiếu API key hoạt động chính xác $100\%$.
* [ ] Integration tests xác minh `IngestionService` lưu trữ vector thực vào PostgreSQL/pgvector thành công qua Docker testcontainers.
* [ ] Integration tests xác minh `RetrievalService` ưu tiên kết quả có độ tương đồng ngữ nghĩa cao hơn qua RRF fusion.
* [ ] Script `reembed_chunks.py` chạy thành công ở cả 2 chế độ (`full` và `--only-zero`).
* [ ] Không có lỗi type check (`mypy`) hay linting (`ruff`).
