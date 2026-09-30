# IMPLEMENTATION CHECKLIST & TEST-FIRST SPECIFICATIONS
**Dự án:** Creative Research Workbench  
**Trạng thái:** Chờ phê duyệt trước khi lập trình  
**Nguyên tắc:** Spec-first, Test-first, Read-before-write, Blast Radius Thấp -> Cao

---

## 1. Tổng quan tiến trình hoàn thiện

```
[Phase 5.4] Nối Problem Intake & Structuring Canvas (Blast Radius: Rất thấp)
  │
  ▼
[Phase 5.5] Workflow Stepper & FSM Next-Step State Transition (Blast Radius: Thấp)
  │
  ▼
[Phase 5.6] Method Recommendations & Evidence Panel (Blast Radius: Trung bình)
  │
  ▼
[Phase 5.7] Search Overlay (Cmd+K) & Knowledge Explorer (Blast Radius: Thấp)
  │
  ▼
[Phase 5.8] Legacy Directory Quarantine & Consolidation (Blast Radius: Cục bộ)
```

---

## 2. Chi tiết từng Hạng mục & Gherkin Scenarios

### Hạng mục 1: Nối Problem Intake & Structuring Canvas (Phase 5.4)
- **File mục tiêu:** `apps/web/features/session/session-detail.tsx`, `apps/web/features/intake/intake-form.tsx`, `apps/web/features/structuring/normalized-view.tsx`
- **Mục tiêu:** Khi người dùng nhập vấn đề trên màn hình Session Detail, gọi API `POST /api/v1/sessions/{id}/problem-frame`, nhận về `normalized_statement`, `contradiction_type`, `improving_parameter`, `worsening_parameter` và hiển thị kết quả phân tích.
- **Gherkin Scenario:**
  ```gherkin
  Scenario: Lưu Problem Intake và hiển thị kết quả chuẩn hóa
    Given người dùng đang ở trang "/sessions/{sessionId}" với session "active"
    When người dùng nhập "Mục tiêu": "Bánh răng cần cứng để chịu tải lớn nhưng mềm để giảm rung động"
    And nhấn nút "Lưu và chuyển sang Phân tích cấu trúc"
    Then hệ thống gửi POST request đến "/api/v1/sessions/{sessionId}/problem-frame"
    And chuyển sang tab "Phân tích" (structuring)
    And hiển thị Normalized Statement từ backend
    And hiển thị ContradictionBadge với loại "technical"
    And hiển thị thông số cải thiện "Strength" và thông số suy giảm "Vibration"
  ```
- **Checklist thực hiện:**
  - [x] Viết unit test cho component `IntakeForm` và `NormalizedView` (mock TanStack Query mutation).
  - [x] Fetch dữ liệu session thật qua `getSession(sessionId)` trong `session-detail.tsx` thay cho mock data.
  - [x] Nối `useMutation` gọi `createProblemFrame(sessionId, data)` trong `intake-form.tsx`.
  - [x] Tạo component `NormalizedView` và `ContradictionBadge` để hiển thị kết quả phân tích.

---

### Hạng mục 2: Workflow Stepper & FSM Transition (Phase 5.5)
- **File mục tiêu:** `apps/web/features/session/workflow-stepper.tsx`, `apps/web/features/session/session-detail.tsx`
- **Mục tiêu:** Hiển thị tiến trình 6 giai đoạn (`intake` -> `structuring` -> `retrieval` -> `ideation` -> `evaluation` -> `synthesis`) phản ánh đúng `current_stage` từ backend, cho phép bấm "Chuyển bước" qua API `POST /api/v1/sessions/{id}/next-step`.
- **Gherkin Scenario:**
  ```gherkin
  Scenario: Chuyển bước quy trình nghiên cứu TRIZ
    Given session đang ở giai đoạn "structuring" và đã có ProblemFrame hợp lệ
    When người dùng nhấn nút "Chuyển sang Tìm kiếm tài liệu"
    Then hệ thống gửi POST request đến "/api/v1/sessions/{sessionId}/next-step"
    And session cập nhật current_stage = "retrieval"
    And WorkflowStepper làm sáng bước 3 "Tài liệu"
    And tab "retrieval" được kích hoạt
  ```
- **Checklist thực hiện:**
  - [x] Viết unit test cho `WorkflowStepper` với các trạng thái active/completed/disabled.
  - [x] Tạo component `WorkflowStepper` nhận `currentStage` và callback `onNextStep`.
  - [x] Nối `useMutation` gọi `nextStep(sessionId)` và invalidate query `['session', sessionId]`.

---

### Hạng mục 3: Method Recommendations & Evidence Panel (Phase 5.6)
- **File mục tiêu:** `apps/web/features/ideation/principle-suggestions.tsx`, `apps/web/features/retrieval/evidence-panel.tsx`
- **Mục tiêu:** Hiển thị các nguyên tắc sáng tạo TRIZ được gợi ý (từ `MethodRecommender`) và trích dẫn bằng chứng từ 10 Golden Documents (từ `RetrievalService`).
- **Gherkin Scenario:**
  ```gherkin
  Scenario: Hiển thị gợi ý nguyên tắc sáng tạo và tài liệu trích dẫn
    Given session đã xác định mâu thuẫn kỹ thuật
    When người dùng mở tab "Ý tưởng" (ideation) hoặc "Tài liệu" (retrieval)
    Then hiển thị danh sách TRIZ Principles phù hợp kèm số hiệu và mô tả
    And Evidence Panel hiển thị các trích đoạn văn bản liên quan có source_ref
  ```
- **Checklist thực hiện:**
  - [x] Viết unit test cho `PrincipleSuggestions` và `EvidencePanel`.
  - [x] Xây dựng `PrincipleSuggestions` component hiển thị thẻ nguyên tắc TRIZ.
  - [x] Xây dựng `EvidencePanel` component hiển thị trích dẫn tài liệu với độ tương đồng score.

---

### Hạng mục 4: Search Overlay (Cmd+K) (Phase 5.7)
- **File mục tiêu:** `apps/web/components/search-overlay.tsx`, `apps/web/app/layout.tsx`
- **Mục tiêu:** Mở modal tìm kiếm khi ấn Cmd+K hoặc click icon Search trên header, thực hiện Hybrid Search qua `POST /api/v1/search`.
- **Gherkin Scenario:**
  ```gherkin
  Scenario: Tìm kiếm tri thức bằng phím tắt Cmd+K
    Given người dùng đang ở bất kỳ trang nào trên web app
    When người dùng nhấn tổ hợp phím "Cmd+K" (hoặc "Ctrl+K")
    Then modal tìm kiếm xuất hiện
    When người dùng nhập "mâu thuẫn vật lý"
    Then hệ thống debounce 300ms và gửi request POST "/api/v1/search"
    And hiển thị danh sách trích đoạn tài liệu kèm source_ref và topic badge
  ```
- **Checklist thực hiện:**
  - [x] Viết unit test cho `SearchOverlay` component.
  - [x] Tạo `SearchOverlay` với phím tắt toàn cục `Cmd+K` / `Ctrl+K`.
  - [x] Nối `useQuery` gọi `searchKnowledge({ query, top_k: 5 })`.

---

### Hạng mục 5: Legacy Directory Quarantine & Consolidation (Phase 5.8)
- **File mục tiêu:** `apps/api/README.md`, `frontend/README.md`, `README.md`
- **Mục tiêu:** Đánh dấu rõ ràng `apps/api` và `frontend` là deprecated/legacy skeleton, cập nhật `README.md` để xác nhận `backend/` và `apps/web/` là 2 nguồn chân lý duy nhất.
- **Checklist thực hiện:**
  - [x] Thêm file ghi chú deprecation trong `apps/api/DEPRECATED.md` và `frontend/DEPRECATED.md`.
  - [x] Cập nhật architecture diagram trong `README.md` cho khớp chính xác cấu trúc thực tế `backend/` và `apps/web/`.
