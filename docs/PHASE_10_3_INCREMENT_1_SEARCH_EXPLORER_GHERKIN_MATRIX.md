# Gherkin Test Matrix: Phase 10.3 Increment 1 — Semantic Knowledge Base Explorer

## Feature: Semantic Knowledge Base Explorer & Advanced Filters
  As a researcher
  I want a dedicated full-page semantic search explorer with golden and source_type filters
  So that I can effectively discover knowledge chunks across the standardized corpus

### Scenario 1: Backend filters by golden flag
  Given a golden document D1 with chunk C1 containing "nguyên tắc sáng chế"
  And a non-golden document D2 with chunk C2 containing "nguyên tắc sáng chế"
  When I request "POST /api/v1/search" with query "nguyên tắc" and filters {"golden": true}
  Then the response results must only contain chunks belonging to D1 (golden=true)
  And no chunk belonging to D2 should be returned

### Scenario 2: Backend filters by source_type
  Given document D1 with source_type "golden_kb"
  And document D2 with source_type "external_case"
  When I request "POST /api/v1/search" with query "triz" and filters {"source_type": "golden_kb"}
  Then all returned results must have metadata.source_type equal to "golden_kb"

### Scenario 3: Frontend initial blank state with suggestions
  Given the user opens "/search" without any query
  Then an initial welcome banner should be displayed
  And quick suggestion buttons should be visible
  When the user clicks a suggestion button
  Then the search input should be populated and search is triggered

### Scenario 4: Frontend search execution and results render
  Given the user enters a search query "mâu thuẫn" on the "/search" page
  When the search completes successfully
  Then a results summary indicating count and latency should appear
  And result cards should display the source reference, excerpt snippet, and metadata badges

### Scenario 5: Frontend empty results state
  Given the user searches for a term that has no matches in the corpus
  When the search completes
  Then an empty state card explaining no matching chunks were found should be shown

### Scenario 6: Frontend error state with retry
  Given the search API returns an error (e.g. 500)
  When the search fails
  Then an isolated error message should be displayed with a "Thử lại" (Retry) button
  And clicking "Thử lại" re-executes the search query
