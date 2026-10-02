---
title: "PHASE 6.2 UI GHERKIN TEST MATRIX — AI Problem Structuring UI"
topic: "problem-structuring"
source_type: "test-matrix"
language: "vi"
tags: ["phase-6.2", "gherkin", "bdd", "intake-form", "ai-trust-contract", "test-first"]
phase: "6.2"
status: "draft"
golden: false
created: "2026-10-02"
---

# PHASE 6.2 UI GHERKIN TEST MATRIX — AI Problem Structuring UI

> **Mục tiêu:** Ma trận kịch bản BDD (Given-When-Then) làm cơ sở cho phương pháp Test-First / Red-Green-Refactor trước khi triển khai component `IntakeForm` và `api-client.ts`.

---

## 1. Unit Contract Scenarios (`api-client.test.ts`)

### Scenario 1.1: Gọi `analyzeProblemWithAI` thành công với provenance `ai_hypothesis`
- **Given:** Endpoint `POST /api/v1/sessions/{session_id}/ai/analyze-problem` khả dụng.
- **When:** Gọi `analyzeProblemWithAI('sess-123', { raw_statement: 'Tăng tốc độ nhưng không giảm độ bền', domain: 'engineering' })`.
- **Then:**
  - Client gửi HTTP POST tới đúng URL `/api/v1/sessions/sess-123/ai/analyze-problem`.
  - Body chứa `{ raw_statement: '...', domain: 'engineering' }`.
  - Trả về object chứa `data.normalized_statement`, `data.contradiction_type`, `data.suggested_keywords` và `_meta.provenance = 'ai_hypothesis'`.

### Scenario 1.2: Gọi `analyzeProblemWithAI` fallback `rule_based_fallback`
- **Given:** Backend kích hoạt fallback do thiếu LLM API Key hoặc timeout.
- **When:** Client nhận response 200 có `_meta.provenance = 'rule_based_fallback'` và `_meta.fallback_reason = 'llm_api_key_missing'`.
- **Then:** Client parse thành công mà không ném lỗi exception.

---

## 2. Component Interaction Scenarios (`intake-form.test.tsx`)

### Scenario 2.1: Vị trí và điều kiện kích hoạt nút AI Suggestion
- **Given:** Người dùng mở `IntakeForm` của một session.
- **Then:** Nút `✨ Gợi ý với AI` được hiển thị ở góc phải của block Mục tiêu / Mô tả bài toán.
- **When:** Ô nhập mục tiêu chứa dưới 10 ký tự (ví dụ: `"Bánh răng"`).
- **Then:** Nút `✨ Gợi ý với AI` ở trạng thái disabled.
- **When:** Người dùng nhập đủ từ 10 ký tự trở lên (ví dụ: `"Cần tăng độ bền bánh răng nhưng giảm ma sát"`).
- **Then:** Nút `✨ Gợi ý với AI` chuyển sang trạng thái enabled và có thể click.

### Scenario 2.2: Trạng thái Loading khi đang phân tích AI
- **Given:** Người dùng nhập mô tả bài toán hợp lệ (>= 10 ký tự).
- **When:** Người dùng click `✨ Gợi ý với AI`.
- **Then:**
  - Nút chuyển sang trạng thái loading với spinner và text `"Đang phân tích..."`.
  - Nút submit form chính bị disabled tạm thời để chống race condition.

### Scenario 2.3: Render Ephemeral Suggestion Card khi AI thành công (`ai_hypothesis`)
- **Given:** API trả về kết quả AI gợi ý với `_meta.provenance = 'ai_hypothesis'`.
- **When:** Request phân tích hoàn tất.
- **Then:**
  - Card gợi ý xuất hiện inline bên dưới textarea Mục tiêu.
  - Hiển thị badge `"✨ Gợi ý AI"`.
  - Hiển thị `normalized_statement`, `contradiction_type`, `improving_parameter`, `worsening_parameter`, và lý giải `reasoning`.
  - Hiển thị danh sách `suggested_keywords` dưới dạng badges/pills read-only.

### Scenario 2.4: Render Ephemeral Suggestion Card khi Fallback (`rule_based_fallback`)
- **Given:** API trả về kết quả phân tích quy tắc với `_meta.provenance = 'rule_based_fallback'`.
- **When:** Request phân tích hoàn tất.
- **Then:**
  - Card gợi ý xuất hiện.
  - Hiển thị badge `"⚡ Phân tích Rule-based (Fallback)"` màu cảnh báo/amber.
  - Vẫn hiển thị đầy đủ các thông số TRIZ từ bộ quy tắc.

### Scenario 2.5: Người dùng áp dụng gợi ý (Apply Suggestion — Local State Only)
- **Given:** Card gợi ý AI đang hiển thị với `normalized_statement = "Chuẩn hóa: Tăng tốc độ quay và kiểm soát nhiệt độ"`.
- **When:** Người dùng click nút `"Áp dụng gợi ý"`.
- **Then:**
  - Nội dung ô textarea Mục tiêu (`form.goal`) được thay thế 100% bằng chuỗi `normalized_statement`.
  - Card gợi ý đóng lại.
  - Các trường khác (constraints, affected_entities,...) giữ nguyên.
  - **KHÔNG** có request `createProblemFrame` nào được gửi đi.
  - **KHÔNG** đổi tab hoặc thay đổi FSM state.

### Scenario 2.6: Người dùng bỏ qua gợi ý (Discard Suggestion)
- **Given:** Card gợi ý AI đang hiển thị.
- **When:** Người dùng click nút `"Bỏ qua"`.
- **Then:**
  - Card gợi ý biến mất khỏi màn hình.
  - Nội dung các trường trong form (kể cả ô Mục tiêu) giữ nguyên 100% như trước khi gọi AI.

### Scenario 2.7: Xử lý lỗi API khi gọi AI (Error Resilience)
- **Given:** Endpoint AI trả về mã lỗi HTTP 500 hoặc network error.
- **When:** Request phân tích thất bại.
- **Then:**
  - Form hiển thị banner thông báo lỗi inline.
  - Dữ liệu form của người dùng không bị mất hoặc bị reset.
  - Nút submit chính và nút AI được mở lại để người dùng tiếp tục thao tác.

### Scenario 2.8: Đảm bảo AI Trust Contract (No-Auto-Persist Guarantee)
- **Given:** Người dùng kích hoạt phân tích AI nhiều lần, xem gợi ý và thậm chí bấm "Áp dụng gợi ý".
- **When:** Chưa click nút `"Lưu và chuyển sang Phân tích cấu trúc"`.
- **Then:**
  - Hàm `createProblemFrame` KHÔNG bao giờ được gọi.
  - Cache query session KHÔNG bị invalidate.
  - Trạng thái DB của session hoàn toàn không thay đổi.
