---
title: "TEST PLAN — Creative Research Workbench MVP"
topic: "testing"
source_type: "plan"
language: "vi"
tags: ["pytest", "acceptance", "integration", "unit", "vitest", "playwright"]
phase: "1"
status: "canonical"
golden: true
created: "2026-07-03"
---

# TEST PLAN — Creative Research Workbench MVP

---

## Chiến lược kiểm thử

| Layer | Tool | Coverage target |
|---|---|---|
| Unit (backend) | pytest | >= 80% |
| Integration (backend) | pytest + testcontainers | Tất cả service |
| Unit (frontend) | Vitest + Testing Library | >= 70% |
| E2E | Playwright | Happy path per screen |
| Performance | Locust | Search < 200ms p95 |

---

## Acceptance Gates per Phase

### Phase 2 — Ingestion & Retrieval
- [ ] Ingest 10 golden docs thành công, không có lỗi
- [ ] Full-text search `"mâu thuẫn kỹ thuật"` → trả kết quả trong 200ms
- [ ] Vector search Recall@5 >= 0.75 trên golden set
- [ ] Mọi result có `excerpt` (>= 50 chars) và `source_ref`
- [ ] Duplicate ingest bị chặn (content_hash unique)

### Phase 3 — Problem Structuring
- [ ] 10/10 Gherkin scenarios Phase 3 pass
- [ ] `normalize_problem()` không crash trên input rỗng
- [ ] Contradiction type detected với accuracy >= 80% (manual eval 20 samples)

### Phase 4 — Reasoning Workflow
- [ ] WorkflowEngine FSM transition hợp lệ cho mọi state
- [ ] MethodRecommender trả về >= 1 principle cho mọi contradiction
- [ ] E2E: problem → contradiction → principles < 3 seconds tổng

### Phase 5 — UI
- [ ] Playwright: tạo session → nhập problem → xem principles (happy path)
- [ ] Không có TypeScript error
- [ ] Lighthouse score >= 80

---

## Test Data

- Golden set: 10 docs trong `docs/` với frontmatter
- Sample problems: 5 bài toán TRIZ mẫu (bánh răng, nhiệt độ, cánh quạt...)
- Edge cases: input rỗng, input quá dài (> 5000 chars), Unicode đặc biệt
