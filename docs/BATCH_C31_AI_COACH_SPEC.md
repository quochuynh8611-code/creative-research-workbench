# BẢN ĐẶC TẢ KỸ THUẬT (SPECIFICATION) — BATCH C31: AI SOLUTION COACH

**Dự án:** Creative Research Workbench (CRW)  
**Phiên bản:** v1.1.0 (Phase 14 / Batch C31)  
**Trạng thái:** Spec Implemented — PR 1 & PR 2 Merged, PR 3 in progress  
**Mục tiêu:** Mở rộng AI Solution Coach thành trợ lý đồng hành phân tích và gợi ý giải pháp theo ngữ cảnh TRIZ, tuân thủ nghiêm ngặt nguyên tắc Human-in-the-Loop, Zero Auto-Overwrite và Grounded Traceability.

---

## 1. Mục Tiêu & Triết Lý Thiết Kế (Design Philosophy)

1. **Công cụ Trợ lực Con người (Human-Empowering Tool):**
   - AI Coach KHÔNG phải là một autonomous agent tự động thực hiện hành động.
   - AI Coach là một cố vấn chuyên môn (Advisor/Coach) giúp người nghiên cứu phát hiện các góc nhìn mới, liên kết mâu thuẫn kỹ thuật với 40 nguyên tắc sáng tạo và đặt câu hỏi gợi mở.
2. **Kỷ Luật Kiểm Chứng & Truy Vết (Grounded Traceability):**
   - Mọi gợi ý sinh ra từ AI Coach bắt buộc phải có nguồn gốc (Grounding Source): mâu thuẫn kỹ thuật cụ thể, nguyên tắc TRIZ, ghi chú trước đó, hoặc bằng chứng trong Knowledge Base.
   - Tuyệt đối không đưa ra các khẳng định mang tính ảo giác (hallucination) không truy vết được.
3. **Bảo Vệ Toàn Vẹn Dữ Liệu (Zero Auto-Overwrite):**
   - Lệnh gọi AI Coach là một thao tác truy vấn thuần túy (Read-only Analysis), hoàn toàn KHÔNG tự động ghi đè hay thay đổi trạng thái phiên (`workflow_state`, `ProblemFrame`).
   - Mọi hành động chuyển đổi gợi ý thành Candidate Solution hoặc Research Note đều phải qua xác nhận tường minh từ Founder.
4. **Resilience & Safe Fallback:**
   - Khi không có kết nối Internet, thiếu API key, hoặc LLM gặp sự cố (timeout, 429), hệ thống tự động kích hoạt Rule-Based TRIZ Heuristic Coach để luôn cung cấp gợi ý có giá trị mà không làm sập giao diện hay treo request.

---

## 2. Ranh Giới Phạm Vi (Scope Boundary)

### 2.1 Trong Phạm Vi (In-Scope)
1. **Backend AI Coach Service (`AICoachService`):**
   - **Giới hạn số lượng gợi ý:** Mỗi lần phân tích trả về **tối đa 5 suggestions** (tập trung vào chất lượng, tính liên quan cao và khả năng kiểm chứng).
   - **Quy tắc Grounding cứng (Hard Grounding Rule):**
     - Mỗi gợi ý bắt buộc phải có ít nhất một `source_grounding` hợp lệ trỏ tới một trong 4 thực thể: `contradiction`, `principle`, `evidence`, hoặc `note`.
     - Nếu gợi ý từ LLM không có căn cứ hợp lệ hoặc căn cứ rỗng: **Loại bỏ ngay lập tức**, tuyệt đối không hiển thị cho người dùng.
   - **Giới hạn ngữ cảnh đầu vào (Bounded Input Context):**
     - Chỉ thu thập các trường cần thiết trong phiên: `title`, `domain`, `ProblemFrame` (statement, contradiction type, improving/worsening parameters), top 3-5 Candidate Solutions hiện có, top 3-5 Research Notes hiện có, và các nguyên tắc TRIZ từ ma trận Altshuller.
     - Giới hạn kích thước prompt tối đa (bounded prompt size), tuyệt đối không gửi toàn bộ database, không gửi metadata hệ thống, không gửi secret, API key hay token.
   - **Phân loại 5 nhóm gợi ý có cấu trúc:**
     1. `possible_cause`: Nguyên nhân gốc rễ tiềm ẩn chưa được khai thác.
     2. `contradiction_direction`: Hướng mâu thuẫn kỹ thuật hoặc vật lý gợi mở.
     3. `relevant_principle`: Nguyên tắc sáng tạo TRIZ hoặc lăng kính tư duy phù hợp nhất.
     4. `clarifying_question`: Câu hỏi đào sâu để người nghiên cứu tự kiểm chứng.
     5. `solution_candidate`: Ý tưởng giải pháp sơ bộ kèm cơ chế hoạt động.
   - **Phân định Provenance minh bạch (Clear Provenance):**
     - `ai_coach`: Gợi ý được sinh từ mô hình AI thật (OpenAI / Ollama).
     - `rule_based_fallback`: Gợi ý từ bộ quy tắc TRIZ Heuristic cục bộ (Rule-Based Coach KHÔNG phải AI).
2. **Backend API Endpoint:**
   - `POST /api/v1/sessions/{session_id}/coach/suggestions`
   - Nhận diện `session_id`, xác thực session tồn tại, tổng hợp ngữ cảnh có giới hạn và trả về JSON có cấu trúc.
   - **Idempotency & Rate Limit:**
     - Endpoint là thao tác thuần truy vấn (pure query/preview), **zero side-effects xuống database**.
     - Áp dụng kiểm soát tần suất per-session: khi client gửi nhiều request dồn dập, chỉ trả lời phân tích logic an toàn, không tạo mutations.
     - Timeout tối đa 10s, retry tối đa 2 lần. Khi lỗi mạng, timeout hoặc malformed JSON: tự động chuyển sang `rule_based_fallback`.
   - Cam kết Zero Secret Exposure: Không trả về API key hay prompt thô chứa dữ liệu nhạy cảm.
3. **Frontend Coach Panel (`AICoachPanel`):**
   - Đặt tại không gian làm việc của Session (tích hợp trong tab Ideation / Session Workspace).
   - Hiển thị danh sách tối đa 5 thẻ gợi ý, phân định rõ ràng nhãn nguồn gốc (`ai_coach` vs `rule_based_fallback`).
   - Hiển thị các trạng thái trực quan:
     - `idle`: Trạng thái sẵn sàng phân tích kèm nút bấm "Phân tích cùng AI Coach".
     - `analyzing`: Trạng thái đang tải (skeleton/spinner) an toàn.
     - `suggestions_ready`: Danh sách thẻ gợi ý trực quan, có huy hiệu phân loại nhóm và căn cứ nguồn.
     - `empty`: Trạng thái phiên chưa có đủ dữ liệu (chưa có ProblemFrame) kèm hướng dẫn bổ sung.
     - `degraded_mock`: Huy hiệu thông báo đang hoạt động ở chế độ Mock hoặc Rule-Based Fallback.
   - Tương tác người dùng:
     - [Chấp nhận]: Đánh dấu đã tiếp thu gợi ý.
     - [Bỏ qua]: Ẩn thẻ gợi ý khỏi danh sách xem.
     - [Tạo Giải pháp]: Mở modal xác nhận và chuyển đổi thành Candidate Solution mới qua API hiện có.
     - [Tạo Ghi chú]: Mở modal xác nhận và chuyển đổi thành Research Note mới qua API hiện có.
4. **Không Thay Đổi Database Schema:**
   - Giữ nguyên toàn bộ schema hiện hành. Các gợi ý là dữ liệu tạm thời (ephemeral) phía client; chỉ khi người dùng bấm "Tạo Giải pháp" hoặc "Tạo Ghi chú" thì mới ghi vào các bảng `candidate_solutions` và `research_notes` sẵn có.

### 2.2 Ngoài Phạm Vi (Out-of-Scope)
- KHÔNG xây dựng Autonomous Agent tự động quyết định thay người dùng.
- KHÔNG tích hợp thuật toán ARIZ (Algorithm for Inventive Problem Solving) hoặc các quy luật tiến hóa hệ thống kỹ thuật phức tạp.
- KHÔNG thêm domain, lens hoặc workflow stages mới ngoài 6 chặng TRIZ hiện có.
- KHÔNG lưu trữ hoặc sử dụng dữ liệu người dùng để huấn luyện model.
- KHÔNG deploy production.

---

## 3. Kiến Trúc Kỹ Thuật & Luồng Dữ Liệu (Architecture & Data Flow)

```
┌────────────────────────────────────────────────────────────────────────┐
│                          USER / BROWSER UI                             │
│                                                                        │
│  [AICoachPanel]                                                        │
│   ├── Nút "Phân tích cùng AI Coach" ──(1. POST /coach/suggestions)──┐  │
│   ├── Hiển thị thẻ Suggestions & Grounding Sources                  │  │
│   ├── Nút "Tạo Solution" ──(Confirm Modal)──> POST /candidate-sol   │  │
│   └── Nút "Tạo Ghi chú"  ──(Confirm Modal)──> POST /notes           │  │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ (1) Request
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKAPI REST ENDPOINT                           │
│  POST /api/v1/sessions/{session_id}/coach/suggestions                   │
│                                                                        │
│  ├── 1. Xác thực session tồn tại & lấy context:                         │
│  │      - ProblemFrame (statement, contradiction, improving/worsening) │
│  │      - Existing CandidateSolutions & ResearchNotes                  │
│  │      - Altshuller Recommended Principles (MethodRecommender)        │
│  │                                                                     │
│  ├── 2. AICoachService:                                                │
│  │      ├── Thử gọi LLMClient.generate_coach_suggestions(context)     │
│  │      │     └── Timeout: 10s | Max retries: 2                        │
│  │      └── Fallback: RuleBasedCoach (TRIZ Heuristic Generator)        │
│  │                                                                     │
│  └── 3. Trả về AICoachResponse (JSON chuẩn hóa, Zero Secret)            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Đặc Tả Hợp Đồng Giao Tiếp API (API Contract)

### Endpoint: `POST /api/v1/sessions/{session_id}/coach/suggestions`
- **Method:** `POST`
- **Path Parameter:** `session_id` (UUID hợp lệ)
- **Request Body:** Không bắt buộc (hoặc tùy chọn filter category nếu cần trong tương lai)
- **Response Headers:** `Content-Type: application/json`

#### Response Model (`AICoachResponse`):
```json
{
  "data": {
    "session_id": "9d791a4d-2bc3-5141-aade-d7fdde622b23",
    "summary": "AI Coach nhận thấy bài toán đang gặp mâu thuẫn cốt lõi giữa Tốc độ giao hàng và Chi phí vận hành.",
    "provenance": "ai_coach",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "latency_ms": 845.2,
    "fallback_reason": null,
    "generated_at": "2026-11-17T20:10:00.000Z",
    "suggestions": [
      {
        "id": "sug-b4e8-4821",
        "category": "possible_cause",
        "title": "Nút thắt phân loại thủ công tại kho trung chuyển",
        "description": "Thời gian giao hàng bị kéo dài chủ yếu do khâu kiểm đếm và phân tuyến thủ công ở giờ cao điểm.",
        "source_grounding": {
          "source_type": "contradiction",
          "source_reference": "Mâu thuẫn kỹ thuật: Tốc độ (Improving) vs Tổn thất thời gian (Worsening)"
        },
        "actionable_payload": null
      },
      {
        "id": "sug-c1f9-3312",
        "category": "relevant_principle",
        "title": "Áp dụng Nguyên tắc #1: Phân nhỏ (Segmentation)",
        "description": "Chia nhỏ lộ trình giao hàng thành các chặng vi mô (micro-hubs) để tối ưu chi phí xe tải lớn.",
        "source_grounding": {
          "source_type": "principle",
          "source_reference": "Nguyên tắc sáng tạo TRIZ #1: Phân nhỏ (Segmentation)"
        },
        "actionable_payload": null
      },
      {
        "id": "sug-d2a3-9981",
        "category": "solution_candidate",
        "title": "Mô hình Trạm trung chuyển linh hoạt (Dynamic Micro-Hubs)",
        "description": "Sử dụng các điểm ký gửi đối tác làm trạm đệm di động nhằm giảm quãng đường di chuyển của tài xế.",
        "source_grounding": {
          "source_type": "principle",
          "source_reference": "Nguyên tắc sáng tạo TRIZ #1: Phân nhỏ kết hợp Nguyên tắc #15: Linh hoạt hóa"
        },
        "actionable_payload": {
          "title": "Mô hình Trạm trung chuyển linh hoạt (Dynamic Micro-Hubs)",
          "mechanism": "Ứng dụng thuật toán phân cụm đơn hàng theo thời gian thực để phân bổ hàng tới micro-hubs gần nhất, kết hợp tài xế chặng cuối độc lập."
        }
      },
      {
        "id": "sug-e5b7-1044",
        "category": "clarifying_question",
        "title": "Tần suất đơn hàng ngoài giờ cao điểm",
        "description": "Liệu chi phí có giảm đáng kể nếu đơn hàng không gấp được gom lại để giao vào khung giờ thấp điểm?",
        "source_grounding": {
          "source_type": "session_context",
          "source_reference": "Ngữ cảnh bài toán Logistics & Giao vận"
        },
        "actionable_payload": {
          "content": "Câu hỏi làm rõ: Tỷ lệ khách hàng sẵn sàng nhận hàng chậm hơn 2 giờ để đổi lấy voucher giảm giá vận chuyển là bao nhiêu?",
          "note_type": "hypothesis"
        }
      }
    ]
  }
}
```

---

## 5. Đặc Tả Giao Diện & Trải Nghiệm Người Dùng PR 2 (UI Specification)

### 5.1 Vị Trí & Hiển Thị của `AICoachPanel`
- Đặt tại tab **Ideation (Ý tưởng & Nguyên tắc)** trong `apps/web/features/session/session-detail.tsx`, ngay phía trên hoặc đồng hành cùng `CandidateSolutions`.
- Header của Panel hiển thị:
  - Biểu tượng AI Coach (Bot / Sparkles)
  - Tiêu đề: **AI Solution Coach**
  - Trạng thái AI Provider (gắn liền với cấu hình của hệ thống: Sẵn sàng / Mock mode / Degraded)
  - Nút bấm chính: **"Phân tích cùng AI Coach"** (kèm trạng thái loading khi đang xử lý).

### 5.2 5 Trạng Thái Trực Quan (Component States)
1. **`idle`**:
   - Khi chưa chạy phân tích trong phiên.
   - Hiển thị mô tả ngắn gọn về khả năng trợ lý giải pháp TRIZ và nút bấm "Phân tích với AI Coach".
2. **`analyzing`**:
   - Trạng thái đang tải dữ liệu (Loading skeleton / spinner với thông điệp: *"AI Coach đang rà soát mâu thuẫn, nguyên tắc TRIZ và bằng chứng..."*).
   - Nút phân tích bị vô hiệu hóa (disabled).
3. **`suggestions`**:
   - Hiển thị thẻ tóm tắt phân tích (`summary`).
   - **Quy tắc Giới hạn (Max 5 Displayed)**: Frontend chỉ hiển thị tối đa 5 gợi ý đầu tiên. Nếu backend trả nhiều hơn 5, chỉ hiển thị 5 và kèm thông báo: *"Đã hiển thị 5 gợi ý ưu tiên"*.
   - **Contract Validation chặt chẽ**: Mỗi suggestion bắt buộc phải có đủ: `id`, `category`, `title`, `description`, `source_grounding.source_type`, `source_grounding.source_reference`. Nếu thiếu bất kỳ trường nào, bỏ qua card đó, không crash UI và không hiển thị card lỗi.
   - Danh sách tối đa 5 thẻ gợi ý (`CoachSuggestion`), mỗi thẻ hiển thị:
     - Category badge (Nguyên nhân / Hướng mâu thuẫn / Nguyên tắc TRIZ / Câu hỏi làm rõ / Giải pháp đề xuất).
     - Title & Description.
     - Source Grounding badge (`source_type`: contradiction, principle, evidence, note kèm `source_reference`).
     - Provenance tag rõ ràng ("AI Coach" vs "Rule-based fallback").
4. **`empty`**:
   - Khi phiên nghiên cứu chưa có `ProblemFrame` (hoặc statement rỗng).
   - Hiển thị banner hướng dẫn: *"Phiên nghiên cứu chưa có thông tin bài toán. Vui lòng hoàn thành bước Nhập vấn đề hoặc Phân tích cấu trúc trước khi nhờ AI Coach phân tích."*
   - Vô hiệu hóa nút phân tích để bảo vệ hệ thống.
5. **`error/degraded`**:
   - Khi backend gặp lỗi hoặc không thể kết nối mạng.
   - Hiển thị thông báo thân thiện: *"Không thể lấy gợi ý từ AI Coach vào lúc này. Vui lòng thử lại sau."*
   - Tuyệt đối không làm crash toàn trang, không lộ stack trace, query hay secret. Có nút "Thử lại".

### 5.3 Thao Tác Phê Duyệt Của Con Người Theo Phân Loại (Action Rules by Category)
1. **"Lưu thành Giải pháp" (CHỈ dành cho category = `solution_candidate`)**:
   - CHỈ category `solution_candidate` mới có nút "Lưu thành Giải pháp". Các category khác TUYỆT ĐỐI KHÔNG có nút này.
   - Mở `ConfirmationModal` với tiêu đề "Lưu gợi ý thành Giải pháp" và nội dung giải pháp.
   - Chỉ khi người dùng bấm "Xác nhận", frontend mới gọi `createCandidateSolution(sessionId, { title, mechanism, ... })`.
   - Invalidate query `['sessions', sessionId, 'solutions']` để cập nhật bảng Candidate Solutions.
2. **"Lưu vào Ghi chép" (Dành cho tất cả các category khác hoặc khi cần lưu note)**:
   - Mở `ConfirmationModal` với tiêu đề "Lưu gợi ý vào Sổ tay nghiên cứu".
   - Chỉ khi người dùng bấm "Xác nhận", frontend mới gọi `createResearchNote(sessionId, { content, note_type: 'insight' | 'hypothesis' })`.
   - Invalidate query `['sessions', sessionId, 'notes']` để cập nhật Notebook.
3. **"Bỏ qua"**:
   - Chỉ ẩn thẻ gợi ý khỏi danh sách hiển thị cục bộ (`local state`).
   - KHÔNG gọi bất kỳ API nào, KHÔNG xóa dữ liệu khỏi database, KHÔNG lưu backend.

---

## 6. Ma Trận Kịch Bản Kiểm Thử Gherkin (Gherkin Scenarios)

### Scenario 1: Happy Path — AI Coach phân tích phiên có đầy đủ ProblemFrame
```gherkin
Feature: AI Solution Coach Analysis
  Scenario: Nhận gợi ý giải pháp thành công khi phiên có ProblemFrame hợp lệ
    Given Phiên nghiên cứu "session-123" đã có ProblemFrame với improving "speed" và worsening "cost"
    When Người dùng gửi yêu cầu phân tích tới "POST /api/v1/sessions/session-123/coach/suggestions"
    Then Hệ thống trả về HTTP 200 OK
    And Dữ liệu trả về chứa danh sách ít nhất 3 gợi ý
    And Mỗi gợi ý đều có category, title, description và source_grounding hợp lệ
    And Trường provenance ghi nhận "ai_coach" hoặc "mock_coach"
```

### Scenario 2: Graceful Fallback — Tự động chuyển Rule-Based khi Provider lỗi
```gherkin
  Scenario: Tự động kích hoạt Rule-Based Fallback khi LLM timeout hoặc lỗi mạng
    Given Phiên nghiên cứu "session-123" hợp lệ
    And Cấu hình LLM Provider gặp lỗi timeout 10 giây hoặc trả về HTTP 500
    When Người dùng gửi yêu cầu phân tích tới "POST /api/v1/sessions/session-123/coach/suggestions"
    Then Hệ thống trả về HTTP 200 OK
    And Dữ liệu vẫn chứa các gợi ý nguyên tắc sáng tạo dựa trên ma trận TRIZ
    And Trường provenance mang giá trị "rule_based_fallback"
    And Trường fallback_reason nêu rõ nguyên nhân lỗi
```

### Scenario 3: Validation Guard — Từ chối phiên trống hoặc không tồn tại
```gherkin
  Scenario: Trả về lỗi thân thiện khi phiên nghiên cứu không tồn tại hoặc chưa có bài toán
    Given Mã phiên nghiên cứu "invalid-uuid-999" không tồn tại trong hệ thống
    When Người dùng gửi yêu cầu phân tích tới "POST /api/v1/sessions/invalid-uuid-999/coach/suggestions"
    Then Hệ thống trả về HTTP 404 Not Found
    And Thông báo lỗi nêu rõ "ResearchSession with id 'invalid-uuid-999' not found"
```

### Scenario 4: Human-in-the-Loop — Xác nhận trước khi ghi dữ liệu
```gherkin
  Scenario: Chuyển đổi gợi ý của Coach thành Candidate Solution có xác nhận của Founder
    Given Panel AI Coach đang hiển thị gợi ý giải pháp "Trạm trung chuyển linh hoạt"
    When Người dùng bấm nút "Lưu thành Giải pháp"
    Then Hệ thống hiển thị Modal xác nhận hành động
    When Người dùng bấm "Xác nhận" trên Modal
    Then Hệ thống gửi yêu cầu "POST /api/v1/sessions/{id}/candidate-solutions"
    And Danh sách Candidate Solutions của phiên xuất hiện giải pháp mới
```

### Scenario 5: Zero-Secret Leakage — Đảm bảo an toàn bí mật
```gherkin
  Scenario: Phản hồi API Coach tuyệt đối không chứa API key hay token
    Given Hệ thống cấu hình OPENAI_API_KEY là "sk-proj-super-secret-key"
    When Người dùng gọi API Coach suggestions
    Then Toàn bộ chuỗi JSON trả về không chứa "sk-proj" hay "super-secret-key"
```

---

## 7. Đánh Giá Rủi Ro & Trade-offs (Blast Radius Defense)

| Rủi Ro Nhận Diện | Tác Động Tiềm Ẩn | Biện Pháp Kiểm Soát & Giải Pháp Kiến Trúc |
| :--- | :--- | :--- |
| **LLM sinh ảo giác (Hallucination)** | Gợi ý giải pháp vô căn cứ, sai lệch nguyên tắc TRIZ | Bắt buộc trường `source_grounding` đối chiếu trực tiếp với Contradiction hoặc 40 Nguyên tắc sáng tạo. |
| **Ghi đè nhầm dữ liệu người dùng** | Mất ý tưởng nghiên cứu đang soạn dở | Áp dụng triệt để Zero Auto-Overwrite: Coach suggestions là view-only; việc lưu thành Solution/Note bắt buộc có Modal xác nhận. |
| **Latency cao từ bên thứ ba (OpenAI/Ollama)** | Treo giao diện, nghẽn thread pool backend | Đặt timeout tối đa 10s cho request AI; nếu quá 10s tự động chuyển sang Rule-Based Heuristic Coach tức thì (< 50ms). |
| **Rò rỉ API key trong response/log** | Lộ bí mật hệ thống ra client browser | Mô hình Pydantic đầu ra được lọc nghiêm ngặt (Whitelist fields); logger không ghi log prompt nhạy cảm. |
| **Tăng kích thước bundle frontend** | Giảm tốc độ tải trang | Sử dụng component độc lập `AICoachPanel` với dynamic import hoặc load theo tab Ideation. |
