# Phase 10.1 Gherkin Test Matrix — TRIZ 39 Parameters Auto-mapping & Bilingual Intelligence

> **Version:** 1.0.0  
> **Status:** Active  
> **Date:** 2026-10-02  

---

## 1. BDD Feature Specifications

### Feature 1: Bilingual Parameter Auto-mapping Endpoint
```gherkin
Feature: Auto-mapping TRIZ 39 Parameters from Natural Language

  Scenario: 1.1 Auto-map parameters from Vietnamese engineering description
    Given a technical description "Cánh tay robot cần tăng độ bền và chịu tải nhưng phải giảm khối lượng di động"
    When the client sends POST to /api/v1/triz/auto-map with {"text": text, "top_k": 5}
    Then the response status should be 200 OK
    And the data list should contain "strength" (ID 14) and "weight_moving" (ID 1)
    And each match item should include "name_vi", "name_en", "score", and "matched_keywords"

  Scenario: 1.2 Auto-map parameters from English engineering description
    Given a technical description "Improve battery energy capacity while reducing heat and thermal degradation"
    When the client sends POST to /api/v1/triz/auto-map with {"text": text, "top_k": 5}
    Then the response status should be 200 OK
    And the data list should contain "temperature" (ID 17) and energy-related parameters
    And the results should be sorted by score in descending order

  Scenario: 1.3 Validation error on empty or whitespace text
    Given an empty text payload {"text": "   "}
    When the client sends POST to /api/v1/triz/auto-map
    Then the response status should be 400 Bad Request
    And the detail should explain that text cannot be empty
```

### Feature 2: Problem Structuring Engine Bilingual 39 Parameters Resolution
```gherkin
Feature: Problem Structuring Service with Full 39 Parameters

  Scenario: 2.1 Problem framing extracts 39-parameter codes from complex statements
    Given a raw statement "Hệ thống cần tăng độ tin cậy và tự động hóa trong khi tránh làm phức tạp thiết bị"
    When problem structuring service processes the statement
    Then the identified improving parameter should be "reliability" or "automation_level"
    And the worsening parameter should be "complexity"
    And the contradiction should link to valid Altshuller 39x39 matrix principles
```

---

## 2. Test Execution Matrix

| Test ID | Level | Target Module | Scenario | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **T10.1-01** | Integration | `test_triz_auto_map_api.py` | POST `/api/v1/triz/auto-map` với câu tiếng Việt | HTTP 200, trả về danh sách matches có `strength` và `weight_moving` |
| **T10.1-02** | Integration | `test_triz_auto_map_api.py` | POST `/api/v1/triz/auto-map` với câu tiếng Anh | HTTP 200, trả về danh sách matches có `temperature` |
| **T10.1-03** | Integration | `test_triz_auto_map_api.py` | POST `/api/v1/triz/auto-map` với chuỗi rỗng / whitespace | HTTP 400 Bad Request |
| **T10.1-04** | Integration | `test_triz_auto_map_api.py` | POST `/api/v1/triz/auto-map` với `top_k` tùy biến (e.g. 3) | HTTP 200, độ dài `data` <= 3 |
| **T10.1-05** | Unit | `api-client.test.ts` | `mapTrizParameters(text, top_k)` gọi POST `/api/v1/triz/auto-map` | Trả về `TrizParameterMatch[]` |
