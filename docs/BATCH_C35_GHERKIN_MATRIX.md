# BATCH C35: GHERKIN TEST MATRIX & FAILING TEST SPECIFICATION

## 1. Mục Tiêu Kiểm Thử
Định nghĩa các kịch bản kiểm thử theo phong cách BDD (Behavior-Driven Development) nhằm bao phủ 4 trục yêu cầu:
1. **Domain Expansion**: Đảm bảo nạp và tìm kiếm chính xác các template của Healthcare, Education và Sustainability.
2. **Lens Expansion**: Đảm bảo 9-Windows API trả về đủ 6 lăng kính (bao gồm Systems Thinking, Design Thinking, Lean Startup), mỗi lăng kính đủ 9 ô tọa độ.
3. **Workflow Expansion**: Đảm bảo các Workflow Profiles (Standard, Rapid Prototyping, Stakeholder Alignment) được trả về đầy đủ kèm các gợi ý phương pháp.
4. **Security & Zero Secret Leakage**: Đảm bảo không có chuỗi nhạy cảm hay secret trong JSON catalogs, responses và logs.

---

## 2. Gherkin Scenarios

### Kịch bản 1: Domain Expansion — Truy xuất Templates mới (Healthcare, Education, Sustainability)
```gherkin
Feature: Domain Templates Catalog Expansion
  As a researcher or product innovator
  I want to access pre-structured session templates for Healthcare, Education, and Sustainability
  So that I can quickly frame complex multidisciplinary problems

  Scenario Outline: Fetching templates by domain
    Given the domain templates catalog is initialized
    When a user queries templates for domain "<domain>"
    Then the system returns at least one template with domain "<domain>"
    And each template must contain valid "problem_frame", "tags", and "title"
    And "improving_parameter" and "worsening_parameter" must be valid TRIZ parameters

    Examples:
      | domain         |
      | healthcare     |
      | education      |
      | sustainability |
```

### Kịch bản 2: Lens Expansion — Truy xuất TRIZ 9-Windows với 3 Lăng kính Mới
```gherkin
Feature: TRIZ 9-Windows Multi-Lens Expansion
  As an innovation strategist
  I want to explore the System Operator across Systems Thinking, Design Thinking, and Lean Startup lenses
  So that I can analyze past, present, and future across supersystem, system, and subsystem

  Scenario Outline: Querying 9-windows for new lenses
    Given the 9-windows knowledge repository is loaded
    When the user requests 9-windows with lens "<lens>"
    Then the response status code is 200
    And the response contains lens title "<lens_title>"
    And the grid contains exactly 9 windows
    And the windows cover all 3 system levels ("supersystem", "system", "subsystem")
    And the windows cover all 3 time horizons ("past", "present", "future")
    And there are no duplicate (level, time) coordinates

    Examples:
      | lens             | lens_title                           |
      | systems_thinking | Lăng kính Tư duy Hệ thống           |
      | design_thinking  | Lăng kính Tư duy Thiết kế            |
      | lean_startup     | Lăng kính Khởi nghiệp Tinh gọn       |

  Scenario: Rejecting an unsupported lens
    Given the 9-windows service is running
    When the user requests an invalid lens "quantum_teleportation"
    Then the response status code is 422 Unprocessable Entity
```

### Kịch bản 3: Lens Resolver — Tự Động Ánh Xạ Domain Mới Sang Lens Phù Hợp
```gherkin
Feature: Dynamic Domain to Lens Resolution
  As a user creating a research session in a specific domain
  I want the 9-windows tool to automatically select the most appropriate default lens
  So that I get relevant contextual prompts immediately

  Scenario Outline: Automatic lens mapping
    When the user opens 9-windows for a session with domain "<domain>"
    Then the resolved default lens should be "<expected_lens>"

    Examples:
      | domain         | expected_lens    |
      | healthcare     | systems_thinking |
      | education      | design_thinking  |
      | sustainability | systems_thinking |
      | technical      | engineering      |
      | business       | business         |
      | life           | everyday         |
```

### Kịch bản 4: Workflow Profiles — Cung Cấp Hướng Dẫn Quy Trình Chuyên Biệt
```gherkin
Feature: Workflow Profiles Catalog
  As a facilitator or session owner
  I want to choose between Standard TRIZ, Rapid Prototyping, and Stakeholder Alignment
  So that the team receives workflow guidance tailored to their objective

  Scenario: Listing all available workflow profiles
    When the user requests the workflow profiles catalog
    Then the system returns 3 profiles: "standard_triz", "rapid_prototyping", and "stakeholder_alignment"
    And each profile defines "recommended_lenses", "stages_guidance", and "focus_summary"
```

### Kịch bản 5: Zero Secret Leakage & Schema Invariant
```gherkin
Feature: Security & Architecture Invariants
  As a security auditor and software architect
  I want to verify that no credentials are leaked and database schema remains unchanged
  So that the system remains secure and backward compatible

  Scenario: Secret scan across expanded catalogs and docs
    When the scanner inspects all JSON files, source code, and docs in Batch C35
    Then zero real API keys, bearer tokens, or database passwords are found

  Scenario: Database schema invariant verification
    When the database migration inspection runs
    Then the migration HEAD must remain "006 (head)"
    And no new Alembic migration scripts exist in backend/alembic/versions
```

### Kịch bản 6: PR 3 Backend E2E Integration — Contract Validation & Error Resilience
```gherkin
Feature: Backend E2E Workflow Profiles & Multi-Lens Contract
  As an API consumer and frontend integration layer
  I want the backend endpoints to enforce strict data contracts and error resilience
  So that frontend clients always receive valid catalogs or predictable error codes

  Scenario: Strict schema contract on workflow profiles
    When a GET request is sent to "/api/v1/sessions/workflow-profiles"
    Then the response status is 200 OK
    And the response contains meta.total == 3
    And every profile contains valid fields ("id", "name_vi", "name_en", "description_vi", "description_en", "recommended_lenses", "stages_guidance")
    And all recommended lenses must be one of the 6 valid lenses
    And each profile provides stage guidance for "intake", "structuring", and "ideation"

  Scenario: Rejecting unsupported HTTP methods on workflow profiles
    When a POST request is sent to "/api/v1/sessions/workflow-profiles"
    Then the response status is 405 Method Not Allowed

  Scenario Outline: 9-Windows comprehensive multi-lens verification
    When a GET request is sent to "/api/v1/triz/nine-windows" with lens "<lens>"
    Then the response status is 200 OK
    And the response grid contains exactly 9 cells
    And all cells have non-empty "label_vi", "prompt_vi", and "description_vi"

    Examples:
      | lens             |
      | engineering      |
      | business         |
      | everyday         |
      | systems_thinking |
      | design_thinking  |
      | lean_startup     |

  Scenario: 9-Windows rejecting invalid lens query parameter
    When a GET request is sent to "/api/v1/triz/nine-windows" with lens "invalid_quantum_lens"
    Then the response status is 422 Unprocessable Entity

  Scenario Outline: Session creation from expansion domain templates
    When a user creates a session from template "<template_id>"
    Then the created session has domain "<expected_domain>"
    And the session has a valid problem_frame matching the template contradiction
    And the session workflow_state is "intake"

    Examples:
      | template_id              | expected_domain |
      | tpl-healthcare-triage-ai | healthcare      |
      | tpl-edu-hybrid-engage    | education       |
      | tpl-sus-packaging-waste  | sustainability  |
```

### Kịch bản 7: PR 3 Frontend E2E Integration — UI Guidance Consumption & Error Recovery
```gherkin
Feature: Frontend E2E Workflow Profile Guidance & Lens Integration
  As a user navigating a research session
  I want the workflow guidance component and lens selector to work reliably across happy, error, and empty paths
  So that my research flow is never disrupted by network blips or unexpected data

  Scenario: Happy path guidance rendering and profile switching
    Given the user is on the Session Detail view for a "healthcare" session
    When the workflow profiles are fetched from "/api/v1/sessions/workflow-profiles"
    Then all 3 profile options are available
    And the resolved default lens is "systems_thinking"
    And switching profiles updates the recommended lenses and stage highlights

  Scenario: Graceful recovery on workflow profiles API error
    Given the backend returns a 500 Internal Server Error for "/api/v1/sessions/workflow-profiles"
    When the Session Detail view renders
    Then the WorkflowProfileGuidance shows an error alert without crashing the page
    And the rest of the session detail views (stepper, problem frame) continue functioning

  Scenario: Safe handling of empty profiles response
    Given the backend returns an empty profile list
    When the WorkflowProfileGuidance mounts
    Then it renders null without throwing uncaught exceptions
```

---

## 3. Planned Failing Test Suites (Trước khi viết code sản phẩm)

### 3.1. Backend Test Suites
1. **`backend/tests/unit/test_domain_templates_expansion.py`** (PASS)
2. **`backend/tests/unit/test_nine_windows_expansion.py`** (PASS)
3. **`backend/tests/integration/test_triz_nine_windows_api_expansion.py`** (PASS)
4. **`backend/tests/integration/test_c35_e2e_workflow_integration.py`** (PR 3 MỚI):
   - `test_workflow_profiles_schema_contract`: kiểm tra schema 3 profiles, lenses, stages.
   - `test_workflow_profiles_method_not_allowed`: POST trả về 405.
   - `test_all_six_lenses_nine_windows_api`: duyệt đủ 6 lenses, mỗi lens đủ 9 ô.
   - `test_nine_windows_invalid_lens_returns_422`: lens lạ trả về 422.
   - `test_e2e_session_creation_from_expansion_templates`: tạo session từ templates healthcare, education, sustainability.

### 3.2. Frontend Test Suites
1. **`apps/web/lib/__tests__/triz-lens-resolver-expansion.test.ts`** (PASS)
2. **`apps/web/features/triz/__tests__/triz-nine-windows-expansion.test.tsx`** (PASS)
3. **`apps/web/features/session/__tests__/workflow-profile-guidance.test.tsx`** (PASS)
4. **`apps/web/features/session/__tests__/c35-workflow-lens-integration.test.tsx`** (PR 3 MỚI):
   - `test_session_detail_workflow_profile_guidance_e2e`: happy path tích hợp Session Detail + Guidance + Lens.
   - `test_workflow_profile_guidance_error_boundary_resilience`: error path (API 500) không làm sập trang.
   - `test_workflow_profile_guidance_empty_payload_safety`: empty list không văng exception.
   - `test_cross_domain_lens_resolution_consistency`: kiểm tra mapping domain sang lens nhất quán.
