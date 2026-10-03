# 🧪 Phase 9B — Export UX Hardening & PDF Strategy Gherkin Test Matrix

> **Tài liệu:** BDD Test Matrix cho Phase 9B
> **Căn cứ:** [PHASE_9B_EXPORT_UX_AND_PDF_EXECUTION_SPEC.md](docs/PHASE_9B_EXPORT_UX_AND_PDF_EXECUTION_SPEC.md), [ADR-006](docs/ADR/ADR-006-phase-9b-export-ux-and-pdf-strategy.md)

---

## 1. Feature: Export Dropdown Picker trong Session Detail

```gherkin
Feature: Export Dropdown Picker UI

  Scenario: Render unified export dropdown button in Session Header
    Given người dùng đang xem trang chi tiết phiên nghiên cứu
    When trang tải xong dữ liệu phiên
    Then hiển thị nút "Xuất dữ liệu" (Export) có icon dropdown
    And nút này nằm ở vị trí header thao tác

  Scenario: User opens export menu and chooses Markdown format
    Given người dùng nhấn vào nút "Xuất dữ liệu"
    When menu dropdown mở ra
    Then hiển thị 3 lựa chọn: "Xuất Markdown (.md)", "Xuất JSON (.json)", "In / Lưu PDF (.pdf)"
    When người dùng bấm chọn "Xuất Markdown (.md)"
    Then hệ thống gọi API exportSessionMarkdown với sessionId hiện tại
    And tải file "session_{id}.md" về máy
    And đóng menu dropdown

  Scenario: User opens export menu and chooses JSON snapshot format
    Given người dùng nhấn vào nút "Xuất dữ liệu"
    When menu dropdown mở ra
    And người dùng bấm chọn "Xuất JSON (.json)"
    Then hệ thống gọi API exportSessionJson với sessionId hiện tại
    And tải file "session_{id}.json" về máy
    And đóng menu dropdown

  Scenario: User opens export menu and chooses Print/PDF format
    Given người dùng nhấn vào nút "Xuất dữ liệu"
    When menu dropdown mở ra
    And người dùng bấm chọn "In / Lưu PDF (.pdf)"
    Then hệ thống gọi hàm window.print() của trình duyệt
    And các phần tử mang class "no-print" không xuất hiện trong bản in
```

---

## 2. Feature: Backend Export API Contract & Error Handling

```gherkin
Feature: Backend Export API Contract Hardening

  Scenario: Request export with format=pdf informs client-side workflow
    Given một phiên nghiên cứu tồn tại trong hệ thống
    When người dùng gửi request GET /api/v1/sessions/{session_id}/export?format=pdf
    Then hệ thống trả về HTTP 400 Bad Request
    And body detail thông báo rõ ràng về việc PDF được hỗ trợ tối ưu qua client-side printing và danh sách formats được hỗ trợ (md, markdown, json)

  Scenario: Backward compatibility for Markdown and JSON export
    Given một phiên nghiên cứu tồn tại
    When gửi GET /api/v1/sessions/{session_id}/export?format=md
    Then trả về HTTP 200 OK Content-Type "text/markdown; charset=utf-8"
    When gửi GET /api/v1/sessions/{session_id}/export?format=json
    Then trả về HTTP 200 OK Content-Type "application/json; charset=utf-8"
```
