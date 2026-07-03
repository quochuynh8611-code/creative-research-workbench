---
title: "GHERKIN SCENARIOS — Creative Research Workbench"
topic: "testing"
source_type: "bdd"
language: "vi"
tags: ["gherkin", "scenario", "feature", "bdd", "acceptance", "triz"]
phase: "1"
status: "canonical"
golden: true
created: "2026-07-03"
---

# GHERKIN SCENARIOS — Creative Research Workbench

---

## Feature: Ingestion Pipeline

```gherkin
Feature: Ingestion Pipeline
  Để có thể tìm kiếm tài liệu
  Là backend service
  Tôi cần parse và lưu trữ markdown documents vào database

  Scenario: Ingest một golden document thành công
    Given file "docs/ADR-001-architecture.md" có YAML frontmatter hợp lệ
    When IngestionService.ingest(filepath) được gọi
    Then Document record được tạo trong database
    And ít nhất 1 Chunk record được tạo
    And mỗi Chunk có embedding vector không null

  Scenario: Chặn duplicate ingest
    Given document "ADR-001-architecture.md" đã được ingest
    When IngestionService.ingest(filepath) được gọi lần 2
    Then không có Document record mới được tạo
    And system trả về status "already_exists"
```

---

## Feature: Hybrid Search

```gherkin
Feature: Hybrid Search
  Để tìm thông tin liên quan
  Là người dùng
  Tôi cần tìm kiếm trong kho tài liệu bằng câu hỏi tự nhiên

  Scenario: Tìm kiếm full-text cơ bản
    Given kho tài liệu đã có 10 golden documents được ingest
    When POST /api/v1/search với query "mâu thuẫn kỹ thuật"
    Then response trả về trong < 200ms
    And ít nhất 1 result có excerpt chứa từ khóa liên quan
    And mỗi result có "source_ref" hợp lệ

  Scenario: Vector search Recall@5
    Given kho tài liệu đã có 10 golden documents
    When chạy benchmark 10 golden queries
    Then Recall@5 >= 0.75
```

---

## Feature: Problem Structuring

```gherkin
Feature: Problem Structuring
  Để xác định loại mâu thuẫn
  Là người dùng
  Tôi cần nhập bài toán và nhận phân tích có cấu trúc

  Scenario: Tạo ProblemFrame từ input tự do
    Given session "abc-123" đang ở trạng thái active
    When POST /sessions/abc-123/problem-frame với raw_statement hợp lệ
    Then ProblemFrame record được tạo
    And contradiction_type không phải null
    And normalized_statement không rỗng

  Scenario: Xử lý input rỗng
    Given session hợp lệ đang tồn tại
    When POST /sessions/{id}/problem-frame với raw_statement = ""
    Then response trả về 422 Unprocessable Entity
    And error message giải thích lý do
```
