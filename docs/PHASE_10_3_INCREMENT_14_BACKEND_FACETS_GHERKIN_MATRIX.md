# Phase 10.3 Increment 14 — Backend Facets & Explorer Aggregate Counts Gherkin Matrix

## Feature: Backend Facets & Explorer Aggregate Counts

  As a researcher searching across the knowledge base
  I want backend-computed total hits and facet distribution counts
  So that I can understand the full scope of matches beyond the top-k limit and accurately filter across source segments

  Background:
    Given the knowledge base contains documents with diverse topics, source types, phases, and golden statuses

  @increment-14 @backend @total-hits
  Scenario: 45 - Total hits exceeds top_k limit
    Given the knowledge base has 8 chunks matching "mâu thuẫn"
    When a client sends POST /api/v1/search with query="mâu thuẫn" and top_k=3
    Then the response status is 200
    And results length is 3
    And total_hits is 8

  @increment-14 @backend @facet-counts
  Scenario: 46 - Accurate facet counts returned in search response
    Given matching candidates consist of:
      | topic         | source_type   | phase | golden | count |
      | contradiction | golden_kb     | 1     | true   | 2     |
      | function      | research_paper| 2     | false  | 3     |
    When a client sends POST /api/v1/search
    Then facet_counts.topic contains {"contradiction": 2, "function": 3}
    And facet_counts.source_type contains {"golden_kb": 2, "research_paper": 3}
    And facet_counts.phase contains {"1": 2, "2": 3}
    And facet_counts.golden contains {"true": 2, "false": 3}

  @increment-14 @backend @zero-results
  Scenario: 47 - Empty search returns zero total_hits and empty facet counts
    When a client sends POST /api/v1/search for a non-existent query
    Then results is empty
    And total_hits is 0
    And all facet_counts categories are empty dictionaries

  @increment-14 @frontend @explorer-total-hits
  Scenario: 48 - Explorer displays backend total_hits and filtered fraction
    Given backend returns total_hits=15 and results length=5
    When SemanticSearchExplorer renders the results
    Then the summary bar displays "15 kết quả tìm thấy"
    And the context chip displays "Hiển thị 5 / 15 mục"

  @increment-14 @frontend @explorer-fallback
  Scenario: 49 - Explorer falls back gracefully when backend omits aggregate fields
    Given a legacy search response with no total_hits and no facet_counts containing 4 items
    When SemanticSearchExplorer renders the response
    Then the summary bar falls back to "4 kết quả tìm thấy"
    And the explorer operates without throwing runtime errors
