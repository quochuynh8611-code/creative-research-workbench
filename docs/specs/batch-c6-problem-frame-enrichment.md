# Batch C6 — Problem Frame Enrichment: Explicit "Use Insight" Action

## 1. Mục tiêu (Purpose)
Cho phép người dùng tái sử dụng và đưa các phát hiện, ghi chú (`ResearchNote`) đã lưu trong Sổ tay nghiên cứu (Research Notebook) vào biểu mẫu định khung bài toán (`IntakeForm`), hỗ trợ quá trình hình thành bài toán sáng tạo (Problem Framing) mà không gây ra bất kỳ sự cố ghi đè dữ liệu âm thầm nào.

## 2. Quyết định Kiến trúc (Architectural Decision)
Áp dụng **Phương án B: Explicit "Use insight" action** với cơ chế Human-in-the-loop:
1. Người dùng chủ động mở bảng tham chiếu ghi chú đã lưu thuộc phiên nghiên cứu (`InsightReferencePanel`).
2. Từng ghi chú có nút hành động tường minh **"Dùng insight này"**.
3. Khi bấm nút, hệ thống hiển thị **khung Preview & Xác nhận (Confirmation)**:
   - Hiển thị đầy đủ nội dung note, loại ghi chú (type badge), thời gian tạo.
   - Cho phép người dùng chọn trường đích (Target Field):
     - `want`: "Điều tôi muốn đạt được / cải thiện"
     - `obstacle`: "Nhưng lại bị vướng / lo ngại"
     - `context`: "Bối cảnh / ràng buộc thực tế"
     - `goal`: "Mục tiêu / Mô tả bài toán"
   - Cảnh báo trực quan nếu trường đích hiện đã có nội dung (Overwrite Warning).
4. Có nút **"Hủy"** để đóng preview bất kỳ lúc nào mà không làm thay đổi bất kỳ state nào.
5. Chỉ khi người dùng nhấn **"Áp dụng"**, nội dung mới được điền vào trường đích đã chọn và tái kích hoạt logic chuẩn hóa câu mâu thuẫn hiện có (`composeConflictStatement`).

## 3. Ranh giới & Ràng buộc Kỹ thuật (Technical Boundaries)
- **Frontend-only**: Không chỉnh sửa backend, API, cơ sở dữ liệu, Alembic migration, seed data hay FSM engine.
- **Không tự động ghi đè**: Tuyệt đối không tự động prefill khi chưa có sự xác nhận tường minh của người dùng.
- **Không tự động kích hoạt API**: Không tự động gọi `createProblemFrame` hoặc `analyzeProblemWithAI`.
- **Không tự động chuyển tab**: Không tự động chuyển tab `intake` -> `structuring` khi áp dụng insight.
- **Không persistence**: Không lưu tạm vào `localStorage`, `sessionStorage`, hay `IndexedDB`.
- **Không can thiệp ngoài phạm vi**: Không sửa `ResearchNotebook`, không sửa `SessionDetail`, không sửa các feature khác.

## 4. Đặc tả Giao diện & Component Contract

### 4.1. Component `InsightReferencePanel`
Đường dẫn dự kiến: `apps/web/features/intake/insight-reference-panel.tsx`

```typescript
export type IntakeTargetField = 'want' | 'obstacle' | 'context' | 'goal'

export interface InsightReferencePanelProps {
  sessionId: string
  currentValues?: {
    want?: string
    obstacle?: string
    context?: string
    goal?: string
  }
  onApplyInsight?: (content: string, target: IntakeTargetField) => void
  onCancelPreview?: () => void
  className?: string
}
```

### 4.2. Quản lý Dữ liệu (Data Fetching)
- Sử dụng `@tanstack/react-query` `useQuery`.
- Query key chuẩn: `['sessions', sessionId, 'notes']`.
- Query function: `listResearchNotes(sessionId)` từ `@/lib/api-client`.
- Xử lý đủ 3 trạng thái mạng:
  - `isLoading`: Hiển thị Skeleton / Spinner thông báo đang tải ghi chú.
  - `isError`: Hiển thị thông báo lỗi mạng kèm nút "Thử lại" gọi `refetch()`.
  - `empty`: Hiển thị thông báo "Chưa có ghi chú nào trong phiên này" khi danh sách rỗng.

### 4.3. Quy tắc Điền dữ liệu vào `IntakeForm`
Khi áp dụng một insight vào target:
- `want`: Gán `wantText = note.content`, tái tính toán `form.goal = composeConflictStatement(note.content, obstacleText, contextText)`.
- `obstacle`: Gán `obstacleText = note.content`, tái tính toán `form.goal = composeConflictStatement(wantText, note.content, contextText)`.
- `context`: Gán `contextText = note.content`, tái tính toán `form.goal = composeConflictStatement(wantText, obstacleText, note.content)`.
- `goal`: Gán trực tiếp `form.goal = note.content`, không thay đổi `wantText`, `obstacleText`, `contextText`.

## 5. Đặc tả Gherkin (Gherkin Scenarios)

```gherkin
Feature: Problem Frame enrichment từ insight đã lưu

  Scenario: Người dùng chọn insight để prefill ProblemFrame
    Given Người dùng đang ở "Problem Intake" của một phiên có ít nhất một insight đã lưu
    When Người dùng mở "Dùng insight từ Sổ tay"
    Then Hệ thống hiển thị insight cùng loại ghi chú và thời điểm tạo
    When Người dùng chọn "Dùng insight này"
    Then Hệ thống hiển thị preview toàn bộ nội dung insight
    And Hệ thống hiển thị các trường đích: "Muốn", "Bị vướng", "Bối cảnh", "Mục tiêu / Mô tả bài toán"
    And Nội dung hiện có của các trường không bị thay đổi trước khi xác nhận

  Scenario: Người dùng áp dụng insight vào trường "Muốn"
    Given Preview đang hiển thị một insight và trường đích "Muốn"
    When Người dùng nhấn "Áp dụng"
    Then Hệ thống điền nội dung insight vào "Muốn"
    And Hệ thống cập nhật "Mục tiêu / Mô tả bài toán" theo quy tắc "Muốn... Nhưng..." hiện có
    And Hệ thống không gọi API tạo ProblemFrame
    And Hệ thống không tự động chuyển tab

  Scenario: Người dùng hủy việc dùng insight
    Given Preview insight đang hiển thị
    When Người dùng nhấn "Hủy"
    Then Preview đóng
    And Toàn bộ giá trị hiện tại của "Muốn", "Bị vướng", "Bối cảnh" và "Mục tiêu / Mô tả bài toán" giữ nguyên
    And Không có mutation, navigation hay AI analysis nào được kích hoạt
```

## 6. Danh mục Test RED Bắt buộc

1. `test_renders_loading_state_while_notes_are_loading`
2. `test_renders_error_state_with_retry_action_when_notes_query_fails`
3. `test_renders_empty_state_when_no_notes_exist`
4. `test_renders_research_notes_with_type_badge_and_creation_time`
5. `test_opens_preview_when_user_clicks_use_insight`
6. `test_closes_preview_and_preserves_all_intake_values_when_user_cancels`
7. `test_shows_overwrite_warning_when_selected_target_already_has_content`
8. `test_applies_insight_to_want_target_and_regenerates_goal_using_existing_compose_logic`
9. `test_applies_insight_to_obstacle_target_and_regenerates_goal_using_existing_compose_logic`
10. `test_applies_insight_to_context_target_and_regenerates_goal_using_existing_compose_logic`
11. `test_applies_insight_to_goal_target_without_changing_want_obstacle_or_context`
12. `test_does_not_call_create_problem_frame_when_previewing_or_cancelling`
13. `test_does_not_call_analyze_problem_with_ai_when_previewing_or_cancelling`
14. `test_does_not_navigate_to_another_tab_when_applying_an_insight`
15. `test_does_not_persist_insight_selection_or_preview_state`
