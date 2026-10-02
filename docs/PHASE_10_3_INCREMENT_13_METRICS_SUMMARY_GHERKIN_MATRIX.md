# Phase 10.3 Increment 13 — Result Distribution Metrics & Quick Context Summary Chips Gherkin Matrix

## Feature: Result Distribution Metrics & Quick Context Summary Chips in Semantic Search Explorer

  As a researcher reviewing semantic search results
  I want quick quantitative summary chips for total results, keyword matches, golden items, and segment counts
  So that I can immediately gauge result distribution and quality without scrolling through every card

  Background:
    Given the Semantic Search Explorer is rendered with query results

  @increment-13 @metrics @distribution
  Scenario: 41 - Render accurate distribution metrics chips
    Given a search for "ma sát" returns 3 items:
      | chunk_id | golden | excerpt                      |
      | chk-1    | true   | Giảm ma sát trong ổ bi       |
      | chk-2    | false  | Ma sát bề mặt tiếp xúc       |
      | chk-3    | false  | Tối ưu cấu trúc cơ khí chung |
    When the results view is rendered
    Then the summary bar shows:
      | "3 kết quả tìm thấy" |
      | "2 khớp từ khóa"     |
      | "1 chuẩn vàng"       |

  @increment-13 @metrics @zero-hide
  Scenario: 42 - Hide keyword and golden chips when counts are zero
    Given a search returns 2 regular items with no direct keyword match
    When the results view is rendered
    Then the summary bar shows "2 kết quả tìm thấy"
    And the keyword match chip is not rendered
    And the golden items chip is not rendered

  @increment-13 @metrics @segment-context
  Scenario: 43 - Display filtered vs total count context on segment selection
    Given search results contain 4 items total with 2 case_study items
    When the user clicks the "case_study" segment tab
    Then the summary bar shows "Hiển thị 2 / 4 mục"

  @increment-13 @metrics @segment-update
  Scenario: 44 - Update metrics dynamically when switching back to all
    Given the user is viewing a source segment showing "Hiển thị 2 / 4 mục"
    When the user clicks the "Tất cả" segment tab
    Then the segment context chip is removed
    And the full count of 4 results remains displayed
