# CREATIVE RESEARCH WORKBENCH — KỊCH BẢN DEMO 5 PHÚT (STAKEHOLDER WALKTHROUGH)

**Đối tượng khán giả:** Ban Lãnh Đạo, Hội Đồng Khoa Học, Nhà Đầu Tư, Đối Tác Công Nghệ  
**Thời lượng:** 5 phút (00:00 — 05:00)  
**Mục tiêu:** Trình diễn quy trình giải quyết bài toán mâu thuẫn phức tạp bằng phương pháp luận TRIZ kết hợp AI Solution Coach có căn cứ (Hard Grounding).  
**Bảo mật:** Toàn bộ tham số trong kịch bản sử dụng placeholder an toàn (`sk-proj-***`, `<SESSION_ID>`). Tuyệt đối không hard-code credentials.

---

## 1. Chuẩn Bị Môi Trường Trước Buổi Demo (Pre-Demo Setup)

1. **Khởi động hệ thống local sandbox:**
   ```bash
   # Terminal 1: Khởi động Backend & DB
   docker compose up -d

   # Terminal 2: Khởi động Frontend
   npm --prefix apps/web run dev
   ```

2. **Nạp dữ liệu mẫu an toàn (Idempotent Demo Seeder):**
   ```bash
   # Chạy script seeder nạp 2 bài toán mẫu hoàn chỉnh
   python backend/scripts/seed_demo_data.py --base-url http://localhost:8000
   ```

3. **Mở trình duyệt:**
   - Truy cập: `http://localhost:3000`
   - Đảm bảo AI Status Badge ở góc trên bên phải hiển thị màu xanh (`READY`).

---

## 2. Kịch Bản Chi Tiết Từng Phút (Minute-by-Minute Script)

### [00:00 - 00:45] | Mở Đầu: Tầm Nhìn & Triết Lý TRIZ + AI
- **Hành động trên màn hình:**
  - Mở trang chủ `/sessions`.
  - Nếu là tài khoản mới, chỉ vào **Welcome Onboarding Modal 3 bước**:
    - Bước 1: Định nghĩa bài toán & mâu thuẫn.
    - Bước 2: Chuẩn hóa mâu thuẫn theo TRIZ.
    - Bước 3: AI Coach gợi ý giải pháp có căn cứ (Hard Grounding).
  - Bấm nút **"Bỏ qua"** để chứng minh tính linh hoạt 1-click không chặn luồng công việc, sau đó chỉ vào nút icon **"Hướng dẫn nhanh"** trên thanh công cụ để minh họa khả năng xem lại tour bất kỳ lúc nào.
- **Lời thoại gợi ý (Talking Points):**
  > "Kính thưa quý vị, các công cụ GenAI thông thường thường đưa ra câu trả lời chung chung hoặc ảo giác (hallucination) khi đối mặt với các bài toán mâu thuẫn hóc búa trong kỹ thuật và kinh doanh.  
  > Creative Research Workbench (CRW) giải quyết triệt để vấn đề này bằng cách kết hợp **Lý thuyết Giải quyết Bài toán Sáng chế TRIZ** với **AI Solution Coach có kiểm chứng**. Hôm nay, tôi xin trình diễn cách CRW tháo gỡ một bài toán kinh doanh điển hình trong đúng 5 phút."

---

### [00:45 - 01:45] | Bước 1: Bóc Tách Mâu Thuẫn Kinh Doanh (Problem Framing)
- **Hành động trên màn hình:**
  - Nhấp mở phiên nghiên cứu mẫu đã seed:  
    `[DEMO] Tối ưu Tốc độ Giao hàng & Chi phí Logistics Chặng Cuối`.
  - Mở tab **Problem Frame**.
  - Chỉ vào phát biểu mâu thuẫn:
    - *Mục tiêu:* Giao hàng hỏa tốc trong 2 giờ (`speed`).
    - *Trở ngại / Xấu đi:* Chi phí kho bãi và tài xế trực chờ tăng vọt (`loss_of_money`).
- **Lời thoại gợi ý:**
  > "Đây là bài toán kinh điển của ngành Logistics: Khách hàng đòi hỏi giao hàng siêu tốc, nhưng nếu tăng tài xế trực chờ thì chi phí kho vận sẽ bào mòn toàn bộ lợi nhuận.  
  > Thay vì thỏa hiệp (trade-off) hay chọn giải pháp trung bình, CRW giúp chuẩn hóa bài toán thành một mâu thuẫn kỹ thuật sắc bén."

---

### [01:45 - 02:45] | Bước 2: Khám Phá Nguyên Tắc Sáng Tạo & Bằng Chứng Thực Nghiệm
- **Hành động trên màn hình:**
  - Chuyển sang tab **Research Notes (Ghi Chép & Bằng Chứng)**:
    - Điểm qua Note 1: Khảo sát thời gian chết của tài xế (45% thời gian chờ tại kho tổng).
    - Điểm qua Note 2: Mô hình Hub phân tán siêu nhỏ (Micro-fulfillment Center).
  - Chuyển sang tab **TRIZ Matrix & Lăng Kính Đời Sống (Everyday/Business Lens)**:
    - Hệ thống tự động đối chiếu thông số `speed` vs `loss_of_money` và trích xuất các nguyên tắc sáng tạo phù hợp:
      - *Nguyên tắc 10 (Hành động trước - Prior Action)*.
      - *Nguyên tắc 1 (Phân nhỏ - Segmentation)*.
      - *Nguyên tắc 35 (Thay đổi thông số - Parameter Changes)*.
- **Lời thoại gợi ý:**
  > "Hệ thống không yêu cầu người dùng phải là chuyên gia TRIZ. Ma trận 39x39 và bộ Lăng kính Kinh doanh tự động định vị các phát minh tương tự trong lịch sử nhân loại để tìm ra các hướng mở đường khả thi nhất."

---

### [02:45 - 04:00] | Bước 3: AI Solution Coach — Gợi Ý Có Căn Cứ & Kiểm Soát Con Người (HITL)
- **Hành động trên màn hình:**
  - Nhấn nút **"Tìm gợi ý từ AI Coach"**.
  - Quan sát phản hồi nhanh (<200ms) với danh sách tối đa 5 gợi ý:
    - Chỉ vào nhãn căn cứ: `Hard Grounding` liên kết trực tiếp với Nguyên tắc 10 và các ghi chép thực địa.
    - Nhấn mạnh cơ chế an toàn: Nếu AI offline hoặc mất mạng, hệ thống tự kích hoạt `rule_based_fallback` đảm bảo không bao giờ làm gián đoạn phiên làm việc.
  - Bấm **"Lưu thành Giải pháp"** cho giải pháp:  
    *Ứng dụng Nguyên tắc 10: Dự đoán nhu cầu SKU bán chạy tại từng cụm dân cư*.
  - Hộp thoại **ConfirmationModal** xuất hiện để xác nhận hành động, ngăn ngừa việc ghi đè hoặc lưu nhầm.
- **Lời thoại gợi ý:**
  > "Khác biệt cốt lõi của AI Coach trong CRW là tính minh bạch: Mỗi gợi ý giải pháp đều trích dẫn chính xác nguyên tắc TRIZ và bằng chứng thực nghiệm của doanh nghiệp. Con người luôn giữ quyền quyết định tối cao (Human-in-the-Loop) trước khi bất kỳ giải pháp nào được đưa vào kế hoạch hành động."

---

### [04:00 - 05:00] | Bước 4: Tổng Hợp Kế Hoạch & Xuất Bản Báo Cáo Chuyên Nghiệp
- **Hành động trên màn hình:**
  - Chuyển sang tab **Synthesis (Tổng Hợp)**.
  - Xem danh sách Candidate Solutions đã được chấm điểm Novelty (8/10) và Feasibility (9/10).
  - Bấm nút **"Xuất Báo Cáo"** (Export Markdown / Print Preview).
  - Trình chiếu giao diện in sạch sẽ (CSS `@media print`), ẩn toàn bộ nút bấm điều hướng, sẵn sàng xuất file PDF báo cáo chiến lược.
- **Lời thoại kết luận:**
  > "Chỉ trong 5 phút, từ một mâu thuẫn phức tạp ban đầu, CRW đã giúp nhóm nghiên cứu cấu trúc hóa bài toán, khám phá các giải pháp mang tính đột phá và xuất bản một bản báo cáo khả thi gửi ban lãnh đạo. Đó chính là sức mạnh của Creative Research Workbench."

---

## 3. Danh Mục Câu Hỏi Thường Gặp (Q&A Cheat Sheet)

| Câu hỏi của Stakeholder | Câu trả lời khuyến nghị |
| :--- | :--- |
| **Hệ thống có gửi dữ liệu bí mật kinh doanh lên cloud không?** | CRW hỗ trợ cả mô hình LLM cục bộ (Ollama) và API thương mại với bộ lọc mặt nạ bảo mật (Secret Masking), đảm bảo dữ liệu nhạy cảm không bị rò rỉ. |
| **Dữ liệu demo có lẫn vào môi trường production không?** | Hoàn toàn không. Công cụ seeder trang bị Anti-Production Guard, chặn đứng 100% các domain ngoài localhost/sandbox. |
| **Nếu không có kết nối Internet thì AI Coach có hoạt động không?** | Có. CRW sở hữu cơ chế Rule-Based Heuristic Fallback nội suy từ bộ tri thức TRIZ offline, đảm bảo hoạt động liên tục 100%. |
