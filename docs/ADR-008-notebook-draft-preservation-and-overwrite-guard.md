---
title: "ADR-008 — Notebook Draft Preservation and Overwrite Guard"
topic: "notebook-ux-hardening"
source_type: "decision-record"
language: "vi"
tags: ["adr", "frontend", "notebook", "ux-hardening", "draft-preservation", "overwrite-guard"]
phase: "C4a"
status: "Proposed"
golden: true
created: "2026-11-12"
---

# ADR-008 — Notebook Draft Preservation and Overwrite Guard

## 1. Bối Cảnh (Context)
Trong phiên nghiên cứu (`ResearchSession`), người dùng có thể lưu các phát hiện (insights, trích dẫn, nguyên tắc sáng tạo, giải pháp ứng viên) vào `ResearchNotebook` thông qua cơ chế `onSaveAsNote` từ nhiều nguồn khác nhau (`EvidencePanel`, `TrizMatrixLookup`, `PrincipleSuggestions`, `CandidateSolutions`, và `TrizNineWindows`).

Qua khảo sát kiến trúc ở Batch C4, chúng tôi phát hiện 2 vấn đề rủi ro mất dữ liệu nghiêm trọng:
1. **Mất chỉnh sửa do unmount khi chuyển tab (Unmount Data Loss)**:
   Tại `SessionDetail`, `ResearchNotebook` được render theo điều kiện `{activeTab === 'notebook' && <ResearchNotebook ... />}`. Khi người dùng rời khỏi tab Notebook để tra cứu thêm thông tin ở các tab khác (`structuring`, `retrieval`, `ideation`), component `ResearchNotebook` bị unmount hoàn toàn. Toàn bộ nội dung người dùng đang gõ dở trong textarea bị hủy khỏi bộ nhớ. Khi quay lại tab Notebook, component remount và chỉ lấy lại bản nháp thô từ `noteDraft`.
2. **Ghi đè âm thầm phá hủy dữ liệu (Silent Destructive Overwrite)**:
   Khi `handleSaveAsNote(incomingDraft)` được gọi từ bất kỳ công cụ nào, `SessionDetail` lập tức ghi đè `noteDraft = incomingDraft` và chuyển tab sang Notebook mà không kiểm tra xem người dùng có đang có nội dung chưa lưu (dirty state) trong form hay không. Toàn bộ công sức biên soạn trước đó bị xóa sổ mà không có bất kỳ cảnh báo, xác nhận hay cơ chế hoàn tác nào.

---

## 2. Quyết Định Kiến Trúc (Architectural Decision)

Chúng tôi quyết định áp dụng mô hình **Mandatory Controlled Draft State Owned by SessionDetail with Confirmation Overwrite Guard**:

1. **SessionDetail Là Chủ Sở Hữu Duy Nhất (Single Source of Truth) Của Trạng Thái Draft**:
   - `SessionDetail` trực tiếp quản lý toàn bộ các biến trạng thái:
     - `draft: NoteDraft | null` (bản nháp gốc được nạp từ các công cụ hoặc null khi ở trạng thái idle)
     - `content: string` (nội dung người dùng đang soạn thảo)
     - `noteType: NoteType` (loại ghi chú hiện tại)
     - `isDirty: boolean` (thuộc tính tính toán dẫn xuất - derivation từ so sánh giá trị hiện tại với draft gốc)
     - `pendingDraft: NoteDraft | null` (bản nháp mới đang chờ xác nhận ghi đè khi form đang dirty)
   - Trạng thái `content` và `noteType` được lưu giữ liên tục trong suốt vòng đời của phiên tại `SessionDetail`, hoàn toàn không bị mất khi chuyển tab.
   - Khi lưu ghi chú thành công qua callback `onNoteCreated` hoặc khi người dùng hủy nháp qua callback `onClearDraft`, `SessionDetail` là chủ thể duy nhất chịu trách nhiệm reset toàn bộ draft state về trạng thái sạch (`draft = null`, `content = ""`, `noteType = "insight"`, `isDirty = false`, `pendingDraft = null`).

2. **ResearchNotebook Trở Thành Controlled Form Component Bắt Buộc**:
   - Contract props bắt buộc (không có optional controlled props):
     ```typescript
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
   - Nhận `content: string` và `noteType: NoteType` bắt buộc từ `SessionDetail`.
   - Phát sự kiện `onContentChange(content)` và `onNoteTypeChange(noteType)` lên `SessionDetail` khi người dùng nhập liệu hoặc đổi combobox.
   - `isDirty` KHÔNG phải là prop của `ResearchNotebook`; `SessionDetail` tự tính toán.
   - `onClearDraft` CHỈ dành riêng cho hành động discard khi người dùng chủ động bấm "Hủy nháp".
   - `onNoteCreated` CHỈ dành riêng cho sự kiện lưu ghi chú thành công (`createNoteMutation.onSuccess`).
   - `ResearchNotebook` KHÔNG tự gọi `onClearDraft` khi lưu thành công và KHÔNG tự ý reset controlled props.
   - Vẫn tự quản lý logic validation client-side, submit mutation, error handling và UI rendering của form.

3. **Dirty Rule Tính Toán Dẫn Xuất (Derivation from State)**:
   - Quy tắc tính toán duy nhất:
     ```typescript
     isDirty =
       content !== (draft?.content ?? "") ||
       noteType !== (draft?.note_type ?? "insight")
     ```
   - Loại bỏ hoàn toàn quy tắc dirty dựa trên `content.trim() !== ""`.
   - Khi draft rỗng và chưa chỉnh sửa: `isDirty = false`.
   - Khi người dùng gõ rồi xóa về đúng nội dung draft gốc: `isDirty = false`.
   - Khi người dùng đổi `noteType` so với draft gốc: `isDirty = true`.
   - Guard CHỈ kích hoạt khi `isDirty = true`. Khi `isDirty = false`, guard KHÔNG kích hoạt.

4. **Cơ Chế Bảo Vệ Ghi Đè (Overwrite Guard)**:
   - Khi `handleSaveAsNote(incomingDraft)` được kích hoạt:
     - **Nếu `isDirty === false`**: Thay thế draft lập tức, cập nhật `content` và `noteType` theo `incomingDraft`, reset `isDirty = false`, chuyển tab sang Notebook ngay lập tức mà không hiển thị dialog (bảo toàn 100% trải nghiệm mượt mà của C3b).
     - **Nếu `isDirty === true`**: Lưu `incomingDraft` vào `pendingDraft`, giữ nguyên tab hiện tại (`activeTab`), KHÔNG thay đổi `draft`, `content`, hay `noteType`, và hiển thị hộp thoại xác nhận dễ tiếp cận: *"Ghi đè bản nháp chưa lưu?"*.
   - Khi người dùng chọn **"Ghi đè"**: Nạp `pendingDraft` vào `draft`, cập nhật `content`/`noteType`, reset `isDirty = false`, giải phóng `pendingDraft = null`, và chuyển tab sang Notebook.
   - Khi người dùng chọn **"Hủy"**, nhấn phím **Escape**, hoặc click ra ngoài (click outside): Hủy `pendingDraft = null`, giữ nguyên toàn bộ `draft`, `content`, `noteType` và không chuyển tab.
   - Tuyệt đối KHÔNG triển khai cơ chế Append (nối tiếp văn bản).
   - Tuyệt đối KHÔNG sử dụng các cơ chế persistence như `localStorage`, `sessionStorage`, hay `IndexedDB`.

---

## 3. Các Phương Án Đã Cân Nhắc (Alternatives Considered)

| Tiêu chí | Phương án 1: Chỉ thêm Modal cảnh báo (Confirmation-Only) | Phương án 2: Giữ Notebook mounted bằng CSS hidden | Phương án 3: Tự động nối tiếp (Automatic Append) | Phương án 4 (Được chọn): Mandatory Controlled Draft State trong SessionDetail |
| :--- | :--- | :--- | :--- | :--- |
| **Giải quyết mất text khi chuyển tab** | ❌ Không giải quyết: Component vẫn unmount khi đổi tab, mất chữ đã gõ. | ⚠️ Một phần: Giữ DOM ẩn nhưng dễ gây side effects về layout, refetch React Query ngầm và rò rỉ sự kiện. | ❌ Không giải quyết: Vẫn mất chữ đã gõ khi unmount. | ✅ Giải quyết triệt để: State được bảo tồn liên tục ở cấp container phiên. |
| **Chống ghi đè âm thầm** | ✅ Có cảnh báo. | ❌ Vẫn ghi đè âm thầm nếu không có logic guard. | ⚠️ Không ghi đè nhưng gây rác văn bản nối tiếp khó lường. | ✅ Bảo vệ tường minh qua Dialog xác nhận chỉ khi form thực sự dirty. |
| **Tính rõ ràng của dữ liệu** | Phức tạp: Phải đồng bộ trạng thái dirty chéo component. | Phức tạp về DOM và kiểm thử headless. | Hành vi khó dự đoán, người dùng phải xóa tay thủ công. | Phân định ranh giới rõ ràng: State cha điều phối, con hiển thị. |
| **Độ phức tạp & Rủi ro** | Trung bình. | Cao (ảnh hưởng toàn bộ tab rendering). | Trung bình. | Kiểm soát tốt trong phạm vi SessionDetail và ResearchNotebook. |

---

## 4. Hệ Quả & Đánh Đổi (Consequences & Trade-offs)

### 4.1. Tích Cực (Pros)
- **Bảo toàn dữ liệu tuyệt đối (Zero Data Loss)**: Người dùng có thể thoải mái chuyển qua lại giữa tab Notebook và các tab khác để đối chiếu mà không sợ mất nội dung đang gõ dở.
- **Bảo vệ có chủ đích (Context-Aware Guard)**: Hộp thoại xác nhận chỉ xuất hiện khi người dùng thực sự có thay đổi chưa lưu (`isDirty === true`). Khi chưa chỉnh sửa hoặc khi nội dung được hoàn trả về gốc, quy trình vẫn diễn ra tức thì, không gây phiền toái.
- **Kiến trúc rõ ràng (Single Source of Truth)**: Trạng thái bản nháp của phiên làm việc quy về một mối tại `SessionDetail`. Phân tách rành mạch: `onClearDraft` cho discard, `onNoteCreated` cho save success.
- **Tuân thủ tiêu chuẩn tiếp cận (A11y)**: Hộp thoại xác nhận có `role="dialog"`, `aria-modal="true"`, accessible name, bẫy focus và hỗ trợ phím Escape / click outside.

### 4.2. Rủi Ro Thực Tế & Biện Pháp Kiểm Soát (Risks & Mitigations)
- **Rủi ro lan tỏa interface (Prop Interface Drift)**: `ResearchNotebookProps` yêu cầu các props bắt buộc `content`, `noteType`, `onContentChange`, `onNoteTypeChange`, `onClearDraft`, `onNoteCreated`.
  - *Biện pháp*: Toàn bộ thay đổi interface được khép kín bên trong module `apps/web/features/notebook` và `SessionDetail`. Không tác động ra ngoài các module khác.
- **Rủi ro ảnh hưởng test cũ**: Các test cũ của `ResearchNotebook` có thể render mà không truyền đầy đủ controlled props.
  - *Biện pháp*: Viết test RED bao phủ đầy đủ 17 trường hợp theo đúng controlled contract; khi chuyển sang GREEN sẽ cập nhật contract và test adapter thích ứng chính xác.
- **Tuyệt đối không dùng persistence ngoài bộ nhớ**: Không dùng `localStorage`, `sessionStorage`, `IndexedDB` hay database; toàn bộ trạng thái chỉ tồn tại trong vòng đời phiên làm việc trên client.

---

## 5. Tính Khả Nghịch (Reversibility)
Đây là quyết định **hai chiều (Two-way Door)**:
- Không tạo migration, không đổi schema database hay API backend.
- Nếu cần rollback, chỉ cần trả lại các state cục bộ vào `ResearchNotebook` và gỡ bỏ modal trong `SessionDetail` mà không để lại di chứng dữ liệu.
