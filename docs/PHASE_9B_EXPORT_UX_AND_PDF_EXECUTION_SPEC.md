# 📋 Phase 9B — Export UX Hardening & Safe PDF Strategy Execution Specification

> **Phiên bản:** 1.0.0
> **Trạng thái:** DRAFT — Chờ phê duyệt
> **Ngày lập:** 2026-10-02
> **Tác giả:** Staff Software Engineer / Technical Architect
> **Căn cứ:** [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), [PROFESSIONAL_UPGRADE_ROADMAP.md](docs/PROFESSIONAL_UPGRADE_ROADMAP.md) (Phase 9), [ADR-005](docs/ADR/ADR-005-phase-9a-export-and-synthesis.md), [ADR-006](docs/ADR/ADR-006-phase-9b-export-ux-and-pdf-strategy.md)

---

## 1. Bối cảnh & Mục tiêu Kỹ thuật

Phase 9A đã tạo nền móng vững chắc cho việc xuất dữ liệu phiên (Markdown có Candidate Solutions, JSON Snapshot) và sinh Báo cáo AI Synthesis (với deterministic fallback).

Mục tiêu của **Phase 9B** là hoàn thiện trải nghiệm xuất dữ liệu (Export UX Hardening) và chuẩn hóa luồng xuất PDF (PDF Strategy):
1. **Unified Export Picker UX:** Thay thế các nút xuất rải rác ở Session Header bằng một menu chọn định dạng chuẩn hóa:
   - 📄 **Tải Markdown (.md)**: Kích hoạt `exportSessionMarkdown()`.
   - 📊 **Tải JSON Snapshot (.json)**: Kích hoạt `exportSessionJson()`.
   - 📑 **In / Lưu PDF (.pdf)**: Kích hoạt `window.print()` với print layout đã tinh chỉnh.
2. **Tối ưu hóa Print Stylesheet (@media print):**
   - Đảm bảo khi in hoặc lưu PDF từ trình duyệt:
     - Ẩn toàn bộ thanh điều hướng, nút bấm, header controls (`.no-print`).
     - Tối ưu ngắt trang (`break-inside: avoid`, `@page { margin: 15mm; }`).
     - Nền trắng tinh gọn, tương phản cao, text rõ ràng cho máy in/PDF viewer.
3. **Backend Contract Hardening:**
   - Cung cấp hướng dẫn rõ ràng trong response `HTTP 400` khi gọi `GET /api/v1/sessions/{id}/export?format=pdf` để API consumers biết PDF được hỗ trợ tối ưu qua client-side browser workflow.
   - Bảo toàn 100% contract cho `format=md`, `format=markdown`, `format=json`.

---

## 2. Phạm vi Thực hiện (In-Scope & Non-Goals)

### A. In-Scope
1. Component / UX Export Dropdown Picker trong Session Detail Header.
2. Xử lý xuất file JSON trực tiếp từ UI (`exportSessionJson` -> download file `session_{id}.json`).
3. Tối ưu CSS Print layout trong Session Detail Canvas và Synthesis View.
4. Unit test & integration test cho frontend export picker và backend contract.
5. Cập nhật tài liệu kỹ thuật và spec.

### B. Non-Goals
- Không cài đặt thêm thư viện binary C (như Cairo, Pango, WeasyPrint) vào Backend runtime.
- Không đụng chạm đến `Session Import & Templates` (thuộc Phase 9.3 riêng).
- Không sửa `apps/web/app/layout.tsx`.
- Không tạo migration hay bảng DB mới.

---

## 3. Thiết kế Hợp đồng & UX Flow

### A. Frontend Export Format Picker
- Nút bấm chính: `[Xuất dữ liệu / Export ▾]`
- Dropdown menu options:
  1. **Markdown (.md)** — Kèm icon Download, gọi API `exportSessionMarkdown(sessionId)` và tải file `session_{sessionId}.md`.
  2. **JSON Snapshot (.json)** — Kèm icon FileJson, gọi API `exportSessionJson(sessionId)` và tải file `session_{sessionId}.json`.
  3. **In / Lưu PDF (.pdf)** — Kèm icon Printer, gọi `window.print()`.
- Trạng thái:
  - Hiển thị loading spinner (`Đang xuất...`) khi API export đang thực thi.
  - Vô hiệu hóa controls tương ứng khi đang tải.
  - Hiển thị thông báo lỗi nếu tải file thất bại mà không làm chuyển đổi active tab.

### B. Backend API Contract
- `GET /api/v1/sessions/{session_id}/export?format=markdown|md|json` (đã hoạt động ổn định ở 9A).
- `GET /api/v1/sessions/{session_id}/export?format=pdf` -> Trả về `400 Bad Request` với message mô tả chi tiết: `"Unsupported export format 'pdf'. PDF export is supported via client-side printing or browser rendering. Supported API formats: md, markdown, json"`

---

## 4. Phân tích Rủi ro & Blast Radius

| Vùng ảnh hưởng | Mức độ | Biện pháp kiểm soát |
|---|---|---|
| `session-detail.tsx` | Cực thấp | Tái cấu trúc cụm nút export thành dropdown menu; không ảnh hưởng các tab logic khác. |
| `sessions.py` | Không đổi / Cực thấp | Giữ nguyên error handling và logic export hiện hữu. |
| DB / State | 0 (Zero) | Không mutation, không thay đổi workflow_state. |
