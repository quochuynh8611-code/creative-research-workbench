# ⚠️ DEPRECATED — LEGACY SKELETON

> **LƯU Ý QUAN TRỌNG:** Thư mục `frontend/` này là **legacy skeleton** từ giai đoạn khởi tạo ban đầu của dự án và **KHÔNG PHẢI LÀ NGUỒN CHÂN LÝ (SOURCE OF TRUTH)**.

---

### 1. Nguồn chân lý của Frontend (Canonical Frontend Source of Truth)
Toàn bộ mã nguồn ứng dụng web Next.js 14, UI components, state management (TanStack Query), các tính năng Problem Canvas, TRIZ Workflow Stepper, Evidence Panel, Search Overlay (Cmd+K) và bộ test suite toàn diện hiện tại nằm ở:

👉 **[`/apps/web/`](../apps/web/)**

---

### 2. Quy tắc phát triển
- **KHÔNG** tiếp tục phát triển tính năng, sửa đổi UI components hoặc styling trong `frontend/`.
- Mọi kiểm thử Jest, type-check TypeScript, ESLint và Next.js dev server đều thực hiện tại `/apps/web/`.
- Thư mục này được giữ lại tạm thời phục vụ đối chiếu lịch sử (quarantine mode) và sẽ được dọn dẹp theo quy trình.
