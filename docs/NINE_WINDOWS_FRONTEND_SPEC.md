# Đặc Tả Kỹ Thuật Frontend: TRIZ 9-Windows System Operator Viewer (Batch C2)

## 1. Mục Đích (Purpose)
Xây dựng giao diện web chỉ đọc (Read-only Viewer) cho công cụ tư duy kinh điển TRIZ 9-Windows (System Operator / Multi-Screen Scheme), cho phép nhà nghiên cứu và người dùng trực quan hóa vấn đề sáng tạo trên lưới 2 chiều:
- **Cấp độ hệ thống (System Levels)**: Siêu hệ thống (`supersystem`), Hệ thống (`system`), Phân hệ (`subsystem`).
- **Chân trời thời gian (Time Horizons)**: Quá khứ (`past`), Hiện tại (`present`), Tương lai (`future`).
- **3 Lăng kính nhận thức**: Kỹ thuật (`engineering`), Kinh doanh (`business`), Đời sống (`everyday`).

---

## 2. Phạm Vi & Ranh Giới (Scope Boundaries & Risk Assessment)

### 2.1. In Scope
- Tuyến đường chuyên dụng: `/triz/nine-windows`.
- Bộ chuyển đổi 3 lăng kính (Lens Segmented Control) với lăng kính mặc định là `engineering`.
- Bố cục lưới tương thích đơn DOM (Single DOM tree with responsive CSS, tuyệt đối không nhân đôi DOM giữa desktop và mobile):
  - **Desktop ($\ge 768\text{px}$)**: Lưới ma trận 3 cột (Thời gian) $\times$ 3 hàng (Cấp độ hệ thống).
  - **Mobile ($< 768\text{px}$)**: Stacked cards theo nhóm Cấp độ hệ thống (`supersystem` $\rightarrow$ `system` $\rightarrow$ `subsystem`), bên trong mỗi nhóm xếp tuần tự theo Chân trời thời gian (`past` $\rightarrow$ `present` $\rightarrow$ `future`).
  - Không sử dụng accordion đóng/mở làm gián đoạn việc quét thông tin.
- Hiển thị đầy đủ nội dung ô: `label_vi`, `prompt_vi`, `description_vi`.
- Hiển thị nhãn Tiếng Anh (`label_en`) nếu có; không hiển thị element thừa nếu không có.
- Hiển thị danh sách ví dụ (`examples_vi`) chỉ khi mảng có phần tử; nếu `examples_vi` là `[]` hoặc `undefined` thì không render khối rỗng.
- Trạng thái nạp dữ liệu: Skeleton loader 3x3 với `data-testid="nine-windows-loading"`.
- Trạng thái lỗi: Alert thông báo với `data-testid="nine-windows-error"` kèm nút "Thử lại" (Retry).
- Sử dụng React Query v5 để fetch và cache dữ liệu với queryKey `['triz', 'nine-windows', lens]`.

### 2.2. Out of Scope (Cấm Tuyệt Đối)
- Không có nút `onSaveAsNote` hoặc liên kết trực tiếp ghi vào Notebook.
- Không chỉnh sửa nội dung cell inline.
- Không export JSON/PDF.
- Không lưu trạng thái vào localStorage hoặc bất kỳ cơ chế client-side persistence nào.
- Không sửa đổi hoặc can thiệp vào `ProblemFrame`, `WorkflowEngine` hay database.
- Không cài thêm thư viện phụ thuộc mới.

### 2.3. Đánh Giá Rủi Ro Có Kiểm Soát (Bounded Risk Assessment)
Không sử dụng các tuyên bố tuyệt đối ("blast radius = 0", "an toàn tuyệt đối"). Tính năng chạm vào một số thành phần dùng chung với phạm vi ảnh hưởng được kiểm soát chặt chẽ:
1. `apps/web/lib/types.ts`: Bổ sung kiểu dữ liệu mới (`TrizNineWindowsLens`, `TrizNineWindowsResponse`, ...). Rủi ro xung đột namespace hoặc type compile error được cô lập qua TypeScript build check và unit test.
2. `apps/web/lib/api-client.ts`: Bổ sung hàm export `getTrizNineWindows` dùng chung instance `apiClient` axios. Rủi ro tác động request interceptor/baseURL được kiểm soát qua isolated API client test.
3. `apps/web/app/page.tsx`: Bổ sung liên kết điều hướng trong `<nav aria-label="Điều hướng chính">`. Rủi ro vỡ layout responsive của navigation bar được kiểm tra trực quan và qua hồi quy RTL.

---

## 3. Tuyến Đường & Điều Hướng (Route & Navigation)
- **URL Route**: `/triz/nine-windows`
- **Page File**: `apps/web/app/triz/nine-windows/page.tsx`
- **Component File**: `apps/web/features/triz/triz-nine-windows.tsx`
- **Navigation**: Thêm liên kết `<Link href="/triz/nine-windows">9 Cửa sổ</Link>` vào menu điều hướng `<nav aria-label="Điều hướng chính">` tại `apps/web/app/page.tsx`.

---

## 4. Hợp Đồng Dữ Liệu Frontend (Data Contract)
- **Endpoint**: `GET /api/v1/triz/nine-windows?lens=engineering|business|everyday`
- **TypeScript Types**:
  ```typescript
  export type TrizNineWindowsLens = 'engineering' | 'business' | 'everyday'
  export type TrizSystemLevel = 'supersystem' | 'system' | 'subsystem'
  export type TrizTimeHorizon = 'past' | 'present' | 'future'

  export interface TrizNineWindowsCell {
    level: TrizSystemLevel
    time: TrizTimeHorizon
    label_vi: string
    prompt_vi: string
    description_vi: string
    label_en?: string
    examples_vi?: string[]
  }

  export interface TrizNineWindowsMeta {
    total_windows: number
    system_levels: string[]
    time_horizons: string[]
  }

  export interface TrizNineWindowsResponse {
    lens: TrizNineWindowsLens
    lens_title: string
    grid: TrizNineWindowsCell[]
    meta: TrizNineWindowsMeta
  }
  ```
- **Thứ tự 9 ô Canonical (Canonical Grid Order)**:
  1. `(supersystem, past)`
  2. `(supersystem, present)`
  3. `(supersystem, future)`
  4. `(system, past)`
  5. `(system, present)`
  6. `(system, future)`
  7. `(subsystem, past)`
  8. `(subsystem, present)`
  9. `(subsystem, future)`

---

## 5. Thiết Kế Bố Cục UI & Semantics (Layout & Accessibility)

### 5.1. Kiến Trúc Bố Cục Responsive Đơn DOM (Single DOM Responsive Architecture)
- Tuyệt đối không sinh 2 cây DOM song song cho desktop và mobile (tránh lãng phí bộ nhớ và lỗi accessibility do trùng lặp ID/role).
- Sử dụng CSS Grid / Flexbox tương thích:
  - **Desktop ($\ge 768\text{px}$, `md:` trở lên)**: `grid grid-cols-3 gap-4`. Hiển thị tiêu đề cột (Quá khứ, Hiện tại, Tương lai) và tiêu đề dòng (Siêu hệ thống, Hệ thống, Phân hệ).
  - **Mobile ($< 768\text{px}$)**: Các ô tự động xếp chồng dạng stacked cards, nhóm theo 3 cấp độ hệ thống từ trên xuống dưới: Siêu hệ thống $\rightarrow$ Hệ thống $\rightarrow$ Phân hệ. Trong mỗi cấp độ, 3 ô thời gian xuất hiện theo thứ tự: Quá khứ $\rightarrow$ Hiện tại $\rightarrow$ Tương lai.

### 5.2. Cấu Trúc Ngữ Nghĩa & Khả Năng Tiếp Cận (Semantics & A11y)
- **Cell Card Semantic**: Mỗi ô cửa sổ là một `<article role="article">` mang `aria-label` cấu trúc:
  `aria-label="{Tên cấp độ} • {Tên thời gian}: {label_vi}"`
  Ví dụ: `aria-label="Siêu hệ thống • Quá khứ: Hạ tầng kỹ thuật quá khứ"`.
- **Heading Structure**:
  - `h1`: Tiêu đề chính trang 9 Cửa sổ TRIZ.
  - `h2`: Tiêu đề các nhóm / lăng kính nhận thức.
  - `h3`: Tiêu đề `label_vi` bên trong mỗi cell card.
- **Badge Tọa Độ**: Hiển thị rõ ràng `{Tên cấp độ} • {Tên thời gian}` (ví dụ: `Hệ thống • Hiện tại`).
- **Nội Dung Ô**:
  - `label_vi`: Hiển thị ở thẻ heading `h3`.
  - `label_en`: Hiển thị dưới dạng phụ đề tiếng Anh (`text-xs text-muted-foreground italic`), chỉ render khi có dữ liệu.
  - `prompt_vi`: Khối câu hỏi định hướng tư duy với icon nhận diện (`HelpCircle` hoặc `Lightbulb`).
  - `description_vi`: Mô tả diễn giải chi tiết của ô.
  - `examples_vi`: Danh sách ví dụ thực tế. Chỉ render khối chứa ví dụ khi `examples_vi` tồn tại và có ít nhất 1 phần tử. Không render placeholder hay container rỗng khi `examples_vi: []` hoặc `undefined`.
- **Bộ Chọn Lăng Kính (Lens Switcher)**:
  - Chứa trong `<div role="group" aria-label="Chọn lăng kính TRIZ">`.
  - 3 nút bấm tương ứng: "Kỹ thuật", "Kinh doanh", "Đời sống".
  - Nút đang được chọn mang `aria-pressed="true"`, các nút còn lại mang `aria-pressed="false"`.

---

## 6. Kịch Bản Kiểm Thử Gherkin (Given-When-Then Scenarios)

### Kịch bản 1: Mặc định hiển thị Lăng kính Kỹ thuật
```gherkin
Scenario: Hiển thị mặc định lăng kính kỹ thuật khi truy cập trang
  Given người dùng truy cập route "/triz/nine-windows"
  When trang tải dữ liệu thành công từ API
  Then nút lăng kính "Kỹ thuật" có thuộc tính aria-pressed="true"
  And endpoint "/api/v1/triz/nine-windows" được gọi với params { lens: "engineering" }
  And đúng 9 ô cửa sổ được render trên màn hình theo đúng thứ tự canonical
```

### Kịch bản 2: Chuyển đổi Lăng kính (Lens Switching)
```gherkin
Scenario: Người dùng chuyển đổi lăng kính sang Kinh doanh và Đời sống
  Given trang 9 Cửa sổ đang hiển thị lăng kính "Kỹ thuật"
  When người dùng click vào nút "Kinh doanh"
  Then nút "Kinh doanh" chuyển sang aria-pressed="true" và nút "Kỹ thuật" chuyển sang aria-pressed="false"
  And API client gửi request với params { lens: "business" }
  And nội dung 9 ô cửa sổ được cập nhật tương ứng với dữ liệu lăng kính Kinh doanh
  When người dùng click vào nút "Đời sống"
  Then nút "Đời sống" chuyển sang aria-pressed="true"
  And API client gửi request với params { lens: "everyday" }
  And nội dung 9 ô cửa sổ được cập nhật tương ứng với dữ liệu lăng kính Đời sống
```

### Kịch bản 3: Đảm bảo thứ tự Canonical và ngữ nghĩa Accessibility
```gherkin
Scenario: Thứ tự và ngữ nghĩa của 9 ô cửa sổ trong cây DOM
  Given dữ liệu 9-Windows đã được tải thành công
  When truy vấn tất cả các phần tử có role="article"
  Then tìm thấy chính xác 9 phần tử
  And thứ tự xuất hiện của 9 phần tử trong DOM tuân thủ nghiêm ngặt:
    | Vị trí | Cấp độ (Level) | Chân trời thời gian (Time) |
    | 1      | supersystem    | past                       |
    | 2      | supersystem    | present                    |
    | 3      | supersystem    | future                     |
    | 4      | system         | past                       |
    | 5      | system         | present                    |
    | 6      | system         | future                     |
    | 7      | subsystem      | past                       |
    | 8      | subsystem      | present                    |
    | 9      | subsystem      | future                     |
  And mỗi phần tử article sở hữu aria-label chứa đầy đủ thông tin cấp độ, thời gian và tiêu đề tiếng Việt
```

### Kịch bản 4: Hiển thị đầy đủ nội dung bên trong từng ô
```gherkin
Scenario: Hiển thị chi tiết nội dung từng ô cửa sổ
  Given dữ liệu 9-Windows hợp lệ được cung cấp
  When kiểm tra từng ô cửa sổ (cell) bằng phạm vi within(cell)
  Then mỗi ô đều hiển thị đầy đủ:
    - Tiêu đề tiếng Việt (label_vi)
    - Câu hỏi định hướng tư duy (prompt_vi)
    - Đoạn mô tả chi tiết (description_vi)
```

### Kịch bản 5: Xử lý trường ví dụ tùy chọn (examples_vi)
```gherkin
Scenario: Xử lý an toàn khi examples_vi có dữ liệu, rỗng hoặc bị khuyết
  Given dữ liệu ô cửa sổ có mảng examples_vi chứa ít nhất 1 chuỗi ký tự
  When ô cửa sổ được render
  Then danh sách các ví dụ thực tế được hiển thị đầy đủ
  Given dữ liệu ô cửa sổ có examples_vi là mảng rỗng []
  When ô cửa sổ được render
  Then không có phần tử container danh sách ví dụ nào được render trong DOM
  Given dữ liệu ô cửa sổ bị khuyết trường examples_vi (undefined)
  When ô cửa sổ được render
  Then không có phần tử container danh sách ví dụ nào được render trong DOM
```

### Kịch bản 6: Xử lý nhãn tiếng Anh tùy chọn (label_en)
```gherkin
Scenario: Hiển thị nhãn tiếng Anh khi có và ẩn khi không có
  Given ô cửa sổ có trường label_en hợp lệ
  When ô cửa sổ được render
  Then phụ đề tiếng Anh (label_en) xuất hiện trong ô
  Given ô cửa sổ không có trường label_en (undefined)
  When ô cửa sổ được render
  Then không có placeholder hoặc văn bản "undefined" nào xuất hiện trong ô
```

### Kịch bản 7: Trạng thái nạp dữ liệu (Loading Skeleton)
```gherkin
Scenario: Hiển thị skeleton loading trong lúc chờ phản hồi từ API
  Given người dùng truy cập trang hoặc đổi lăng kính và request đang được xử lý
  When trạng thái truy vấn là isLoading
  Then khối skeleton nạp dữ liệu với data-testid="nine-windows-loading" được hiển thị
  And nội dung 9 ô thực tế chưa xuất hiện
```

### Kịch bản 8: Xử lý lỗi API (Lỗi 422 hoặc mạng) và cơ chế Thử lại (Retry)
```gherkin
Scenario: Hiển thị thông báo lỗi và phục hồi thành công khi thử lại
  Given backend trả về lỗi HTTP 422 Unprocessable Entity hoặc lỗi mất mạng
  When trạng thái truy vấn là isError
  Then thông báo lỗi với data-testid="nine-windows-error" được hiển thị
  And nút "Thử lại" xuất hiện trên giao diện
  When người dùng click vào nút "Thử lại"
  Then hệ thống kích hoạt yêu cầu fetch lại dữ liệu từ backend
  And nếu lần gọi lại thành công, giao diện chuyển sang hiển thị đầy đủ 9 ô cửa sổ
```

---

## 7. Tiêu Chí Nghiệm Thu (Acceptance Criteria)
- [ ] Spec và ADR phản ánh trung thực kiến trúc single-DOM responsive, loại bỏ tuyên bố tuyệt đối, minh định rủi ro có kiểm soát.
- [ ] Kịch bản Gherkin được ánh xạ 1:1 sang các test case RTL trong `apps/web/features/triz/__tests__/triz-nine-windows.test.tsx`.
- [ ] Bộ test RED thất bại đúng nguyên nhân (chưa cài đặt component và client method).
- [ ] Toàn bộ 339 tests hiện hữu của frontend tiếp tục PASS 100%.
- [ ] Dừng lại chờ Chủ dự án phê duyệt trước khi chuyển sang pha GREEN.
