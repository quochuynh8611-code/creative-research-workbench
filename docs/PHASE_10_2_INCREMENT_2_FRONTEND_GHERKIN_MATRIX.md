# Gherkin Test Matrix: Phase 10.2 Increment 2 — Frontend Cross-Session Discovery Panel

## Feature: Related Sessions Panel in Session Detail
  As a researcher
  I want to view cross-session discovery results directly in the "Tài liệu & Bằng chứng" tab
  So that I can quickly reference past research sessions solving similar TRIZ contradictions

### Scenario 1: Fetch and render matching sessions with similarity metrics
  Given a session S1 in the "Tài liệu & Bằng chứng" tab
  And the backend returns 2 matched sessions with similarity scores
  When the RelatedSessionsPanel is mounted with isActiveTab=true
  Then it should render 2 session cards
  And each card should display the title, domain, similarity score, match reasons, and shared principles
  And clicking the card title or action links to the session URL

### Scenario 2: Source session has no problem frame (Intake stage)
  Given a source session without a problem frame
  And the API returns { has_problem_frame: false, reason: "no_problem_frame", matched_sessions: [] }
  When the RelatedSessionsPanel renders
  Then it should display an informative notice guiding the user to complete the Intake step
  And no error banner should be displayed

### Scenario 3: No matching sessions found in database
  Given a source session with a problem frame
  And the API returns { has_problem_frame: true, reason: null, matched_sessions: [], total_candidates_analyzed: 5 }
  When the RelatedSessionsPanel renders
  Then it should display an empty state stating no similar sessions were found

### Scenario 4: Error handling and retry capability
  Given the cross-session API returns an error (HTTP 500 / network failure)
  When the RelatedSessionsPanel query fails
  Then a localized error message should be displayed within the panel
  And a "Thử lại" (Retry) button should be present
  And clicking "Thử lại" calls refetch

### Scenario 5: Conditional query activation
  Given the RelatedSessionsPanel is mounted with isActiveTab=false
  When the parent tab is not "retrieval"
  Then the query must NOT be enabled and no network request should be sent
