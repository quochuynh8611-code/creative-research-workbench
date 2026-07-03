---
title: "GHERKIN SCENARIOS — Creative Research Workbench"
topic: testing
source_type: bdd
language: vi
tags: [gherkin, scenario, feature, bdd, acceptance-test]
golden: true
phase: 0
created_at: 2026-07-03
---

# GHERKIN SCENARIOS — Creative Research Workbench

## Feature 1: Tạo research session

```gherkin
Feature: Research session management

  Scenario: Tạo session mới thành công
    Given người dùng ở màn hình Session List
    When người dùng nhập title "Cải thiện năng suất nghiên cứu" và domain "research"
    And người dùng nhấn "Tạo session"
    Then hệ thống tạo session với status "draft"
    And người dùng được chuyển đến Session Workspace

  Scenario: Tạo session với title trống
    Given người dùng ở màn hình Session List
    When người dùng để trống title và nhấn "Tạo session"
    Then hệ thống hiển thị lỗi "Title is required"
    And không có session nào được tạo
```

## Feature 2: Chuẩn hóa bài toán

```gherkin
Feature: Problem intake

  Scenario: Nhận ProblemFrame từ raw statement
    Given người dùng đang ở stage Intake
    When người dùng nhập "Máy của tôi chạy chậm khi có nhiều người dùng cùng lúc"
    And người dùng nhấn "Phân tích"
    Then hệ thống trả về ProblemFrame với goal, constraints và affected_entities
    And completeness_score >= 0.6

  Scenario: Bài toán quá mơ hồ
    Given người dùng đang ở stage Intake
    When người dùng nhập "Mọi thứ không ổn"
    Then hệ thống trả về clarifying questions
    And không tạo ProblemFrame cho đến khi câu hỏi được trả lời
```

## Feature 3: Nhận diện mâu thuẫn

```gherkin
Feature: Contradiction analysis

  Scenario: Extract technical contradiction
    Given đã có ProblemFrame với goal và constraints
    When hệ thống phân tích mâu thuẫn
    Then trả về ít nhất 1 technical contradiction
    And mỗi contradiction có improving_parameter và worsening_parameter
    And có suggested_principles từ TRIZ matrix
```

## Feature 4: Dựng chuỗi nhân quả

```gherkin
Feature: Cause-effect analysis

  Scenario: Xây 5-Why chain
    Given đã có ProblemFrame với failure_signals
    When người dùng chọn phương pháp "5-Why"
    Then hệ thống trả về CauseEffectChain với ít nhất 3 levels
    And root_causes được xác định
```

## Feature 5: Đề xuất phương pháp phù hợp

```gherkin
Feature: Method recommendation

  Scenario: Gợi ý TRIZ method từ contradiction type
    Given đã có Contradiction với type "technical"
    When hệ thống generate method suggestions
    Then trả về >= 3 method suggestions
    And mỗi suggestion có rationale và citation_ids
    And citation_ids trỏ về tài liệu trong knowledge base
```
