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

---

## 3. Planned Failing Test Suites (Trước khi viết code sản phẩm)

### 3.1. Backend Test Suites
1. **`backend/tests/unit/test_domain_templates_expansion.py`**:
   - `test_healthcare_templates_exist_and_valid()`: Kiểm tra các mẫu y tế có đủ thuộc tính.
   - `test_education_templates_exist_and_valid()`: Kiểm tra các mẫu giáo dục có đủ thuộc tính.
   - `test_sustainability_templates_exist_and_valid()`: Kiểm tra các mẫu bền vững có đủ thuộc tính.
2. **`backend/tests/unit/test_nine_windows_expansion.py`**:
   - `test_systems_thinking_lens_contains_9_windows()`: 9 ô hợp lệ.
   - `test_design_thinking_lens_contains_9_windows()`: 9 ô hợp lệ.
   - `test_lean_startup_lens_contains_9_windows()`: 9 ô hợp lệ.
   - `test_nine_windows_validator_accepts_all_6_lenses()`: Bộ validator chấp thuận cả 6 lăng kính.
3. **`backend/tests/integration/test_triz_nine_windows_api_expansion.py`**:
   - `test_api_get_systems_thinking_lens()`: HTTP 200.
   - `test_api_get_design_thinking_lens()`: HTTP 200.
   - `test_api_get_lean_startup_lens()`: HTTP 200.
   - `test_api_workflow_profiles_endpoint()`: HTTP 200 trả về 3 profiles.

### 3.2. Frontend Test Suites
1. **`apps/web/lib/__tests__/triz-lens-resolver-expansion.test.ts`**:
   - Kiểm tra `resolveLensFromDomain('healthcare')` -> `'systems_thinking'`.
   - Kiểm tra `resolveLensFromDomain('education')` -> `'design_thinking'`.
   - Kiểm tra `resolveLensFromDomain('sustainability')` -> `'systems_thinking'`.
2. **`apps/web/features/triz/__tests__/triz-nine-windows-expansion.test.tsx`**:
   - Kiểm tra render selector với đủ 6 tabs lăng kính.
   - Kiểm tra click chuyển sang các tab `systems_thinking`, `design_thinking`, `lean_startup` và gọi API tương ứng.
