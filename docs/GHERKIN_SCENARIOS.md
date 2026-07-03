# GHERKIN SCENARIOS — Creative Research Workbench

## Feature: Research Session Management

```gherkin
Feature: Research Session Management

  Scenario: Create a new research session
    Given I am a logged-in researcher
    When I create a session with title "Cải thiện năng suất nghiên cứu" and domain "research"
    Then the session should be created with status "draft"
    And the session should have a unique ID

  Scenario: List sessions with filter
    Given I have 5 sessions (3 active, 2 archived)
    When I filter by status "active"
    Then I should see exactly 3 sessions
```

## Feature: Problem Intake

```gherkin
Feature: Problem Intake

  Scenario: Submit a problem frame with complete data
    Given I have an active session
    When I submit a problem frame with goal, constraints and success criteria
    Then the system returns a completeness_score >= 0.80
    And the system returns a normalized_problem_statement

  Scenario: Request clarifying questions
    Given I submit only a raw_problem_statement
    When I call the clarify endpoint
    Then the system returns 3-5 targeted questions
    And each question targets a missing field
```

## Feature: Knowledge Retrieval

```gherkin
Feature: Knowledge Retrieval

  Scenario: Retrieve relevant documents for a query
    Given the knowledge base is indexed
    When I query "contradiction in technical systems"
    Then I receive at least 3 results
    And each result has excerpt, source_title and source_ref
    And at least 1 result is from the TRIZ-40-principles document

  Scenario: Filter retrieval by topic
    Given the knowledge base is indexed
    When I query with filter topic "business"
    Then all results have topic tag "business"
```

## Feature: Method Recommendation

```gherkin
Feature: Method Recommendation

  Scenario: Recommend methods for a technical contradiction
    Given I have a contradiction of type "technical"
    When I request method suggestions
    Then the system returns at least 2 TRIZ principles
    And each suggestion has a rationale and cited_sources
```
