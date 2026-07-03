---
title: "PRODUCT SPEC — Creative Research Workbench"
topic: product
source_type: spec
language: vi
tags: [triz, problem-framing, mvp, user-story, product-vision]
golden: true
phase: 0
created_at: 2026-07-03
---

# PRODUCT SPEC — Creative Research Workbench

## 1. Product Intent
Xây dựng một **workbench nghiên cứu sáng tạo** giúp người dùng chuyển hóa bài toán mơ hồ thành insight có cấu trúc, được hỗ trợ bởi kho tài liệu TRIZ và tư duy sáng tạo.

Sản phẩm **không phải** một chatbot hỏi đáp. Sản phẩm **là** một công cụ workflow có bước, có citation, có persistence.

## 2. Problem Statement
Nhà nghiên cứu và người giải quyết vấn đề phức tạp thường gặp:
- Không biết cách cấu trúc hóa bài toán trước khi tìm giải pháp.
- Tìm kiếm tài liệu liên quan mất nhiều thời gian, thiếu context.
- Không có công cụ lưu lại quá trình suy nghĩ và reasoning.
- Thiếu gợi ý về phương pháp phù hợp với từng loại bài toán.

## 3. Product Goal
Giúp người dùng:
1. **Frame** — Cấu trúc hóa bài toán thành ProblemFrame có contradiction, cause-effect, function model.
2. **Retrieve** — Tìm tài liệu liên quan từ kho TRIZ với citation rõ ràng.
3. **Ideate** — Sinh candidate solutions có provenance.
4. **Evaluate** — Đánh giá giải pháp theo multi-axis scoring.
5. **Synthesize** — Xuất research report có thể tái sử dụng.

## 4. Target Users
- **Primary**: Kỹ sư, nhà nghiên cứu, product manager giải quyết bài toán kỹ thuật/kinh doanh phức tạp.
- **Secondary**: Giảng viên, sinh viên học TRIZ và tư duy sáng tạo.

## 5. Jobs To Be Done
- "Khi tôi có một bài toán mơ hồ, tôi muốn công cụ giúp tôi đặt câu hỏi đúng."
- "Khi tôi cần tìm phương pháp TRIZ phù hợp, tôi muốn gợi ý có lý do rõ ràng."
- "Khi tôi sinh ra giải pháp, tôi muốn biết nó dựa trên tài liệu nào."

## 6. MVP Scope

### Trong scope
- Research session management (CRUD)
- Problem intake và clarification questions
- ProblemFrame extraction (goal, constraints, contradiction)
- Hybrid retrieval từ kho markdown
- Method suggestion với citation
- Basic evaluation matrix

### Ngoài scope (v1)
- Real-time collaboration
- Export PDF/Word
- Integration với công cụ bên ngoài (Notion, Jira)
- Mobile app

## 7. Success Metrics
- User có thể tạo ProblemFrame đầy đủ trong < 10 phút.
- Retrieval trả về kết quả liên quan (Recall@5 >= 0.75).
- Method suggestion có citation rõ ràng 100% trường hợp.
