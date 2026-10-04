---
title: "ADR-004 — Lựa chọn Kiến trúc Xử lý Tác vụ Nền Bất đồng bộ (Async Background Processing Strategy)"
topic: "architecture"
source_type: "decision-record"
language: "vi"
tags: ["adr", "async", "background-tasks", "jobs", "fastapi", "performance", "scalability"]
phase: "12.2"
status: "canonical"
golden: true
created: "2026-10-04"
---

# ADR-004 — Lựa chọn Kiến trúc Xử lý Tác vụ Nền Bất đồng bộ (Async Background Processing Strategy)

## 1. Bối cảnh (Context)

1. Trong hệ thống Creative Research Workbench, quy trình nạp tài liệu (`IngestionService`) và re-embedding tri thức (`reembed_chunks.py`) bao gồm nhiều thao tác tính toán nặng:
   - Phân tích cú pháp Markdown và bóc tách YAML frontmatter.
   - Băm nhỏ văn bản theo dung lượng token (`tiktoken cl100k_base`).
   - Gọi mạng đến External AI API (OpenAI `text-embedding-3-small` hoặc Gemini `text-embedding-004`) để tính toán vector 1536 chiều.
   - Lưu trữ Document và hàng chục/hàng trăm Chunks vào PostgreSQL.
2. Việc thực thi đồng bộ các tác vụ này trong luồng xử lý HTTP request chính (`POST /api/v1/documents/upload`) dẫn đến:
   - Thời gian phản hồi HTTP kéo dài (từ vài giây đến hàng chục giây).
   - Nguy cơ HTTP timeout (504 Gateway Timeout) ở reverse proxy / client.
   - Gây tắc nghẽn worker pool của Uvicorn, làm suy giảm khả năng phục vụ các API nhẹ khác (search, session CRUD).
3. Do đó, cần thiết lập một kiến trúc xử lý bất đồng bộ (Background Processing) để giải phóng luồng HTTP request ngay khi nhận dữ liệu và cho phép client theo dõi trạng thái tiến trình qua polling.

---

## 2. Quyết định Kiến trúc (Architectural Decision)

Chúng tôi quyết định áp dụng **Phương án A: FastAPI `BackgroundTasks` kết hợp Database-backed Job Store (`background_jobs` table)** làm nền tảng xử lý tác vụ nền cho hệ thống:

1. **Sử dụng Native FastAPI `BackgroundTasks`:**
   - Tận dụng cơ chế background task có sẵn của Starlette/FastAPI để kích hoạt worker function ngay sau khi HTTP response đã được gửi về client.
   - Không đưa thêm các thành phần hạ tầng phân tán mới vào hệ thống tại giai đoạn này.
2. **Quản trị Trạng thái qua Cơ sở Dữ liệu PostgreSQL (`background_jobs` table):**
   - Tạo bảng `background_jobs` trong PostgreSQL để ghi nhận đầy đủ vòng đời tác vụ: `pending -> running -> completed | failed`.
   - Lưu trữ metadata tiến độ (`progress_percentage`), thông điệp lỗi (`error_message`), và tóm tắt kết quả (`result_summary`).
3. **Kỷ luật Cách ly Kết nối (Session Isolation Discipline):**
   - Background worker function không sử dụng lại session của HTTP request (vốn sẽ bị đóng ngay sau khi response trả về).
   - Worker bắt buộc tự tạo SQLAlchemy session/connection mới từ Engine và thực hiện dọn dẹp (`close()`) trong khối `finally`.
4. **Hỗ trợ Chế độ Kép (Dual-mode Ingestion):**
   - Giữ nguyên endpoint `POST /api/v1/documents/upload` với query parameter `async: bool = False`.
   - Nếu `async=false` (mặc định): Chạy đồng bộ như cũ, bảo toàn tính tương thích ngược 100% cho các test suite hiện hữu.
   - Nếu `async=true`: Khởi tạo record trong `background_jobs`, nạp task vào `BackgroundTasks`, và phản hồi ngay mã HTTP 202 Accepted kèm `job_id`.

---

## 3. Các Phương án Đã Cân nhắc (Options Considered)

### Phương án A (Được chọn): FastAPI `BackgroundTasks` + DB Job Store
- **Ưu điểm:**
  - **Tối giản hạ tầng (Zero Infrastructure Overhead):** Không cần cài đặt thêm Redis, RabbitMQ hay Celery worker container. Giữ nguyên Docker Compose 3-tier hiện có (PostgreSQL, Backend, Frontend).
  - **Dễ dàng kiểm thử (High Testability):** Dễ dàng viết unit và integration tests trong môi trường pytest và testcontainers mà không cần mock message broker phức tạp.
  - **Độ phức tạp thấp:** Mã nguồn tinh gọn, trực quan, dễ bảo trì và mở rộng.
- **Đánh giá:** **Chấp thuận (Canonical Choice cho Phase 12.2).**

### Phương án B: Celery Worker + Redis Message Broker
- **Ưu điểm:**
  - Hỗ trợ phân tán tải ra nhiều server worker độc lập.
  - Hỗ trợ message persistence và advanced queue routing phức tạp.
- **Nhược điểm:**
  - **Tăng độ phức tạp hạ tầng:** Phải thêm ít nhất 2 service mới (Redis container, Celery worker container) vào `docker-compose.yml`, `Dockerfile`, và quy trình CI/CD.
  - **Chi phí vận hành & bảo trì cao:** Phải quản lý connection pooling của Redis, xử lý worker crash, dead-letter queues, và serialization issues.
  - **Quá mức cần thiết (Over-engineering):** Quy mô hiện tại của Research Workbench là ứng dụng studio cá nhân/nhóm nhỏ với lưu lượng vài chục đến hàng trăm tài liệu; Celery mang lại chi phí vận hành lớn hơn nhiều so với giá trị thực tế.
- **Đánh giá:** **Bị từ chối.**

---

## 4. Hệ quả & Đánh đổi (Consequences & Trade-offs)

### Tích cực:
1. **Trải nghiệm người dùng mượt mà:** Upload tài liệu phản hồi tức thì (`< 50ms`), loại bỏ hoàn toàn nguy cơ timeout.
2. **Khả năng quan sát tiến trình:** Client và UI có thể theo dõi chính xác trạng thái và tiến độ xử lý của từng tài liệu qua `GET /api/v1/jobs/{job_id}`.
3. **An toàn & Bền vững:** Không làm rò rỉ database connection nhờ quy tắc session isolation nghiêm ngặt. Lỗi trong task nền được ghi nhận rõ ràng mà không làm gián đoạn tiến trình API.

### Giới hạn & Chi phí (Tiêu cực / Rủi ro):
1. **Gắn liền vòng đời tiến trình (Process Lifecycle Coupling):** FastAPI `BackgroundTasks` gắn trực tiếp với vòng đời của tiến trình app server hiện tại. Nếu backend container / process bị restart hoặc crash giữa chừng, các job đang ở trạng thái `running` có thể bị gián đoạn và kẹt lại ở trạng thái dang dở mà không tự phục hồi.
2. **Giới hạn Scale-out đơn tiến trình:** Background task chạy trong cùng tiến trình với Uvicorn server, phù hợp với kiến trúc single-node / studio quy mô vừa và nhỏ, chưa hỗ trợ phân tán tải đa worker node.
3. **Cần cơ chế dọn dẹp định kỳ (Housekeeping):** Bảng `background_jobs` sẽ tích lũy bản ghi theo thời gian, cần cơ chế dọn dẹp job cũ trong tương lai.

---

## 5. Ranh giới & Những việc Hoãn lại (Scope Boundaries & Deferred Items)

- **Trong Phase 12.2:** Xây dựng cơ chế backend background processing dựa trên FastAPI `BackgroundTasks`, ORM model `BackgroundJob`, migration Alembic tạo bảng `background_jobs`, session isolation, và các REST API endpoints (`/upload?async=true`, `/jobs/{id}`).
- **Hoãn sang các Phase sau:**
  - **Reconciliation & Auto-recovery:** Việc quét, reconcile, retry hoặc resume các job dang dở sau khi process restart/crash chưa nằm trong phạm vi Phase 12.2 và sẽ được xem xét ở phase hardening tiếp theo.
  - **Frontend Integration:** Tích hợp Polling UI / Progress Indicator trên giao diện Next.js (chuyển sang sub-phase UI riêng).
  - **Housekeeping:** Background task định kỳ dọn dẹp các job cũ (Cron cleanup job).
  - **Bulk Re-embedding UI:** Re-embedding toàn bộ Knowledge Base qua background job UI.

---

## 6. Trạng thái Quyết định (Decision Status)

- **Trạng thái:** Canonical / Approved (Áp dụng từ Phase 12.2).
- **Phạm vi áp dụng:** Toàn bộ hệ thống Creative Research Workbench.
