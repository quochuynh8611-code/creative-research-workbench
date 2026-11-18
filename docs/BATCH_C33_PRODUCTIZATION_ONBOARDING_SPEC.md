# BATCH C33 SPECIFICATION: PRODUCTIZATION & ONBOARDING

**Dự án:** Creative Research Workbench (CRW)  
**Phiên bản:** v1.0.0 (Batch C33 — Productization & Onboarding)  
**Tác giả:** Senior Product Engineer / UX Engineer  
**Ngày:** 2026-11-18  
**Trạng thái:** Draft for Founder Review (Human-in-the-Loop)  

---

## 1. Mục Tiêu & Bối Cảnh (Context & Objectives)

Hệ thống Creative Research Workbench đã hoàn thiện các tính năng cốt lõi:
- **Batch C30:** AI Status Safety, Onboarding Banner 6 bước TRIZ, Confirmation Modals.
- **Batch C31:** AI Solution Coach với gợi ý có căn cứ (Hard Grounding), cap 5, rule-based fallback.
- **Batch C32:** Structured JSON Logging, Correlation ID, In-memory Metrics và Local Benchmark Suite.

Tuy nhiên, khi tiếp cận người dùng mới hoặc trình diễn sản phẩm (Demo) cho stakeholder / ban lãnh đạo / đối tác:
1. **Thiếu trải nghiệm chào đón trực quan (Welcome Experience):** Người dùng lần đầu vào ứng dụng thường bỡ ngỡ trước các thuật ngữ TRIZ chuyên sâu nếu chưa đọc tài liệu hướng dẫn.
2. **Khó demo tức thì nếu chưa có dữ liệu (Empty State Friction):** Để demo luồng từ Phân tích ➔ AI Coach ➔ Solution ➔ Export, người thuyết trình phải gõ tay dữ liệu từ đầu, mất nhiều thời gian trong buổi demo ngắn (5 phút).
3. **Thiếu kịch bản demo chuẩn hóa (Standard Demo Script):** Chưa có kịch bản định thời lượng và hướng dẫn từng bước chuẩn xác cho stakeholder.

**Mục tiêu cốt lõi của Batch C33:**
- Xây dựng **Welcome / Onboarding Dialog 3 bước** tinh gọn, không chặn (dismissible), lưu trạng thái `localStorage`, có thể mở lại bất kỳ lúc nào.
- Xây dựng **Sample Data Seeder CLI (`backend/scripts/seed_demo_data.py`)** an toàn cho môi trường dev/local (Anti-Production Guard), nạp 2 phiên nghiên cứu mẫu hoàn chỉnh.
- Soạn thảo **Kịch bản Demo 5 phút (`docs/DEMO_SCRIPT.md`)** chuyên nghiệp cho stakeholder.

---

## 2. Ranh Giới Phạm Vi (Scope Boundaries)

### Trong Phạm Vi (In-Scope):
1. **Frontend Onboarding Component:**
   - Component `WelcomeOnboardingModal` hiển thị cho người dùng mới (chưa có session hoặc chưa từng dismiss).
   - Tinh gọn trong **3 bước cốt lõi**:
     - **Bước 1: Tạo Phiên Nghiên Cứu** (Tự nhập hoặc chọn 1-click từ Domain Templates).
     - **Bước 2: Chuẩn Hóa Mâu Thuẫn** (Phát biểu vấn đề theo mâu thuẫn kỹ thuật/vật lý TRIZ).
     - **Bước 3: Nhận Gợi Ý AI Coach & Hành Động** (Nhận 5 gợi ý grounded, lưu giải pháp và xuất báo cáo).
   - **Skip 1-Click bắt buộc:** Nút "Bỏ qua" hoặc icon Close đóng modal ngay lập tức và ghi `crw_onboarding_dismissed = 'true'` vào `localStorage`, KHÔNG bắt buộc người dùng phải xem hết 3 bước.
   - Nút hành động: "Bắt đầu nhanh với bài toán mẫu", "Tạo phiên nghiên cứu mới", hoặc "Bỏ qua" (Skip/Dismiss).
   - Nút "Hướng dẫn nhanh" / "Tour hướng dẫn" trên thanh công cụ Session List để mở lại modal khi cần.
   - **Lưu ý về localStorage:** Trạng thái dismiss được lưu client-side; việc cờ này có thể bị reset khi người dùng xóa cache hoặc đổi trình duyệt là sự **chấp nhận có chủ đích** nhằm giữ hệ thống tinh gọn, không cần lưu trữ trạng thái onboarding vào database.
2. **Sample Data Seeder (`backend/scripts/seed_demo_data.py`):**
   - Script CLI độc lập chạy qua `httpx.AsyncClient` kết nối vào backend local (`http://localhost:8000`).
   - Anti-Production Guard: Chỉ cho phép chạy với hostname trong `ALLOWED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "testserver"}`.
   - **Giới hạn số lượng nạp (Strict Seeder Bounds):**
     - Chỉ seed chính xác **2 demo sessions**.
     - Mỗi session chỉ có đúng **1 problem frame**, tối đa **2 notes**, tối đa **2 candidate solutions**.
     - KHÔNG nạp quá nhiều dữ liệu gây loãng hay rối phiên làm việc.
     - **Mẫu 1 (Business):** Tối ưu hóa Tốc độ Giao hàng & Chi phí Logistics chặng cuối (1 frame, 2 notes, 2 candidate solutions).
     - **Mẫu 2 (Software/Technical):** Tăng cường Bảo mật Đa tầng & Tối ưu Hóa Độ trễ API (1 frame, 1 note, 1 candidate solution).
   - Tính lũy đẳng (Idempotency): Kiểm tra trùng tiêu đề trước khi tạo, tránh nhân bản dữ liệu khi chạy nhiều lần.
3. **Demo Script (`docs/DEMO_SCRIPT.md`):**
   - **Giới hạn kịch bản:** Chỉ duy nhất **1 kịch bản demo 5 phút** chuẩn mực, không thêm nhiều scenario phức tạp.
   - Script tài liệu hóa mốc thời gian rõ ràng (0:00 - 5:00) từ mở app ➔ tạo session ➔ phân tích ➔ AI Coach ➔ lưu solution ➔ export.
   - **Placeholder an toàn:** Mọi cấu hình hoặc tham số nhạy cảm trong script bắt buộc dùng placeholder (`sk-proj-***`, `<SESSION_ID>`), tuyệt đối không hard-code credentials hay API keys.

### Ngoài Phạm Vi (Out-of-Scope):
- KHÔNG deploy lên production.
- KHÔNG thay đổi database schema hoặc tạo Alembic migration mới (Alembic head giữ nguyên `006 (head)`).
- KHÔNG sửa đổi các API logic cốt lõi của backend (seeder chỉ dùng các API POST/GET có sẵn).
- KHÔNG bắt buộc người dùng phải hoàn thành onboarding (phải cho phép skip/dismiss 1-click).

---

## 3. Kiến Trúc Kỹ Thuật (Technical Architecture)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        apps/web (Frontend)                             │
├────────────────────────────────────────────────────────────────────────┤
│  SessionList Page (/sessions)                                          │
│    ├── AIStatusBadge (Trạng thái AI)                                   │
│    ├── OnboardingTourTrigger (Nút "Hướng dẫn nhanh" trên Header)       │
│    ├── WelcomeOnboardingModal (Dialog 3 bước cho new users / replay)   │
│    │     ├── Step 1: Tạo session / Chọn Template                       │
│    │     ├── Step 2: Chuẩn hóa Mâu thuẫn TRIZ                          │
│    │     └── Step 3: Gợi ý AI Coach & Lưu giải pháp                    │
│    │     └── Actions: [Bắt đầu với Mẫu] [Tạo mới] [Bỏ qua (Dismiss)]   │
│    └── OnboardingWorkflowBanner (Banner 6 bước hiển thị khi rỗng)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST API (Async)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       backend/scripts/seed_demo_data.py                │
├────────────────────────────────────────────────────────────────────────┤
│  CLI Runner nạp dữ liệu mẫu phục vụ Stakeholder Demo                   │
│    ├── Anti-Production Guard (Chặn domain production/staging)          │
│    ├── Idempotent Seeder (Kiểm tra session trùng lặp)                  │
│    ├── Sample 1: Business Logistics (Session + Frame + Notes + Sols)   │
│    └── Sample 2: Software Security & Latency                           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Đặc Tả Giao Diện & UX Flow (Welcome Onboarding Modal)

1. **Điều kiện kích hoạt tự động:**
   - Khi người dùng truy cập trang `/sessions`:
   - Nếu `localStorage.getItem('crw_onboarding_dismissed') !== 'true'` VÀ danh sách sessions đang rỗng:
   - Tự động hiển thị `WelcomeOnboardingModal`.
2. **Kích hoạt thủ công (Replay):**
   - Header của `SessionList` bổ sung nút icon `HelpCircle` hoặc `Compass` ("Hướng dẫn nhanh"). Nhấn vào sẽ mở lại modal bất cứ lúc nào mà không phụ thuộc vào `localStorage`.
3. **Cấu trúc 3 bước trong Modal:**
   - **Thẻ 1 (Bước 1 — Định nghĩa bài toán):** Trình bày trực quan icon `Inbox`, giải thích cách nhập mục tiêu mong muốn và trở ngại thực tế.
   - **Thẻ 2 (Bước 2 — Phân tích mâu thuẫn):** Trình bày icon `GitFork`, giải thích cách TRIZ chuẩn hóa thông số cải thiện (Improving) vs thông số xấu đi (Worsening).
   - **Thẻ 3 (Bước 3 — AI Solution Coach):** Trình bày icon `Sparkles`, minh họa cách AI Coach đề xuất các giải pháp có căn cứ (Hard Grounding) từ 40 nguyên tắc sáng tạo.
4. **Hành động điều hướng (Actions):**
   - Nút **"Bắt đầu nhanh với Bài toán Mẫu"** (Primary): Tự động gọi API `createSessionFromTemplate` với template `business_delivery_speed_cost` và chuyển thẳng người dùng vào session chi tiết.
   - Nút **"Tự tạo Phiên Nghiên Cứu"** (Secondary): Đóng modal và mở form tạo session thông thường.
   - Nút **"Bỏ qua" / Icon Close** (Ghost): Đóng modal, lưu `crw_onboarding_dismissed = 'true'` vào `localStorage`.

---

## 5. Đặc Tả Dữ Liệu Mẫu (Sample Seed Data)

Script `backend/scripts/seed_demo_data.py` nạp 2 bài toán hoàn chỉnh:

### Mẫu 1: Doanh nghiệp Vận tải & Logistics (Business Domain)
- **Tiêu đề:** `[DEMO] Tối ưu Tốc độ Giao hàng & Chi phí Logistics Chặng Cuối`
- **Domain:** `business`
- **Problem Frame:**
  - *Mâu thuẫn:* Muốn giao hàng nhanh trong 2 giờ (`speed`) nhưng chi phí kho bãi và tài xế trực chờ quá tốn kém (`loss_of_money`).
- **Research Notes (Bằng chứng thực nghiệm):**
  - Note 1: "Khảo sát thời gian chết của đội ngũ giao vận tại 5 quận trung tâm" (Nguồn: Báo cáo vận hành nội bộ Q3).
  - Note 2: "Mô hình Hub phân tán siêu nhỏ (Micro-fulfillment Center) của chuỗi bán lẻ quốc tế" (Nguồn: Tài liệu Case Study).
- **Candidate Solutions (Giải pháp ứng viên):**
  - Solution 1: "Ứng dụng Nguyên tắc 10 (Hành động trước): Dự đoán nhu cầu SKU bán chạy và luân chuyển hàng đến điểm gửi đối tác trước giờ cao điểm." (Novelty: 8/10, Feasibility: 9/10, Status: accepted).
  - Solution 2: "Ứng dụng Nguyên tắc 1 (Phân nhỏ): Chia gói hàng thành cụm bưu kiện theo bán kính 1km và kết hợp tài xế cộng tác viên bán thời gian." (Novelty: 7/10, Feasibility: 8/10, Status: candidate).

### Mẫu 2: Kiến Trúc Phần Mềm API (Software/Technical Domain)
- **Tiêu đề:** `[DEMO] Tăng cường An ninh Đa tầng & Giảm Độ trễ API Gateway`
- **Domain:** `software`
- **Problem Frame:**
  - *Mâu thuẫn:* Muốn kiểm tra chữ ký token và giải mã đa lớp (`reliability`) nhưng không được làm tăng thời gian phản hồi API quá 50ms (`duration_action`).
- **Research Notes:**
  - Note 1: "Benchmarking thời gian xác thực JWT asymmetric vs symmetric tại gateway".
- **Candidate Solutions:**
  - Solution 1: "Ứng dụng Nguyên tắc 19 (Hành động theo chu kỳ): Xác thực toàn diện chữ ký khóa công khai theo chu kỳ 5 phút và lưu phiên xác thực tại in-memory cache cục bộ." (Novelty: 8/10, Feasibility: 9/10, Status: accepted).

---

## 6. Kịch Bản Demo 5 Phút Cho Stakeholder (`docs/DEMO_SCRIPT.md`)

- **0:00 - 0:45 | Giới thiệu bài toán & Khái niệm TRIZ + AI:**
  Mở màn hình chính, giới thiệu Creative Research Workbench là công cụ hỗ trợ tư duy phát minh và giải quyết bài toán hóc búa, kết hợp giữa phương pháp luận TRIZ kinh điển và sức mạnh của AI Coach.
- **0:45 - 1:45 | Tiếp cận bài toán qua Welcome Tour hoặc Session Mẫu:**
  Nhấn vào bài toán mẫu `[DEMO] Tối ưu Tốc độ Giao hàng & Chi phí Logistics Chặng Cuối`. Trình diễn màn hình Problem Framing với mâu thuẫn được định hình sắc bén (`speed` vs `loss_of_money`).
- **1:45 - 2:45 | Khám phá Nguyên tắc Sáng tạo & Lăng kính Đời sống:**
  Mở tab Ma trận TRIZ & Lăng kính Kinh doanh, chỉ ra các nguyên tắc được khuyến nghị: Nguyên tắc 10 (Hành động trước), Nguyên tắc 1 (Phân nhỏ), Nguyên tắc 35 (Thay đổi thông số).
- **2:45 - 4:00 | Trình diễn AI Solution Coach (Human-in-the-Loop):**
  Nhấn nút "Tìm gợi ý từ AI Coach". Chỉ ra tối đa 5 gợi ý có căn cứ (Hard Grounding), phân biệt nguồn gốc `ai_coach` và cơ chế phòng vệ `rule_based_fallback`. Bấm "Lưu thành Giải pháp" kèm hộp thoại xác nhận ConfirmationModal chống thao tác nhầm.
- **4:00 - 5:00 | Tổng hợp Kế hoạch & Xuất Báo cáo:**
  Chuyển sang Tab Synthesis, trình diễn tài liệu tổng hợp Markdown/JSON, nhấn nút in PDF chuẩn định dạng `@media print` sẵn sàng gửi cho đối tác hoặc nhà đầu tư.

---

## 7. Ma Trận Kịch Bản Gherkin (Gherkin Scenarios)

```gherkin
Feature: Welcome Onboarding & Demo Productization
  As a new user or product presenter
  I want an intuitive onboarding modal and pre-seeded sample sessions
  So that I can immediately understand the workflow and demonstrate value in 5 minutes

  Scenario: Welcome modal automatically appears for first-time visitors with empty sessions
    Given user visits "/sessions"
    And localStorage does not have "crw_onboarding_dismissed"
    And the session list is empty
    When the page completes loading
    Then the Welcome Onboarding modal is displayed
    And it presents 3 sequential workflow steps

  Scenario: User dismisses the welcome modal
    Given the Welcome Onboarding modal is open
    When the user clicks "Bỏ qua" or the close button
    Then the modal is closed
    And localStorage has "crw_onboarding_dismissed" set to "true"
    And reloading "/sessions" does not auto-open the modal

  Scenario: User manually triggers the onboarding tour
    Given user is on "/sessions"
    And the Welcome Onboarding modal is closed
    When user clicks the "Hướng dẫn nhanh" button in header
    Then the Welcome Onboarding modal is opened regardless of localStorage

  Scenario: Quick start with sample template from onboarding modal
    Given the Welcome Onboarding modal is open
    When user clicks "Bắt đầu với bài toán mẫu"
    Then a session is created from template "business_delivery_speed_cost"
    And user is redirected to the session workspace

  Scenario: Anti-Production Guard prevents demo seeding on remote hosts
    Given target base URL is "https://api.crw-workbench.com"
    When seed_demo_data is executed
    Then it raises ValueError with message containing "Anti-Production Guard"

  Scenario: Seeder idempotently injects sample demo sessions into local sandbox
    Given target base URL is "http://localhost:8000"
    When seed_demo_data is executed
    Then 2 demo sessions are created with ProblemFrames, Notes, and CandidateSolutions
    When seed_demo_data is executed a second time
    Then no duplicate demo sessions are created
```

---

## 8. Kế Hoạch Kiểm Thử Fail-First (Red Phase)

1. `apps/web/features/session/__tests__/welcome-onboarding-modal.test.tsx`:
   - `test_welcome_modal_renders_for_new_users`
   - `test_welcome_modal_dismiss_sets_local_storage`
   - `test_welcome_modal_manual_trigger_opens_modal`
   - `test_quick_start_button_creates_session_from_template`
2. `backend/tests/unit/test_demo_seeder.py`:
   - `test_validate_seeder_params_rejects_external_hosts`
   - `test_validate_seeder_params_accepts_localhost`
   - `test_seeder_creates_demo_sessions_with_grounding_notes_and_solutions`
   - `test_seeder_idempotency_avoids_duplicate_creation`
   - `test_seeder_payloads_zero_secret_leak`

---

## 9. Phân Tích Đánh Đổi (Trade-offs) & Kiểm Soát Rủi Ro

| Quyết định | Đánh đổi / Rủi ro | Giải pháp kiểm soát |
| :--- | :--- | :--- |
| **Lưu trạng thái dismiss trên `localStorage`** | Trạng thái không đồng bộ giữa các trình duyệt khác nhau | Đây là UX client-side nhẹ nhàng, có thêm nút "Hướng dẫn nhanh" để người dùng mở lại bất cứ lúc nào. |
| **Seeder chạy qua REST API thay vì trực tiếp database** | Tốc độ chậm hơn 1 chút so với raw SQL insert | Đảm bảo 100% tuân thủ model validation, FSM state và auto-embedding của backend. Có Anti-Production Guard chặn URL ngoài. |
| **Gắn nhãn `[DEMO]` ở đầu tiêu đề session mẫu** | Người dùng có thể nhìn thấy tiền tố `[DEMO]` | Giúp người dùng phân biệt rõ giữa phiên nghiên cứu thực tế và dữ liệu mẫu, có thể xóa hoặc archive an toàn. |

---

## 10. Đề Xuất Chiến Lược Phân Rã PR (Batch C33)

- **PR 1: `feat(ux): welcome onboarding modal and quick-start flow`**
  - Component `WelcomeOnboardingModal`, tích hợp nút replay trên `SessionList`, unit tests trên Next.js/React.
- **PR 2: `feat(ops): demo data seeder and stakeholder demo script`**
  - CLI script `backend/scripts/seed_demo_data.py`, unit test seeder, tài liệu `docs/DEMO_SCRIPT.md`.
- **PR 3: `docs(product): Batch C33 productization finalization & roadmap update`**
  - Cập nhật deployment guide, roadmap Batch C33, chuyển ADR-014 sang `Accepted`.
