# ADR-014: Kiến Trúc Trải Nghiệm Tiếp Cận, Dữ Liệu Demo Và Kịch Bản Trình Diễn (Productization & Onboarding Architecture)

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-18
- **Tác giả:** Senior Product Engineer / UX Engineer
- **Ngữ cảnh:** Creative Research Workbench (CRW) — Batch C33

---

## 1. Ngữ Cảnh & Vấn Đề (Context & Problem Statement)

Creative Research Workbench đã hoàn thiện các tính năng cốt lõi: Phân tích mâu thuẫn TRIZ, 40 nguyên tắc sáng tạo, AI Solution Coach (Batch C31), Observability và Benchmark Suite (Batch C32).

Tuy nhiên, về mặt tiếp cận sản phẩm (Productization & Adoption):
1. **Thiếu trải nghiệm chào đón (Welcome Friction):** Người dùng lần đầu mở ứng dụng bắt gặp danh sách trống (empty state) hoặc giao diện phức tạp mà không có định hướng rõ ràng về 3 bước giá trị cốt lõi: Tạo bài toán ➔ Bóc tách mâu thuẫn ➔ Nhận giải pháp từ AI Coach.
2. **Khó khăn khi demo cho stakeholder:** Người thuyết trình (Founder, Sales, Technical Architect) phải mất 10-15 phút gõ tay từng bước để tạo ra một session hoàn chỉnh có đầy đủ mâu thuẫn, ghi chép và giải pháp mẫu.
3. **Nguy cơ ô nhiễm dữ liệu production:** Nếu viết script nạp dữ liệu cẩu thả hoặc nhúng dữ liệu mẫu vào migration database, dữ liệu demo có thể vô tình lọt vào cơ sở dữ liệu thật.

Do đó, Batch C33 cần thiết lập một kiến trúc trải nghiệm Onboarding và cơ chế Seed dữ liệu demo an toàn, độc lập và tinh gọn.

---

## 2. Các Quyết Định Kiến Trúc (Decisions)

### Quyết định 1: Xây Dựng Welcome Onboarding Modal 3 Bước Tinh Gọn Trên Client State
- **Giải pháp:** Xây dựng component `WelcomeOnboardingModal` thuần React/Tailwind, không dùng thư viện ngoài nặng nề.
- **Trạng thái lưu trữ:** Sử dụng `localStorage` với khóa `crw_onboarding_dismissed = 'true'`.
- **Ràng buộc tương tác & Skip 1-Click:**
  - **Skip 1-Click bắt buộc:** Người dùng có thể nhấn nút "Bỏ qua" hoặc icon Close bất cứ lúc nào để đóng modal ngay lập tức và ghi nhận `crw_onboarding_dismissed = 'true'`. Tuyệt đối không bắt buộc phải click xem hết 3 bước.
  - Tái mở linh hoạt (Replayability): Cung cấp nút "Hướng dẫn nhanh" (Quick Guide icon) cố định trên header của danh sách session để người dùng mở lại khi muốn ôn lại quy trình.
  - 1-Click Quick Start: Tích hợp nút hành động cho phép người dùng tạo ngay một phiên nghiên cứu từ Domain Template mẫu (`business_delivery_speed_cost`).

### Quyết định 2: Công Cụ Nạp Dữ Liệu Demo Bất Đồng Bộ Qua REST API Kèm Anti-Production Guard
- **Giải pháp:** Cung cấp script độc lập `backend/scripts/seed_demo_data.py` sử dụng `httpx.AsyncClient` kết nối vào backend local (`http://localhost:8000`).
- **Giới hạn môi trường (Strict Local/Sandbox Constraint):**
  - Script được thiết kế thuần túy cho môi trường phát triển cục bộ và sandbox phục vụ chuẩn bị demo.
  - **ĐÂY KHÔNG PHẢI LÀ CÔNG CỤ NẠP DỮ LIỆU PRODUCTION.** Việc cấm dùng cho production là một giới hạn kiến trúc có chủ đích nhằm loại bỏ nguy cơ ô nhiễm dữ liệu thực.
- **Giới hạn số lượng nạp (Strict Bounds):**
  - Chỉ seed chính xác **2 demo sessions**.
  - Mỗi session chỉ có đúng **1 problem frame**, tối đa **2 notes**, tối đa **2 candidate solutions**.
  - Không nạp quá nhiều dữ liệu gây loãng hay rối hệ thống.
- **Lý do chọn REST API thay vì chèn trực tiếp vào Database:**
  - Đảm bảo 100% tuân thủ model validation, FSM state lifecycle và tự động kích hoạt tạo embeddings qua service layer.
  - Giữ database schema và migration history (`alembic/versions`) hoàn toàn sạch sẽ, không chứa dữ liệu giả lập.
- **Chốt chặn an toàn (Anti-Production Guard):**
  - Script kiểm tra URL đích, chỉ chấp nhận hostname thuộc whitelist: `localhost`, `127.0.0.1`, `0.0.0.0`, `testserver`.
  - Mọi URL trỏ ra ngoài (staging, production domain, IP public) sẽ bị chặn ngay lập tức và raise `ValueError`.
- **Tính lũy đẳng đa tiêu chí (Multi-criteria Idempotency) & Vòng đời nạp lại:**
  - Script kiểm tra danh sách session hiện có và đối chiếu cả 2 tiêu chí:
    a) Session có tiền tố `[DEMO]` (kể cả khi người dùng đổi một phần tiêu đề) $\rightarrow$ Bỏ qua (skip).
    b) Session có tiêu đề chính xác khớp với bài toán mẫu nhưng bị bỏ mất tiền tố `[DEMO]` $\rightarrow$ Bỏ qua (skip).
  - **Quy tắc chạy lại và nạp lại:**
    - Khi script chạy lần 2 trên cùng một sandbox, hệ thống tự động skip cả 2 session (`sessions_skipped: 2, sessions_created: 0`), tuyệt đối không tạo trùng lặp.
    - Nếu người dùng chủ động xóa hoặc archive các session `[DEMO]`, script seeder sẽ nhận diện trạng thái trống và cho phép nạp lại toàn bộ dữ liệu mẫu một cách an toàn.
- **Bảo mật tuyệt đối (Zero Secret Leak):**
  - Cả 2 định dạng xuất (Table và JSON) đều được lọc qua bộ che giấu token nhạy cảm (`mask_secrets_in_text`), đảm bảo không để lộ API keys hay Bearer tokens.

### Quyết định 3: Chuẩn Hóa Duy Nhất 1 Kịch Bản Demo 5 Phút Chuẩn Stakeholder (`docs/DEMO_SCRIPT.md`)
- **Giải pháp:** Tài liệu hóa chi tiết **duy nhất 1 kịch bản thuyết trình 5 phút**, chia thành 5 mốc thời gian rõ ràng (0:00 - 5:00), không thêm nhiều scenario gây rối.
- **Bảo mật tuyệt đối (Zero Hard-Coded Secret):** Toàn bộ tham số trong kịch bản và câu lệnh demo bắt buộc sử dụng placeholder (`sk-proj-***`, `<SESSION_ID>`).
- **Trọng tâm demo:**
  - Min 1: Giới thiệu Welcome modal & triết lý TRIZ + AI.
  - Min 2: Trực quan hóa mâu thuẫn logistics/kinh doanh.
  - Min 3: 40 nguyên tắc qua Lăng kính Đời sống.
  - Min 4: AI Solution Coach (Grounding, Cap 5, Fallback Heuristic, ConfirmationModal).
  - Min 5: Tổng hợp kế hoạch & xuất bản in PDF sạch.

### Quyết định 4: PR 3 Là Thay Đổi Thuần Tài Liệu (Docs-Only Finalization)
- **Giải pháp:** PR 3 chỉ cập nhật sổ tay vận hành `docs/DEPLOYMENT_GUIDE.md`, lộ trình `docs/IMPLEMENTATION_ROADMAP.md`, hoàn thiện đặc tả và chuyển ADR-014 sang `Accepted`.
- **Chấp nhận có chủ đích:** Không bổ sung automated code test mới cho PR 3. Chất lượng tài liệu được bảo đảm thông qua quy trình "Docs Health Check" trước khi commit (rà soát regex secret, markdown lint, và kiểm tra liên kết nội bộ).

---

## 3. Các Phương Án Bị Loại Bỏ (Rejected Alternatives)

| Phương Án Bị Loại | Lý Do Loại Bỏ |
| :--- | :--- |
| **Sử dụng thư viện Product Tour ngoài (như driver.js, Shepherd, intro.js)** | Làm tăng dung lượng bundle JS frontend (thêm 50-100KB), phụ thuộc vào DOM CSS selector dễ bị gãy khi refactor layout, gây cản trở người dùng. |
| **Nhúng dữ liệu mẫu vào Alembic Migration (Seed Migration)** | Ô nhiễm lịch sử migration, làm rò rỉ dữ liệu demo lên môi trường production khi chạy `alembic upgrade head`, vi phạm nguyên tắc Zero Production Blast Radius. |
| **Bắt buộc người dùng phải đi qua Onboarding (Forced Wizard)** | Gây khó chịu và ức chế cho người dùng chuyên nghiệp muốn vào việc ngay lập tức. |
| **Tạo endpoint POST `/seed-demo` trực tiếp trong backend production code** | Mở ra lỗ hổng bảo mật nếu ai đó gọi endpoint này trên môi trường live; script CLI chạy cục bộ an toàn hơn nhiều. |

---

## 4. Hậu Quả & Đánh Đổi (Consequences & Trade-offs)

### Tích cực:
- Nâng cao đáng kể tính thân thiện (Usability) cho người dùng mới và nhà nghiên cứu chưa quen với TRIZ.
- Tiết kiệm 100% thời gian chuẩn bị dữ liệu trước các buổi demo: Chỉ cần 1 lệnh CLI hoặc 1 click template là có đầy đủ toàn bộ vòng đời bài toán.
- Kịch bản demo chuẩn xác giúp nhà sáng lập và kỹ sư truyền tải trọn vẹn giá trị công nghệ của CRW trong đúng 5 phút.
- Giữ vững tính bất biến: 0 database schema changes, 0 production risks.

### Đánh đổi (Trade-offs):
- **Chấp nhận có chủ đích việc reset `localStorage`:** Cờ `crw_onboarding_dismissed` chỉ lưu trữ client-side trên trình duyệt. Nếu người dùng xóa bộ nhớ cache hoặc chuyển sang trình duyệt khác, cờ có thể bị reset và modal có thể xuất hiện lại. Đây là sự chấp nhận có chủ đích để giữ hệ thống siêu tinh gọn, không cần lưu trữ bảng dữ liệu hay cột trạng thái user onboarding trong database PostgreSQL. Người dùng luôn có thể tắt ngay trong 1 click ("Bỏ qua") hoặc mở lại bằng nút "Hướng dẫn nhanh".
- **Chấp nhận PR 3 là Docs-Only:** Không phát triển test tự động mới cho các cập nhật tài liệu vận hành và roadmap, tránh làm phức tạp hóa test suite khi không có thay đổi mã nguồn logic.

---

## 5. Chiến Lược Rollback (Rollback Strategy)

1. Nếu component Onboarding gặp lỗi render: Gỡ bỏ thẻ `<WelcomeOnboardingModal />` khỏi `SessionList` mà không ảnh hưởng tới bất kỳ luồng nghiệp vụ tạo/sửa session nào.
2. Dữ liệu mẫu do seeder tạo ra đều mang tiền tố `[DEMO]`, người dùng có thể xóa hoặc archive hàng loạt bằng giao diện hoặc API mà không để lại tác dụng phụ.
