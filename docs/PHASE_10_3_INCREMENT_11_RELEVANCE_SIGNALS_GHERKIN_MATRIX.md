# Phase 10.3 Increment 11 — Lightweight Relevance Tiers & Keyword Match Indicators Gherkin Matrix

## Matrix Overview

| Scenario ID | Category | Score | Query | Excerpt / Source | Expected Badges |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scenario 32** | High Relevance | `0.94` | `"ma sát"` | `"Giảm ma sát bề mặt"` | `Độ khớp cao (94%)`, `Khớp từ khóa` |
| **Scenario 33** | Good Relevance | `0.82` | `"nhiệt độ"` | `"Kiểm soát nhiệt độ pin xe"` | `Độ khớp tốt (82%)`, `Khớp từ khóa` |
| **Scenario 34** | Reference Tier | `0.71` | `"bền bỉ"` | `"Tối ưu cơ cấu cơ học"` | `Tham khảo (71%)`, Không có badge `Khớp từ khóa` |
| **Scenario 35** | Short Token Guard | `0.85` | `"độ"` (< 3 chars) | `"Tăng cường độ cứng"` | `Độ khớp tốt (85%)`, Không gắn badge `Khớp từ khóa` cho token ngắn |

---

## Detailed Gherkin Specifications

```gherkin
Feature: Lightweight Relevance Tiers & Keyword Match Indicators

  Scenario 32: Render badge Độ khớp cao và Khớp từ khóa khi score >= 0.90 và chứa từ khóa
    Given người dùng tìm kiếm từ khóa "ma sát"
    And kết quả trả về có score=0.94 và excerpt chứa "Giảm ma sát bề mặt"
    When thẻ kết quả được hiển thị
    Then hiển thị badge "Độ khớp cao (94%)"
    And hiển thị badge "Khớp từ khóa"

  Scenario 33: Render badge Độ khớp tốt khi score trong khoảng 0.75 đến 0.90
    Given người dùng tìm kiếm từ khóa "nhiệt độ"
    And kết quả trả về có score=0.82 và excerpt chứa "Kiểm soát nhiệt độ"
    When thẻ kết quả được hiển thị
    Then hiển thị badge "Độ khớp tốt (82%)"
    And hiển thị badge "Khớp từ khóa"

  Scenario 34: Render badge Tham khảo khi score < 0.75 và không có keyword match
    Given người dùng tìm kiếm từ khóa "bền bỉ"
    And kết quả trả về có score=0.71 và excerpt không chứa từ khóa
    When thẻ kết quả được hiển thị
    Then hiển thị badge "Tham khảo (71%)"
    And KHÔNG hiển thị badge "Khớp từ khóa"

  Scenario 35: Bỏ qua token ngắn dưới 3 ký tự khi kiểm tra Khớp từ khóa
    Given người dùng tìm kiếm từ khóa ngắn "độ"
    And kết quả trả về có score=0.85 và excerpt chứa "Tăng cường độ cứng"
    When thẻ kết quả được hiển thị
    Then hiển thị badge "Độ khớp tốt (85%)"
    And KHÔNG hiển thị badge "Khớp từ khóa" do token ngắn bị loại trừ
```
