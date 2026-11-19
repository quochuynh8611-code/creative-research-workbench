# ADR-017: Research Synthesis, Provenance & Export Completeness Architecture

## Status
Proposed (Chờ Founder phê duyệt)

## Date
2026-11-19

## Context
Sau khi hoàn tất Batch C31 (AI Solution Coach), Batch C34 (Advanced TRIZ Toolkit: ARIZ 6 bước, Evolution Patterns 8 quy luật, Resource Taxonomy 5 nhóm), và Batch C35 (Domains, 6 Lenses, 3 Workflow Profiles), sản phẩm Creative Research Workbench đã sở hữu năng lực phân tích đa tầng chuyên sâu.

Tuy nhiên, khâu kết xuất tri thức (Export Markdown & JSON, AI Report Synthesis) hiện tại gặp phải các khoảng cách kỹ thuật:
1. **Mất nhãn nguồn tri thức khi xuất bản (Broken Provenance)**: Hàm định dạng ngữ cảnh nguồn `source_context` trong `session_export_service.py` chỉ nhận diện các nguồn từ Phase 9. Các ghi chú được tạo từ ARIZ, Evolution, Resource, và AI Coach bị rơi vào nhánh rỗng, làm mất dấu vết học thuật trong file Markdown xuất bản.
2. **Thiếu trường dữ liệu trong bản snapshot (Incomplete JSON Snapshot)**: Hàm `export_session_as_json` bỏ sót `domain` và `tags` trong `session_payload`, gây suy hao dữ liệu khi sao lưu hoặc khôi phục phiên nghiên cứu.
3. **Thiếu nhãn hiển thị và tùy chọn tạo phiên trên Frontend**: `DOMAIN_LABELS` trong `utils.ts` thiếu nhãn tiếng Việt cho `healthcare` và `sustainability`, và dropdown `DOMAIN_OPTIONS` trong form tạo phiên thủ công chỉ có 4 domain cũ.
4. **Mất trạng thái lựa chọn Workflow Profile**: Component `WorkflowProfileGuidance` không lưu trữ bền vững profile được chọn, dẫn đến việc bị reset về `standard_triz` mỗi khi người dùng tải lại trang.

---

## Decisions

### Decision 1: Bổ Sung Domain & Tags Vào Export Serialization Mà Không Đổi DB Schema (Zero DB Migration)
- **Quyết định**: Bổ sung `session.domain` và `session.tags` vào `session_payload` trong `export_session_as_json`, và bổ sung `domain: "{session.domain}"` vào YAML frontmatter cũng như phần tổng quan của `export_session_as_markdown`.
- **Lý do**: Cả hai cột `domain` và `tags` đã tồn tại trong schema cơ sở dữ liệu từ các migration trước. Việc bổ sung này thuần túy ở tầng serialization/formatting, tuyệt đối không đòi hỏi migration cơ sở dữ liệu mới.
- **Phương án bị loại**: Lưu trữ snapshot export vào một bảng riêng trong PostgreSQL. Bị loại vì tăng độ phức tạp lưu trữ không cần thiết và vi phạm nguyên tắc stateless export.

### Decision 2: Mở Rộng Bộ Phân Giải Provenance Cho 4 Nguồn Mới Với Cơ Chế Defensive Escaping
- **Quyết định**: Mở rộng `session_export_service.py` để hỗ trợ format chuỗi nguồn chuẩn hóa cho:
  - `triz_ariz`: `| Nguồn: Thuật giải ARIZ [Bước {step_id}: {step_title}]`
  - `triz_evolution`: `| Nguồn: Quy luật Tiến hóa [{pattern_name}]`
  - `triz_resource`: `| Nguồn: Ma trận Tài nguyên [{resource_group}]`
  - `ai_coach`: `| Nguồn: AI Solution Coach [{suggestion_type}]`
  - Tất cả các trường dữ liệu động lấy từ `source_context` bắt buộc phải đi qua hàm `escape_markdown_inline` trước khi chèn vào tài liệu Markdown.
- **Lý do**: Đảm bảo 100% tính truy nguyên tri thức, đồng thời phòng vệ triệt để trước rủi ro Markdown injection hoặc vỡ định dạng bảng.

### Decision 3: Phân Định Ranh Giới Nghiêm Ngặt Giữa 3 PRs (Không Trộn Lẫn Phạm Vi)
- **Quyết định**:
  - **PR 1**: `backend-only` — Tập trung toàn bộ vào logic serialization, export format, sanitize dữ liệu, và AI report context.
  - **PR 2**: `frontend-only` — Tập trung vào đúng 3 thay đổi UI (nhãn `DOMAIN_LABELS`, dropdown `DOMAIN_OPTIONS`, và `localStorage` persistence cho Workflow Profile).
  - **PR 3**: `tests + docs only` — Tập trung vào integration tests E2E roundtrip export và tài liệu kỹ thuật, zero production runtime change.
- **Lý do & Chấp nhận có chủ đích**: Đảm bảo blast radius của từng PR được kiểm soát hoàn toàn độc lập, dễ dàng review, giảm thiểu rủi ro merge conflict và cô lập lỗi tức thì nếu có hồi quy (regression).

### Decision 4: Giới Hạn PR 2 Ở Đúng 3 Thay Đổi UI (Loại Bỏ Badge Provenance Khỏi PR 2)
- **Quyết định**: PR 2 là **frontend-only**, tuyệt đối không thay đổi behavior production ngoài 3 thay đổi UI:
  1. Thêm nhãn tiếng Việt cho `healthcare` và `sustainability` vào `DOMAIN_LABELS`.
  2. Mở rộng `DOMAIN_OPTIONS` trong form tạo session thủ công thêm đúng 3 domain (`healthcare`, `education`, `sustainability`).
  3. Bổ sung `localStorage` persistence cho `WorkflowProfileGuidance`.
  - **Tuyệt đối KHÔNG thêm badge provenance trong PR 2**.
- **Lý do**: Giữ cho PR 2 có kích thước nhỏ gọn, không can thiệp sâu vào các components danh sách ghi chú phức tạp (`research-notebook.tsx`, `session-detail.tsx`), tránh làm chậm tiến độ và giảm rủi ro hồi quy UI.

### Decision 5: Giới Hạn PR 3 Ở E2E Export Roundtrip Verification (Zero Testcontainers)
- **Quyết định**: PR 3 chỉ bao gồm:
  1. Backend integration test: `test_c36_export_synthesis_integration.py` kiểm chứng xuất Markdown/JSON đầy đủ provenance và kiểm tra tính lũy đẳng roundtrip (`export -> import`).
  2. Frontend integration test: `c36-export-roundtrip-integration.test.tsx` kiểm chứng trigger download blob ở tầng client mock.
  3. Cập nhật tài liệu `DEPLOYMENT_GUIDE.md`, `IMPLEMENTATION_ROADMAP.md` và nghiệm thu ADR-017.
  - **Tuyệt đối KHÔNG thêm badge UI trong PR 3** (chỉ xem xét sau nếu còn dư thời gian và được Founder duyệt riêng).
- **Lý do**: Khép kín vòng đời kiểm chứng tự động mà không phụ thuộc hạ tầng Docker ngoài (Zero Testcontainers), bảo đảm thời gian thực thi test dưới 2 giây.

### Decision 6: Bền Vững Hóa Lựa Chọn Workflow Profile Qua LocalStorage Có Namespace & Versioning
- **Quyết định**: Lưu trữ lựa chọn profile của người dùng trên trình duyệt qua `localStorage` với key có namespace rõ ràng và versioning: `crw:session:${sessionId}:workflow-profile:v1` (thay vì key unversioned), bọc trong khối `try/catch` an toàn. Nếu `sessionId` không được cung cấp, fallback về key `crw:session:default:workflow-profile:v1`.
- **Lý do**: Tránh xung đột khóa trong tương lai, dễ dàng thực hiện migrate dữ liệu nếu schema cấu hình profile thay đổi, đồng thời Workflow Profile là định hướng phương pháp luận ở tầng ứng dụng (Application Guidance), không phải là trạng thái bắt buộc của FSM lõi. Lưu trữ client-side đáp ứng hoàn hảo nhu cầu duy trì trải nghiệm người dùng mà không cần thay đổi database schema.

---

## Consequences

### Positive
- Hoàn thiện 100% tính truy nguyên (Provenance) của toàn bộ các tính năng từ Batch C31, C34, C35 khi xuất ra Markdown và JSON.
- Đảm bảo tính toàn vẹn của dữ liệu sao lưu (JSON Snapshot) có đầy đủ `domain` và `tags`.
- Nâng cao tính nhất quán trải nghiệm người dùng trên frontend khi tạo phiên mới và lựa chọn workflow profile.
- Ranh giới giữa các PRs rõ ràng, minh bạch, an toàn tuyệt đối cho hệ thống production.

### Negative / Trade-offs
- Bản xuất Markdown sẽ chứa chuỗi thông tin nguồn dài hơn một chút đối với các ghi chú phức tạp.
- Lựa chọn Workflow Profile lưu tại `localStorage` chỉ có hiệu lực trên trình duyệt hiện tại của người dùng, không đồng bộ xuyên thiết bị (đây là chấp nhận có chủ đích để bảo toàn Zero DB Mutation).

---

## Rollback Strategy
Nếu có bất kỳ sự cố nào phát sinh:
1. Rollback code backend/frontend về commit `5820bad` (HEAD của Batch C35 trên `main`).
2. Do không có bất kỳ migration cơ sở dữ liệu nào, việc rollback diễn ra tức thì mà không cần can thiệp rollback cơ sở dữ liệu.
