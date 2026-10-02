# ADR-005: Chiến Lược Xuất Dữ Liệu & Tổng Hợp Báo Cáo AI (Phase 9A — Export & Synthesis)

> **Trạng thái:** PROPOSED (DRAFT — Pending Approval)
> **Ngày lập:** 2026-10-02
> **Người đề xuất:** Staff Software Engineer / Technical Architect
> **Căn cứ:** [ADR-001](docs/ADR-001-architecture.md), [PROFESSIONAL_UPGRADE_ROADMAP.md](docs/PROFESSIONAL_UPGRADE_ROADMAP.md) (Phase 9), [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md)

---

## 1. Bối cảnh (Context)

Sau khi hoàn thành 5 bước đầu tiên trong chu trình nghiên cứu TRIZ (`Intake → Structuring → Retrieval → Ideation → Evaluation`), người dùng cần một đầu ra hữu hình (tangible artifact) có thể chia sẻ, lưu trữ hoặc báo cáo cho các bên liên quan.

Hệ thống cần giải quyết 3 bài toán:
1. Xuất dữ liệu nguyên bản (Markdown & JSON) có đầy đủ thực thể giải pháp ứng viên (`CandidateSolution`).
2. Sinh báo cáo nghiên cứu chiến lược tự động thông qua AI (LLM) với độ tin cậy và cấu trúc chuẩn mực khoa học.
3. Bảo toàn tính toàn vẹn dữ liệu (Data Integrity) và quyền kiểm soát của người dùng (AI Trust Contract).

---

## 2. Các Quyết định Kiến trúc (Decisions)

### A. AI Research Report là Preview-Only & Zero Auto-Overwrite
- **Quyết định:** Endpoint `POST /api/v1/sessions/{id}/ai/generate-report` là pure computation/generation service, trả về kết quả preview cho người dùng trên frontend và **tuyệt đối không tự động ghi đè hoặc insert ngầm vào database**.
- **Lý do:**
  - Tuân thủ nguyên tắc **AI Trust Contract** đã thiết lập tại Phase 6.2: Người dùng phải là người kiểm duyệt và quyết định cuối cùng.
  - Ngăn ngừa ô nhiễm dữ liệu database (DB pollution) khi người dùng thử nghiệm tạo báo cáo nhiều lần với các provider/parameters khác nhau.

### B. Không Tạo Thêm Bảng Mới hoặc Chạy Migration (Zero-Migration Pattern)
- **Quyết định:** Không tạo bảng `research_reports` trong cơ sở dữ liệu.
- **Lý do:**
  - Báo cáo nghiên cứu là sự tổng hợp (synthesis view) được tính toán trên các thực thể đã lưu (`ResearchSession`, `ProblemFrame`, `Contradiction`, `ResearchNote`, `CandidateSolution`).
  - Nếu người dùng muốn lưu các trích đoạn từ báo cáo AI vào hệ thống, họ có thể dùng tính năng có sẵn: "Lưu vào Notebook" (`ResearchNote` với `note_type='insight'` hoặc `note_type='decision'`).

### C. Cấu trúc Hợp đồng Dữ liệu Export Markdown & JSON
- **Markdown Export:** Mở rộng `session_export_service.py` thêm mục `4. GIẢI PHÁP ĐỀ XUẤT (CANDIDATE SOLUTIONS)` bao gồm bảng phân loại điểm số (`Novelty`, `Feasibility`), cơ chế hoạt động và trạng thái (`accepted`, `candidate`, `rejected`).
- **JSON Snapshot Export:** Trả về JSON object phân cấp đầy đủ quan hệ của phiên nghiên cứu, phục vụ sao lưu hoặc di chuyển dữ liệu (data portability).
  - *Lưu ý quan trọng:* `recommended_methods` trong JSON export là dữ liệu derived/recomputed at export time từ `MethodRecommender`, không phải một bảng snapshot cố định độc lập trong DB.

### D. Graceful Fallback & Resiliency Cho AI Report Generator
- **Quyết định:** Khi gọi LLM thất bại (timeout > 15s, rate limit 429, API key không hợp lệ, hoặc trả về malformed format), `AIReportService` tự động chuyển sang chế độ **Deterministic Template-Based Synthesis Fallback** kết hợp dữ liệu có sẵn trong DB, trả về `provenance: "rule_based_fallback"` kèm lý do lỗi rõ ràng.

---

## 3. Các Phương Án Đã Bị Bác Bỏ (Rejected Alternatives)

1. **Bác bỏ tạo bảng `research_reports` và lưu cứng mỗi lần generate:**
   - *Lý do:* Gây phình to database, tăng độ phức tạp migration và blast radius không cần thiết.
2. **Bác bỏ dùng công cụ biên dịch PDF nhị phân phức tạp (như WeasyPrint / wkhtmltopdf) trên Backend:**
   - *Lý do:* Yêu cầu thêm thư viện C runtime hệ điều hành nặng nề trong Docker container; thay vào đó, Next.js CSS print styling (`window.print()`) và Markdown export đáp ứng hoàn hảo nhu cầu in ấn/PDF của người dùng.
3. **Bác bỏ tự động chuyển trạng thái FSM sang `completed` khi generate report:**
   - *Lý do:* FSM state transition phải là hành động chủ động của người dùng qua `POST /sessions/{id}/next-step`, không gắn chặt vào hành vi đọc/preview báo cáo.

---

## 4. Hậu Quả & Đánh Đổi (Consequences & Trade-offs)

- **Ưu điểm:**
  - Blast radius cực hẹp, zero migration risk.
  - Hoàn thiện toàn diện chu trình 6 bước TRIZ.
  - Output chuyên nghiệp, nhất quán, hỗ trợ cả con người đọc (Markdown) và máy đọc (JSON).
- **Đánh đổi:**
  - Nếu người dùng không tải file về máy, báo cáo AI tạm thời sẽ biến mất khi reload trang (đúng với triết lý ephemeral preview).
  - `recommended_methods` trong JSON export phụ thuộc vào thuật toán và ma trận của `MethodRecommender` tại thời điểm gọi export. Nếu ma trận TRIZ được nâng cấp trong tương lai, một session cũ khi export lại JSON có thể nhận được danh sách gợi ý cập nhật hơn so với thời điểm phiên được tạo ban đầu.
