# PRODUCT SPEC — Creative Research Workbench

## 1. Product Intent
Creative Research Workbench là một phần mềm hỗ trợ các nhà nghiên cứu, kỹ sư, giảng viên, người làm sản phẩm và người học áp dụng phương pháp luận sáng tạo vào công việc và đời sống. Sản phẩm không chỉ là một kho tài liệu TRIZ, mà là một hệ thống hỗ trợ phân tích vấn đề, gợi ý phương pháp, truy xuất case tương tự và lưu lại tiến trình tư duy nghiên cứu.

## 2. Problem Statement
Người dùng thường có nhiều tài liệu về TRIZ, tư duy sáng tạo, giải quyết vấn đề và ra quyết định, nhưng gặp ba trở ngại lớn:
- Khó chuyển một vấn đề đời thực từ dạng mơ hồ sang dạng có cấu trúc.
- Khó chọn đúng công cụ sáng tạo cho đúng loại bài toán.
- Khó tích lũy và tái sử dụng các phiên nghiên cứu trước đó.

## 3. Product Goal
Biến kho tài liệu hiện có thành một research copilot có workflow, giúp người dùng:
- Chuẩn hóa mô tả vấn đề.
- Phát hiện mâu thuẫn, chức năng, chuỗi nhân quả và tài nguyên sẵn có.
- Được gợi ý công cụ TRIZ hoặc phương pháp sáng tạo phù hợp.
- Tìm case, nguyên lý, ví dụ và tài liệu liên quan.
- Lưu hồ sơ nghiên cứu để tái sử dụng và học tập.

## 4. Target Users
### 4.1 Primary Users
- Nhà nghiên cứu độc lập.
- Kỹ sư giải quyết bài toán kỹ thuật.
- Product manager hoặc founder cần giải bài toán đổi mới.
- Giảng viên và học viên học TRIZ hoặc tư duy sáng tạo.

### 4.2 Secondary Users
- Nhân sự đào tạo nội bộ trong doanh nghiệp.
- Chuyên gia tư vấn đổi mới sáng tạo.
- Người dùng cá nhân muốn áp dụng phương pháp sáng tạo vào quyết định đời sống.

## 5. Jobs To Be Done
- Khi tôi có một vấn đề phức tạp nhưng chưa biết bắt đầu từ đâu, tôi muốn hệ thống ép vấn đề về dạng có cấu trúc.
- Khi tôi không biết nên dùng nguyên tắc hay công cụ nào, tôi muốn hệ thống đề xuất phương pháp phù hợp.
- Khi tôi tìm ý tưởng mới, tôi muốn xem các case tương tự.
- Khi tôi học TRIZ, tôi muốn vừa học vừa thực hành.
- Khi tôi đã nghiên cứu một lần, tôi muốn lưu reasoning trail để tái sử dụng.

## 6. Core Value Proposition
Một không gian làm việc nghiên cứu sáng tạo kết hợp tri thức TRIZ với workflow phân tích vấn đề.

## 7. Scope
### 7.1 In Scope for MVP
- Research session management.
- Problem intake theo biểu mẫu có cấu trúc.
- Phân tích contradiction, function, cause-effect.
- Gợi ý công cụ TRIZ phù hợp.
- Semantic retrieval trên kho tài liệu nội bộ.
- Citation/source rõ ràng.
- Research notebook.

### 7.2 Out of Scope for MVP
- Collaboration thời gian thực đa người dùng.
- Tự động hóa ARIZ hoàn chỉnh.
- Fine-tuned model riêng.

## 8. Product Principles
- **Read-before-write**: luôn phân tích tài liệu nguồn trước khi đưa ra gợi ý.
- **Structured over vague**: ép người dùng làm rõ mục tiêu, ràng buộc, xung đột.
- **Evidence-backed**: mọi gợi ý đều kèm nguồn từ kho tri thức.
- **Human-in-the-loop**: hệ thống hỗ trợ tư duy, không thay thế phán đoán chuyên gia.
- **Reusable reasoning**: mỗi phiên nghiên cứu để lại dấu vết tư duy tái sử dụng được.

## 9. Main User Journey
1. Tạo một research session mới.
2. Nhập vấn đề bằng ngôn ngữ tự nhiên.
3. Hệ thống hỏi làm rõ để chuẩn hóa bài toán.
4. Hệ thống dựng contradiction map, function map, cause-effect chain.
5. Hệ thống đề xuất công cụ TRIZ và tài liệu liên quan.
6. Người dùng duyệt các hướng giải, ghi chú và đánh giá.
7. Người dùng chọn hướng hứa hẹn nhất và tạo action plan.
8. Phiên nghiên cứu được lưu để tìm lại hoặc học lại.
