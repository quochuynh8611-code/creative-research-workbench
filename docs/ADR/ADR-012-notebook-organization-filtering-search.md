# ADR-012: Client-Side Note Organization via Note Type Filtering and Content Search

## Status
Proposed

## Context
Trong quy trình làm việc của Creative Research Workbench, Sổ tay nghiên cứu (`ResearchNotebook`) đóng vai trò là kho lưu trữ trung tâm cho tất cả các quan sát, trích dẫn tri thức, nguyên tắc sáng chế gợi ý và giải pháp ứng viên. Người dùng có thể tích lũy hàng chục ghi chú thuộc nhiều loại khác nhau (`insight`, `hypothesis`, `decision`, `question`, `action`) trong suốt phiên nghiên cứu.

Hiện tại, `ResearchNotebook` chỉ hiển thị một danh sách phẳng sắp xếp giảm dần theo thời gian tạo, không có công cụ phân loại hay tìm kiếm. Khi số lượng ghi chú tăng lên, người dùng gặp khó khăn trong việc:
1. Định vị lại các ghi chú cụ thể theo từ khóa nội dung.
2. Lọc riêng các giả thuyết (`hypothesis`) hoặc quyết định (`decision`) để chuẩn bị cho giai đoạn tổng hợp (`synthesis`).

Cần có một giải pháp tổ chức ghi chú tinh gọn, hiệu năng cao, trực quan và an toàn tuyệt đối mà không cần can thiệp vào tầng cơ sở dữ liệu hay backend API.

## Decision
Áp dụng **Phương án A: Client-Side Organization (Bộ lọc loại + Tìm kiếm nội dung)**:

1. **Bộ lọc loại ghi chú (`note_type`)**:
   - Bổ sung thanh điều khiển lọc gồm 6 lựa chọn: `Tất cả` (`all`), `Insight`, `Hypothesis`, `Decision`, `Question`, `Action`.
   - Mỗi nút hiển thị bộ đếm số lượng (counter) ghi chú thuộc loại đó trong toàn bộ session.
   - Trạng thái mặc định là `all`.
   - Bộ đếm luôn giữ ổn định dựa trên toàn bộ dữ liệu tải về, không bị ảnh hưởng bởi truy vấn tìm kiếm.

2. **Tìm kiếm nội dung (`search`)**:
   - Ô nhập tìm kiếm từ khóa trong trường `content`.
   - Lọc chuỗi không phân biệt hoa thường (`case-insensitive`).

3. **Kết hợp Logic AND & Empty Filter State**:
   - Kết quả hiển thị là giao (AND) giữa bộ lọc loại và từ khóa tìm kiếm.
   - Khi không có ghi chú nào thỏa mãn điều kiện kết hợp, hiển thị Empty Filter State với thông báo `"Không tìm thấy ghi chú phù hợp với bộ lọc"` kèm nút `"Xóa bộ lọc"` để người dùng nhanh chóng khôi phục danh sách.

4. **Bảo tồn Bất biến Vận hành**:
   - Giữ nguyên toàn bộ logic tạo ghi chú, xóa ghi chú, và banner soạn thảo nháp (`initialDraft`).
   - Không lưu trạng thái bộ lọc vào bất kỳ bộ nhớ bền vững nào (`localStorage`, `sessionStorage`, `IndexedDB`).

## Alternatives Considered

1. **Phương án B: Server-Side Filtering & Search via Backend API**:
   - *Mô tả*: Bổ sung query params `q` và `note_type` vào endpoint `GET /api/v1/sessions/{session_id}/notes`, cập nhật SQL query và migration DB nếu cần.
   - *Lý do loại bỏ*: Blast radius lớn, đòi hỏi sửa đổi backend, cơ sở dữ liệu, và API contract; không cần thiết vì số lượng ghi chú trong một session nghiên cứu thực tế thường dưới 100 notes, xử lý tại client-side mang lại phản hồi tức thì (zero latency).

2. **Phương án C: AI-Assisted Tagging & Organization**:
   - *Mô tả*: Sử dụng LLM tự động gắn nhãn, phân cụm hoặc tóm tắt các ghi chú.
   - *Lý do loại bỏ*: Phi tất định (non-deterministic), tốn token và độ trễ mạng, nguy cơ ảo giác và vi phạm trực tiếp nguyên tắc tinh gọn của hệ thống.

## Consequences

- **Tích cực**:
  - Trải nghiệm tìm kiếm và phân loại tức thì, mượt mà, không phát sinh round-trip mạng.
  - Zero blast radius lên backend, API và Database.
  - 100% tương thích ngược với toàn bộ dữ liệu ghi chú đã lưu trước đó.
  - Bộ đếm trực quan giúp người dùng nắm bắt tổng quan cấu trúc tri thức của phiên làm việc.
- **Tiêu cực**:
  - Trạng thái filter và search không lưu lại khi người dùng tải lại trang (F5), tuy nhiên đây là chủ đích thiết kế để giữ giao diện luôn ở trạng thái sạch sẽ, dễ dự đoán khi mở lại tab Sổ tay.

## Reversibility
Quyết định có tính khả nghịch cao (two-way door). Trong trường hợp cần rollback, chỉ cần khôi phục lại component `ResearchNotebook` mà không ảnh hưởng tới bất kỳ phần nào khác của hệ thống.
