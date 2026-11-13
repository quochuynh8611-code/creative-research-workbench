# Batch C7c-2a — Truyền source_context Từ TRIZ 9-Windows Tới Research Notebook (Pilot Scope)

## 1. Mục Tiêu (Purpose)

Tài liệu này xác lập đặc tả kỹ thuật chi tiết cho giai đoạn **Pilot C7c-2a** thuộc hệ thống Creative Research Workbench:
- Triển khai luồng truyền dẫn dữ liệu nguồn gốc (`source_context`) một cách có kiểm soát và an toàn tuyệt đối từ công cụ **Sơ đồ 9 Màn hình TRIZ (`triz_9_windows`)** tới **Sổ tay nghiên cứu (`ResearchNotebook`)**.
- Xác thực và bảo vệ hợp đồng dữ liệu ở tầng frontend trước khi gọi API `POST /api/v1/sessions/{session_id}/notes`, đảm bảo tuân thủ đầy đủ schema backend đã định nghĩa tại `backend/src/app/schemas/note_context.py` (Batch C7c-1 / ADR-014).
- Duy trì tính toàn vẹn của vòng đời bản nháp (`NoteDraft`), cơ chế bảo vệ nội dung chưa lưu (`C4a Dirty Guard`), hộp thoại xác nhận ghi đè (`Overwrite Confirmation Dialog`), và cô lập trạng thái giữa các phiên làm việc (`Session Isolation`).
- **Giới hạn phạm vi**: Lượt này là **Pilot duy nhất cho nguồn TRIZ 9-Windows**. Tuyệt đối KHÔNG triển khai đồng loạt 4 nguồn còn lại (`triz_matrix`, `principle_suggestion`, `evidence`, `candidate_solution`) trong batch này.

---

## 2. Ranh Giới & Ràng Buộc Kỹ Thuật (Boundaries & Constraints)

1. **Phạm vi Pilot hẹp**: Chỉ có component `TrizNineWindows` (`apps/web/features/triz/triz-nine-windows.tsx`) đóng gói thêm trường `source_context` vào `NoteDraft`. Bốn nguồn còn lại giữ nguyên format payload hiện tại.
2. **Không sửa Backend hay Database**: Backend runtime đã hoàn tất tại C7c-1 (DB migration revision 006, model `ResearchNote` có cột `source_context` kiểu `JSONB(none_as_null=True)`).
3. **Bảo tồn định dạng nội dung ghi chú (Content Format Invariant)**:
   - Giữ nguyên cấu trúc văn bản tổng hợp của note: `[TRIZ 9-Windows: {lens_title} • {levelLabel} - {timeLabel}: {cell.label_vi}]\nCâu hỏi gợi mở: ...`.
   - Giữ nguyên phân loại mặc định `note_type: 'insight'`.
   - Giữ nguyên `source_chunk_id: null` (nguồn 9-Windows không gắn với chunk tài liệu).
4. **Tương thích ngược (Backward Compatibility)**:
   - Các component gọi `ResearchNotebook` mà không có context (hoặc người dùng tự gõ note thủ công trực tiếp từ form) vẫn hoạt động bình thường, gửi `source_context: undefined/null`, backend lưu giá trị **SQL NULL** thật sự. Tuyệt đối không gửi object rỗng `{}`.
   - Các route độc lập (standalone route `/triz/nine-windows`) hoạt động ở chế độ chỉ đọc (read-only) khi không truyền `onSaveAsNote`.
5. **Không chỉnh sửa tính năng ngoài phạm vi**:
   - Không thêm badge hiển thị nguồn gốc trong danh sách note ở lượt pilot (dành cho C7c-2b).
   - Không sửa tính năng C6 "Use insight" (`InsightReferencePanel`) hay C7b clipboard copy (`handleCopyNote`).

---

## 3. Quyết Định Hành Vi Nghiệp Vụ (Behavioral Specifications)

### 3.1. Hợp Đồng Dữ Liệu `source_context` Cho Variant TRIZ 9-Windows
Khi người dùng bấm "Lưu vào sổ tay" tại một ô trên lưới 9-Windows, payload context được tạo ra phải tuân thủ nghiêm ngặt schema:
```typescript
export interface Triz9WindowsSourceContext {
  schema_version: 1
  source_type: 'triz_9_windows'
  lens: 'engineering' | 'business' | 'everyday'
  level: 'supersystem' | 'system' | 'subsystem'
  time: 'past' | 'present' | 'future'
  cell_label: string
}
```

### 3.2. Ràng Buộc Lens Phải Khớp Dữ Liệu Grid Đang Hiển Thị & placeholderData
- `lens` trong `source_context` bắt buộc phải là lens của dữ liệu grid/cell thực tế đang hiển thị trên giao diện tại thời điểm người dùng bấm nút lưu (`data.lens` từ response API).
- Tuyệt đối không được lấy state `activeLens` cục bộ nếu request chuyển lens đang pending hoặc đang tải skeleton, nhằm tránh lỗi ghép nhầm (mismatch) giữa `activeLens` mới với cell dữ liệu cũ của lens trước đó.
- Component sử dụng `placeholderData: (previousData) => previousData` để giữ grid cũ hiển thị trong khi đổi lens (chống layout shift). Trong thời gian mạng đang tải, selector lens có thể đã hiển thị lens mới, nhưng `source_context` vẫn bảo đảm lấy `data.lens` của dữ liệu grid thực tế đang render bên dưới.
- Lấy trực tiếp từ `cell` và `data` đã render:
  - `lens`: `data.lens` (hoặc `activeLens` khi đã đồng bộ hoàn tất với data).
  - `level`: `cell.level`.
  - `time`: `cell.time`.
  - `cell_label`: `cell.label_vi`.

### 3.3. Định Nghĩa Ngữ Nghĩa: "Nguồn Khởi Đầu" (Provenance Origin)
- `source_context` biểu thị **nguồn khởi đầu** (origin) của ý tưởng nghiên cứu, không phải chứng chỉ xác nhận nội dung văn bản còn nguyên trạng thái sơ khai.
- Khi người dùng nhận nháp vào Sổ tay nghiên cứu rồi gõ thêm nhận xét, điều chỉnh câu chữ, hoặc thay đổi phân loại (`note_type`), `source_context` **VẪN ĐƯỢC GIỮ NGUYÊN VẸN** để bảo lưu dấu vết tri thức (knowledge trail).
- Việc chỉnh sửa nội dung không làm mất `source_context`.

### 3.4. Vòng Đời Bản Nháp (`NoteDraft Lifecycle`) & Bảo Vệ Trạng Thái
1. **Tiếp nhận khi form sạch (Clean Draft)**: Nếu `!isNoteDraftDirty`, draft mới được nạp vào form ngay lập tức: `content`, `note_type`, và `source_context` thuộc cùng một draft đồng bộ. Tab tự động chuyển sang `notebook`.
2. **Tiếp nhận khi form bẩn (Dirty Collision)**: Nếu `isNoteDraftDirty === true`, draft mới được lưu vào `pendingDraft` (mang đầy đủ `source_context` mới) và mở `Overwrite Confirmation Dialog`.
3. **Hủy ghi đè (Cancel Overwrite)**: Nhấn "Hủy" hoặc phím `Escape`: `pendingDraft` bị hủy (`null`). Bản nháp hiện tại cùng `content`, `note_type`, và `source_context` cũ được giữ nguyên vẹn.
4. **Xác nhận ghi đè (Confirm Overwrite)**: Nhấn "Ghi đè": Toàn bộ `noteContent`, `noteType`, và `noteDraft` (chứa `source_context` mới) được thay thế đồng bộ. `pendingDraft` được reset về `null`.
5. **Hủy nháp (Discard Draft)**: Bấm "Hủy nháp" trên banner Notebook: `noteDraft` bị reset về `null`, form được dọn sạch, không để lại tàn dư context.
6. **Lưu thành công (Save Success)**: Sau khi tạo ghi chú thành công: `noteDraft` bị xóa, form reset về mặc định. Ghi chú thủ công tiếp theo của người dùng sẽ không mang context của draft trước.
7. **Đổi phiên làm việc (Session Switch)**: Khi `sessionId` thay đổi, `useEffect` hook reset toàn bộ draft state (`noteDraft = null`, `pendingDraft = null`, `noteContent = ''`), chống rò rỉ context xuyên session.
8. **Quy tắc Dirty Guard**: Cơ chế dirty guard vẫn dựa trên sự khác biệt giữa `noteContent` và `noteType` so với draft ban đầu; không thực hiện deep comparison trên metadata tĩnh.
9. **Phân biệt context vắng mặt với context sai kiểu**:
   - Chỉ khi `source_context` là `null` hoặc `undefined` thì mới được xem là không có context (lưu note thủ công tự do).
   - Mọi giá trị khác (kể cả các giá trị falsy như `false`, `0`, `""`, `NaN`) đều bắt buộc phải đưa qua bộ kiểm thực `validateTriz9WindowsContext`.
   - Nếu context sai kiểu hoặc vi phạm hợp đồng, hệ thống chặn submit `fail-closed`, hiển thị lỗi dạng chuỗi và giữ nguyên bản nháp; tuyệt đối không tự ý gỡ bỏ context sai kiểu để lưu lén plain note.

### 3.5. Kiểm Tra Dữ Liệu Không Hợp Lệ (Invalid Context Handling)
Áp dụng kỷ luật kiểm tra fail-closed nghiêm ngặt theo hợp đồng backend:
- Không dùng các hàm `Number()`, `.trim()`, hoặc cắt chuỗi ngầm để "sửa chữa dữ liệu" sai quy cách.
- **Tại component nguồn (`TrizNineWindows`)**:
  - Trước khi gọi `onSaveAsNote`, kiểm tra tính hợp lệ của `cell` và `data`:
    - `schema_version === 1`.
    - `lens` nằm trong `['engineering', 'business', 'everyday']`.
    - `level` nằm trong `['supersystem', 'system', 'subsystem']`.
    - `time` nằm trong `['past', 'present', 'future']`.
    - `cell_label` là chuỗi không rỗng, không chỉ toàn khoảng trắng, độ dài $\le 100$ Unicode code points.
    - `cell_label` không chứa ký tự điều khiển ASCII < 32 (`\n`, `\r`, `\t`, `\0`) và không chứa ký tự ngắt dòng Unicode `U+2028`, `U+2029`.
    - Không chứa bất kỳ trường lạ nào ngoài danh sách trên.
  - Nếu dữ liệu không hợp lệ: **KHÔNG** phát draft thiếu context; hiển thị thông báo lỗi ngắn gọn, accessible ngay tại component nguồn; không chuyển tab và không ghi đè draft đang có.
- **Tại bước submit (`ResearchNotebook`)**:
  - Nếu draft có `source_context` nhưng bị vi phạm validation: **KHÔNG** gửi yêu cầu `POST`, hiển thị thông báo lỗi dạng chuỗi trên form, giữ nguyên bản nháp để người dùng không bị mất nội dung.
  - Tuyệt đối **KHÔNG** tự ý retry bằng cách gỡ bỏ context để gửi lén plain note.
- **Ghi chú không có context**: Ghi chú từ người dùng tự nhập hoặc caller cũ không có context vẫn gửi payload bình thường (không có trường `source_context` hoặc `source_context: undefined/null`).

### 3.6. Xử Lý Lỗi API 422 Từ Backend (API Error Handling)
- Khi backend trả về lỗi `HTTP 422 Unprocessable Entity`:
  - Trích xuất thông báo lỗi an toàn thành **dạng chuỗi (string)**, không bao giờ để lọt mảng đối tượng `detail: [{ loc, msg, type }]` vào React state khiến giao diện bị crash trắng trang.
  - Không reset draft, không xóa `noteContent`, không xóa `source_context` khi lưu thất bại, giúp người dùng giữ lại toàn bộ dữ liệu để thao tác lại.
  - Không hiển thị nguyên văn giá trị đầu vào (input payload) có thể chứa dữ liệu nhạy cảm trong thông báo lỗi UI.
  - Không tạo global error utility hay can thiệp vào interceptor toàn hệ thống trong pilot này.

---

## 4. Thiết Kế Type & Validation Runtime Tối Thiểu

### 4.1. TypeScript Interface Cho Payload Ghi (Write Payload)
Trong `apps/web/lib/types.ts`:
```typescript
// Variant cho nguồn TRIZ 9-Windows (Pilot C7c-2a)
export interface Triz9WindowsSourceContext {
  schema_version: 1
  source_type: 'triz_9_windows'
  lens: 'engineering' | 'business' | 'everyday'
  level: 'supersystem' | 'system' | 'subsystem'
  time: 'past' | 'present' | 'future'
  cell_label: string
}

// Union mở rộng an toàn cho tương lai
export type NoteSourceContext = Triz9WindowsSourceContext

// Cập nhật các interface liên quan
export interface NoteDraft {
  content: string
  note_type: NoteType
  source_chunk_id?: string | null
  source_context?: NoteSourceContext | null
}

export interface CreateResearchNoteInput {
  content: string
  note_type?: NoteType
  source_chunk_id?: string | null
  source_context?: NoteSourceContext | null
}

export interface ResearchNote {
  id: string
  session_id: string
  content: string
  note_type: NoteType
  source_chunk_id?: string | null
  source_context?: unknown | null // Kiểu linh hoạt khi đọc từ API (apps/web/lib/types.ts:253)
  created_at: string
}
```

### 4.2. Dữ Liệu Đọc Từ API (Read Payload)
- Khi gọi `listResearchNotes` hoặc nhận response từ `createResearchNote`:
  - `source_context` có thể là `null`, `undefined`, hoặc mang `source_type`/`schema_version` khác (từ các nguồn C7c-1 backend).
  - Không dùng toán tử ép kiểu thiếu an toàn `as Triz9WindowsSourceContext`.
  - Chưa xử lý hoặc hiển thị các variant lạ trong pilot này.

### 4.3. Runtime Validation Helper Dự Kiến (Cho Phase GREEN)
Đề xuất tạo module tiện ích độc lập tại `apps/web/lib/triz-9-windows-context-validator.ts`:
```typescript
const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/

export function validateTriz9WindowsContext(
  context: unknown
): { valid: true; data: Triz9WindowsSourceContext } | { valid: false; error: string } {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return { valid: false, error: 'Context phải là một object' }
  }
  const obj = context as Record<string, unknown>
  const allowedKeys = new Set(['schema_version', 'source_type', 'lens', 'level', 'time', 'cell_label'])
  for (const k of Object.keys(obj)) {
    if (!allowedKeys.has(k)) {
      return { valid: false, error: `Trường không cho phép: ${k}` }
    }
  }
  if (obj.schema_version !== 1) {
    return { valid: false, error: 'schema_version phải bằng 1' }
  }
  if (obj.source_type !== 'triz_9_windows') {
    return { valid: false, error: 'source_type phải là triz_9_windows' }
  }
  if (!['engineering', 'business', 'everyday'].includes(obj.lens as string)) {
    return { valid: false, error: 'lens không hợp lệ' }
  }
  if (!['supersystem', 'system', 'subsystem'].includes(obj.level as string)) {
    return { valid: false, error: 'level không hợp lệ' }
  }
  if (!['past', 'present', 'future'].includes(obj.time as string)) {
    return { valid: false, error: 'time không hợp lệ' }
  }
  if (typeof obj.cell_label !== 'string') {
    return { valid: false, error: 'cell_label phải là chuỗi' }
  }
  if (CONTROL_CHAR_REGEX.test(obj.cell_label)) {
    return { valid: false, error: 'cell_label chứa ký tự điều khiển hoặc ngắt dòng không hợp lệ' }
  }
  if (!obj.cell_label.trim()) {
    return { valid: false, error: 'cell_label không được rỗng hoặc chỉ chứa khoảng trắng' }
  }
  if (Array.from(obj.cell_label).length > 100) {
    return { valid: false, error: 'cell_label không được vượt quá 100 ký tự' }
  }
  return { valid: true, data: obj as unknown as Triz9WindowsSourceContext }
}
```

---

## 5. Kịch Bản Gherkin Bắt Buộc (BDD Specifications)

### Kịch bản 1: Lưu một cell 9-Windows, sửa thêm nhận xét rồi submit thành công
```gherkin
Feature: TRIZ 9-Windows source_context transmission to Research Notebook

  Scenario: Lưu cell 9-Windows, cá nhân hóa nội dung và lưu ghi chú thành công
    Given Người dùng đang xem Sơ đồ 9 Màn hình TRIZ với lăng kính "engineering"
    And Ô "Hệ thống • Hiện tại" có nhãn "Hệ thống kỹ thuật hiện tại"
    When Người dùng nhấn "Lưu vào sổ tay" tại ô này
    Then Giao diện tự động chuyển sang tab "notebook"
    And Form soạn thảo hiển thị nội dung mẫu trích xuất từ ô 9-Windows
    And Bản nháp đang lưu trữ source_context với schema_version=1, source_type="triz_9_windows", lens="engineering", level="system", time="present", cell_label="Hệ thống kỹ thuật hiện tại"
    When Người dùng gõ thêm vào cuối nội dung: "\nNhận xét cá nhân: Cần chú ý chi phí bảo trì."
    And Người dùng đổi phân loại ghi chú thành "Hypothesis"
    And Người dùng nhấn nút "Lưu ghi chú"
    Then API "POST /api/v1/sessions/{id}/notes" được gọi với payload:
      """json
      {
        "content": "[TRIZ 9-Windows: Lăng kính Kỹ thuật & Công nghệ • Hệ thống - Hiện tại: Hệ thống kỹ thuật hiện tại]\n...\nNhận xét cá nhân: Cần chú ý chi phí bảo trì.",
        "note_type": "hypothesis",
        "source_chunk_id": null,
        "source_context": {
          "schema_version": 1,
          "source_type": "triz_9_windows",
          "lens": "engineering",
          "level": "system",
          "time": "present",
          "cell_label": "Hệ thống kỹ thuật hiện tại"
        }
      }
      """
    And Bản nháp được dọn sạch sau khi lưu thành công
    And Lần tạo ghi chú thủ công tiếp theo không chứa source_context của ô 9-Windows.
```

### Kịch bản 2: Draft dirty, nhận cell khác rồi hủy overwrite
```gherkin
  Scenario: Bảo vệ bản nháp chưa lưu khi hủy ghi đè từ cell 9-Windows mới
    Given Người dùng đã soạn dở nội dung "Phân tích mâu thuẫn nhiệt độ động cơ" trong Notebook
    And Trạng thái form đang dirty
    When Người dùng chuyển sang tab "structuring", mở 9-Windows và nhấn "Lưu vào sổ tay" tại ô "Siêu hệ thống • Tương lai"
    Then Hộp thoại xác nhận ghi đè xuất hiện với thông báo "Ghi đè bản nháp chưa lưu?"
    When Người dùng nhấn nút "Hủy" (hoặc phím Escape)
    Then Hộp thoại xác nhận đóng lại
    And Người dùng quay lại tab "notebook"
    And Nội dung "Phân tích mâu thuẫn nhiệt độ động cơ" vẫn được giữ nguyên
    And source_context mới không bị ghi đè vào bản nháp hiện tại.
```

### Kịch bản 3: Cell / context không hợp lệ bị chặn an toàn
```gherkin
  Scenario: Chặn tạo nháp và submit khi dữ liệu cell vi phạm hợp đồng context
    Given Dữ liệu ô 9-Windows bị lỗi chứa nhãn cell_label chỉ gồm khoảng trắng hoặc ký tự điều khiển "\n"
    When Người dùng nhấn nút "Lưu vào sổ tay" tại ô bị lỗi đó
    Then Hệ thống KHÔNG chuyển sang tab "notebook"
    And Hệ thống KHÔNG cập nhật bản nháp NoteDraft
    And Một thông báo lỗi accessible hiển thị ngay tại ô nguồn: "Dữ liệu ô không hợp lệ để lưu vào sổ tay"
    And Nếu một payload có context bị lỗi bằng cách nào đó tới được bước submit của Notebook:
      Then Form hiển thị lỗi dạng chuỗi
      And Hệ thống KHÔNG thực hiện gọi API POST
      And Hệ thống KHÔNG tự ý retry bằng cách gỡ bỏ context để gửi lén note.
```

### Kịch bản 4: Context sai kiểu falsy không được coi là context vắng mặt
```gherkin
  Scenario: Context sai kiểu falsy không được coi là context vắng mặt
    Given draft có source_context sai kiểu (ví dụ: boolean false, number 0, chuỗi rỗng "", hoặc NaN)
    When Người dùng lưu ghi chú
    Then Hệ thống KHÔNG thực hiện gọi API createResearchNote
    And Form hiển thị lỗi accessible về context không hợp lệ
    And Nội dung nháp và note_type được giữ nguyên vẹn.
```

### Kịch bản 5: Context vắng mặt vẫn cho phép lưu note thủ công
```gherkin
  Scenario: Context vắng mặt vẫn cho phép lưu note
    Given source_context là null hoặc undefined
    When Người dùng lưu ghi chú
    Then Hệ thống gọi API createResearchNote với payload không mang context cũ
    And Ghi chú được lưu thành công với giá trị SQL NULL trong cơ sở dữ liệu.
```

---

## 6. Kế Hoạch Kiểm Thử 14 Nhóm Bắt Buộc

| Nhóm | Mục Tiêu Kiểm Thử | File Test Dự Kiến |
| :--- | :--- | :--- |
| **1** | Cell save tạo đúng context đủ `schema_version`, `lens`, `level`, `time`, `cell_label`. | `triz-nine-windows-source-context.test.tsx` |
| **2** | Context khớp lens thực tế đang hiển thị (`business`, `everyday`, `engineering`). | `triz-nine-windows-source-context.test.tsx` |
| **3** | Đổi lens / trạng thái loading không ghép nhầm cell cũ với lens mới. | `triz-nine-windows-source-context.test.tsx` |
| **4** | `content`, `note_type: 'insight'`, `source_chunk_id: null` giữ nguyên format baseline. | `triz-nine-windows-source-context.test.tsx` |
| **5** | Invalid context ở cell nguồn bị chặn, hiển thị lỗi, không gọi callback, không chuyển tab. | `triz-nine-windows-source-context.test.tsx` |
| **6** | Notebook submit chuyển `source_context` nguyên vẹn tới hàm `createResearchNote`. | `research-notebook-source-context.test.tsx` |
| **7** | Người dùng sửa `content` hoặc `note_type` vẫn giữ nguyên `source_context` nguồn gốc. | `research-notebook-source-context.test.tsx` |
| **8** | Draft không có context (hoặc ghi chú thủ công) vẫn gửi payload cũ, không gửi object `{}`. | `research-notebook-source-context.test.tsx` |
| **9** | Invalid context khi submit bị chặn: không gọi API POST, hiển thị lỗi chuỗi, giữ draft. | `research-notebook-source-context.test.tsx` |
| **10** | Overwrite conflict: Cancel giữ nguyên context cũ; Confirm thay thế context mới đồng bộ. | `session-detail-source-context.test.tsx` |
| **11** | Discard draft và Save note thành công reset sạch draft, không rò context sang note kế tiếp. | `session-detail-source-context.test.tsx` |
| **12** | Đổi `sessionId` reset toàn bộ draft và context, không rò rỉ xuyên session. | `session-detail-source-context.test.tsx` |
| **13** | Backend trả về 422 (detail string hoặc array): UI hiển thị chuỗi an toàn, không crash React, giữ nguyên draft. | `research-notebook-source-context.test.tsx` |
| **14** | Chế độ Standalone read-only, C6 Use insight, C7b Copy clipboard và 464 baseline tests không bị regression. | Full suite regression check |

---

## 7. Ghi Nhận Giới Hạn Nghiệm Thu Thực Tế (Pilot C7c-2a Scope)

- **Đã kiểm chứng (Runtime Data Isolation PASS)**:
  - Note tạo từ 9-Windows (`fd44ef7e-4b24-4d04-a1d8-9e2148352052`) được lưu trữ với đầy đủ 6 trường context chuẩn xác dạng JSONB Object.
  - Note tạo thủ công sau đó (`345eee5c-28f1-4d0c-9736-b8825821253d`) được ghi nhận là chuẩn `SQL NULL` (`source_context IS NULL = true`).
  - Dữ liệu API và Database hoàn toàn đồng nhất.
- **Giới hạn nghiệm thu thủ công**:
  - Do chưa xác nhận liệu người dùng có reload trang hay chuyển session giữa 2 lần lưu trên UI hay không, tài liệu chỉ ghi nhận nghiệm thu cho khía cạnh **cô lập dữ liệu runtime** (Runtime Data Isolation PASS), không tuyên bố đã chứng minh hành vi reset ngay tức thì trên cùng một trang (same-page immediate reset) nếu không reload.
