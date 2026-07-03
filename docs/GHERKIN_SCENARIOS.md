# GHERKIN SCENARIOS — Creative Research Workbench

## Feature: Research Session Management

```gherkin
Feature: Research Session Management

  Scenario: Create a new research session
    Given I am on the dashboard
    When I click "New Session"
    And I enter title "Improve delivery time for medical equipment"
    And I select domain "business"
    Then a new session is created with status "draft"
    And I am redirected to the session detail page

  Scenario: Search sessions by keyword
    Given I have 5 sessions in the system
    When I search for "delivery time"
    Then I see only sessions matching the keyword
```

## Feature: Problem Intake

```gherkin
Feature: Problem Intake

  Scenario: Complete problem intake form
    Given I have an active session
    When I fill in goal: "Reduce delivery time by 30%"
    And I add constraint: "Budget under 50M VND"
    And I add affected entity: "Warehouse team"
    And I add failure signal: "Customer complaints about delay"
    Then the ProblemFrame is saved
    And the system proceeds to structuring stage
```

## Feature: Problem Structuring

```gherkin
Feature: Problem Structuring

  Scenario: Extract contradiction from problem frame
    Given I have a completed ProblemFrame
    When the system runs contradiction extraction
    Then I see at least one Contradiction with improving_parameter and worsening_parameter
    And each contradiction has a context explanation

  Scenario: Build cause-effect chain
    Given I have identified failure signals
    When the system builds cause-effect chain
    Then I see a tree of cause nodes
    And each node links to potential root causes
```

## Feature: Knowledge Retrieval

```gherkin
Feature: Knowledge Retrieval

  Scenario: Retrieve relevant chunks for a contradiction
    Given I have a Contradiction object
    When the system runs hybrid retrieval
    Then I see at least 3 relevant knowledge chunks
    And each chunk shows excerpt and source file
    And chunks are ranked by relevance_score
```

## Feature: Method Recommendation

```gherkin
Feature: Method Recommendation

  Scenario: Get TRIZ method suggestions
    Given I have a structured ProblemFrame
    When I request method recommendations
    Then I see at least 2 MethodSuggestion objects
    And each suggestion includes rationale and cited_sources
    And suggestions are ranked by ranking_score
```
