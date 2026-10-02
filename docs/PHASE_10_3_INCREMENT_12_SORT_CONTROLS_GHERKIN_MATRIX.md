# Phase 10.3 Increment 12 — In-View Result Ordering & Priority Sort Controls Gherkin Matrix

## Feature: In-View Result Ordering & Priority Sort Controls in Semantic Search Explorer

  As a researcher exploring semantic search results
  I want to switch result ordering between relevance, keyword-first, and golden-first
  So that I can scan and prioritize critical evidence quickly without extra backend roundtrips

  Background:
    Given the Semantic Search Explorer is initialized with search results

  @increment-12 @ordering @default
  Scenario: 36 - Default relevance ordering
    Given a search returns items with scores [0.95, 0.88, 0.72]
    When the results are rendered
    Then the sort selector defaults to "relevance"
    And items are displayed in order of their initial RRF relevance

  @increment-12 @ordering @keyword-first
  Scenario: 37 - Reorder by keyword-first priority
    Given search results contain:
      | chunk_id | score | excerpt                                     |
      | chk-1    | 0.95  | Tài liệu cơ học tổng quát                  |
      | chk-2    | 0.78  | Giải pháp giảm ma sát cho vòng bi nâng cao |
    And the search query is "ma sát"
    When the user selects sort mode "keyword_first"
    Then "chk-2" is displayed before "chk-1" because it matches query keywords
    And items within the keyword-matched group remain ordered by score descending

  @increment-12 @ordering @golden-first
  Scenario: 38 - Reorder by golden-first priority
    Given search results contain:
      | chunk_id | score | golden | excerpt                      |
      | chk-reg  | 0.96  | false  | Báo cáo nghiên cứu thường    |
      | chk-gold | 0.82  | true   | Tài liệu chuẩn vàng (Golden) |
    When the user selects sort mode "golden_first"
    Then "chk-gold" is displayed before "chk-reg"

  @increment-12 @ordering @segment-interop
  Scenario: 39 - Sort applies to active source segment bucket
    Given search results have multiple source types and sort mode is "golden_first"
    When the user clicks the "case_study" source segment tab
    Then only case_study results are displayed
    And they are ordered with golden case studies first, followed by regular case studies

  @increment-12 @ordering @state-preservation
  Scenario: 40 - State preservation when switching sort modes and source segments
    Given a snippet in the result list is expanded
    When the user changes the sort mode
    Then the snippet remains expanded
    And changing source segment does not reset the selected sort mode
