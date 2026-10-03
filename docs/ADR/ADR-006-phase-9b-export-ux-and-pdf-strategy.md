# ADR-006: Chiến Lược Xuất PDF & Hoàn Thiện UX Xuất Dữ Liệu (Phase 9B — Export UX Hardening & PDF Strategy)

> **Trạng thái:** PROPOSED (DRAFT — Pending Approval)
> **Ngày lập:** 2026-10-02
> **Người đề xuất:** Staff Software Engineer / Technical Architect
> **Căn cứ:** [ADR-001](docs/ADR-001-architecture.md), [ADR-005](docs/ADR/ADR-005-phase-9a-export-and-synthesis.md), [PROFESSIONAL_UPGRADE_ROADMAP.md](docs/PROFESSIONAL_UPGRADE_ROADMAP.md) (Phase 9), [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md)

---

## 1. Bối cảnh (Context)

Sau khi hoàn thành Phase 9A (commit `92ee808`), hệ thống Creative Research Workbench đã cung cấp:
- Backend: Xuất Markdown có đầy đủ Candidate Solutions, xuất snapshot JSON, và service sinh Báo cáo Nghiên cứu AI (kèm fallback deterministic).
- Frontend: Tab Synthesis trong Session Detail, nút xuất Markdown và nút in/lưu PDF qua `window.print()`.

Tuy nhiên, theo mục tiêu hoàn thiện Phase 9 (Export & Sharing):
1. **UX Xuất dữ liệu còn phân mảnh:** Nút "Xuất Markdown" và "In / Lưu PDF" hiện đang nằm riêng rẽ ở header, chưa có bộ chọn định dạng thống nhất (Format Picker / Export Dropdown) hỗ trợ đầy đủ 3 định dạng: **Markdown (.md)**, **JSON Snapshot (.json)** và **Tài liệu PDF (.pdf)**.
2. **Xác định chiến lược Render PDF:** Cần chốt rõ ranh giới kiến trúc giữa việc sinh file nhị phân PDF trên Backend (Server-Side PDF Rendering) so với việc tối ưu hóa luồng Print-to-PDF / CSS Paged Media trên Frontend.

---

## 2. Phân Tích Các Lựa Chọn Kiến Trúc (Options Analysis)

### Option A: Server-Side Binary PDF Generation (Backend)
- **Cơ chế:** Cài đặt thư viện Python như `weasyprint`, `playwright` (headless Chromium) hoặc `reportlab` trên FastAPI backend để compile Markdown/HTML thành file `session_{id}.pdf` nhị phân.
- **Ưu điểm:** Cung cấp file `.pdf` tải trực tiếp qua HTTP download link hoặc API curl.
- **Nhược điểm & Rủi ro (Blast Radius rất cao):**
  - `weasyprint` yêu cầu các dependency thư viện C cấp hệ điều hành (`libpango-1.0`, `libcairo2`, `libgdk-pixbuf`) -> làm vỡ tính di động của Docker container và môi trường local macOS/Linux nếu thiếu C dylibs.
  - `playwright`/`puppeteer` kéo theo dung lượng image tăng thêm 300MB-500MB và tiêu tốn CPU/RAM lớn trong runtime.
  - Phức tạp hóa việc render font tiếng Việt và đồng bộ CSS theme giữa Frontend và Backend.
  - Khả năng rollback phức tạp nếu dependency C bị lỗi runtime trên production.

### Option B: Pure Client-Side PDF Generation (Frontend)
- **Cơ chế:** Dùng `@react-pdf/renderer` hoặc `jspdf` + `html2canvas` hoàn toàn ở phía client.
- **Ưu điểm:** Không thêm dependency cho backend.
- **Nhược điểm:** `@react-pdf/renderer` yêu cầu viết lại toàn bộ cây component bằng các thẻ riêng (`<Document>`, `<Page>`, `<View>`), không tận dụng được Tailwind/CSS hiện có; `html2canvas` tạo PDF dạng ảnh chụp bitmap khiến văn bản bị nhòe, không chọn/copy text được và file rất nặng.

### Option C: Hybrid / Staged Rollout Strategy (Khuyến nghị cho Phase 9B)
- **Cơ chế:**
  1. **Phase 9B (Export UX Hardening & Safe PDF Path):**
     - Xây dựng **Unified Export Dropdown Picker** tại Session Header hỗ trợ 3 tùy chọn rõ ràng:
       - 📄 **Markdown (`.md`)**: Tải về tài liệu Markdown chuẩn TRIZ (tích hợp Candidate Solutions).
       - 📊 **JSON Snapshot (`.json`)**: Tải về toàn bộ cấu trúc phiên nghiên cứu để backup/chia sẻ.
       - 📑 **In / Lưu PDF (`.pdf`)**: Kích hoạt trình in hệ điều hành (`window.print()`) được tối ưu hóa bằng CSS `@media print` chuyên biệt (loại bỏ controls thừa, tối ưu ngắt trang `@page`, bố cục chuẩn A4/Letter, bảo toàn độ sắc nét vector của font chữ).
     - **Backend Contract:** `GET /api/v1/sessions/{id}/export?format=pdf` trả về thông báo hướng dẫn hoặc HTTP 400 rõ ràng: *"Định dạng PDF nhị phân server-side được lên kế hoạch trong sub-phase tiếp theo. Vui lòng sử dụng tính năng in trực tiếp ra PDF trên giao diện Workbench."*
  2. **Phase 9C (Server-Side PDF Binary Renderer - Nếu cần):** Nghiên cứu giải pháp renderer nhẹ (như lightweight headless CLI) mà không làm tăng blast radius của backend.

---

## 3. Quyết Định Kiến Trúc (Decisions)

1. **Áp dụng Option C cho Phase 9B:**
   - Hoàn thiện trải nghiệm người dùng với **Export Format Picker** tích hợp tại Session Header.
   - Tối ưu hóa toàn diện CSS Paged Media `@media print` cho trang Session Detail và Báo cáo Tổng hợp AI.
   - Giữ Backend API an toàn tuyệt đối, zero dependency C mới, zero container bloat.
2. **Bảo Toàn Tương Thích Ngược:**
   - Các hàm API client và endpoints cho `markdown` và `json` giữ nguyên contract đã ổn định ở Phase 9A.
3. **Tuân Thủ AI Trust Contract:**
   - Mọi thao tác export là pure read-only, không làm thay đổi trạng thái phiên (`workflow_state`) và không tạo bản ghi mới trong DB.

---

## 4. Hậu Quả & Đánh Đổi (Consequences & Trade-offs)

- **Ưu điểm:**
  - **Blast Radius = 0 đối với Backend infrastructure:** Không cần cài đặt thư viện hệ thống hay sửa Dockerfile.
  - **Chất lượng hiển thị PDF vượt trội:** Tận dụng trực tiếp engine render của trình duyệt hiện đại (Chrome/Safari/Firefox), giữ đúng typographic tokens, font chữ tiếng Việt sắc nét và màu sắc chuẩn.
  - **Trải nghiệm người dùng đồng nhất:** Người dùng có một menu xuất dữ liệu trực quan, dễ hiểu.
- **Đánh đổi:**
  - Để lưu file PDF, người dùng nhấn "Lưu dưới dạng PDF" trong hộp thoại in của trình duyệt thay vì tải trực tiếp qua link HTTP 1-click từ backend.
