# Phase 10.3 Increment 8 — Contextual Empty-State Guidance & Actionable Recovery Actions Gherkin Matrix

## Matrix Overview

| Scenario ID | Category | Query Context | Active Filters | Session Context | Expected Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scenario 20** | Empty-State Recovery | `q="ma sát"` | `topic="triz_principle"`, `golden=true` | None (Standalone) | Hiển thị CTA "Nới lỏng bộ lọc", click reset filter về default, giữ `q="ma sát"` và URL sync |
| **Scenario 21** | Empty-State Recovery | `q="nhiệt động"` | None (default) | `session_id="sess-abc"`, `from_tab="ideation"` | Hiển thị CTA "Quay lại phiên nghiên cứu" với href `/sessions/sess-abc?tab=ideation` |
| **Scenario 22** | Empty-State Recovery | `q="khó tìm"` | `source_type="golden_kb"` | `session_id="sess-xyz"` (no from_tab) | Hiển thị cả 2 CTA: "Nới lỏng bộ lọc" và "Quay lại phiên nghiên cứu" với default tab `retrieval` |
| **Scenario 23** | Clean State | `q="không có gì"` | None (default) | None (Standalone) | Không hiển thị CTA "Nới lỏng bộ lọc" và không hiển thị CTA session |

---

## Detailed Gherkin Specifications

### Feature: Contextual Empty-State Guidance & Recovery Actions

```gherkin
Feature: Empty Results Recovery Surface

  Scenario 20: Khi 0 kết quả và có filter active, hiển thị CTA Nới lỏng bộ lọc và reset đúng trạng thái
    Given người dùng đang ở trang Explorer với query "ma sát" và bộ lọc topic="triz_principle"
    When API searchKnowledge trả về 0 kết quả
    Then giao diện hiển thị thông báo "Không tìm thấy đoạn tri thức nào phù hợp"
    And hiển thị nút bấm "Nới lỏng bộ lọc"
    When người dùng click vào nút "Nới lỏng bộ lọc"
    Then các bộ lọc được reset về giá trị mặc định
    And từ khóa tìm kiếm "ma sát" vẫn được giữ nguyên
    And URL được đồng bộ về "/search?q=ma+s%C3%A1t" (không còn param topic)

  Scenario 21: Khi 0 kết quả trong contextual mode, hiển thị CTA Quay lại phiên nghiên cứu với from_tab
    Given người dùng mở Explorer từ session "sess-abc" với from_tab="ideation"
    And thực hiện tìm kiếm từ khóa "nhiệt động" không có kết quả
    Then giao diện hiển thị nút liên kết "Quay lại phiên nghiên cứu"
    And liên kết có thuộc tính href trỏ tới "/sessions/sess-abc?tab=ideation"

  Scenario 22: Khi 0 kết quả với cả active filter và session_id không có from_tab
    Given người dùng ở contextual mode session_id="sess-xyz" với source_type="golden_kb"
    When tìm kiếm trả về 0 kết quả
    Then giao diện hiển thị cả nút "Nới lỏng bộ lọc" và liên kết "Quay lại phiên nghiên cứu"
    And liên kết quay lại session mặc định trỏ tới "/sessions/sess-xyz?tab=retrieval"

  Scenario 23: Khi 0 kết quả ở Standalone mode không có active filter
    Given người dùng tìm kiếm từ khóa "không có gì" với tất cả bộ lọc ở mặc định
    When API trả về 0 kết quả
    Then giao diện hiển thị thông điệp "Không tìm thấy đoạn tri thức nào phù hợp"
    And KHÔNG hiển thị nút "Nới lỏng bộ lọc"
    And KHÔNG hiển thị liên kết "Quay lại phiên nghiên cứu"
```
