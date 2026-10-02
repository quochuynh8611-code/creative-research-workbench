# 🧪 Phase 9.3 — Session Import & Domain Templates Gherkin Test Matrix

> **Tài liệu:** BDD Test Matrix cho Phase 9.3
> **Căn cứ:** [PHASE_9_3_SESSION_IMPORT_AND_TEMPLATES_SPEC.md](docs/PHASE_9_3_SESSION_IMPORT_AND_TEMPLATES_SPEC.md)

---

## 1. Feature: Nhập Phiên Nghiên Cứu từ JSON Snapshot (Session Import)

```gherkin
Feature: Session Import from JSON Snapshot

  Scenario: Import full session snapshot successfully
    Given một snapshot JSON hợp lệ chứa session, problem_frame, 2 research_notes và 1 candidate_solution
    When người dùng gửi request POST /api/v1/sessions/import với payload snapshot đó
    Then hệ thống trả về HTTP 201 Created
    And trả về id phiên mới (UUID khác với snapshot ban đầu)
    And tạo bản ghi ProblemFrame tương ứng trong DB
    And tạo 2 bản ghi ResearchNote và 1 bản ghi CandidateSolution gắn với session mới
    And tổng số session trong hệ thống tăng thêm 1

  Scenario: Import session with missing title returns 400 Bad Request
    Given một payload snapshot không có trường "title" trong session hoặc title chỉ có khoảng trắng
    When người dùng gửi request POST /api/v1/sessions/import
    Then hệ thống trả về HTTP 400 Bad Request
    And body detail thông báo rõ "missing required session title"
    And không có session mới nào được tạo trong DB

  Scenario: Import session with malformed body returns 400 Bad Request
    Given một request payload không phải là JSON object hoặc thiếu trường "session"
    When người dùng gửi request POST /api/v1/sessions/import
    Then hệ thống trả về HTTP 400 Bad Request
```

---

## 2. Feature: Mẫu Nghiên Cứu Theo Lĩnh Vực (Domain Templates)

```gherkin
Feature: Domain Templates

  Scenario: List available domain templates
    When người dùng gửi request GET /api/v1/sessions/templates
    Then hệ thống trả về HTTP 200 OK
    And danh sách chứa ít nhất 3 templates: "technical", "business", "software"
    And mỗi template có đầy đủ "id", "title", "domain", "description", "tags" và "problem_frame"

  Scenario: Create session from domain template successfully
    Given một template_id hợp lệ "engineering_composite_arm"
    When người dùng gửi request POST /api/v1/sessions/from-template với template_id
    Then hệ thống trả về HTTP 201 Created
    And tạo một ResearchSession mới kèm ProblemFrame đã được cấu hình sẵn theo template
    And session có trạng thái "active" và workflow_state "structuring"
```
