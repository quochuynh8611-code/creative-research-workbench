# BATCH C36 GHERKIN MATRIX: RESEARCH SYNTHESIS, PROVENANCE & EXPORT COMPLETENESS

Tài liệu này xác định ma trận kiểm thử hành vi (Behavior-Driven Development - BDD) cho **Batch C36**, phân định theo từng PR và phục vụ trực tiếp cho quy trình Test-First.

---

## 1. Ma Trận Kịch Bản BDD Theo Từng PR

| Mã Kịch Bản | PR Phụ Trách | Mục Tiêu Kiểm Thử | Tầng Thực Thi |
| :--- | :--- | :--- | :--- |
| **SC-C36-01** | PR 1 (Backend) | Xuất Markdown đầy đủ YAML frontmatter `domain` và chuỗi nguồn ARIZ/Evolution/Resource/AI Coach | Backend Unit Test |
| **SC-C36-02** | PR 1 (Backend) | Xuất JSON snapshot đầy đủ `domain`, `tags` và `source_context` nguyên vẹn | Backend Unit Test |
| **SC-C36-03** | PR 1 (Backend) | Phòng vệ Markdown Injection trên các trường metadata nguồn của ghi chú | Backend Unit Test |
| **SC-C36-04** | PR 2 (Frontend) | Ánh xạ nhãn tiếng Việt cho `healthcare` và `sustainability` trong `DOMAIN_LABELS` | Frontend Unit Test |
| **SC-C36-05** | PR 2 (Frontend) | Form tạo session thủ công hiển thị đủ 3 domain mới (`healthcare`, `education`, `sustainability`) | Frontend Component Test |
| **SC-C36-06** | PR 2 (Frontend) | Lưu và khôi phục lựa chọn Workflow Profile từ `localStorage` theo `sessionId` | Frontend Component Test |
| **SC-C36-07** | PR 3 (E2E) | Tích hợp Backend: Roundtrip Export JSON -> Import Session bảo toàn 100% dữ liệu | Backend Integration Test |
| **SC-C36-08** | PR 3 (E2E) | Tích hợp Frontend: Trigger xuất Markdown và JSON kích hoạt tải Blob an toàn | Frontend Integration Test |

---

## 2. Đặc Tả Chi Tiết Từng Kịch Bản Gherkin

### 🔹 PR 1: Backend-Only Scenarios

#### Scenario 1 (SC-C36-01): Xuất Markdown chứa đầy đủ Domain và Provenance Nguồn Mới
```gherkin
Feature: Session Markdown Export Provenance
  As a researcher or stakeholder
  I want my exported Markdown report to display the domain and exact provenance for all advanced TRIZ notes
  So that the origin of insights is fully traceable in reports.

  Scenario: Exporting session with ARIZ, Evolution, Resource and AI Coach notes to Markdown
    Given a ResearchSession exists with domain "sustainability" and title "Bio-Packaging Innovation"
    And the session has a note with source_type "triz_ariz", step_id 2, and step_title "Vùng xung đột"
    And the session has a note with source_type "triz_evolution", pattern_name "Linh hoạt hóa"
    And the session has a note with source_type "triz_resource", resource_group "Tài nguyên Thời gian"
    And the session has a note with source_type "ai_coach", suggestion_type "solution_candidate"
    When export_session_as_markdown is invoked for this session
    Then the generated Markdown must contain frontmatter with 'domain: "sustainability"'
    And the overview section must display the domain "sustainability"
    And the notes section must contain "Nguồn: Thuật giải ARIZ [Bước 2: Vùng xung đột]"
    And the notes section must contain "Nguồn: Quy luật Tiến hóa [Linh hoạt hóa]"
    And the notes section must contain "Nguồn: Ma trận Tài nguyên [Tài nguyên Thời gian]"
    And the notes section must contain "Nguồn: AI Solution Coach [solution_candidate]"
```

#### Scenario 2 (SC-C36-02): Xuất JSON Snapshot chứa đầy đủ Domain, Tags và Source Context
```gherkin
Feature: Session JSON Snapshot Completeness
  As a system architect
  I want exported JSON snapshots to preserve domain and tags
  So that backups and exports retain complete session categorization.

  Scenario: Exporting session snapshot to JSON
    Given a ResearchSession exists with domain "healthcare" and tags ["cardio", "emergency"]
    When export_session_as_json is invoked for this session
    Then the resulting payload dictionary must contain a root key "session"
    And session["domain"] must equal "healthcare"
    And session["tags"] must equal ["cardio", "emergency"]
    And all notes in "research_notes" must preserve their exact "source_context" structure
```

#### Scenario 3 (SC-C36-03): Phòng Vệ Markdown Injection Trong Metadata Nguồn
```gherkin
Feature: Markdown Inline Escaping for Provenance Fields
  As a security-conscious engineer
  I want arbitrary strings in source context to be safely escaped
  So that malicious formatting or link injections do not compromise exported reports.

  Scenario: Note with special characters in step title or pattern name
    Given a note has a source_context with step_title "*Bold* [Malicious Link](http://evil.com) <script>"
    When export_session_as_markdown is invoked
    Then the exported Markdown must escape all asterisks, brackets, and angle brackets
    And raw HTML tags must not be rendered
```

---

### 🔹 PR 2: Frontend-Only Scenarios

#### Scenario 4 (SC-C36-04): Ánh Xạ Nhãn Tiếng Việt Đầy Đủ
```gherkin
Feature: Domain Labels Completeness
  As a Vietnamese user
  I want healthcare and sustainability domains to display proper Vietnamese labels
  So that the interface looks professional and localized.

  Scenario: Resolving domain labels for expansion domains
    When DOMAIN_LABELS is queried with key "healthcare"
    Then the returned label must be "Y tế / Sức khỏe"
    When DOMAIN_LABELS is queried with key "sustainability"
    Then the returned label must be "Môi trường / Bền vững"
```

#### Scenario 5 (SC-C36-05): Tùy Chọn Domain Mới Trong Form Tạo Phiên
```gherkin
Feature: Manual Session Creation with Expansion Domains
  As a user creating a new research session
  I want to select Healthcare, Education, or Sustainability directly from the dropdown
  So that I am not forced to create sessions exclusively through templates.

  Scenario: Opening session creation form
    Given the user is on the SessionList page
    When the user clicks the "Tạo phiên nghiên cứu mới" button
    Then the Domain select dropdown must contain options for "healthcare", "education", and "sustainability"
    And selecting "healthcare" sets formDomain to "healthcare"
```

#### Scenario 6 (SC-C36-06): Duy Trì Trạng Thái Workflow Profile Qua LocalStorage
```gherkin
Feature: Workflow Profile Persistence
  As a researcher
  I want my selected workflow profile to remain active when I refresh the page
  So that I do not lose my workflow context.

  Scenario: Selecting a workflow profile and reloading
    Given the user is viewing SessionDetail for session "session-123"
    When the user selects the profile "rapid_prototyping" in WorkflowProfileGuidance
    Then localStorage must store "rapid_prototyping" under key "crw:session:session-123:workflow-profile:v1"
    When the component re-mounts
    Then the active profile must automatically restore to "rapid_prototyping"
```

---

### 🔹 PR 3: Tests & Docs Only Scenarios

#### Scenario 7 (SC-C36-07): Roundtrip Export JSON -> Import Session Không Suy Hao
```gherkin
Feature: E2E Export and Import Roundtrip
  As a QA engineer
  I want to ensure exported JSON can be imported without data loss
  So that system backups are completely reliable.

  Scenario: Exporting and importing a complex session
    Given a session with domain "sustainability", tags, and 4 types of notes
    When the session is exported to JSON
    And the exported payload is fed into session_import_service
    Then the newly imported session must retain domain "sustainability"
    And the newly imported session must retain the original tags
    And all imported notes must retain their source_context intact
```

#### Scenario 8 (SC-C36-08): Frontend Export Trigger and Blob Download
```gherkin
Feature: Frontend Export Blob Handling
  As an end user
  I want to click the Export button and receive the downloaded file
  So that I can use the report offline.

  Scenario: Clicking Export Markdown in SessionDetail
    Given the user opens the Export dropdown menu
    When the user clicks "Xuất Markdown (.md)"
    Then exportSessionMarkdown must be called with the active sessionId
    And a Blob download URL must be created and triggered
    And no error alert should be displayed
```

#### Scenario 9 (SC-C36-09): Roundtrip Import Với Edge Case Domain Rỗng/Null
```gherkin
Feature: Edge Case Domain Roundtrip Robustness
  As a QA engineer
  I want to verify that sessions with null or empty domain string can be exported and imported
  So that legacy or unclassified sessions never crash the import pipeline.

  Scenario: Exporting and importing a session without domain
    Given a session with domain set to null or empty string ""
    When the session is exported to JSON
    And the exported payload is fed into session_import_service
    Then the import must succeed without crashing
    And the imported session domain must safely fallback to null
```
