# TEST PLAN — Creative Research Workbench

## Test Strategy
Test theo từng layer: unit tests cho domain logic, integration tests theo Gherkin scenarios, và golden-set evaluation cho retrieval quality.

## Layer 1 — Unit Tests
- ProblemFrame validation logic.
- Contradiction extractor.
- Completeness score calculator.
- Method recommender mapping.

## Layer 2 — Integration Tests (theo Gherkin)
- Session creation và intake flow.
- Problem structuring pipeline.
- Retrieval với known queries.
- Method suggestion cho từng loại contradiction.

## Layer 3 — Golden-Set Retrieval Evaluation
- 10 tài liệu vàng được chọn làm benchmark.
- Đo Recall@5, Precision@5 cho hybrid retrieval.
- So sánh full-text vs vector vs hybrid.

## Layer 4 — End-to-End QA
- 5 bài toán thật: kỹ thuật, kinh doanh, giáo dục, cá nhân, nghiên cứu.
- Đo: citation accuracy, task completion rate, user satisfaction.

## Definition of Done cho MVP
- [ ] Tất cả Gherkin scenarios PASS.
- [ ] Retrieval Recall@5 >= 0.80.
- [ ] Citation accuracy >= 0.90.
- [ ] Task completion >= 0.75 trên 5 bài toán thật.
- [ ] Không có lỗi P0/P1 mở trong production.
