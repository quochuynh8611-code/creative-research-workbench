---
title: "ADR-006 — Tích Hợp TRIZ 9-Windows Read-Only Vào Problem Framing Dưới Dạng Collapsible Section"
topic: "frontend-integration"
source_type: "decision-record"
language: "vi"
tags: ["adr", "frontend", "triz", "nine-windows", "problem-framing", "structuring", "collapsible"]
phase: "C3a"
status: "canonical"
golden: true
created: "2026-11-11"
---

# ADR-006 — Tích Hợp TRIZ 9-Windows Read-Only Vào Problem Framing Dưới Dạng Collapsible Section

## 1. Bối cảnh (Context)
Sau khi hoàn thiện endpoint backend qua PR #21 (Batch C1) và giao diện trang tra cứu độc lập `/triz/nine-windows` qua PR #22 (Batch C2), công cụ **Sơ đồ 9 Màn hình TRIZ (9-Windows / System Operator)** đã có thể phục vụ người dùng ở chế độ tra cứu độc lập.

Tuy nhiên, trong quy trình giải quyết bài toán sáng tạo, giai đoạn **Định khung & Phân tích cấu trúc (Problem Structuring)** là thời điểm then chốt mà người dùng cần mở rộng không gian nhận thức:
- Cần quan sát bài toán không chỉ ở hiện tại của hệ thống, mà còn xem xét bối cảnh siêu hệ thống (môi trường, hạ tầng xung quanh) và phân hệ (linh kiện, vi cấu trúc), đồng thời đối chiếu quá khứ và tương lai.
- Việc chuyển hẳn ra khỏi trang phiên nghiên cứu sang tuyến đường `/triz/nine-windows` làm gián đoạn dòng suy nghĩ của nhà nghiên cứu.
- Mặt khác, nếu tích hợp quá sâu (như biến thành một bước FSM bắt buộc hay tự động biến đổi câu từ của ProblemFrame) sẽ gây xáo trộn kiến trúc workflow cốt lõi.

Do đó, Batch C3a cần một giải pháp tích hợp tối giản, an toàn và thuận tiện nhất ngay tại màn hình `<NormalizedView />`.

---

## 2. Quyết định Kiến trúc (Architectural Decision)

Chúng tôi quyết định áp dụng phương án **Embedded Collapsible Section** trong `<NormalizedView />` với các nguyên tắc:

1. **Collapsible Mặc Định Đóng (Closed by Default)**:
   - Khi người dùng vào tab `structuring`, khu vực 9 Cửa sổ TRIZ luôn ở trạng thái đóng (`isExpanded = false`).
   - Điều này đảm bảo giao diện phân tích cấu trúc bài toán vẫn giữ được sự tinh gọn, tập trung vào câu bài toán chuẩn hóa và thẻ phân loại mâu thuẫn.

2. **Conditional Unmounting (Không Sử Dụng CSS Hiding)**:
   - Chỉ khi người dùng chủ động bấm mở rộng (`isExpanded = true`), component `<TrizNineWindows />` mới được mount vào cây DOM và kích hoạt truy vấn React Query.
   - Khi đóng lại, component bị unmount hoàn toàn. Quyết định này loại bỏ triệt để nguy cơ component âm thầm gửi request API nền hay chiếm dụng tài nguyên bộ nhớ khi đang ẩn.

3. **Kỷ Luật Tách Biệt FSM & Read-Only**:
   - 9-Windows đóng vai trò là một **công cụ tư duy hỗ trợ (Cognitive Sidecar Tool)**.
   - Tuyệt đối không can thiệp vào `WorkflowEngine`, không thêm state FSM mới, không bắt buộc người dùng phải tương tác mới được chuyển bước sang `retrieval`.
   - Giữ nguyên lăng kính khởi tạo mặc định là `engineering`, không thực hiện ánh xạ domain tự động và không có nút lưu ghi chú trong phạm vi C3a.

---

## 3. Các Phương án Đã Cân Nhắc (Alternatives Considered)

| Tiêu chí | Phương án A (Được chọn): Collapsible trong NormalizedView | Phương án B: Tab chuyên dụng trong Session Detail | Phương án C: Liên kết điều hướng sang `/triz/nine-windows` |
| :--- | :--- | :--- | :--- |
| **Tính tiện dụng (UX)** | Cao: Người dùng mở ra xem ngay bên dưới câu bài toán chuẩn hóa mà không phải rời tab. | Trung bình: Người dùng phải chuyển sang một tab riêng biệt, mất ngữ cảnh của câu bài toán. | Thấp: Chuyển hướng sang trang khác làm đứt gãy luồng nghiên cứu hiện tại. |
| **Ảnh hưởng luồng FSM** | Không ảnh hưởng: Nằm gọn trong tab `structuring` hiện có. | Có nguy cơ gây nhầm lẫn: Thêm tab thứ 7 vào `SessionDetail` dễ khiến người dùng hiểu nhầm đây là một bước FSM tuần tự. | Không ảnh hưởng. |
| **Độ phức tạp mã nguồn** | Thấp: Chỉ cần một state boolean mở/đóng bọc lấy component đã có sẵn. | Trung bình: Cần mở rộng mảng `TABS` và xử lý điều hướng tab trong `SessionDetail`. | Rất thấp: Chỉ là một thẻ liên kết ngoài. |

---

## 4. Hệ Quả & Đánh Đổi (Consequences & Trade-offs)

### 4.1. Tích cực (Pros)
- Đưa tri thức 9-Windows vào đúng thời điểm nhận thức quan trọng nhất của quy trình TRIZ (Structuring / Reframing).
- Tái sử dụng 100% component `<TrizNineWindows />` đã được kiểm chứng ở Batch C2 mà không cần sửa đổi lớn.
- Không phát sinh thay đổi ở tầng database, entity backend hay FSM state machine.

### 4.2. Rủi ro Có Kiểm soát & Đánh đổi (Bounded Risks & Trade-offs)
- **Tăng chiều dài trang khi mở rộng**: Lưới 3x3 khi mở ra sẽ chiếm diện tích đáng kể. Rủi ro này được giảm thiểu bằng việc mặc định đóng, chỉ chiếm một dòng tiêu đề toggle gọn gàng khi người dùng chưa có nhu cầu.
- **Ghép nối (Coupling) với NormalizedView**: Thêm một phần tử con vào `NormalizedView` làm tăng trách nhiệm hiển thị của component này. Cần đảm bảo component con được bọc độc lập và cách ly lỗi (error boundary / graceful error handling).
- **Nguy cơ rò rỉ network request**: Nếu triển khai sai bằng cách ẩn CSS (`hidden` / `display: none`), React Query trong `TrizNineWindows` vẫn sẽ tự động kích hoạt truy vấn ngay khi vào tab `structuring`. Giải pháp bắt buộc là sử dụng conditional rendering `{isExpanded && <TrizNineWindows />}`.

---

## 5. Tính Khả Nghịch (Reversibility)
Đây là quyết định **hai chiều (Two-way Door)**:
- Việc nhúng component hoàn toàn mang tính chất hiển thị (pure presentation).
- Không có bất kỳ phụ thuộc nào về mặt dữ liệu được lưu xuống DB.
- Nếu cần gỡ bỏ hoặc chuyển sang tab độc lập trong tương lai, chi phí kỹ thuật chỉ là xóa hoặc di chuyển vài dòng JSX mà không gây tác động phụ.
