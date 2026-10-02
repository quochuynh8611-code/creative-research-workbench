# 📋 Phase 9A — Export, Sharing & AI Research Report Generator Execution Specification

> **Phiên bản:** 1.0.0
> **Trạng thái:** DRAFT — Chờ phê duyệt
> **Ngày lập:** 2026-10-02
> **Tác giả:** Staff Software Engineer / Technical Architect
> **Căn cứ:** [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), [PROFESSIONAL_UPGRADE_ROADMAP.md](docs/PROFESSIONAL_UPGRADE_ROADMAP.md) (Phase 9), [ADR-001](docs/ADR-001-architecture.md), [ADR-005](docs/ADR/ADR-005-phase-9a-export-and-synthesis.md)

---

## 1. Vấn đề & Bối cảnh Kỹ thuật (Problem Statement)

Creative Research Workbench đã hoàn thiện các giai đoạn từ **Intake → Structuring → Retrieval → Ideation → Evaluation** (qua các Phase 5.x, 6.x, 7.x và 8). Tuy nhiên:
1. **Khoảng trống Export:** `session_export_service.py` (tạo từ commit sơ khai `bc9b1f3`) chỉ xuất Problem Frame, TRIZ Principles và Research Notes. Toàn bộ thực thể **Candidate Solutions (Phase 7.4)** với điểm Novelty/Feasibility và trạng thái (`accepted`/`candidate`/`rejected`) bị bỏ sót trong tài liệu Markdown xuất ra.
2. **Thiếu định dạng dữ liệu có cấu trúc (JSON Snapshot):** Chưa hỗ trợ trích xuất toàn bộ dữ liệu phiên nghiên cứu dưới dạng JSON để sao lưu hoặc tích hợp với các công cụ bên ngoài.
3. **Khoảng trống giai đoạn Synthesis (Tổng hợp tri thức bằng AI):** Giai đoạn 6 của FSM (`synthesis`) chưa có công cụ để tổng hợp toàn bộ các phát hiện, bằng chứng và giải pháp thành một **Báo cáo Nghiên cứu Khoa học (Executive Research Report)** có tính thuyết phục cao.

---

## 2. Mục tiêu (Goals) & Phạm vi Không thực hiện (Non-Goals)

### A. Mục tiêu (Goals)
1. **Hoàn thiện Markdown Export:** Bổ sung mục `4. GIẢI PHÁP ĐỀ XUẤT (CANDIDATE SOLUTIONS)` vào tài liệu GFM Markdown xuất ra từ `GET /api/v1/sessions/{id}/export?format=markdown` (hoặc `format=md`), hiển thị chi tiết tiêu đề, cơ chế, điểm số, rủi ro và trạng thái.
2. **Bổ sung JSON Export Snapshot:** Hỗ trợ `GET /api/v1/sessions/{id}/export?format=json` trả về snapshot JSON đầy đủ bao gồm session, problem_frame, contradictions, recommended_methods, research_notes, và candidate_solutions.
3. **AI Research Report Generator (Synthesis Service & API):**
   - Xây dựng `AIReportService` kết hợp với `LLMClient` (OpenAI / Gemini / Mock) để tạo báo cáo tổng hợp chuyên nghiệp (Executive Summary, TRIZ Problem Statement, Evidence Synthesis, Solution Evaluation, Action Plan).
   - Cung cấp endpoint `POST /api/v1/sessions/{id}/ai/generate-report`.
   - **Tuân thủ triệt để AI Trust Contract:** Preview-only, zero auto-overwrite vào database, trả về metadata provenance (`ai_synthesis` hoặc `rule_based_fallback`), model, latency_ms và prompt_version.
   - **Graceful Fallback:** Tự động fallback sang cấu trúc tổng hợp template-based deterministic khi LLM timeout, quota 429 hoặc ném exception.
4. **Giao diện Synthesis UI trong Canvas:**
   - Thêm tab `Tổng hợp & Báo cáo (Synthesis)` trong Session Detail Canvas cho phép người dùng kích hoạt AI tạo báo cáo, xem trước Markdown, sao chép hoặc tải về file `.md`.

### B. Phạm vi Không thực hiện (Non-Goals)
- Không thêm bảng database mới hoặc chạy Alembic migration (dùng pure service generation & preview-only pattern).
- Không sửa `apps/web/app/layout.tsx` (Global navigation bar được dời sang phase riêng).
- Không triển khai Evidence-to-Knowledge bridge.
- Không xây dựng PDF binary compiler (ví dụ `weasyprint`) phức tạp trên backend; tiếp tục duy trì browser print / frontend export an toàn.
- Không hỗ trợ import/session template injection ở sub-phase này.

---

## 3. Kiến trúc & Thiết kế Hợp đồng Dữ liệu (Data & API Contracts)

### A. Backend Endpoints Contract

#### 1. Export Session (`GET /api/v1/sessions/{session_id}/export`)
- **Query Params:** `format: Literal["markdown", "md", "json"] = "markdown"`
- **Response Format:**
  - `format="markdown" | "md"`: `Response(content=md_text, media_type="text/markdown; charset=utf-8", headers={"Content-Disposition": "attachment; filename=..."})`
  - `format="json"`: `Response(content=json_text, media_type="application/json; charset=utf-8")`
- **Lưu ý về JSON Snapshot:**
  - Khối `session`, `problem_frame`, `research_notes`, và `candidate_solutions` là các thực thể được persisted trong DB.
  - Khối `recommended_methods` là dữ liệu **derived / recomputed at export time** thông qua `MethodRecommender(bind=db).recommend_methods(session_id)`. Đây không phải là một snapshot cố định lưu riêng trong DB; nếu cấu hình ma trận TRIZ cập nhật thì kết quả export JSON có thể thay đổi theo thời điểm export.
- **Error Codes:**
  - `404 Not Found`: Session không tồn tại.
  - `400 Bad Request`: Format không hợp lệ (ngoài md, markdown, json).

#### 2. AI Research Report Generation (`POST /api/v1/sessions/{session_id}/ai/generate-report`)
- **Response Schema:**
```json
{
  "data": {
    "session_id": "uuid-string",
    "report_title": "Báo cáo Nghiên cứu Chiến lược: ...",
    "executive_summary": "Tóm tắt ngắn gọn bài toán, mâu thuẫn và giải pháp được chọn...",
    "problem_background": "Phân tích phát biểu gốc và mâu thuẫn TRIZ...",
    "evidence_synthesis": "Tổng hợp các trích dẫn và phát hiện từ tri thức...",
    "solution_assessment": "Đánh giá các phương án giải pháp ứng viên...",
    "action_plan": [
      "Bước 1: ...",
      "Bước 2: ..."
    ],
    "markdown_content": "# BÁO CÁO NGHIÊN CỨU CHIẾN LƯỢC...\n\n...",
    "provenance": "ai_synthesis",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "prompt_version": "2026-10-02.v1",
    "latency_ms": 1250.5,
    "fallback_reason": null
  }
}
```

---

## 4. Phân tích Rủi ro & Blast Radius

| Thành phần | Mức độ ảnh hưởng | Biện pháp phòng vệ |
|---|---|---|
| `session_export_service.py` | Cực thấp | Chỉ append thêm section 4 (Candidate Solutions) và hàm `export_session_as_json` |
| `sessions.py` | Cực thấp | Mở rộng param check `format` và thêm route `POST /ai/generate-report` |
| `LLMClient` & `AIAnalysisService` | Không ảnh hưởng | Tái sử dụng `LLMClient` polymorphic factory đã ổn định từ Phase 6.2 |
| Frontend API Client & Types | Cực thấp | Thêm function `generateAIResearchReport`, `exportSessionJson` và TypeScript types |
| Frontend Canvas UI | Thấp | Tích hợp tab Synthesis độc lập trong `session-detail.tsx` |

---

## 5. Tiêu chí Chấp thuận (Acceptance Criteria)

1. `GET /api/v1/sessions/{id}/export?format=markdown` trả về file Markdown đầy đủ 4 phần (Problem Frame, TRIZ Principles, Research Notes, Candidate Solutions).
2. `GET /api/v1/sessions/{id}/export?format=json` trả về JSON snapshot hợp lệ, chứa đầy đủ quan hệ của session.
3. `POST /api/v1/sessions/{id}/ai/generate-report` trả về bản báo cáo hoàn chỉnh, có fallback rõ ràng khi LLM gặp sự cố mà không làm crash ứng dụng hoặc thay đổi DB.
4. **FSM State Invariance:** AI Report generation (`POST /api/v1/sessions/{id}/ai/generate-report`) tuyệt đối không được tự động thay đổi `workflow_state` của session hoặc tự ý chuyển FSM state.
5. Toàn bộ test suite backend và frontend đạt 100% PASS mà không có type-check error hay lint warning.
