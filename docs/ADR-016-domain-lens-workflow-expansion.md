# ADR-016: Domain, Lens & Workflow Expansion Architecture

## Status
Proposed (Chờ Founder phê duyệt)

## Date
2026-11-18

## Context
Sau khi hoàn tất Batch C34 (TRIZ Toolkit Advanced: ARIZ 6 bước, Evolution 8 quy luật, Resource 5 tabs), Creative Research Workbench đã sở hữu năng lực giải quyết vấn đề sáng tạo sâu sắc theo lý thuyết TRIZ cổ điển.
Tuy nhiên, phạm vi ứng dụng thực tế của sản phẩm đang đối mặt với các nhu cầu mở rộng:
1. **Phạm vi lĩnh vực (Domains)**: Người dùng trong các ngành Y tế (Healthcare), Giáo dục (Education) và Bền vững môi trường (Sustainability) cần các mẫu bài toán (Templates) sát với thực tế ngành hàng, thay vì chỉ là các bài toán cơ khí hoặc phần mềm thuần túy.
2. **Lăng kính tư duy (Lenses)**: Khung 9 Màn hình (9-Windows / System Operator) hiện chỉ hỗ trợ 3 lăng kính (`engineering`, `business`, `everyday`). Để phân tích các bài toán hiện đại có tính hệ thống phức tạp và tương tác con người cao, hệ thống cần bổ sung các phương pháp luận bổ trợ: **Systems Thinking**, **Design Thinking**, và **Lean Startup**.
3. **Quy trình nghiên cứu (Workflows)**: Bên cạnh quy trình tuần tự TRIZ 6 bước truyền thống, các nhóm đổi mới sáng tạo thường áp dụng luồng **Rapid Prototyping** (chu kỳ thử nghiệm giả thuyết nhanh) và **Stakeholder Alignment** (đạt đồng thuận đa góc nhìn).

## Decisions

### Decision 1: Mở Rộng Domain Mà Không Đổi Database Schema (Zero DB Migration)
- **Quyết định**: Lưu trữ domain dưới dạng chuỗi định danh chuẩn hóa (`healthcare`, `education`, `sustainability`) trong cột `ResearchSession.domain: String(256)` đã có sẵn từ migration `005`.
- **Lý do**: Không cần chạy Alembic migration mới, loại bỏ hoàn toàn rủi ro downtime hoặc khóa bảng trên môi trường production.
- **Phương án bị loại**: Định nghĩa kiểu `ENUM` cấp database trong PostgreSQL. Bị loại vì mỗi lần thêm domain sẽ đòi hỏi `ALTER TYPE` hoặc migration phức tạp.

### Decision 2: Mở Rộng Sơ Đồ 9 Màn Hình Đúng 3 Lăng Kính Mới (Tổng Đúng 6 Lăng Kính, Fail-Closed)
- **Quyết định**: Bổ sung chính xác 3 lăng kính mới vào file tĩnh `triz_nine_windows.json` (tổng số lăng kính là đúng 6, không thêm bất kỳ lăng kính nào khác):
  - `systems_thinking`: Lăng kính Tư duy Hệ thống
  - `design_thinking`: Lăng kính Tư duy Thiết kế
  - `lean_startup`: Lăng kính Khởi nghiệp Tinh gọn
  - Mỗi lăng kính bắt buộc chứa đủ 9 cửa sổ ($3 \times 3$) theo đúng cấu trúc canonical: `(supersystem | system | subsystem)` x `(past | present | future)`.
- **Lý do**: Đảm bảo tính toán vẹn toán học và trải nghiệm đồng nhất của System Operator. Hàm xác thực `validate_nine_windows_data` sẽ tiếp tục tuân thủ cơ chế fail-closed (từ chối nạp nếu bất kỳ lăng kính nào thiếu ô hoặc sai tọa độ).

### Decision 3: Thiết Kế Workflow Profiles Thuần Túy Ở Application-Layer (Không Đổi FSM Cốt Lõi)
- **Quyết định**: Giữ nguyên vẹn 100% FSM tuần tự `WorkflowState` (`idle -> structuring -> retrieval -> ideation -> evaluation -> synthesis -> completed`) và bảng `_VALID_TRANSITIONS`. Triển khai chính xác 2 **Workflow Profiles / Archetypes** mới (tổng số đúng 3 profiles gồm `standard_triz` + 2 mới, không thêm profile khác) thuần túy ở tầng ứng dụng (Application-Layer Guidance & Method Recommendation):
  - `standard_triz`: Tuần tự đầy đủ 6 bước.
  - `rapid_prototyping`: Gợi ý đi tắt từ Structuring sang Ideation và cung cấp checklist Fast Prototyping.
  - `stakeholder_alignment`: Hướng dẫn lập bản đồ các bên liên quan và phân tích mâu thuẫn đa chiều.
- **Lý do & Chấp nhận có chủ đích**: Đây là một chấp nhận có chủ đích (intentional design decision) để bảo toàn tuyệt đối tính toàn vẹn của FSM lõi, không gây breaking changes cho các sessions hiện hữu, không làm thay đổi các điều kiện tiên quyết (ví dụ: yêu cầu `ProblemFrame` trước khi sang `retrieval`), đồng thời vẫn mang lại giá trị định hướng chuyên sâu cho người dùng.
- **Phương án bị loại**: Thêm các state con hoặc nhánh rẽ phức tạp vào bảng trạng thái `_VALID_TRANSITIONS` của FSM. Bị loại vì làm tăng độ phức tạp thuật toán và dễ dẫn đến deadlock trạng thái.

### Decision 4: Mở Rộng Domain Templates Đúng 2 Mẫu Mỗi Domain (Tổng Đúng 6 Mẫu Mới)
- **Quyết định**: Giới hạn chính xác 2 templates mới cho mỗi domain mới (`healthcare`, `education`, `sustainability`), tổng cộng đúng 6 templates mới, không thêm:
  - `healthcare`: `healthcare_clinical_accuracy_emergency_speed`, `healthcare_medical_device_sterilization_longevity`.
  - `education`: `education_personalized_learning_class_scale`, `education_interactive_edtech_digital_distraction`.
  - `sustainability`: `sustainability_circular_packaging_barrier_strength`, `sustainability_carbon_abatement_industrial_throughput`.

### Decision 4: Định Tuyến Thông Minh Domain-to-Lens (Dynamic Fallback Resolver)
- **Quyết định**: Cập nhật hàm `resolveLensFromDomain` ở frontend và backend để tự động ánh xạ:
  - `healthcare` -> `systems_thinking`
  - `education` -> `design_thinking`
  - `sustainability` -> `systems_thinking`
  - Trường hợp không xác định được: Fallback về `'engineering'` một cách an toàn.

## Consequences

### Positive
- Gia tăng đáng kể giá trị và độ bao phủ của sản phẩm cho các nhóm khách hàng phi kỹ thuật thuần túy (EdTech, MedTech, CleanTech/ESG).
- Giữ vững nguyên tắc Zero Schema Mutation, an toàn tuyệt đối cho cơ sở dữ liệu.
- Giữ vững nguyên tắc Read-Only Static Catalog đối với kho tri thức 9-Windows, thời gian phản hồi API dưới 10ms.

### Negative / Trade-offs
- File `triz_nine_windows.json` tăng kích thước từ ~320 dòng lên ~650 dòng. Cần biên soạn nội dung 27 ô mới (3 lăng kính x 9 ô) với chất lượng học thuật và sư phạm cao.
- Frontend cần hiển thị 6 tabs lăng kính thay vì 3 tabs, đòi hỏi thiết kế giao diện dạng horizontal scroll hoặc responsive wrap để tránh vỡ layout trên màn hình nhỏ.

## Rollback Strategy
Nếu có bất kỳ sự cố nào phát sinh:
1. Rollback code backend/frontend về commit `3d4a3848b89d4fb9f4931a5eb23b090e54d89e5d`.
2. Do không có database migration, việc rollback mã nguồn diễn ra tức thì mà không cần can thiệp rollback cơ sở dữ liệu.
