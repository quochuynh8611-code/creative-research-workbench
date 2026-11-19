# BATCH C35 SPEC: DOMAIN, LENS & WORKFLOW EXPANSION (SPEC-FIRST)

## 1. Thông Tin & Baseline
- **Batch**: C35
- **Tên**: Domain, Lens & Workflow Expansion
- **Baseline Git HEAD**: `3d4a3848b89d4fb9f4931a5eb23b090e54d89e5d` (nhánh `main`)
- **Trạng thái**: Draft / Spec-First — Chờ Founder phê duyệt trước khi tạo branch code.
- **Tác giả**: Senior Product Engineer / Domain Expert

---

## 2. Mục Tiêu & Tầm Nhìn Sản Phẩm
Mở rộng không gian ứng dụng của Creative Research Workbench từ kỹ thuật và kinh doanh cơ bản sang các lĩnh vực hiện đại có tính liên ngành cao:
1. **Đa dạng hóa Domain ứng dụng**: Đưa **Healthcare (Y tế)**, **Education (Giáo dục)** và **Sustainability (Bền vững / ESG)** trở thành các First-Class Domains được hỗ trợ toàn diện với templates định sẵn, ví dụ điển hình và từ khóa đặc thù.
2. **Mở rộng Lăng kính Tư duy (Multi-Lens Expansion)**: Mở rộng Sơ đồ 9 Màn hình (TRIZ 9-Windows / System Operator) từ 3 lăng kính hiện tại sang **6 lăng kính**, bổ sung:
   - **Systems Thinking (Tư duy Hệ thống)**
   - **Design Thinking (Tư duy Thiết kế)**
   - **Lean Startup (Khởi nghiệp Tinh gọn)**
3. **Mở rộng Quy trình Nghiên cứu (Workflow Archetypes Expansion)**: Bổ sung 2 cấu hình luồng làm việc chuyên biệt mà không phá vỡ FSM tuần tự kinh điển của TRIZ:
   - **Rapid Prototyping (Tạo mẫu thử nghiệm nhanh)**
   - **Stakeholder Alignment (Đồng thuận đa bên)**
4. **Bảo toàn Ràng buộc Kiến trúc**:
   - Zero database schema mutation (Cột `ResearchSession.domain` và `workflow_state` vốn là String, tận dụng tính linh hoạt có sẵn).
   - Read-only static catalogs tất định, bảo mật cao, zero external side-effects.
   - Zero secret exposure.

---

## 3. Phạm Vi Triển Khai (In-Scope & Out-of-Scope)

### 3.1. In-Scope (Trong phạm vi) & Ràng Buộc Số Lượng Bắt Buộc
- **3 Domain Mới (Đúng 2 templates mỗi domain, tổng cộng đúng 6 templates mới, KHÔNG thêm)**:
  - `healthcare`:
    1. `healthcare_clinical_accuracy_emergency_speed`: Cân bằng Độ chính xác Chẩn đoán Lâm sàng & Tốc độ Xử lý Cấp cứu.
    2. `healthcare_medical_device_sterilization_longevity`: Tiệt trùng Dụng cụ Phẫu thuật Đạt chuẩn Vi sinh & Bảo toàn Độ bền Tuổi thọ Thiết bị.
  - `education`:
    1. `education_personalized_learning_class_scale`: Cá nhân hóa Lộ trình Học tập & Giảng dạy Quy mô Lớp học Lớn.
    2. `education_interactive_edtech_digital_distraction`: Ứng dụng Nền tảng Học tập Tương tác & Kiểm soát Phân tâm Kỹ thuật số.
  - `sustainability`:
    1. `sustainability_circular_packaging_barrier_strength`: Bao bì Sinh học Tái tuần hoàn & Khả năng Chống ẩm, Chịu lực Cơ học.
    2. `sustainability_carbon_abatement_industrial_throughput`: Cắt giảm Phát thải Khí nhà kính & Duy trì Năng suất Sản xuất Công nghiệp.
- **3 Lăng Kính Mới (Tổng cộng đúng 6 lăng kính, KHÔNG thêm lăng kính khác)**:
  - 3 lăng kính hiện có: `engineering`, `business`, `everyday`.
  - 3 lăng kính mới:
    1. `systems_thinking`: Lăng kính Tư duy Hệ thống (Cơ cấu phản hồi, vòng lặp Loops, Stocks & Flows, Điểm đòn bẩy Leverage Points).
    2. `design_thinking`: Lăng kính Tư duy Thiết kế (Thấu cảm Empathize, Xác định Define, Thử nghiệm Ideate/Prototype, User Journey).
    3. `lean_startup`: Lăng kính Khởi nghiệp Tinh gọn (Build-Measure-Learn, Giả thuyết rủi ro Riskiest Assumption, MVP, Pivot/Persevere).
  - Mỗi lăng kính mới chứa đúng 9 ô tọa độ (`supersystem | system | subsystem` x `past | present | future`) với `label_vi`, `label_en`, `prompt_vi`, `description_vi`, `examples_vi`.
- **2 Workflow Profiles Mới (Tổng cộng đúng 3 profiles, KHÔNG thêm profile khác; Thuần Application-Layer, KHÔNG đổi FSM cốt lõi)**:
  - `standard_triz`: Quy trình 6 bước cổ điển theo FSM tuần tự.
  - `rapid_prototyping`: Luồng tạo mẫu nhanh, tập trung chu kỳ lặp Ideation -> Prototyping -> Assumption Validation.
  - `stakeholder_alignment`: Luồng đồng thuận đa bên, tập trung phân tích mâu thuẫn đa góc nhìn và ma trận tiêu chí thống nhất.
  - **Bảo toàn FSM & Read-Only Invariant**: Workflow Profiles là cấu trúc hướng dẫn cấp ứng dụng (Application-Layer Guidance & Method Recommendation), không can thiệp hay sửa đổi enum `WorkflowState` và bảng `_VALID_TRANSITIONS` của FSM lõi. Tất cả frontend components chỉ gọi API ở chế độ Read-Only, tuyệt đối không cho phép user chỉnh sửa trực tiếp các dữ liệu tĩnh này. Đây là quyết định có chủ đích.

### 3.2. Out-of-Scope (Ngoài phạm vi)
- KHÔNG thêm bảng mới, cột mới vào cơ sở dữ liệu PostgreSQL (Zero DB Migration).
- KHÔNG thay đổi FSM tuần tự cốt lõi làm gãy các session đang chạy (`idle -> structuring -> retrieval -> ideation -> evaluation -> synthesis -> completed`).
- KHÔNG triển khai hạ tầng deploy production.
- KHÔNG sửa đổi các thuật toán vector embedding hay logic AI Coach ngoài việc bổ sung metadata/prompts.

---

## 4. Kiến Trúc Chi Tiết

### 4.1. Domain Expansion Specification
Bổ sung 3 domain định danh chuẩn:
1. **`healthcare` (Y tế & Sức khỏe)**:
   - Đặc thù mâu thuẫn: Độ chính xác, độ an toàn tính mạng, tuân thủ quy chuẩn y tế nghiêm ngặt vs. Tốc độ cấp cứu, chi phí xét nghiệm/thuốc men.
   - Default Lens liên kết: `systems_thinking` (hoặc `engineering` tùy ngữ cảnh).
2. **`education` (Giáo dục & Sư phạm)**:
   - Đặc thù mâu thuẫn: Cá nhân hóa lộ trình học tập, sự gắn kết của người học vs. Năng lực giảng dạy của giáo viên, quy mô lớp học lớn.
   - Default Lens liên kết: `design_thinking`.
3. **`sustainability` (Môi trường & Bền vững)**:
   - Đặc thù mâu thuẫn: Giảm phát thải carbon, tuần hoàn vật liệu, thân thiện môi trường vs. Hiệu suất sản xuất, chi phí nguyên vật liệu thay thế.
   - Default Lens liên kết: `systems_thinking`.

### 4.2. Lens Expansion Specification (TRIZ 9-Windows)
Sơ đồ 9 Màn hình mở rộng thành 6 lăng kính, bảo đảm tính đối xứng $3 \times 3 = 9$ ô tọa độ:
1. **`systems_thinking` (Tư duy Hệ thống)**:
   - Tập trung vào: Mối quan hệ tương tác phức hợp, vòng lặp phản hồi (Feedback Loops), dòng chảy (Stocks & Flows), và điểm đòn bẩy can thiệp (Leverage Points).
2. **`design_thinking` (Tư duy Thiết kế)**:
   - Tập trung vào: Trải nghiệm người dùng (UX), sự thấu cảm (Empathy), nhận diện nhu cầu tiềm ẩn (Latent Needs), và chu kỳ thử nghiệm nguyên mẫu (Prototyping & User Testing).
3. **`lean_startup` (Khởi nghiệp Tinh gọn)**:
   - Tập trung vào: Giả thuyết giá trị & giả thuyết tăng trưởng, vòng lặp Xây dựng - Đo lường - Học hỏi (Build - Measure - Learn), sản phẩm khả thi tối thiểu (MVP), và tín hiệu Pivot/Persevere.

### 4.3. Workflow Expansion Specification
Không làm xáo trộn các trạng thái cơ sở dữ liệu `workflow_state`, hệ thống định nghĩa mô hình **Workflow Profile / Strategy** áp dụng lên phiên làm việc:
1. **`standard_triz` (Mặc định)**:
   - Quy trình 6 bước cổ điển: Nhập vấn đề -> Phân tích cấu trúc mâu thuẫn -> Truy xuất tài liệu sáng chế -> Sinh ý tưởng qua 40 nguyên tắc -> Đánh giá giải pháp -> Báo cáo tổng hợp.
2. **`rapid_prototyping` (Tạo mẫu thử nghiệm nhanh)**:
   - Tập trung vào tốc độ kiểm chứng ý tưởng: Nhấn mạnh việc chuyển từ Structuring sang Ideation & Prototyping ngay khi xác định được mâu thuẫn cốt lõi, cung cấp checklist kiểm thử giả thuyết rủi ro cao nhất (Riskiest Assumptions).
3. **`stakeholder_alignment` (Đồng thuận đa bên)**:
   - Tập trung vào giải quyết bất đồng quan điểm giữa các nhóm lợi ích: Nhấn mạnh phân tích mâu thuẫn từ góc nhìn đa đối tượng (Khách hàng, Vận hành, Kỹ thuật, Lãnh đạo) và ma trận tiêu chí đánh giá giải pháp đạt đồng thuận.

---

## 5. Rủi Ro, Thách Thức & Biện Pháp Phòng Vệ

| Rủi Ro Kỹ Thuật | Tác Động | Biện Pháp Phòng Vệ |
|---|---|---|
| **Lỗi định dạng JSON 9-Windows** | Dịch vụ `triz_nine_windows_service` từ chối khởi động do cơ chế fail-closed. | Kiểm thử tự động `validate_nine_windows_data` kiểm tra toàn vẹn đủ 6 lăng kính, mỗi lăng kính đủ 9 ô tọa độ và trường bắt buộc. |
| **Xung đột kiểu dữ liệu Frontend/Backend** | Runtime TypeError hoặc TypeScript compile error khi nhận lens/domain mới. | Đồng bộ hóa `types.ts` với Schema Backend Pydantic trước khi code UI. |
| **Phá vỡ FSM hiện có** | Các phiên nghiên cứu cũ không thể chuyển bước hoặc báo lỗi `InvalidTransitionError`. | Giữ nguyên bộ enum `WorkflowState` cốt lõi, triển khai Workflow Profiles ở tầng ứng dụng/hướng dẫn mà không can thiệp schema FSM. |
| **Rò rỉ thông tin nhạy cảm** | Secret leakage trong tài liệu mẫu hoặc templates. | Chạy Docs Health Check & Secret Scan bằng grep regex trước khi commit. |

---

## 6. Kế Hoạch Triển Khai 3 PR
- **PR 1: Backend Domain Templates, 9-Windows Lenses & Workflow Profiles** (MERGED vào `main` tại `15c7a960df768f5c3dafc9259163273e3bf9bcf5`):
  - Cập nhật `triz_nine_windows.json` (thêm 3 lenses, 27 ô).
  - Cập nhật `domain_templates.py` (thêm 6 templates cho 3 domains).
  - Cập nhật `triz_nine_windows_service.py` và `triz.py`.
  - Bổ sung `workflow_profiles.py` và endpoint `/sessions/workflow-profiles`.
  - Backend unit & integration tests (PASS 100%).
- **PR 2: Frontend Multi-Lens Tabs, Domain Resolver & Workflow Guidance** (IN PROGRESS):
  - Mở rộng `types.ts`: `TargetDomainType`, `TrizNineWindowsLens` (6 lenses), `WorkflowProfile`, `WorkflowProfileId`, `WorkflowProfilesResponse`.
  - Mở rộng `api-client.ts`: `getWorkflowProfiles()`, hỗ trợ 6 lenses trong `getTrizNineWindows()`.
  - Cập nhật `triz-lens-resolver.ts`: `healthcare -> systems_thinking`, `education -> design_thinking`, `sustainability -> systems_thinking`.
  - Nâng cấp `triz-nine-windows.tsx` với selector 6 lăng kính hỗ trợ horizontal scroll cho mobile.
  - Xây dựng component `apps/web/features/session/workflow-profile-guidance.tsx` hiển thị chi tiết 3 profiles và hướng dẫn theo từng giai đoạn nghiên cứu.
  - Tích hợp `WorkflowProfileGuidance` vào `session-detail.tsx`.
  - Frontend test suites:
    - `triz-lens-resolver-expansion.test.ts`: kiểm tra giải mã 3 domain mới.
    - `triz-nine-windows-expansion.test.tsx`: kiểm tra render 6 tabs và tương tác.
    - `workflow-profile-guidance.test.tsx`: kiểm tra render 3 profiles và highlight giai đoạn hiện tại.
- **PR 3: Documentation, Runbook & Batch C35 Finalization**:
  - Cập nhật `DEPLOYMENT_GUIDE.md` và `IMPLEMENTATION_ROADMAP.md`.
  - Đóng hoàn tất Batch C35 sau khi CI 3/3 PASS.
