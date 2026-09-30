# ⚠️ DEPRECATED — LEGACY SKELETON

> **LƯU Ý QUAN TRỌNG:** Thư mục `apps/api/` này là **legacy skeleton** từ giai đoạn khởi tạo ban đầu của dự án và **KHÔNG PHẢI LÀ NGUỒN CHÂN LÝ (SOURCE OF TRUTH)**.

---

### 1. Nguồn chân lý của Backend (Canonical Backend Source of Truth)
Toàn bộ mã nguồn backend, domain models, services (Ingestion, Hybrid Retrieval, Problem Structuring, Method Recommender, Workflow Engine) và REST API endpoints hiện tại nằm ở:

👉 **[`/backend/`](../../backend/)**

---

### 2. Quy tắc phát triển
- **KHÔNG** tiếp tục phát triển tính năng, sửa đổi business logic hoặc tạo routes mới trong `apps/api/`.
- Mọi kiểm thử unit/integration backend, database migrations và Docker runtime đều sử dụng thư mục `/backend/`.
- Thư mục này được giữ lại tạm thời phục vụ đối chiếu lịch sử (quarantine mode) và sẽ được dọn dẹp theo quy trình.
