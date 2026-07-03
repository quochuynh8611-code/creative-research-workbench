# TEST PLAN — Creative Research Workbench

## Test Strategy

### Level 1: Unit Tests
- Domain entities: ProblemFrame, Contradiction, CandidateSolution
- Schema validation: Pydantic models
- Business rules: contradiction types, scoring logic

### Level 2: Integration Tests
- API endpoints theo API_CONTRACTS.md
- Workflow stage transitions
- Retrieval pipeline: parse → chunk → embed → search
- Database CRUD operations

### Level 3: Gherkin/BDD Tests
- Các scenario trong GHERKIN_SCENARIOS.md
- Happy path + edge cases
- Error handling flows

### Level 4: Retrieval Quality Tests
- Golden-set: 10 tài liệu benchmark
- Metrics: Recall@5, Precision@5, MRR
- Threshold: Recall@5 >= 0.80

### Level 5: QA End-to-End
- 5 bài toán thật: kỹ thuật, kinh doanh, giáo dục, cá nhân, nghiên cứu
- Đo citation accuracy
- Đo task completion rate

## Test Environment
- Unit + Integration: pytest + SQLite in-memory
- E2E: Docker Compose + PostgreSQL
- LLM calls: mock responses cho deterministic tests

## Definition of Done
- Unit test coverage >= 80% cho domain layer
- Tất cả Gherkin scenarios có test tương ứng
- Retrieval Recall@5 >= 0.80 trên golden-set
- Không có critical bug trong 5 QA sessions
