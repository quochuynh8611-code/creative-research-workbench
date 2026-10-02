# Phase 10.3 Increment 9 — Active Search Scope Clarity & Removable Filter Chips Bar Gherkin Matrix

## Matrix Overview

| Scenario ID | Category | Scope Mode | Active Filters | User Action | Expected Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scenario 24** | Scope Clarity | Contextual (`session_id="s1"`) | `topic="contradiction"`, `golden=true`, `phase="2"` | View Results | Render badge "Phiên: [Title]" và 3 filter chips: "Chủ đề: Mâu thuẫn...", "Chỉ Golden...", "Phase 2" |
| **Scenario 25** | Chip Removal | Contextual (`session_id="s1"`) | `topic="contradiction"`, `golden=true` | Click `✕` trên chip "Chỉ Golden Documents" | `goldenOnly` thành false, URL loại bỏ `golden=true`, giữ nguyên `topic="contradiction"` và `q` |
| **Scenario 26** | Standalone Scope | Standalone (no session_id) | None (default) | View Results | Render badge "Toàn bộ kho tri thức", không có filter chips |
| **Scenario 27** | Multi-chip Removal | Standalone | `source_type="golden_kb"`, `phase="1"` | Click `✕` trên chip "Nguồn: Golden Knowledge Base" | `selectedSourceType` thành rỗng, URL loại bỏ `source_type`, giữ nguyên `phase="1"` và `q` |

---

## Detailed Gherkin Specifications

```gherkin
Feature: Active Search Scope Clarity & Removable Filter Chips

  Scenario 24: Render đúng Scope Badge và Active Filter Chips khi có bộ lọc
    Given người dùng mở Explorer từ session "sess-test" với query "độ bền"
    And các bộ lọc topic="contradiction", golden=true, phase="2" đang được kích hoạt
    When API search trả về 1 kết quả
    Then thanh Summary Bar hiển thị badge phạm vi có chứa tên session
    And hiển thị chip "Chủ đề: Mâu thuẫn kỹ thuật & Vật lý"
    And hiển thị chip "Chỉ Golden Documents"
    And hiển thị chip "Phase 2"

  Scenario 25: Gỡ bỏ một chip riêng lẻ cập nhật đúng state và URL params
    Given thanh Summary Bar đang hiển thị các chips ở Scenario 24
    When người dùng click nút "Xóa bộ lọc Golden Documents"
    Then chip "Chỉ Golden Documents" biến mất
    And URL được cập nhật loại bỏ tham số "golden=true"
    And các tham số "q=độ+bền", "topic=contradiction", "phase=2", "session_id=sess-test" vẫn được giữ nguyên

  Scenario 26: Render đúng Standalone Scope Badge khi không có session_id
    Given người dùng tìm kiếm từ khóa "triz" ở chế độ Standalone không có bộ lọc
    When API search trả về kết quả
    Then thanh Summary Bar hiển thị badge "Toàn bộ kho tri thức"
    And không hiển thị phần Active Filter Chips thừa

  Scenario 27: Gỡ bỏ chip Source Type giữ nguyên các bộ lọc khác
    Given người dùng đang lọc source_type="golden_kb" và phase="1" với query "nhiệt"
    When người dùng click nút "Xóa bộ lọc loại nguồn"
    Then source_type được reset về mặc định
    And URL được cập nhật không còn "source_type" nhưng vẫn giữ "phase=1" và "q=nhiệt"
```
