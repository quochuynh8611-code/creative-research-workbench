# Batch C4a — Preserve Notebook Draft and Guard Destructive Overwrite

## 1. Purpose
Bảo toàn nội dung người dùng đang soạn trong Research Notebook khi chuyển tab, đồng thời ngăn việc ghi đè âm thầm draft khi có chỉnh sửa chưa lưu.

## 2. Problem Statement
Hiện tại, ResearchNotebook unmount khi người dùng rời tab Notebook. Nội dung người dùng đang soạn bị mất. Khi người dùng bấm “Lưu vào sổ tay” từ một cell 9-Windows khác, SessionDetail ghi đè noteDraft mà không biết form Notebook có đang dirty hay không.

## 3. Goals
- Bảo toàn content và noteType khi chuyển tab trong cùng một session.
- Ngăn ghi đè âm thầm khi Notebook đang dirty.
- Giữ nguyên hành vi C3b khi chưa có chỉnh sửa.
- Không thêm persistence, không thêm Append, không đổi backend.

## 4. Non-Goals
- Không lưu draft vào localStorage, sessionStorage hoặc IndexedDB.
- Không deduplicate note.
- Không thêm Append mode.
- Không đổi NoteDraft shape.
- Không đổi API, DB, migration, FSM, route hay navigation.
- Không sửa standalone /triz/nine-windows.
- Không tự động lưu draft.

## 5. Architecture Decision
SessionDetail là chủ sở hữu duy nhất (Single Source of Truth) của toàn bộ trạng thái draft có thể chỉnh sửa:
- `draft`: NoteDraft | null
- `content`: string
- `noteType`: NoteType
- `isDirty`: boolean
- `pendingDraft`: NoteDraft | null

ResearchNotebook là controlled form component bắt buộc:
- Nhận `content` và `noteType` trực tiếp từ SessionDetail qua props.
- Gọi `onContentChange` khi người dùng chỉnh sửa nội dung trong textarea.
- Gọi `onNoteTypeChange` khi người dùng thay đổi loại ghi chú trong combobox.
- Không giữ bản sao state nội bộ của `content` hoặc `noteType`.
- `isDirty` KHÔNG phải là prop của ResearchNotebook; SessionDetail tự tính toán theo dirty rule.
- Vẫn tự quản lý logic validation client-side, submit mutation, error state và UI rendering của form.
- Khi người dùng bấm "Hủy nháp", ResearchNotebook gọi `onClearDraft` để SessionDetail dọn dẹp nháp.
- Sau khi lưu ghi chú thành công (`createNoteMutation.onSuccess`), ResearchNotebook gọi `onNoteCreated` đúng một lần. ResearchNotebook KHÔNG tự gọi `onClearDraft` và KHÔNG tự reset controlled state (`content`, `noteType`); SessionDetail chịu trách nhiệm reset toàn bộ draft state trong callback `onNoteCreated`.

## 6. State Contract
```ts
type NotebookDraftState = {
  draft: NoteDraft | null
  content: string
  noteType: NoteType
  isDirty: boolean
}

type PendingDraftState = {
  incomingDraft: NoteDraft
} | null
```

## 7. ResearchNotebook Props Contract
```ts
interface ResearchNotebookProps {
  sessionId: string
  initialDraft: NoteDraft | null
  content: string
  noteType: NoteType
  onContentChange: (content: string) => void
  onNoteTypeChange: (noteType: NoteType) => void
  onClearDraft: () => void
  onNoteCreated: () => void
}
```

Ràng buộc bắt buộc:
- `content` và `noteType` là controlled props bắt buộc (không có optional controlled props).
- `onContentChange`, `onNoteTypeChange`, `onClearDraft`, `onNoteCreated` là các callback bắt buộc.
- `onNoteCreated` chỉ được gọi đúng một lần sau khi `createNoteMutation` thành công.
- `onNoteCreated` KHÔNG được gọi khi validation client-side thất bại, API request lỗi hoặc khi người dùng hủy nháp.
- `onClearDraft` chỉ được gọi khi người dùng chủ động bấm “Hủy nháp”.
- `ResearchNotebook` KHÔNG tự reset `content`, `noteType`, `draft` hoặc `isDirty` sau khi lưu thành công.
- `SessionDetail` reset toàn bộ draft state trong `onNoteCreated`:
  - `draft = null`
  - `content = ""`
  - `noteType = "insight"`
  - `isDirty = false`
  - `pendingDraft = null`
- `isDirty` KHÔNG phải là prop của `ResearchNotebook`; `SessionDetail` là chủ sở hữu tính toán `isDirty`.

## 8. State Machine
IDLE:
- draft = null
- content = ""
- noteType = "insight"
- isDirty = false

DRAFT_LOADED:
- draft = NoteDraft
- content = draft.content
- noteType = draft.note_type
- isDirty = false

EDITING:
- content hoặc noteType khác draft gốc
- isDirty = true

OVERWRITE_CONFIRMATION:
- incomingDraft tồn tại trong pendingDraft
- isDirty = true
- activeTab giữ nguyên tại tab hiện tại (không chuyển sang notebook)

DRAFT_REPLACED:
- draft = incomingDraft
- content = incomingDraft.content
- noteType = incomingDraft.note_type
- isDirty = false
- pendingDraft = null
- activeTab = notebook

DRAFT_CLEARED:
- onClearDraft được gọi
- draft = null
- content = ""
- noteType = "insight"
- isDirty = false
- pendingDraft = null

DRAFT_SAVED:
- onNoteCreated được gọi đúng 1 lần
- SessionDetail reset toàn bộ draft state:
  - draft = null
  - content = ""
  - noteType = "insight"
  - isDirty = false
  - pendingDraft = null
- ResearchNotebook không tự reset controlled state

## 9. Dirty Rule
```ts
isDirty =
  content !== (draft?.content ?? "") ||
  noteType !== (draft?.note_type ?? "insight")
```

Quy tắc chi tiết:
- Tuyệt đối KHÔNG dùng quy tắc dirty dựa trên `content.trim() !== ""` hay so sánh `content` với `incomingDraft.content`.
- Draft rỗng và chưa chỉnh sửa (`draft === null && content === "" && noteType === "insight"`): `isDirty = false`.
- Người dùng gõ rồi xóa về đúng nội dung draft gốc (`content === (draft?.content ?? "")` và `noteType === (draft?.note_type ?? "insight")`): `isDirty = false`.
- Người dùng đổi `noteType` so với draft gốc (`noteType !== (draft?.note_type ?? "insight")`): `isDirty = true`.
- Guard chỉ kích hoạt khi `isDirty = true`. Khi `isDirty = false`, guard KHÔNG kích hoạt.

## 10. Overwrite Guard Behavior
Khi `handleSaveAsNote(incomingDraft)` được gọi:
- Nếu `isDirty === false`:
  - set `draft = incomingDraft`.
  - set `content = incomingDraft.content`.
  - set `noteType = incomingDraft.note_type`.
  - set `isDirty = false`.
  - set `pendingDraft = null`.
  - `setActiveTab("notebook")`.
  - KHÔNG hiển thị confirmation dialog.
- Nếu `isDirty === true`:
  - set `pendingDraft = incomingDraft`.
  - KHÔNG đổi `draft`.
  - KHÔNG đổi `content`.
  - KHÔNG đổi `noteType`.
  - KHÔNG đổi `activeTab` (giữ nguyên tab hiện tại).
  - Hiển thị overwrite confirmation dialog.

Khi người dùng chọn “Ghi đè”:
- set `draft = pendingDraft`.
- set `content = pendingDraft.content`.
- set `noteType = pendingDraft.note_type`.
- set `isDirty = false`.
- set `pendingDraft = null`.
- `setActiveTab("notebook")`.

Khi người dùng chọn “Hủy”, nhấn Escape, hoặc click ra ngoài (click outside):
- set `pendingDraft = null`.
- KHÔNG đổi `draft`.
- KHÔNG đổi `content`.
- KHÔNG đổi `noteType`.
- KHÔNG đổi `activeTab` (giữ nguyên tab hiện tại).

Khi người dùng chọn “Hủy nháp”:
- gọi `onClearDraft()`.
- SessionDetail set `draft = null`.
- SessionDetail set `content = ""`.
- SessionDetail set `noteType = "insight"`.
- SessionDetail set `isDirty = false`.
- SessionDetail set `pendingDraft = null`.

Khi lưu ghi chú thành công:
- ResearchNotebook gọi `onNoteCreated()`.
- ResearchNotebook KHÔNG tự gọi `onClearDraft()`.
- SessionDetail xử lý trong `onNoteCreated`:
  - set `draft = null`.
  - set `content = ""`.
  - set `noteType = "insight"`.
  - set `isDirty = false`.
  - set `pendingDraft = null`.

## 11. UI Contract
Confirmation dialog:
- Tiêu đề: “Ghi đè bản nháp chưa lưu?”
- Nội dung: “Bạn đang có nội dung chưa lưu trong Sổ tay nghiên cứu. Ghi đè sẽ thay thế nội dung này bằng góc nhìn mới.”
- Nút chính: “Ghi đè”
- Nút phụ: “Hủy”
- KHÔNG có nút “Nối tiếp” (không hỗ trợ Append mode).
- Dialog phải có `role="dialog"`, `aria-modal="true"` và accessible name (`aria-labelledby`).
- Dialog phải hỗ trợ Escape và click outside để đóng.
- Escape, click outside và nút “Hủy” đều giữ nguyên draft/edit và không chuyển tab.
- Focus phải được quản lý đúng theo pattern accessible dialog.

Dirty indicator:
- Khi `isDirty === true`, hiển thị “Có chỉnh sửa chưa lưu”.
- Khi `isDirty === false`, không hiển thị indicator.
- Không dùng trạng thái lỗi cho dirty state.

## 12. Test Plan — RED
Đúng 17 tests bao quát đầy đủ 2 tầng:

### ResearchNotebook (`apps/web/features/notebook/__tests__/research-notebook.test.tsx`):
1. `test_renders_controlled_content_value`: hiển thị nội dung textarea và note type theo controlled props từ SessionDetail.
2. `test_calls_on_content_change_when_the_user_edits_content`: gọi callback onContentChange khi người dùng gõ vào textarea.
3. `test_calls_on_note_type_change_when_the_user_changes_note_type`: gọi callback onNoteTypeChange khi người dùng thay đổi combobox.
4. `test_does_not_retain_internal_content_state_across_remounts`: không lưu giữ bản sao state nội bộ khi remount với props mới.
5. `test_loads_a_new_initial_draft_through_controlled_props`: nạp initialDraft mới đồng bộ qua controlled props.
6. `test_calls_on_clear_draft_when_user_clicks_discard_draft_button`: gọi onClearDraft khi người dùng bấm nút Hủy nháp.
7. `test_calls_on_note_created_after_successful_note_creation`: gọi onNoteCreated đúng một lần sau khi lưu thành công; không gọi onClearDraft; không tự reset controlled props.
8. `test_preserves_validation_and_submit_behavior`: bảo toàn cơ chế validation rỗng và submit hợp lệ.

### SessionDetail (`apps/web/features/session/__tests__/session-detail.test.tsx`):
9. `test_saves_nine_windows_insight_to_notebook_draft_when_notebook_is_clean`: lưu insight từ 9-Windows prefill vào Notebook khi form chưa dirty.
10. `test_preserves_notebook_edits_when_switching_to_another_tab_and_back`: bảo toàn nội dung và noteType người dùng đang soạn khi chuyển tab qua lại.
11. `test_shows_overwrite_confirmation_when_saving_a_new_insight_while_notebook_is_dirty`: hiển thị confirmation dialog khi lưu ô mới trong lúc notebook đang dirty (cả khi sửa content lẫn đổi noteType).
12. `test_does_not_change_tab_while_overwrite_confirmation_is_open`: giữ nguyên active tab hiện tại khi confirmation dialog đang mở.
13. `test_replaces_draft_and_switches_to_notebook_after_overwrite_confirmation`: khi chọn Ghi đè, thay thế draft, reset isDirty, nạp content/noteType mới và chuyển Notebook.
14. `test_preserves_existing_edits_after_cancelling_overwrite_confirmation`: khi chọn Hủy (hoặc Escape, click outside), giữ nguyên draft, content, noteType và activeTab.
15. `test_clears_draft_content_note_type_and_dirty_state_after_discard`: hủy nháp reset draft, content, noteType và isDirty.
16. `test_clears_draft_state_after_successful_note_creation`: lưu thành công gọi onNoteCreated, SessionDetail reset toàn bộ draft state; onClearDraft không được gọi trong luồng này.
17. `test_does_not_show_overwrite_confirmation_when_the_new_draft_matches_the_existing_untouched_draft`: không hiển thị confirmation khi draft chưa hề bị chỉnh sửa hoặc khi gõ rồi xóa về đúng nội dung draft gốc.

Yêu cầu RED:
- Các test mới phải fail vì behavior chưa tồn tại, không phải lỗi cú pháp, import sai, fixture sai hay TypeScript compile error.
- KHÔNG viết production implementation.
- KHÔNG sửa file production.
- Baseline 375 test cũ phải vẫn pass.
