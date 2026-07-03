---
title: "TEST PLAN — Creative Research Workbench MVP"
topic: testing
source_type: plan
language: vi
tags: [pytest, acceptance, integration, unit, tdd, golden-set]
golden: true
phase: 0
created_at: 2026-07-03
---

# TEST PLAN — Creative Research Workbench MVP

## Purpose
Xác định chiến lược test và acceptance gate cho từng phase của MVP.

## Test Strategy
- **TDD**: Viết failing test trước, code sau.
- **Test Pyramid**: Unit (70%) → Integration (20%) → E2E (10%).
- **Golden Set**: 10 tài liệu benchmark dùng để đánh giá retrieval quality.

## Test Pyramid

### Unit Tests
- Domain logic thuần (ProblemFrame, Contradiction extraction)
- Service methods độc lập với database
- Prompt template rendering

### Integration Tests
- API endpoint → Service → Database
- IngestionService → PostgreSQL + pgvector
- RetrievalService: query → hybrid search → ranked results
- WorkflowEngine: stage transition

### E2E Tests (Playwright)
- Tạo session → nhập problem → nhận ProblemFrame
- Search → nhận kết quả có citation
- Advance workflow → stage chuyển đúng

## Test Environments
- **Local**: Docker Compose (PostgreSQL + pgvector + backend + frontend)
- **CI**: GitHub Actions (pytest + playwright headless)

## Acceptance Gates by Phase

### Phase 0 ✅
- 21 files markdown có metadata
- 10 golden documents được chọn và documented
- `knowledge-inventory.md` committed

### Phase 2
- `pytest` benchmark: Recall@5 >= 0.75 trên golden set
- `/search` API trả về < 200ms
- Mọi kết quả có `excerpt` + `source_file`

### Phase 3
- ProblemFrame có `completeness_score > 0.6` cho 3 sample problems
- Contradiction gắn `suggested_principles` từ TRIZ matrix

### Phase 4
- MethodRecommender trả về >= 3 gợi ý có citation
- WorkflowEngine chuyển stage không mất data

### Phase 5
- User tạo ProblemFrame trong < 10 phút (usability test)
- Không có lỗi console trên Chrome + Safari
