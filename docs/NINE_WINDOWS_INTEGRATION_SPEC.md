# Đặc Tả Tích Hợp: TRIZ 9-Windows Vào Luồng Problem Framing (Batch C3a)

## 1. Mục Đích (Purpose)
Tích hợp trực quan hóa công cụ tư duy kinh điển TRIZ 9-Windows (System Operator / Multi-Screen Scheme) vào giai đoạn Phân tích cấu trúc bài toán (`NormalizedView` thuộc tab `structuring`) của phiên nghiên cứu (`ResearchSession`).

Mục tiêu là hỗ trợ nhà nghiên cứu mở rộng góc nhìn nhận thức về không gian (Siêu hệ thống / Hệ thống / Phân hệ) và thời gian (Quá khứ / Hiện tại / Tương lai) ngay sau khi bài toán được chuẩn hóa, giúp nhận diện mâu thuẫn sâu sắc hơn mà không làm gián đoạn luồng làm việc tuyến tính hiện hữu.

---

## 2. Phạm Vi & Ranh Giới (Scope & Boundary)

### 2.1. In Scope
- Thêm một khối mở rộng/thu gọn (Collapsible Section) nằm bên trong component `<NormalizedView />` (`apps/web/features/structuring/normalized-view.tsx`).
- **Trạng thái mặc định**: **ĐÓNG (`isExpanded = false`)** khi người dùng truy cập tab `structuring`.
- **Tiêu đề điều khiển**: *"Mở rộng góc nhìn hệ thống đa chiều (TRIZ 9-Windows)"*.
- **Hành vi khi Mở (`isExpanded = true`)**:
  - Render component `<TrizNineWindows />` hiện có ở chế độ thuần chỉ đọc.
  - Tự động kích hoạt truy vấn dữ liệu với lăng kính mặc định là `engineering`.
- **Hành vi khi Đóng (`isExpanded = false`)**:
  - Sử dụng conditional rendering (`{isExpanded && <TrizNineWindows />}`).
  - Tuyệt đối không render 9 ô cửa sổ (không có các phần tử `role="article"`) trong cây DOM.
  - Không kích hoạt truy vấn mạng (không gọi API `getTrizNineWindows`).
- **Khả năng tiếp cận (A11y)**:
  - Nút bấm điều khiển có accessible name rõ ràng chứa cụm từ *"Mở rộng góc nhìn hệ thống đa chiều (TRIZ 9-Windows)"*.
  - Thuộc tính `aria-expanded="false"` khi đóng và `aria-expanded="true"` khi mở.

### 2.2. Out of Scope (Cấm Tuyệt Đối Trong Batch C3a)
- KHÔNG ánh xạ `session.domain` sang lens (luôn sử dụng lens mặc định `engineering` khi mở lần đầu).
- KHÔNG có nút "Lưu vào Notebook" (`onSaveAsNote`) hay cơ chế chuyển ghi chú trong Batch C3a.
- KHÔNG cho phép chỉnh sửa trực tiếp nội dung các ô 9-Windows.
- KHÔNG lưu trạng thái đóng/mở hoặc lựa chọn lăng kính vào cơ sở dữ liệu (`ProblemFrame` / `ResearchSession`) hay `localStorage`.
- KHÔNG thay đổi `WorkflowEngine` hay Finite State Machine (FSM); 9-Windows là công cụ hỗ trợ tư duy phi-FSM (non-blocking thinking tool).
- KHÔNG thêm route mới, không thay đổi thanh điều hướng toàn cục của ứng dụng.
- KHÔNG cài đặt thêm bất kỳ thư viện (dependency) bên ngoài nào.

---

## 3. Ranh Giới Tích Hợp Kỹ Thuật (Integration Boundary)

1. **Hợp đồng Dữ liệu (Data Contract Boundary)**:
   - `<NormalizedView />` chỉ đóng vai trò container bọc và điều khiển hiển thị `<TrizNineWindows />`.
   - Tuyệt đối không truyền chuỗi văn bản của `ProblemFrame` (`raw_statement`, `normalized_statement`) vào API backend của 9-Windows.
   - Endpoint backend giữ nguyên: `GET /api/v1/triz/nine-windows?lens=engineering|business|everyday`.

2. **Ranh giới Vòng đời Component (Lifecycle Boundary)**:
   - Sử dụng React state cục bộ: `const [isNineWindowsOpen, setIsNineWindowsOpen] = useState(false)`.
   - Cơ chế unmount khi đóng đảm bảo không tồn đọng query listeners hoặc hiệu ứng phụ khi người dùng không có nhu cầu tham chiếu.

---

## 4. Kịch Bản Kiểm Thử Gherkin (Given-When-Then)

### Kịch bản 1: Mặc định Collapsible Section đóng và không gọi API
```gherkin
Scenario: Trạng thái mặc định khi hiển thị NormalizedView
  Given người dùng truy cập tab "Phân tích cấu trúc" với một ProblemFrame hợp lệ
  When màn hình NormalizedView được render
  Then khối "TRIZ 9-Windows" ở trạng thái đóng (collapsed)
  And nút điều khiển có aria-expanded="false"
  And không có phần tử role="article" nào của 9-Windows xuất hiện trong DOM
  And API getTrizNineWindows không được gọi
```

### Kịch bản 2: Mở rộng Section và nạp dữ liệu lăng kính Kỹ thuật
```gherkin
Scenario: Người dùng bấm mở rộng khối 9-Windows
  Given khối 9-Windows đang ở trạng thái đóng
  When người dùng click vào nút "Mở rộng góc nhìn hệ thống đa chiều (TRIZ 9-Windows)"
  Then nút điều khiển chuyển sang aria-expanded="true"
  And component TrizNineWindows được mount vào DOM
  And API getTrizNineWindows được kích hoạt chính xác với tham số lens="engineering"
  And không có nội dung văn bản của ProblemFrame bị gửi kèm vào API request
  And 9 ô cửa sổ với role="article" xuất hiện đầy đủ trong DOM
```

### Kịch bản 3: Thu gọn Section ẩn toàn bộ nội dung khỏi DOM
```gherkin
Scenario: Người dùng đóng lại khối 9-Windows đã mở
  Given khối 9-Windows đang được mở và hiển thị đầy đủ 9 ô cửa sổ
  When người dùng click lại vào nút điều khiển
  Then nút điều khiển chuyển về aria-expanded="false"
  And toàn bộ các phần tử role="article" của 9-Windows bị xóa hoàn toàn khỏi DOM
```

### Kịch bản 4: Độc lập với domain của Session
```gherkin
Scenario: Lăng kính ban đầu luôn là Kỹ thuật bất kể domain của ProblemFrame
  Given ProblemFrame có trường domain là "business" hoặc "life"
  When người dùng mở khối 9-Windows
  Then API getTrizNineWindows vẫn được gọi với lens="engineering"
  And nút "Kỹ thuật" mang thuộc tính aria-pressed="true"
```

### Kịch bản 5: Khả năng tiếp cận của nút điều khiển
```gherkin
Scenario: Đảm bảo tiêu chuẩn tiếp cận A11y cho nút điều khiển
  Given màn hình NormalizedView đang hiển thị
  When người dùng điều hướng qua trình đọc màn hình
  Then tìm thấy nút bấm có tên tiếp cận chứa "TRIZ 9-Windows" hoặc "Mở rộng góc nhìn"
  And trạng thái aria-expanded phản ánh chính xác trạng thái hiển thị
```

### Kịch bản 6: Kỷ luật Thuần Chỉ Đọc (Không có nút Lưu Notebook)
```gherkin
Scenario: Đảm bảo không hiển thị nút lưu vào Notebook trong Batch C3a
  Given khối 9-Windows đang mở
  When kiểm tra nội dung hiển thị của các ô cửa sổ
  Then không tìm thấy bất kỳ nút bấm hoặc điều khiển nào có tên "Lưu vào Notebook" hoặc "Lưu ghi chú"
```

---

## 5. Danh Sách File Ảnh Hưởng (File Impact List)

1. `docs/NINE_WINDOWS_INTEGRATION_SPEC.md` *(Tạo mới — Đặc tả kỹ thuật C3a)*
2. `docs/ADR-006-nine-windows-structuring-integration.md` *(Tạo mới — Quyết định kiến trúc C3a)*
3. `apps/web/features/structuring/__tests__/normalized-view.test.tsx` *(Tạo mới — Test suite RED)*
4. *(Pha GREEN tiếp theo: `apps/web/features/structuring/normalized-view.tsx`)*

---

## 6. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

- [ ] Đặc tả và ADR được tạo đầy đủ, tuân thủ nguyên tắc Read-before-write và loại bỏ các tuyên bố tuyệt đối.
- [ ] Bộ test RED mới trong `normalized-view.test.tsx` thất bại chính xác do chưa cài đặt tính năng collapsible nhúng `TrizNineWindows`.
- [ ] Toàn bộ 358 tests hiện hữu của frontend tiếp tục PASS 100%.
- [ ] Tuyệt đối không can thiệp vào production code trong pha RED.
