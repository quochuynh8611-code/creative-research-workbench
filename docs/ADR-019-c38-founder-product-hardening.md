---
title: "ADR-019 — Batch C38: Founder Product Hardening Architecture"
topic: "architecture-decision-record"
source_type: "adr"
language: "vi"
tags: ["adr", "c38", "product-hardening", "accessibility", "resilience", "tagging", "nine-windows", "ai-coach"]
status: "Proposed"
created: "2026-11-20"
---

# ADR-019 — Batch C38: Founder Product Hardening Architecture

## Status

Proposed (Chờ Founder phê duyệt qua Human Gate)

## Context

Sau khi hoàn tất Batch C37 (Founder Experience Validation & UX Hardening), toàn bộ các luồng sản phẩm cốt lõi đã được kiểm chứng trực tiếp trên local stack với AI Provider ở Mock mode. Qua quá trình sử dụng thực tế và đối soát kỹ thuật, hệ thống ghi nhận 5 hạng mục còn thiếu hoặc nợ chất lượng cần hoàn thiện trong Batch C38:

1. **C38-GAP-01 (Product Gap): Per-note tagging**:
   - Hiện tại, bảng `research_notes` và API `POST /api/v1/sessions/{id}/notes` chưa hỗ trợ gắn nhãn (tags) cho từng ghi chú riêng lẻ. Người dùng chỉ có thể phân loại theo `note_type` cố định (`insight`, `hypothesis`, `decision`, `question`, `action`) và `source_context`. Trong các phiên nghiên cứu chuyên sâu, Founder cần gắn các tag tùy biến (ví dụ: `#pin-lithium`, `#tản-nhiệt`, `#chi-phi`, `#an-toan`) để phân nhóm, tìm kiếm và xuất bản.
2. **C38-GAP-02 (Product Gap): AI Coach editable draft form**:
   - Trong `AICoachPanel`, khi bấm "Lưu thành Giải pháp" hoặc "Lưu vào Ghi chép", hệ thống chỉ mở một `ConfirmationModal` đơn giản và lập tức gửi trực tiếp nội dung gợi ý thô từ AI vào cơ sở dữ liệu khi xác nhận. Người dùng hoàn toàn không có cơ hội biên tập, tinh chỉnh tiêu đề, cơ chế giải pháp hay nội dung ghi chú trước khi lưu.
3. **C38-GAP-03 (Product Gap): Extended-lens save from 9-Windows**:
   - Trong Batch C35, 3 lăng kính mới (`systems_thinking`, `design_thinking`, `lean_startup`) đã được bổ sung vào Sơ đồ 9 Màn hình TRIZ (`triz_nine_windows.json`). Tuy nhiên, bộ xác thực `validateTriz9WindowsContext` ở frontend (`apps/web/lib/triz-9-windows-context-validator.ts`) và schema Pydantic `Triz9WindowsContext` ở backend (`backend/src/app/schemas/note_context.py`) vẫn bị giới hạn cứng ở 3 lăng kính gốc (`engineering`, `business`, `everyday`). Do đó, hành động bấm "Lưu vào sổ tay" từ bất kỳ ô nào thuộc 3 lăng kính mở rộng đều bị chặn lại bởi lỗi kiểm thực hợp đồng.
4. **C38-GAP-04 (QA Debt): Browser network failure simulation**:
   - Trong Batch C37, việc mô phỏng phục hồi lỗi mạng trình duyệt (Error Recovery simulation) đã được hoãn lại (DEFERRED) sang C38. Hiện tại, chưa có bộ kiểm thử tích hợp tự động nào mô phỏng tình huống ngắt kết nối mạng bất ngờ (`TypeError: Failed to fetch`, `NetworkError`, `offline`) để đảm bảo các biểu mẫu không làm mất bản nháp (draft preservation) và hiển thị thông báo lỗi thân thiện có khả năng thử lại (retry).
5. **C38-GAP-05 (Accessibility Polish): Form field accessibility improvements**:
   - Các biểu mẫu quan trọng trên giao diện (`IntakeForm`, `CandidateSolutions`, `ResearchNotebook`, `SessionList`) còn thiếu các thuộc tính hỗ trợ tiếp cận WCAG 2.1 AA như `id`/`htmlFor` đồng bộ, `aria-required`, `aria-invalid`, `aria-describedby` liên kết với thông báo lỗi, `aria-label` cho ô tìm kiếm và các chỉ báo focus rõ ràng bằng bàn phím.

---

## Decisions

### Decision 1: Lựa Chọn Di Chuyển Lược Đồ Tối Thiểu (Low Schema Mutation) Cho C38-GAP-01 (Per-Note Tagging)

- **Quyết định**: 
  - Thêm một cột nullable `tags` kiểu mảng chuỗi `ARRAY(String)` với giá trị mặc định là mảng rỗng `server_default='{}'` vào bảng `research_notes` qua Alembic migration `007_add_tags_to_research_notes.py`.
  - Cập nhật SQLAlchemy model `ResearchNote` trong `backend/src/app/domain/models.py`.
  - Mở rộng Pydantic schemas: `ResearchNoteCreate(tags: list[str] = [])` trong `backend/src/app/api/v1/endpoints/sessions.py`.
  - Chuẩn hóa tags ở backend: chuyển về chữ thường (`lower()`), loại bỏ khoảng trắng thừa (`strip()`), giới hạn độ dài mỗi tag $\le 50$ ký tự, tối đa 10 tags mỗi note, lọc trùng lặp giữ thứ tự.
  - Cập nhật các hàm export (`session_export_service.py`): thêm `tags` vào JSON snapshot và Markdown note rendering.
  - Frontend: thêm ô nhập tags (ngăn cách bởi dấu phẩy hoặc enter), hiển thị badge tags trên note card, và bổ sung bộ lọc theo tag trên thanh công cụ `ResearchNotebook`.
- **Lý do**:
  - `ARRAY(String)` là kiểu dữ liệu chuẩn của PostgreSQL, hoàn toàn nhất quán với cách thiết kế cột `tags` trong bảng `documents` (`Document.tags`).
  - Cột mới là nullable với default `{}`, tuyệt đối không làm gãy hoặc biến đổi bất kỳ ghi chú hiện có nào trong cơ sở dữ liệu.
  - Cho phép truy vấn và chỉ mục GIN trong tương lai nếu kho ghi chú phình to mà không cần cấu trúc lại bảng.
- **Phương án bị loại (Zero Migration via `source_context` hoặc `#hashtags`)**:
  - *Lưu trong `source_context`*: Bị loại vì `source_context` được thiết kế có cấu trúc ngặt nghèo (`extra="forbid"`) chỉ dành cho liên kết nguồn gốc học thuật (provenance linking). Ghi chú thủ công thường có `source_context=None`.
  - *Tự động bóc tách `#hashtag` từ text*: Bị loại vì làm hỏng định dạng văn bản tự nhiên của người dùng, dễ gây nhầm lẫn với cú pháp Markdown heading (`# Header 1`), và không cho phép chỉnh sửa tag độc lập.

### Decision 2: Thiết Kế Modal Biên Tập Bản Nháp (Editable Draft Form) Cho C38-GAP-02 Thay Vì Direct-Save

- **Quyết định**:
  - Thay thế cửa sổ xác nhận tĩnh hiện tại bằng một **Editable Draft Modal** trực tiếp trong `AICoachPanel` (hoặc tái sử dụng cơ chế controlled draft form):
    - Khi chọn **"Lưu thành Giải pháp"**: Hiển thị modal với 2 trường có thể chỉnh sửa: `Tiêu đề giải pháp` (`input`, required, prefill từ `suggestion.title` hoặc `actionable_payload.title`) và `Cơ chế thực hiện` (`textarea`, required, prefill từ `suggestion.description` hoặc `actionable_payload.mechanism`), kèm thông tin hiển thị chỉ đọc về căn cứ học thuật (`source_reference`) và nguyên tắc TRIZ gợi ý.
    - Khi chọn **"Lưu vào Ghi chép"**: Hiển thị modal với `Nội dung ghi chú` (`textarea`, required, prefill nội dung gợi ý) và `Loại ghi chú` (`select`: `insight`, `hypothesis`, `question`, `decision`, `action`, prefill thông minh theo category của suggestion). Nếu Lô 2 (Tagging) đã sẵn sàng, cho phép gắn tags ngay tại modal này.
  - Khi người dùng bấm "Lưu giải pháp" hoặc "Lưu ghi chép", form thực hiện validation tại chỗ (chặn rỗng/whitespace-only), sau đó gửi mutation và cập nhật query cache.
- **Lý do**:
  - Đảm bảo nguyên tắc cốt lõi **Human-in-the-Loop**: Trí tuệ nhân tạo chỉ đóng vai trò đồng hành gợi mở (Co-pilot), con người (Founder) mới là người quyết định nội dung chính xác được đưa vào tài sản tri thức của dự án.
  - Không phá vỡ API backend hiện có: Tận dụng trực tiếp 2 endpoints sẵn có `POST /api/v1/sessions/{id}/solutions` và `POST /api/v1/sessions/{id}/notes`.

### Decision 3: Đồng Bộ 6 Lăng Kính TRIZ 9-Windows Cho C38-GAP-03 (Zero DB Migration)

- **Quyết định**:
  - Mở rộng tập giá trị `lens` hợp lệ trong `backend/src/app/schemas/note_context.py` từ 3 lên 6 lăng kính:
    `Literal["engineering", "business", "everyday", "systems_thinking", "design_thinking", "lean_startup"]`.
  - Mở rộng tập giá trị `VALID_LENSES` trong `apps/web/lib/triz-9-windows-context-validator.ts` bao gồm đầy đủ 6 lăng kính.
  - Cập nhật kiểu `Triz9WindowsSourceContext.lens` trong `apps/web/lib/types.ts` để đồng bộ với `TrizNineWindowsLens`.
  - Cập nhật `NoteSourceBadge` (`apps/web/features/notebook/components/note-source-badge.tsx`) để hiển thị nhãn thân thiện cho cả 6 lăng kính: Kỹ thuật, Kinh doanh, Đời sống, Tư duy Hệ thống, Tư duy Thiết kế, Khởi nghiệp Tinh gọn.
- **Lý do**:
  - Toàn bộ dữ liệu `source_context` được lưu trữ dưới dạng `JSONB` trong PostgreSQL, do đó việc mở rộng tập giá trị hợp lệ ở tầng application schema hoàn toàn là **Zero Database Migration**.
  - Khôi phục tính nhất quán nghiệp vụ giữa tính năng Multi-Lens (Batch C35) và luồng trích xuất ghi chú vào Sổ tay nghiên cứu (Research Notebook).

### Decision 4: Xây Dựng Bộ Kiểm Thử Mô Phỏng Lỗi Mạng & Bảo Toàn Bản Nháp Cho C38-GAP-04

- **Quyết định**:
  - Viết suite kiểm thử tích hợp frontend chuyên trách: `apps/web/features/session/__tests__/c38-network-failure-simulation.test.tsx`.
  - Mô phỏng các kịch bản mạng thất bại:
    1. Khi gửi tạo session mới gặp lỗi mạng -> Form giữ nguyên tiêu đề, mô tả, hiển thị banner lỗi có `role="alert"`, không reset input.
    2. Khi gửi Problem Frame gặp lỗi mạng -> Nội dung "Muốn... Nhưng..." không bị xóa.
    3. Khi lưu Note trong Research Notebook gặp lỗi mạng -> Text trong textarea và loại ghi chú giữ nguyên vẹn, cho phép người dùng bấm "Thêm ghi chú" lại ngay khi mạng có trở lại.
    4. Khi lưu Candidate Solution gặp lỗi mạng -> Tiêu đề và cơ chế không bị xóa.
  - Rà soát và gia cố các handler trong các component tương ứng để đảm bảo **Không bao giờ gọi `clearDraft()` hoặc reset state trước khi API mutation trả về thành công**.
- **Lý do**:
  - Giải quyết triệt để món nợ chất lượng (QA Debt) hoãn từ C37.
  - Bảo vệ Founder trước sự cố mất mát dữ liệu do chập chờn mạng local/remote.

### Decision 5: Chuẩn Hóa Tiếp Cận Biểu Mẫu WCAG 2.1 AA Cho C38-GAP-05

- **Quyết định**:
  - Rà soát và bổ sung đồng bộ trên 4 biểu mẫu chính (`IntakeForm`, `CandidateSolutions`, `ResearchNotebook`, `SessionList`):
    - Đảm bảo 100% controls có nhãn tường minh kết nối qua `id` và `htmlFor` hoặc `aria-label` thích hợp.
    - Trường bắt buộc có thuộc tính `aria-required="true"` và dấu sao trực quan.
    - Khi có lỗi kiểm thực (validation error), thẻ input nhận thuộc tính `aria-invalid="true"` và `aria-describedby="[error-element-id]"`.
    - Phần tử thông báo lỗi có `id` tương ứng và `role="alert"`.
    - Các thanh trượt (range inputs cho điểm Novelty/Feasibility) có đầy đủ `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`.
    - Giữ gìn trạng thái focus visible sắc nét (`focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none`).
- **Lý do**:
  - Nâng tầm chất lượng sản phẩm chuẩn công nghiệp, thân thiện với công nghệ trợ năng (Screen Readers, bàn phím thuần túy).
  - Thay đổi thuần túy ở tầng markup HTML/JSX, blast radius bằng 0 đối với logic nghiệp vụ backend.

---

## Rollout Strategy & Phân Lô (4 Lô)

Để kiểm soát blast radius và tối ưu hóa thứ tự phụ thuộc, Batch C38 được phân bổ thành 4 lô thực hiện tuần tự:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Lô 1: Quality Foundation (C38-GAP-05 + C38-GAP-04)                     │
│ ➔ A11y Form Polish + Network Failure & Draft Resilience Tests          │
│ ➔ Blast Radius: Cực thấp. Client markup & integration tests.           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Lô 2: Notebook Tagging (C38-GAP-01)                                    │
│ ➔ Per-note tagging: DB migration 007, API contract, UI tags, export    │
│ ➔ Blast Radius: Thấp. Thêm cột nullable vào research_notes.            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Lô 3: Extended-Lens Save (C38-GAP-03)                                  │
│ ➔ Fix hợp đồng 9-Windows context cho 3 lăng kính mới                   │
│ ➔ Blast Radius: Cực thấp. Schema validation update, zero migration.   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Lô 4: AI Coach Editable Draft (C38-GAP-02)                             │
│ ➔ Thay thế direct-save bằng Editable Draft Modal/Form cho AI Coach     │
│ ➔ Blast Radius: Thấp. Component UI interaction, reuse existing APIs.   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Consequences

### Positive
- Khắc phục 100% các khoảng trống tính năng (Product Gaps) và nợ chất lượng (QA Debt) sau đợt kiểm thử thực tế của Founder ở C37.
- Founder có thể tổ chức ghi chú khoa học hơn bằng tag linh hoạt, dễ dàng tìm kiếm và phân loại.
- Không bao giờ bị mất bản nháp khi rớt mạng cục bộ.
- Trợ lý AI trở nên an toàn và thực sự hữu ích khi trao quyền duyệt và sửa đổi bản nháp cho người dùng trước khi ghi vào hệ thống.
- Cả 6 lăng kính TRIZ 9-Windows đều có thể lưu tri thức liền mạch vào Sổ tay nghiên cứu.
- Giao diện đạt chuẩn tiếp cận WCAG 2.1 AA.

### Negative / Trade-offs
- Lô 2 yêu cầu chạy 1 migration cơ sở dữ liệu (`007_add_tags_to_research_notes.py`). Tuy nhiên đây là thao tác thêm cột nullable với default rỗng nên an toàn tuyệt đối và rollback tức thì qua `downgrade()`.
- Giao diện AI Coach sẽ thêm 1 bước tương tác (modal biên tập) thay vì lưu tức thì chỉ với 1 click xác nhận. Đây là trade-off có chủ đích vì an toàn dữ liệu và chất lượng tri thức.

---

## Rollback Plan

1. **Lô 1, Lô 3, Lô 4**:
   - Thuần túy là thay đổi mã nguồn frontend và backend schema validation (không đổi DB).
   - Rollback bằng cách revert commit tương ứng trên git.
2. **Lô 2 (Database Migration)**:
   - Nếu phát sinh sự cố trong quá trình áp dụng migration 007:
     ```bash
     cd backend && alembic downgrade 006
     ```
   - Thao tác hạ cấp chỉ thực hiện `op.drop_column('research_notes', 'tags')`, trả lại nguyên vẹn trạng thái cơ sở dữ liệu của Batch C37 mà không ảnh hưởng tới các bảng khác.

---

## Acceptance Criteria

- [ ] Toàn bộ 4 lô được triển khai theo quy trình Test-First: có failing integration test spec trước khi viết code.
- [ ] Lô 1: Kiểm thử tiếp cận form đạt tiêu chuẩn WCAG 2.1 AA; suite `c38-network-failure-simulation.test.tsx` pass 100%, chứng minh không mất dữ liệu draft khi ngắt mạng.
- [ ] Lô 2: Migration 007 upgrade/downgrade trơn tru; API tạo note nhận `tags`, trả về `tags`; UI cho phép nhập và lọc theo tags; export Markdown/JSON có tags.
- [ ] Lô 3: Cả 6 lăng kính của 9-Windows đều lưu thành công vào Sổ tay nghiên cứu mà không gặp bất kỳ lỗi validation nào; `NoteSourceBadge` hiển thị đúng nhãn.
- [ ] Lô 4: AI Coach hiển thị form chỉnh sửa cho phép Founder sửa `title`, `mechanism` (Solution) hoặc `content`, `note_type` (Note) trước khi lưu; kiểm thử chặn rỗng hoạt động chính xác.
- [ ] Toàn bộ test suites backend và frontend (bao gồm 631 backend tests và 76 frontend suites hiện tại) giữ vững trạng thái GREEN 100%.
- [ ] Zero secret, zero new dependency, Mock mode AI được duy trì ổn định.
