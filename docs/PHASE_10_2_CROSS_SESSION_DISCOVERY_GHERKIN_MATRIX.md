# Gherkin Test Matrix: Phase 10.2 — Backend Cross-Session Knowledge Discovery

## Feature: Cross-Session Knowledge Discovery
  As a researcher
  I want to discover past research sessions with similar problem frames and TRIZ contradictions
  So that I can reuse solutions and research insights across different projects

### Scenario 1: Successfully discover related sessions with matching TRIZ parameters and principles
  Given a source session S1 with domain "engineering", improving_parameter "Speed", worsening_parameter "Strength", contradiction_type "technical", and suggested_principles [1, 35]
  And a target session S2 with domain "engineering", improving_parameter "Speed", worsening_parameter "Strength", contradiction_type "technical", and suggested_principles [1, 35]
  And a target session S3 with domain "manufacturing", improving_parameter "Weight", worsening_parameter "Cost", contradiction_type "technical", and suggested_principles [2, 10]
  When I send a request "GET /api/v1/search/cross-session?session_id={S1.id}&top_k=5&min_score=0.1"
  Then the response status code must be 200
  And the response "has_problem_frame" must be true
  And the response "reason" must be null
  And "matched_sessions" must contain S2 with high similarity_score (close to 1.0)
  And S2 "match_reasons" must list matching parameters and principles
  And S1 must NOT be in "matched_sessions" (no self-match)
  And "total_candidates_analyzed" must reflect total evaluated candidates

### Scenario 2: Exclude source session itself from matches (Self-exclusion)
  Given a source session S1 with valid problem_frame
  When I send a request "GET /api/v1/search/cross-session?session_id={S1.id}"
  Then the response status code must be 200
  And none of the items in "matched_sessions" should have session_id equal to S1.id

### Scenario 3: Exclude archived sessions from results
  Given a source session S1 with active status and improving_parameter "Speed"
  And a target session S2 with matching improving_parameter "Speed" but status is "archived"
  When I send a request "GET /api/v1/search/cross-session?session_id={S1.id}"
  Then the response status code must be 200
  And S2 must NOT appear in "matched_sessions"

### Scenario 4: Source session without problem frame returns deterministic empty result
  Given a source session S1 with status "active" but no problem_frame configured
  And multiple other active sessions exist with complete problem frames
  When I send a request "GET /api/v1/search/cross-session?session_id={S1.id}"
  Then the response status code must be 200
  And "has_problem_frame" must be false
  And "reason" must be "no_problem_frame"
  And "matched_sessions" must be an empty list []
  And "total_candidates_analyzed" must be 0

### Scenario 5: Non-existent session ID returns 404
  When I send a request "GET /api/v1/search/cross-session?session_id=00000000-0000-0000-0000-000000000000"
  Then the response status code must be 404
  And the error message must contain "not found"

### Scenario 6: Boundary top_k and min_score filtering
  Given a source session S1 with valid problem frame
  And 10 target sessions matching with varying similarity scores from 0.1 to 0.9
  When I send a request "GET /api/v1/search/cross-session?session_id={S1.id}&top_k=3&min_score=0.5"
  Then the response status code must be 200
  And the length of "matched_sessions" must be <= 3
  And every matched session must have similarity_score >= 0.5

### Scenario 7: Stable ordering for identical similarity scores
  Given a source session S1
  And target session S_older created at T1 with score 0.5
  And target session S_newer created at T2 (T2 > T1) with score 0.5
  When I send a request "GET /api/v1/search/cross-session?session_id={S1.id}"
  Then S_newer must appear before S_older in "matched_sessions"
