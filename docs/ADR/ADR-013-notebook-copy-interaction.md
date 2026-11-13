# ADR-013: Card-Level Inline Copy Interaction with Async Concurrency Guard

## Status
Proposed

## Context
Trong quy trình làm việc của Sổ tay nghiên cứu (`ResearchNotebook`), người dùng tích lũy nhiều ghi chú tri thức (`ResearchNote`) quan trọng. Người dùng thường xuyên có nhu cầu sao chép nguyên văn nội dung của các ghi chú này để trích dẫn vào tài liệu ngoài, chia sẻ hoặc dán vào các công cụ cộng tác khác.

Khảo sát các vị trí hiện có trong codebase (`semantic-search-explorer.tsx` và `session-detail.tsx`) cho thấy các cài đặt clipboard trước đây còn tồn tại những khiếm khuyết kỹ thuật:
1. Thiếu `await` Promise hoặc không bắt lỗi `catch` khi quyền truy cập Clipboard bị từ chối, dẫn đến tình trạng giao diện báo "Đã chép" ngay cả khi thao tác thất bại (false positive).
2. Khi Clipboard API không tồn tại (`undefined`), giao diện im lặng và người dùng không nhận được bất kỳ phản hồi nào.
3. Sử dụng `setTimeout` trực tiếp mà không lưu `Timer ID` vào `useRef`, không có cơ chế dọn dẹp khi component unmount, và không hủy timer cũ khi người dùng thao tác liên tiếp, dẫn đến hiện tượng race condition và nguy cơ rò rỉ bộ nhớ (memory leak).

Cần một kiến trúc tương tác sao chép chuẩn mực, an toàn, có kiểm soát bất đồng bộ (concurrency guard), và gói gọn tối thiểu trong phạm vi Sổ tay nghiên cứu.

## Decision
Áp dụng **Card-Level Inline Copy Interaction (Phản hồi trực tiếp trên thẻ ghi chú) kèm Concurrency Guard (Latest-Request-Wins)**:

1. **Vị trí và Khả năng Tiếp cận (Accessibility)**:
   - Mỗi thẻ ghi chú hiển thị một nút `<button type="button">` riêng biệt cạnh nút xóa.
   - Accessible name độc lập theo ID: `aria-label="Sao chép ghi chú <note.id>"`.
   - Sử dụng icon `Copy` từ `lucide-react`, chuyển sang icon `Check` và nhãn `"Đã chép"` khi thành công.

2. **Bảo tồn Tuyệt đối Dữ liệu Nguyên văn (Exact Content Preservation)**:
   - Truyền trực tiếp `note.content` vào `navigator.clipboard.writeText(note.content)`.
   - Không thực hiện bất kỳ thao tác `.trim()`, biến đổi chữ hoa/thường, nối thêm ngày tháng hay metadata nào.

3. **Kiểm Soát Bất Đồng Bộ & Latest-Request-Wins**:
   - Sử dụng một biến đếm yêu cầu (`latestRequestIdRef = useRef<number>(0)`).
   - Mỗi lần bấm sao chép, tăng `latestRequestIdRef.current`. Chỉ các Promise thuộc về `requestId` mới nhất mới có quyền cập nhật state phản hồi giao diện.
   - Các Promise cũ resolve hoặc reject muộn hơn sẽ bị hủy bỏ (phớt lờ) ở tầng giao diện.

4. **Quản Lý Vòng Đời Timer và Unmount**:
   - Sử dụng `copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`.
   - Trước khi lập lịch timer mới (2000ms), luôn gọi `clearTimeout` cho timer đang chạy dở.
   - Đăng ký hàm dọn dẹp trong `useEffect` khi component unmount để giải phóng timer và đánh dấu trạng thái unmounted (`isMountedRef = useRef<boolean>(true)`).

5. **Xử Lý Lỗi Tường Minh**:
   - Nếu `navigator.clipboard` không khả dụng: hiển thị `"Trình duyệt không hỗ trợ sao chép"`.
   - Nếu `writeText` reject: hiển thị `"Không thể sao chép vào bộ nhớ tạm"`.
   - Không báo thành công, không dùng `document.execCommand` cũ.

## Alternatives Considered

1. **Phương án B: Banner Phản Hồi Chung cho Toàn Bộ Notebook**:
   - *Mô tả*: Hiển thị thông báo trạng thái "Đã sao chép ghi chú #X" ở thanh tiêu đề trên cùng của Sổ tay.
   - *Lý do loại bỏ*: Khi danh sách ghi chú dài, người dùng bấm sao chép ở cuối trang sẽ không nhìn thấy thông báo ở đầu trang, gây nhầm lẫn và giảm trải nghiệm người dùng.

2. **Phương án C: Tích Hợp Hệ Thống Toast / Notification Toàn Cục**:
   - *Mô tả*: Cài đặt thư viện Toast bên ngoài (ví dụ `sonner`, `react-hot-toast`) hoặc tự viết Provider context toàn cục.
   - *Lý do loại bỏ*: Vi phạm nguyên tắc kiểm soát vùng ảnh hưởng (blast radius), làm phình to phụ thuộc và kiến trúc cho một nhu cầu cục bộ trong Batch C7b.

3. **Phương án D: Fallback sang document.execCommand('copy')**:
   - *Mô tả*: Dùng `textarea` ẩn trong DOM và gọi `document.execCommand('copy')` nếu Clipboard API không hỗ trợ.
   - *Lý do loại bỏ*: `document.execCommand('copy')` đã bị deprecated trong chuẩn Web API, tiềm ẩn rủi ro bảo mật và không đảm bảo hoạt động đồng nhất trên các trình duyệt hiện đại.

## Consequences
- **Tích cực**:
  - Trải nghiệm người dùng trực quan, rõ ràng, phản hồi đúng trọng tâm thẻ vừa bấm.
  - Loại trừ hoàn toàn race condition khi người dùng bấm nhanh nhiều thẻ liên tiếp.
  - Zero memory leak nhờ cơ chế dọn dẹp timer và cờ unmount chuẩn mực.
  - Blast radius tối thiểu: 100% logic nằm trong component `ResearchNotebook`.
- **Tiêu cực / Ràng buộc**:
  - Component cần quản lý thêm các `useRef` cho timer và request ID.
