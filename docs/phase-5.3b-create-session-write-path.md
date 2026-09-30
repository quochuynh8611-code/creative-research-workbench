# Phase 5.3b — Create Session Write Path (Mini Spec & ADR)

## 1. Bối cảnh
Sau khi hoàn thiện Phase 5.3a (Session List Read Path) kết nối đường đọc danh sách Research Sessions từ backend qua TanStack Query, trang `/sessions` đã có nút "Tạo session mới" nhưng chưa có luồng tương tác và mutation để gửi dữ liệu lên endpoint `POST /api/v1/sessions`.

Phase 5.3b bổ sung write path tối giản cho việc tạo Research Session mới ngay tại giao diện danh sách `/sessions`.

---

## 2. Phạm vi
- **UI:** Bổ sung Inline Expandable Creation Panel bên trong `apps/web/features/session/session-list.tsx`.
- **Logic:** Tích hợp `useMutation` từ TanStack Query gọi helper `createSession()` trong `apps/web/lib/api-client.ts`.
- **Test:** Mở rộng bộ kiểm thử React Component trong `apps/web/features/session/__tests__/session-list.test.tsx` bao phủ toàn bộ luồng tạo, validation, loading, success và error.

---

## 3. Quyết định Kiến trúc & Thiết kế
1. **UI Shell:** Sử dụng **Inline Expandable Creation Panel** xuất hiện ngay dưới Header của trang danh sách khi người dùng bấm "Tạo session mới". Không dùng Modal/Dialog hay Sheet phức tạp ở phase này để giảm blast radius và giữ luồng làm việc liền mạch.
2. **Form Fields:**
   - `Tiêu đề session *` (`string`, bắt buộc, auto-focus).
   - `Mô tả` (`string`, tùy chọn).
   - `Lĩnh vực` (`DomainType`, mặc định: `'technical'`).
   - `Tags` (nhập chuỗi phân cách bằng dấu phẩy, tự động parse thành `string[]`).
3. **Data Mutation & Query Invalidation:**
   - Quản lý qua `useMutation({ mutationFn: createSession })`.
   - Trong `onSuccess`: Đóng panel, reset form fields, và kích hoạt `queryClient.invalidateQueries({ queryKey: ['sessions'] })` để làm mới danh sách và cập nhật tổng số lượng (`meta.total`) từ backend.
4. **Validation & Submit Guard:**
   - Kiểm tra `title.trim()` trước khi submit. Nếu rỗng, hiển thị thông báo lỗi tiếng Việt `"Vui lòng nhập tiêu đề session"` và chặn gửi request.
   - Khi đang submit (`isPending === true`): Vô hiệu hóa inputs/buttons, nút submit hiển thị spinner `Loader2` và nhãn `"Đang tạo..."` để chống double submit.
5. **Error Handling:**
   - Khi server trả lỗi: Hiển thị error alert chi tiết trong panel, **giữ form mở và giữ nguyên dữ liệu đã nhập** để người dùng sửa đổi và thử lại.
   - Nút `"Hủy"` cho phép người dùng đóng panel bất cứ lúc nào.

---

## 4. Hành vi Mong muốn
- **State `idle`:** Form đóng, hiển thị nút "Tạo session mới".
- **State `editing`:** Form mở, người dùng nhập liệu các trường `title`, `description`, `domain`, `tags`.
- **State `submitting`:** Nút bấm disable, hiển thị trạng thái đang tạo.
- **State `submit_success`:** Form đóng, dữ liệu reset, danh sách session tự động cập nhật item mới.
- **State `submit_error`:** Form giữ nguyên, hiển thị thông báo lỗi từ server.

---

## 5. Gherkin Scenarios

### Scenario 1: Mở và đóng form tạo session mới
```gherkin
Given người dùng đang ở trang danh sách sessions
When người dùng bấm nút "Tạo session mới"
Then một panel form tạo session xuất hiện với các trường "Tiêu đề", "Mô tả", "Lĩnh vực", "Tags"
When người dùng bấm nút "Hủy"
Then panel form được đóng lại và không có session nào được tạo
```

### Scenario 2: Validate tiêu đề rỗng khi submit
```gherkin
Given panel form tạo session đang mở
When người dùng để trống trường "Tiêu đề" và bấm nút "Tạo session"
Then hệ thống chặn submit và không gọi API tạo session
And hiển thị thông báo lỗi "Vui lòng nhập tiêu đề session"
```

### Scenario 3: Tạo session thành công và làm mới danh sách
```gherkin
Given panel form tạo session đang mở
When người dùng nhập tiêu đề "Hệ thống pin mặt trời perovskite", mô tả "Nâng cao hiệu suất", và tags "solar, energy"
And người dùng bấm nút "Tạo session"
Then hệ thống gọi API `POST /api/v1/sessions` với payload hợp lệ
And khi API phản hồi thành công:
  - Form được đóng lại và reset dữ liệu
  - Query danh sách sessions được làm mới để hiển thị session vừa tạo
```

### Scenario 4: Xử lý lỗi server khi tạo session
```gherkin
Given panel form tạo session đang mở với tiêu đề "Thử nghiệm thất bại"
When người dùng bấm nút "Tạo session" nhưng server trả về lỗi
Then panel form vẫn mở và giữ nguyên dữ liệu người dùng đã nhập
And hiển thị thông báo lỗi từ server kèm icon cảnh báo
```

---

## 6. Trade-offs

| Quyết định | Ưu điểm | Nhược điểm / Nợ kỹ thuật tương lai |
|---|---|---|
| **Inline Panel trong `SessionList`** | - Blast radius tối thiểu, chỉ chỉnh sửa 1 file component.<br>- Dễ dàng chia sẻ `queryClient` context.<br>- Kiểm thử Jest DOM nhanh, trực quan, không phụ thuộc portal/dialog. | - Kích thước file `session-list.tsx` lớn hơn (khoảng ~280 dòng).<br>- Về sau khi thêm logic phức tạp có thể cần tách `SessionCreateForm` thành component riêng. |
| **Query Invalidation (thay vì Optimistic Update)** | - Đảm bảo backend là Single Source of Truth.<br>- Cập nhật chính xác `meta.total`, `id`, `created_at`, `updated_at` từ DB. | - Cần 1 network request đọc lại sau khi tạo thành công (chi phí rất nhỏ cho danh sách session). |

---

## 7. Out of Scope
- Chưa hỗ trợ wizard nhiều bước hay form nhập Problem Frame trực tiếp lúc tạo session (Problem Frame sẽ được cấu trúc trong Session Detail).
- Chưa hỗ trợ chỉnh sửa / xóa session (Edit/Delete flow).
- Chưa chỉnh sửa trang chi tiết `apps/web/features/session/session-detail.tsx`.
- Không thay đổi backend API contracts hay database schema.
