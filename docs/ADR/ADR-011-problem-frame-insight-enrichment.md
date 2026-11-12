# ADR-011: Problem Frame Insight Enrichment via Explicit Human-in-the-Loop Action

## Status
Proposed

## Context
Trong quy trình sáng tạo của Creative Research Workbench, người dùng thường thu thập các quan sát, trích dẫn, giả thuyết và phát hiện (`ResearchNote`) trong quá trình nghiên cứu và lưu trữ vào Sổ tay (`ResearchNotebook`).

Khi quay trở lại bước Nhập vấn đề (`IntakeForm`), người dùng thường muốn tái sử dụng các insight này để làm rõ mục tiêu, rào cản mâu thuẫn hoặc bối cảnh thực tế của bài toán TRIZ. Tuy nhiên, nếu hệ thống tự động điền (auto-prefill) hoặc ghi đè ngầm (silent overwrite) nội dung vào form, rủi ro làm mất dữ liệu người dùng đang soạn dở hoặc phá vỡ cấu trúc mâu thuẫn là rất cao.

Do đó, cần có một cơ chế an toàn, minh bạch, cho phép người dùng chủ động chọn, xem trước và xác nhận trước khi đưa bất kỳ insight nào vào bài toán.

## Decision
Chọn **Phương án B: Explicit "Use insight" action**:

1. **Khối Tham chiếu Tường minh (`InsightReferencePanel`)**:
   - Tích hợp một panel có thể đóng/mở trong `IntakeForm`.
   - Sử dụng React Query đọc danh sách ghi chú của phiên hiện tại qua key `['sessions', sessionId, 'notes']`.
   - Mỗi ghi chú hiển thị đầy đủ badge phân loại, nội dung và thời gian tạo, đi kèm nút hành động "Dùng insight này".

2. **Cơ chế Preview & Human Gate 2 Bước**:
   - Khi bấm "Dùng insight này", giao diện mở hộp thoại xem trước (Preview box).
   - Cho phép người dùng chọn 1 trong 4 trường đích:
     - `want` ("Điều tôi muốn đạt được / cải thiện")
     - `obstacle` ("Nhưng lại bị vướng / lo ngại")
     - `context` ("Bối cảnh / ràng buộc thực tế")
     - `goal` ("Mục tiêu / Mô tả bài toán")
   - Nếu trường đích được chọn đã có dữ liệu từ trước, hiển thị cảnh báo ghi đè màu vàng nổi bật để người dùng nhận thức rõ.
   - Nút "Hủy" đóng preview ngay lập tức, giữ nguyên 100% nội dung form.
   - Nút "Áp dụng" chỉ cập nhật trường đã chọn, sau đó tự động tái tính toán câu phát biểu theo quy tắc chuẩn hóa `composeConflictStatement` mà không tự kích hoạt API hay chuyển tab.

## Alternatives Considered

1. **Phương án A: Read-only reference panel (Chỉ đọc + Copy thủ công)**:
   - *Ưu điểm*: Blast radius gần như bằng không, không can thiệp form state.
   - *Lý do loại bỏ*: Bắt người dùng phải copy vào clipboard rồi tự paste thủ công nhiều lần, trải nghiệm kém liền mạch so với hành động có chủ đích 1-click có xác nhận.

2. **Phương án C: Tự động trích xuất / điền (Automatic enrichment)**:
   - *Ưu điểm*: Tiết kiệm thao tác chuột.
   - *Lý do loại bỏ*: Cực kỳ rủi ro (silent overwrite), dễ làm biến dạng cấu trúc bài toán mâu thuẫn TRIZ và tạo hành vi khó lường ngoài ý muốn.

## Consequences

- **Tích cực**:
  - Người dùng tái sử dụng tri thức từ Notebook vào Problem Framing một cách nhanh chóng, liền mạch.
  - Bảo vệ tuyệt đối công sức soạn thảo của người dùng nhờ cơ chế cảnh báo ghi đè và nút Hủy.
  - Zero blast radius lên backend, API, Database, và FSM.
  - Không sinh thêm dependency bên ngoài.
- **Tiêu cực**:
  - Giao diện có thêm bước chọn target field và xác nhận, tuy nhiên đây là chi phí cần thiết để đảm bảo tính an toàn dữ liệu.

## Reversibility
Quyết định có tính khả nghịch cao (two-way door). Trong trường hợp cần rollback, chỉ cần gỡ bỏ component `InsightReferencePanel` khỏi `IntakeForm`, toàn bộ luồng hoạt động cũ của `IntakeForm` và backend vẫn hoàn toàn nguyên vẹn.
