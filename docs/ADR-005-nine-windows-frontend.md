---
title: "ADR-005 — Thiết Kế Giao Diện Trực Quan Hóa TRIZ 9-Windows Read-Only"
topic: "frontend-architecture"
source_type: "decision-record"
language: "vi"
tags: ["adr", "frontend", "triz", "nine-windows", "nextjs", "react-query", "read-only"]
phase: "C2"
status: "canonical"
golden: true
created: "2026-11-11"
---

# ADR-005 — Thiết Kế Giao Diện Trực Quan Hóa TRIZ 9-Windows Read-Only

## 1. Bối cảnh (Context)
Trong khuôn khổ mở rộng năng lực tư duy sáng tạo của Creative Research Workbench, hệ thống đã hoàn thiện backend cho mô hình **Sơ đồ 9 Màn hình TRIZ (9-Windows / System Operator)** qua PR #21 với endpoint `GET /api/v1/triz/nine-windows?lens=engineering|business|everyday`.

Mục tiêu của Batch C2 là mang công cụ 9-Windows lên giao diện web ở chế độ **chỉ đọc (Pure Read-Only)**:
- Người dùng cần một không gian tham chiếu tư duy trực quan, không bị phân tâm bởi các luồng quản trị dữ liệu nặng nề.
- Đảm bảo tính độc lập và toàn vẹn của dữ liệu: không lưu trữ, không chỉnh sửa, không làm xáo trộn các mô hình `ProblemFrame` hay `WorkflowEngine` hiện hữu.

---

## 2. Quyết định Kiến trúc (Architectural Decision)

Chúng tôi quyết định thiết kế giao diện TRIZ 9-Windows theo các nguyên tắc sau:

1. **Dedicated Route `/triz/nine-windows`**:
   - Tách biệt thành một trang tra cứu chuyên biệt (`apps/web/app/triz/nine-windows/page.tsx`), mở rộng từ namespace `/triz/` nhằm đón đầu các công cụ tư duy sáng tạo trong tương lai.
   - Thêm liên kết trực tiếp trên thanh điều hướng chính của trang chủ (`apps/web/app/page.tsx`).

2. **Cấu trúc Lưới Đa Chiều Đơn DOM (Single DOM Responsive Space-Time Matrix)**:
   - **Không nhân đôi cây DOM**: Tránh render 2 bản desktop và mobile riêng biệt nhằm tối ưu bộ nhớ và bảo toàn ngữ nghĩa a11y.
   - **Desktop ($\ge 768\text{px}$)**: Trình bày đúng bản chất ma trận 9 màn hình của Altshuller: 3 cột đại diện cho Trục Thời gian (`past`, `present`, `future`) và 3 hàng đại diện cho Cấp độ Hệ thống (`supersystem`, `system`, `subsystem`).
   - **Mobile ($< 768\text{px}$)**: Chuyển sang dạng xếp chồng (stacked cards) liên tục, nhóm theo từng Cấp độ hệ thống (`supersystem` $\rightarrow$ `system` $\rightarrow$ `subsystem`), bên trong mỗi nhóm hiển thị tuần tự 3 mốc thời gian (`past` $\rightarrow$ `present` $\rightarrow$ `future`). Không dùng accordion đóng/mở nhằm duy trì tính liền mạch khi người dùng quét thông tin.

3. **Chuyển Đổi 3 Lăng Kính (Lens Switching)**:
   - Áp dụng Segmented Control đồng bộ với pattern của `TrizMatrixLookup`: `Kỹ thuật` (mặc định), `Kinh doanh`, `Đời sống`.
   - Quản trị trạng thái và bộ nhớ đệm thông qua React Query v5 với `queryKey: ['triz', 'nine-windows', activeLens]`. Cấu hình `staleTime: 5 * 60 * 1000` (5 phút) để tối ưu hóa bộ nhớ đệm mà không tạo request dư thừa.

4. **Kỷ Luật Thuần Chỉ Đọc (Strict Read-Only Discipline)**:
   - Tuyệt đối không bổ sung các tính năng lưu ghi chú (`onSaveAsNote`), xuất file, sửa đổi cell, lưu localStorage hay can thiệp vào FSM workflow.

---

## 3. Các Phương án Đã Cân Nhắc (Alternatives Considered)

| Tiêu chí | Phương án A (Được chọn): Dedicated Route `/triz/nine-windows` | Phương án B: Nhúng vào Session Detail Tab | Phương án C: Hộp thoại Modal / Popover |
| :--- | :--- | :--- | :--- |
| **Phạm vi tác động** | Độc lập về route, kiểm soát tốt rủi ro chia sẻ (types, client, nav). | Can thiệp trực tiếp vào `SessionDetail`, tăng độ phức tạp của tab ideation. | Khó hiển thị trọn vẹn lưới 3x3 do hạn chế không gian modal. |
| **Tính tiện dụng** | Người dùng có thể tra cứu độc lập bất kỳ lúc nào mà không cần tạo Session. | Bắt buộc phải có Session đang chạy mới xem được 9-Windows. | Trải nghiệm bị gián đoạn, thao tác mở/đóng cồng kềnh. |
| **Khả năng mở rộng** | Dễ dàng bổ sung các công cụ TRIZ độc lập khác vào nhóm `/triz/*`. | Bị bó hẹp trong phạm vi một session cụ thể. | Khó mở rộng thêm chi tiết cho từng ô. |

---

## 4. Hệ Quả & Đánh Đổi (Consequences & Trade-offs)

### 4.1. Tích cực (Pros)
- **Tách biệt luồng nghiệp vụ**: Không làm biến động logic nghiệp vụ của các màn hình đang hoạt động (`/sessions`, `/knowledge`, `/analytics`).
- **Tối ưu hiệu năng**: Tận dụng cơ chế staleTime và cache tự động của React Query, giảm thiểu số lượng request trùng lặp lên backend.
- **Tiếp cận người dùng nhanh chóng**: Có thể dùng như một tài liệu tham khảo nhanh cho bất kỳ bài toán sáng tạo nào.

### 4.2. Rủi ro Có Kiểm soát & Đánh đổi (Bounded Risks & Trade-offs)
- **Tác động đến các file dùng chung**:
  - `apps/web/lib/types.ts`: Bổ sung contracts giao tiếp mới. Rủi ro xung đột type được kiểm soát qua TypeScript strict compilation.
  - `apps/web/lib/api-client.ts`: Bổ sung hàm gọi API mới dùng chung axios client. Rủi ro tác động lẫn nhau được kiểm soát qua unit test độc lập.
  - `apps/web/app/page.tsx`: Bổ sung liên kết điều hướng. Rủi ro vỡ layout được kiểm soát qua kiểm thử giao diện.
- **Giới hạn tích hợp**: Người dùng chưa thể lưu trực tiếp các gợi ý từ 9-Windows vào Notebook của Session (tính năng này sẽ được xem xét trong các batch mở rộng tiếp theo khi có yêu cầu tích hợp sâu).

---

## 5. Tính Khả Nghịch (Reversibility)
Đây là quyết định kiến trúc **hai chiều (Two-way Door)**:
- Toàn bộ tính năng là giao diện đọc từ REST API có sẵn.
- Không phát sinh bảng dữ liệu, không migration, không thay đổi entity backend.
- Nếu cần tái cấu trúc hoặc di dời vị trí UI trong tương lai, việc hoàn tác hoặc di chuyển component có chi phí kỹ thuật thấp, có thể thu hồi sạch sẽ mà không để lại tác động phụ.
