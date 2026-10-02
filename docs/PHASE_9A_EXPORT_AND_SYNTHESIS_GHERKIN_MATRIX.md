# 🧪 Phase 9A — Export & AI Research Report Generator Gherkin Test Matrix

> **Tài liệu:** BDD Test Matrix cho Phase 9A
> **Căn cứ:** [PHASE_9A_EXPORT_AND_SYNTHESIS_EXECUTION_SPEC.md](docs/PHASE_9A_EXPORT_AND_SYNTHESIS_EXECUTION_SPEC.md), [ADR-005](docs/ADR/ADR-005-phase-9a-export-and-synthesis.md)

---

## 1. Feature: Xuất Dữ Liệu Phiên Nghiên Cứu (Session Export)

```gherkin
Feature: Session Export (Markdown & JSON)

  Scenario: Export session as Markdown includes Candidate Solutions
    Given một phiên nghiên cứu có ProblemFrame, TRIZ Principles, 2 Research Notes và 2 Candidate Solutions
      | title          | mechanism               | novelty_score | feasibility_score | status    |
      | "Cảm biến quang"| "Đo biến thiên quang học"| 0.85          | 0.90              | accepted  |
      | "Thuật toán AI" | "Dự đoán suy thoái pin"  | 0.70          | 0.60              | candidate |
    When người dùng gửi yêu cầu GET /api/v1/sessions/{session_id}/export?format=markdown
    Then hệ thống trả về HTTP 200 OK với Content-Type "text/markdown; charset=utf-8"
    And nội dung trả về chứa mục "4. GIẢI PHÁP ĐỀ XUẤT (CANDIDATE SOLUTIONS)"
    And hiển thị chi tiết "Cảm biến quang" với nhãn "[ACCEPTED]" và điểm Độc đáo/Khả thi
    And hiển thị chi tiết "Thuật toán AI" với nhãn "[CANDIDATE]"

  Scenario: Export session as JSON data snapshot
    Given một phiên nghiên cứu hoàn chỉnh có đầy đủ quan hệ trong DB
    When người dùng gửi yêu cầu GET /api/v1/sessions/{session_id}/export?format=json
    Then hệ thống trả về HTTP 200 OK với Content-Type "application/json; charset=utf-8"
    And payload JSON chứa các trường thực thể phiên và danh sách "recommended_methods" được trích xuất
    And mảng "candidate_solutions" có đúng 2 phần tử

  Scenario: Export session not found returns 404
    Given một session_id không tồn tại trong hệ thống
    When người dùng gửi yêu cầu GET /api/v1/sessions/{invalid_id}/export?format=markdown
    Then hệ thống trả về HTTP 404 Not Found

  Scenario: Export session with invalid format returns 400
    Given một phiên nghiên cứu tồn tại
    When người dùng gửi yêu cầu GET /api/v1/sessions/{session_id}/export?format=docx
    Then hệ thống trả về HTTP 400 Bad Request
    And detail phản hồi nêu rõ các định dạng được hỗ trợ là "markdown" hoặc "json"
```

---

## 2. Feature: Sinh Báo Cáo Nghiên Cứu AI (AI Research Report Synthesis)

```gherkin
Feature: AI Research Report Generator

  Scenario: Generate AI research report successfully
    Given một phiên nghiên cứu có ProblemFrame và ít nhất 1 Candidate Solution
    When người dùng gửi yêu cầu POST /api/v1/sessions/{session_id}/ai/generate-report
    Then hệ thống gọi LLM Client và trả về HTTP 200 OK
    And response body chứa "report_title", "executive_summary", "evidence_synthesis", "solution_assessment", "action_plan", "markdown_content"
    And trường "provenance" có giá trị "ai_synthesis"
    And cơ sở dữ liệu hoàn toàn không phát sinh thêm record mới (Zero Auto-Overwrite)

  Scenario: Generate AI report gracefully fallbacks when LLM fails
    Given một phiên nghiên cứu hợp lệ
    And LLM Client gặp sự cố (timeout hoặc ngoại lệ kết nối)
    When người dùng gửi yêu cầu POST /api/v1/sessions/{session_id}/ai/generate-report
    Then hệ thống bắt ngoại lệ và trả về HTTP 200 OK với báo cáo tổng hợp dự phòng
    And trường "provenance" có giá trị "rule_based_fallback"
    And trường "fallback_reason" chứa thông tin lỗi tương ứng

  Scenario: Generate AI report on non-existent session returns 404
    Given một session_id không tồn tại trong DB
    When người dùng gửi yêu cầu POST /api/v1/sessions/{invalid_id}/ai/generate-report
    Then hệ thống trả về HTTP 404 Not Found
```

---

## 3. Feature: Giao Diện Người Dùng Synthesis Canvas

```gherkin
Feature: Synthesis Canvas UI

  Scenario: User opens Synthesis tab and generates report
    Given người dùng đang ở trang chi tiết phiên /sessions/[id]
    When người dùng chọn tab "Tổng hợp & Báo cáo" (Synthesis)
    And bấm nút "✨ Tạo Báo cáo AI"
    Then giao diện hiển thị trạng thái đang tổng hợp (loading spinner)
    And sau khi hoàn tất, hiển thị bản xem trước Báo cáo Chiến lược (Markdown preview)
    And có nút "Sao chép Markdown" và "Tải file .md"
```
