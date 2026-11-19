# ADR-016: Domain, Lens & Workflow Expansion Architecture

## Status
Accepted (Phê duyệt hoàn tất cùng Batch C35: PR #78, PR #79, PR #80)

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

### Decision 5: Giao Diện Người Dùng 6 Tabs & Component Hướng Dẫn Workflow Profiles (Read-Only)
- **Quyết định**:
  - `apps/web/features/triz/triz-nine-windows.tsx` mở rộng segmented controls từ 3 tabs thành đúng 6 tabs (`engineering`, `business`, `everyday`, `systems_thinking`, `design_thinking`, `lean_startup` - KHÔNG thêm lens khác) với container `overflow-x-auto` và responsive styling giúp trải nghiệm trên mobile không bị tràn viền hoặc co rúm nhãn.
  - Xây dựng component độc lập `WorkflowProfileGuidance` (`apps/web/features/session/workflow-profile-guidance.tsx`) hiển thị đúng 3 profiles (`standard_triz`, `rapid_prototyping`, `stakeholder_alignment` - KHÔNG thêm profile khác), recommended lenses và checklist hành động theo từng giai đoạn nghiên cứu, tích hợp vào `session-detail.tsx`.
  - **Read-Only API Call Contract**: Tất cả các components frontend liên quan đến 9-Windows và Workflow Profiles chỉ gọi các REST API read-only (`GET /api/v1/triz/nine-windows`, `GET /api/v1/sessions/workflow-profiles`), tuyệt đối không cung cấp cơ chế cho người dùng chỉnh sửa trực tiếp các file JSON tĩnh từ UI. Đây là một chấp nhận có chủ đích (intentional design decision) nhằm bảo toàn tính toàn vẹn của kho tri thức chuẩn hóa.
  - **Domain Resolver**: Ánh xạ đúng 3 domain mới (`healthcare -> systems_thinking`, `education -> design_thinking`, `sustainability -> systems_thinking` - KHÔNG thêm domain khác).
- **Lý do**: Cung cấp công cụ trực quan hỗ trợ nhà nghiên cứu đổi mới sáng tạo áp dụng đúng phương pháp luận mà không cần ghi nhớ quy tắc phức tạp.

### Decision 6: Xác Minh Tích Hợp End-to-End & Đồng Bộ Hóa Hợp Đồng API (PR 3)
- **Quyết định**:
  - **Phạm vi Docs & Tests Only**: PR 3 thuần túy là kiểm thử tích hợp (Integration Tests) và cập nhật tài liệu vận hành. Tuyệt đối không thay đổi runtime behavior của backend hay frontend trong môi trường production.
  - **Không dùng Testcontainers**: Backend integration test (`test_c35_e2e_workflow_integration.py`) ưu tiên sử dụng in-memory/test double hoặc dependency override cho database session, loại bỏ hoàn toàn việc phụ thuộc vào Docker/Testcontainers giúp test chạy nhanh, ổn định và teardown tức thì.
  - **Frontend Mock API ở Client/Network Layer**: Frontend integration test (`c35-workflow-lens-integration.test.tsx`) chỉ mock API ở tầng `api-client` / network layer, tuyệt đối không gọi backend live để tránh flaky và phụ thuộc môi trường mạng.
  - Viết suite integration test backend bao phủ happy path và error path cho `GET /api/v1/sessions/workflow-profiles` (schema, lens recommendations, 405 error), `GET /api/v1/triz/nine-windows` (6 lenses, 422 error), và lifecycle tạo session từ template mới (`POST /api/v1/sessions/from-template`).
  - Viết suite frontend E2E/integration test bao phủ happy path, switching profiles, dynamic lens resolution, và error boundary / empty fallback resilience.
  - Khẳng định tính bất biến: Zero Schema Mutation, Zero Backend Business Logic Drift, Zero Secret Leakage.
- **Lý do**: Khép kín vòng đời kiểm thử theo kim chỉ nam Test-First và bảo đảm chất lượng chuyển giao giữa backend capability và frontend UI consumption.

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
