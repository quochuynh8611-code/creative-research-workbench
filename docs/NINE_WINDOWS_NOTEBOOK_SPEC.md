# Đặc Tả Kỹ Thuật: Lưu Nội Dung TRIZ 9-Windows Vào Research Notebook (Batch C3b)

## 1. Mục Đích (Purpose)
Đặc tả hành vi và giao diện cho tính năng lưu nội dung từ các ô cửa sổ trong sơ đồ **TRIZ 9-Windows (System Operator)** vào **Research Notebook** (Sổ tay nghiên cứu) của phiên làm việc (`ResearchSession`).

Tính năng này cho phép nhà nghiên cứu lưu lại các góc nhìn nhận thức (siêu hệ thống, hệ thống, phân hệ qua các trục thời gian) thành các bản ghi chú nghiên cứu (`ResearchNote`), phục vụ việc tổng hợp luận cứ và phát triển giải pháp mà không làm xáo trộn luồng làm việc tuyến tính.

---

## 2. Phạm Vi Thực Hiện (Scope)

### 2.1. In Scope
- Bổ sung nút **"Lưu vào sổ tay"** (kèm icon `Bookmark`) trên từng thẻ ô (`<article>`) của 9-Windows khi component được truyền prop `onSaveAsNote`.
- Định dạng bản nháp `NoteDraft` gửi sang `ResearchNotebook`:
  - `note_type: 'insight'`.
  - `source_chunk_id: null`.
  - `content`: chuỗi văn bản Markdown có cấu trúc gồm: tên lăng kính, tọa độ tầng & thời gian, nhãn ô, câu hỏi gợi mở, mô tả đặc điểm, và phần ví dụ thực tế (nếu có).
- Xử lý ví dụ thực tế tùy chọn:
  - Khi `examples_vi` có phần tử: thêm dòng `\n\nVí dụ: ${examples_vi.join('; ')}`.
  - Khi `examples_vi` rỗng (`[]`) hoặc `undefined`: không thêm dòng `Ví dụ:`.
- Truyền nối tiếp callback:
  - `SessionDetail` truyền `handleSaveAsNote` vào `NormalizedView` qua prop `onSaveAsNote`.
  - `NormalizedView` truyền tiếp `onSaveAsNote` vào `<TrizNineWindows />`.
- Đảm bảo khả năng tiếp cận (Accessibility):
  - Mỗi nút lưu có `aria-label` định danh duy nhất theo từng ô (ví dụ: `Lưu vào sổ tay: Siêu hệ thống • Quá khứ - Hạ tầng kỹ thuật quá khứ`).
  - Đường viền focus rõ ràng (`focus-visible:ring-2 focus-visible:ring-primary focus:outline-none`).
  - Không sử dụng màu sắc làm chỉ báo duy nhất (luôn có nhãn chữ và icon).

### 2.2. Out of Scope
- KHÔNG tự động deduplicate ghi chú ở client hay server (người dùng chủ động xem trước và chỉnh sửa trong form compose của Notebook trước khi lưu).
- KHÔNG lưu vào `localStorage` hay biến đổi state DB của `ProblemFrame` hay `ResearchSession`.
- KHÔNG thay đổi `WorkflowEngine` hay máy trạng thái FSM (đây là công cụ hỗ trợ tư duy phi-FSM).
- KHÔNG chỉnh sửa logic nội bộ của `ResearchNotebook` (tái sử dụng 100% cơ chế nhận `initialDraft`).
- KHÔNG thêm thư viện (dependency) mới.
- KHÔNG hiển thị nút lưu trên trang tra cứu độc lập `/triz/nine-windows` (khi `onSaveAsNote` là `undefined`).

---

## 3. Hành Vi Người Dùng (UX Behavior)

1. **Hiển thị nút lưu có điều kiện**:
   - Khi `onSaveAsNote` được truyền vào `TrizNineWindows`: Mỗi ô trong 9 ô cửa sổ hiển thị một nút `"Lưu vào sổ tay"` ở chân thẻ (card footer).
   - Khi `onSaveAsNote` không được truyền (như ở trang `/triz/nine-windows` hoặc khi nhúng ở chế độ read-only): Nút lưu hoàn toàn **không xuất hiện** trong DOM.
2. **Tương tác click**:
   - Khi người dùng click nút `"Lưu vào sổ tay"` trên một ô:
     1. Khởi tạo một đối tượng `NoteDraft` với nội dung chuẩn hóa của ô đó.
     2. Gọi hàm callback `onSaveAsNote(draft)`.
     3. Tại component cha `SessionDetail`, `setNoteDraft(draft)` được kích hoạt và chuyển ngay tab hiển thị sang `notebook` (`setActiveTab('notebook')`).
     4. Tab `ResearchNotebook` hiển thị banner màu hổ phách *"Đang soạn thảo từ bản nháp gợi ý / trích dẫn"* kèm nút *"Hủy nháp"*, textarea được điền sẵn nội dung, dropdown phân loại chọn sẵn `Insight`.

---

## 4. Hợp Đồng Dữ Liệu `NoteDraft` (Contract Specification)

```ts
interface NoteDraft {
  content: string
  note_type: NoteType // luôn là 'insight'
  source_chunk_id?: string | null // luôn là null
}
```

### Quy tắc định dạng chuỗi `content`:
```text
[TRIZ 9-Windows: ${lens_title} • ${level_label} - ${time_label}: ${label_vi}]
Câu hỏi gợi mở: ${prompt_vi}

Đặc điểm: ${description_vi}${examples_section}
```

Trong đó:
- `${level_label}`: Ánh xạ từ `level` (`supersystem` → `Siêu hệ thống`, `system` → `Hệ thống`, `subsystem` → `Phân hệ`).
- `${time_label}`: Ánh xạ từ `time` (`past` → `Quá khứ`, `present` → `Hiện tại`, `future` → `Tương lai`).
- `${examples_section}`:
  - Nếu `cell.examples_vi && cell.examples_vi.length > 0`: `\n\nVí dụ: ${cell.examples_vi.join('; ')}`.
  - Nếu `cell.examples_vi` là rỗng (`[]`) hoặc `undefined`: chuỗi rỗng `""`.

---

## 5. Tiêu Chuẩn Tiếp Cận (Accessibility)

1. **Tên tiếp cận duy nhất (Unique Accessible Name)**:
   - Thuộc tính `aria-label` cho nút lưu trên mỗi ô:
     `aria-label="Lưu vào sổ tay: ${level_label} • ${time_label} - ${cell.label_vi}"`
   - Đảm bảo trong 9 ô không có 2 nút nào trùng `aria-label`.
2. **Điều hướng bàn phím**:
   - Nút thuộc luồng tab bàn phím (`tabindex="0"` mặc định của thẻ `<button>`).
   - Có trạng thái `focus-visible` với vòng sáng rõ ràng.

---

## 6. Kịch Bản Gherkin (Acceptance Scenarios)

### Kịch bản 1: Không có nút lưu khi xem độc lập
```gherkin
Scenario: Xem 9-Windows ở chế độ không truyền callback
  Given component TrizNineWindows được render không có prop onSaveAsNote
  When 9 ô cửa sổ hiển thị thành công
  Then không có nút nào có nhãn chứa "Lưu vào sổ tay" xuất hiện trong DOM
```

### Kịch bản 2: Hiển thị 9 nút lưu khi có callback
```gherkin
Scenario: Xem 9-Windows trong ngữ cảnh có callback onSaveAsNote
  Given component TrizNineWindows được render với prop onSaveAsNote là jest.fn()
  When 9 ô cửa sổ hiển thị thành công
  Then xuất hiện đúng 9 nút bấm có nhãn hoặc aria-label chứa "Lưu vào sổ tay"
  And mỗi nút có aria-label phân biệt rõ tọa độ và nhãn của ô tương ứng
```

### Kịch bản 3: Lưu ô có ví dụ thực tế thành bản nháp Insight
```gherkin
Scenario: Người dùng bấm lưu một ô có chứa ví dụ thực tế
  Given 9-Windows đang hiển thị với prop onSaveAsNote
  And ô "Siêu hệ thống • Quá khứ" có danh sách ví dụ ["Đường ray xe lửa khổ hẹp"]
  When người dùng click nút "Lưu vào sổ tay" của ô "Siêu hệ thống • Quá khứ"
  Then callback onSaveAsNote được gọi đúng 1 lần
  And tham số draft có note_type là "insight"
  And tham số draft có source_chunk_id là null
  And draft.content chứa "Lăng kính Kỹ thuật & Công nghệ"
  And draft.content chứa "Siêu hệ thống - Quá khứ: Hạ tầng kỹ thuật quá khứ"
  And draft.content chứa "Câu hỏi gợi mở:"
  And draft.content chứa "Đặc điểm:"
  And draft.content chứa "Ví dụ: Đường ray xe lửa khổ hẹp"
```

### Kịch bản 4: Bỏ qua phần ví dụ khi ô không có ví dụ
```gherkin
Scenario: Người dùng bấm lưu một ô không có ví dụ thực tế (rỗng hoặc undefined)
  Given 9-Windows đang hiển thị với prop onSaveAsNote
  And ô đang chọn có examples_vi là mảng rỗng [] hoặc undefined
  When người dùng click nút "Lưu vào sổ tay" của ô này
  Then callback onSaveAsNote được gọi
  And draft.content không chứa chuỗi "Ví dụ:"
```

### Kịch bản 5: Chuyển tiếp liên tab từ SessionDetail sang ResearchNotebook
```gherkin
Scenario: Người dùng lưu cell 9-Windows từ tab Phân tích cấu trúc
  Given người dùng đang ở tab "Phân tích cấu trúc" của phiên nghiên cứu
  And khối "TRIZ 9-Windows" đang được mở rộng
  When người dùng click nút "Lưu vào sổ tay" của bất kỳ ô nào
  Then giao diện tự động chuyển sang tab "Sổ tay nghiên cứu"
  And banner "Đang soạn thảo từ bản nháp gợi ý / trích dẫn" xuất hiện
  And ô textarea được điền sẵn nội dung draft của ô 9-Windows vừa chọn
```

---

## 7. Danh Sách Tác Động File (File Impact List)

1. `docs/NINE_WINDOWS_NOTEBOOK_SPEC.md`: Tài liệu đặc tả kỹ thuật (tạo mới).
2. `docs/ADR-007-nine-windows-notebook-integration.md`: Bản ghi quyết định kiến trúc (tạo mới).
3. `apps/web/features/triz/triz-nine-windows.tsx`: Bổ sung prop optional `onSaveAsNote` và render nút lưu có điều kiện (pha GREEN).
4. `apps/web/features/structuring/normalized-view.tsx`: Nhận prop optional `onSaveAsNote` và chuyển tiếp xuống `TrizNineWindows` (pha GREEN).
5. `apps/web/features/session/session-detail.tsx`: Truyền `onSaveAsNote={handleSaveAsNote}` vào `NormalizedView` (pha GREEN).
6. `apps/web/features/triz/__tests__/triz-nine-windows.test.tsx`: Bổ sung 6 test RED cho hành vi nút lưu, a11y và NoteDraft contract.
7. `apps/web/features/structuring/__tests__/normalized-view.test.tsx`: Bổ sung 3 test RED cho việc chuyển tiếp callback.
8. `apps/web/features/session/__tests__/session-detail.test.tsx`: Bổ sung 2 test RED cho luồng liên tab từ 9-Windows sang Notebook và xóa nháp.
