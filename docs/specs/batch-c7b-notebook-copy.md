# Batch C7b — Sao Chép Ghi Chú Trong Research Notebook (Copy to Clipboard)

## 1. Mục tiêu (Purpose)
Cho phép người dùng chủ động sao chép nguyên văn nội dung (`note.content`) của bất kỳ ghi chú đã lưu nào trong Sổ tay nghiên cứu (`ResearchNotebook`) vào bộ nhớ tạm hệ thống (Clipboard). Tính năng cung cấp phản hồi trạng thái tức thời (thành công hoặc thông báo lỗi) trên đúng thẻ ghi chú được thao tác, tuân thủ nghiêm ngặt tính bất biến dữ liệu, không làm ảnh hưởng đến form soạn thảo hay bộ lọc hiện có.

## 2. Ranh giới & Ràng buộc Kỹ thuật (Technical Boundaries)
- **Frontend-only**: Không can thiệp backend, API client, cơ sở dữ liệu, Alembic migration, hay FSM engine.
- **Không persistence**: Không lưu trạng thái sao chép vào `localStorage`, `sessionStorage`, hay `IndexedDB`.
- **Độc lập tuyệt đối**:
  - Không gọi mutation tạo (`createResearchNote`) hay xóa (`deleteResearchNote`).
  - Không làm thay đổi nội dung form nháp (`content`, `noteType`, `initialDraft`).
  - Không làm thay đổi trạng thái bộ lọc loại (`selectedType`) hay ô tìm kiếm (`searchQuery`).
  - Không đọc bộ nhớ tạm của người dùng (`navigator.clipboard.readText`).
  - Không sử dụng `document.execCommand` hay thêm thư viện bên thứ ba.
  - Không can thiệp sang các thành phần khác (`InsightReferencePanel`, `SessionDetail`).

---

## 3. Đặc Tả Hợp Đồng Hành Vi (Behavioral Contract)

### 3.1. Nút Sao Chép trên từng Card Ghi Chú
- Mỗi thẻ ghi chú đã lưu (`ResearchNote`) hiển thị một nút sao chép độc lập:
  - Thuộc tính bắt buộc: `type="button"`.
  - Accessible name phân biệt rõ ràng từng thẻ: `aria-label="Sao chép ghi chú <note.id>"`.
  - Tooltip: `title="Sao chép nội dung"`.
  - Vị trí: Đặt trong nhóm điều khiển góc trên bên phải của card (cạnh timestamp và nút xóa).
  - Không làm thay đổi `aria-label` hay hành vi của nút xóa ghi chú hiện có.

### 3.2. Quy Tắc Sao Chép Dữ Liệu
- Chỉ thực hiện sao chép khi người dùng chủ động bấm vào nút sao chép của thẻ đó.
- Gọi API chuẩn: `navigator.clipboard.writeText(note.content)`.
- **Nguyên văn 100%**:
  - Giữ nguyên toàn bộ khoảng trắng ở đầu/cuối chuỗi (`leading/trailing whitespace`).
  - Giữ nguyên các ký tự xuống dòng (`\n`, `\r\n`).
  - Giữ nguyên định dạng tiếng Việt Unicode và các ký tự đặc biệt.
  - Tuyệt đối **không** `.trim()`, không viết hoa, không thêm tiền tố phân loại, không nối timestamp, và không chèn metadata nguồn.

### 3.3. Trạng Thái Đang Xử Lý (Pending)
- Trong thời gian `navigator.clipboard.writeText` đang chờ xử lý (Promise pending):
  - Giao diện **chưa** hiển thị trạng thái "Đã chép".
  - Nếu đã có phản hồi hoặc timer từ lần bấm trước đó (trên cùng note hoặc note khác), lần bấm mới sẽ lập tức hủy timer cũ và xóa phản hồi cũ.
  - Cho phép người dùng bấm sao chép một note khác mà không bị chặn bởi Promise pending trước đó.

### 3.4. Trạng Thái Thành Công (Success)
- Chỉ chuyển sang trạng thái thành công **sau khi** `writeText` resolve thành công.
- Phản hồi thành công được gắn định danh chính xác theo `note.id`:
  - Hiển thị nhãn trực quan hoặc icon Check với text `"Đã chép"`.
  - Cập nhật `aria-label` hoặc vùng thông báo với `aria-live="polite"` để hỗ trợ thiết bị trợ thính (screen readers).
  - Các thẻ ghi chú khác vẫn giữ nguyên nút sao chép ở trạng thái bình thường.
- Phản hồi thành công tự động biến mất và nút khôi phục về trạng thái ban đầu sau đúng **2000ms** tính từ thời điểm chấp nhận resolve.

### 3.5. Xử Lý Lỗi An Toàn (Error Handling)
- Khi môi trường không hỗ trợ (ví dụ `typeof navigator === 'undefined'`, `!navigator.clipboard`, hoặc `typeof navigator.clipboard.writeText !== 'function'`):
  - Hiển thị thông báo lỗi inline: `"Trình duyệt không hỗ trợ sao chép"`.
  - Tuyệt đối không báo thành công, không gây lỗi ngoại lệ chưa bắt (uncaught exception).
- Khi Promise bị từ chối (reject, ví dụ do người dùng từ chối cấp quyền Clipboard):
  - Bắt lỗi trong khối `catch` và hiển thị thông báo lỗi: `"Không thể sao chép vào bộ nhớ tạm"`.
  - Tuyệt đối không hiển thị trạng thái thành công.
- Thông báo lỗi giữ nguyên trên thẻ cho đến khi người dùng bấm sao chép lần tiếp theo hoặc component unmount (hoặc tự tắt theo timer).
- Lỗi sao chép là trạng thái cục bộ của thao tác clipboard, **không** được ghi đè vào biến `actionError` của thao tác tạo/xóa ghi chú.

### 3.6. Tính Đúng Đắn Bất Đồng Bộ (Async Correctness — Latest-Request-Wins)
- Giao diện áp dụng nguyên tắc **Latest-Request-Wins**:
  - Mỗi thao tác bấm sao chép được gán một định danh yêu cầu duy nhất (requestId).
  - Kết quả (resolve hoặc reject) của một Promise cũ hoàn tất muộn hơn không được phép ghi đè hay thay đổi phản hồi của thao tác mới nhất.
  - Timer của thao tác cũ không được phép xóa phản hồi của thao tác mới nhất.
  - Việc hủy timer không đồng nghĩa với việc hủy Promise của trình duyệt (do Clipboard API không hỗ trợ AbortSignal), nhưng component sẽ phớt lờ kết quả nếu thao tác đó đã lỗi thời.

### 3.7. Vòng Đời & Dọn Dẹp (Lifecycle & Unmount Cleanup)
- Sử dụng `useRef` để theo dõi Timer ID và trạng thái mounted của component.
- Khi component unmount:
  - Lập tức dọn dẹp timer đang chờ (`clearTimeout`).
  - Vô hiệu hóa mọi cập nhật state từ các Promise clipboard vẫn đang pending.
  - Không kích hoạt timer mới khi Promise resolve sau khi component đã unmount.

### 3.8. Tương Tác với Bộ Lọc và Xóa Ghi Chú
- Khi danh sách ghi chú đang được lọc theo `note_type` hoặc tìm kiếm theo từ khóa `searchQuery`:
  - Nút sao chép trên các ghi chú đang hiển thị hoạt động chính xác với đúng nội dung của ghi chú đó.
- Nếu một thẻ ghi chú đang hiển thị phản hồi sao chép mà bị ẩn đi do người dùng thay đổi bộ lọc hoặc xóa ghi chú:
  - Phản hồi sao chép không được nhảy hoặc gán nhầm sang thẻ ghi chú khác.
  - Dữ liệu bộ lọc và bản nháp không bị ảnh hưởng.

---

## 4. Đặc Tả Gherkin (Gherkin Scenarios)

```gherkin
Feature: Sao chép nội dung ghi chú trong Research Notebook vào Clipboard

  Background:
    Given người dùng đang mở tab Sổ tay nghiên cứu của phiên "ses-c7b"
    And danh sách ghi chú đã lưu gồm có:
      | id    | note_type  | content                                                         |
      | c7b-1 | insight    | \n  Phát hiện mâu thuẫn nhiệt - tải trọng cấu trúc composite. \n |
      | c7b-2 | hypothesis | Giả thuyết: Graphene đa tầng cải thiện độ dẫn nhiệt 25%.       |

  Scenario: 1. Sao chép thành công nguyên văn nội dung ghi chú
    When người dùng bấm nút sao chép "Sao chép ghi chú c7b-1"
    Then API "navigator.clipboard.writeText" chưa giải quyết xong thì giao diện chưa hiển thị "Đã chép"
    When API "navigator.clipboard.writeText" giải quyết thành công
    Then nội dung được chuyển tới clipboard là nguyên văn "\n  Phát hiện mâu thuẫn nhiệt - tải trọng cấu trúc composite. \n"
    And nút sao chép của ghi chú "c7b-1" hiển thị trạng thái "Đã chép"
    And nút sao chép của ghi chú "c7b-2" vẫn ở trạng thái bình thường
    When thời gian trôi qua 2000ms
    Then trạng thái "Đã chép" trên ghi chú "c7b-1" tự động biến mất và nút trở về bình thường

  Scenario: 2. Xử lý an toàn khi Clipboard API thiếu hoặc quyền bị từ chối
    Given môi trường trình duyệt không hỗ trợ Clipboard API hoặc quyền truy cập bị từ chối
    When người dùng bấm nút sao chép "Sao chép ghi chú c7b-2"
    Then giao diện không hiển thị trạng thái "Đã chép"
    And giao diện hiển thị thông báo lỗi phù hợp trên thẻ ghi chú "c7b-2"
    And form soạn thảo nháp và các ghi chú khác không bị thay đổi
    And không có ngoại lệ chưa bắt (uncaught error) xảy ra trong ứng dụng

  Scenario: 3. Hai thao tác sao chép hoàn tất sai thứ tự (Latest-Request-Wins)
    Given người dùng bấm nút sao chép trên ghi chú "c7b-1" và thao tác này bị hoãn giải quyết
    When người dùng bấm nút sao chép trên ghi chú "c7b-2" và thao tác này giải quyết thành công ngay lập tức
    Then ghi chú "c7b-2" hiển thị trạng thái "Đã chép"
    When thao tác hoãn của ghi chú "c7b-1" giải quyết xong sau đó
    Then giao diện vẫn giữ phản hồi thành công trên ghi chú "c7b-2"
    And ghi chú "c7b-1" không hiển thị "Đã chép"
```
