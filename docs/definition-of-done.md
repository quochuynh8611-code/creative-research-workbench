---
title: "Definition of Done — Creative Research Workbench"
topic: process
source_type: definition
language: vi
tags: [dod, acceptance-criteria, quality-gate, phase-checklist]
golden: true
phase: 0
created_at: 2026-07-03
---

# Definition of Done — Creative Research Workbench

## Nguyên tắc chung
Một task được coi là **Done** khi:
- [ ] Code được review (hoặc self-review có checklist)
- [ ] Tests pass (unit + integration liên quan)
- [ ] Không có linting error
- [ ] Tài liệu liên quan được cập nhật
- [ ] PR được merge vào `develop`

## Phase 0 — Discovery ✅
- [x] 21 file markdown được kiểm kê
- [x] Taxonomy gắn nhãn hoàn tất
- [x] 10 golden documents được chọn với lý do rõ ràng
- [x] `knowledge-inventory.md` committed
- [x] YAML frontmatter trên 10 golden docs

## Phase 1 — Domain & Spec
- [ ] DOMAIN_SCHEMA.md được khóa (không thay đổi entity name)
- [ ] API_CONTRACTS.md được khóa (endpoint + payload shape)
- [ ] GHERKIN scenarios cover 5 user flows chính
- [ ] FAILING_INTEGRATION_TEST_SPEC có >= 5 tests

## Phase 2 — Ingestion & Retrieval
- [ ] IngestionService parse đúng frontmatter của 10 golden docs
- [ ] Chunk theo heading boundary (h2/h3)
- [ ] pgvector index tạo thành công
- [ ] `/search` trả về kết quả trong < 200ms
- [ ] Recall@5 >= 0.75 trên golden set
- [ ] Mọi result có `excerpt` + `source_file`

## Phase 3 — Problem Structuring
- [ ] ProblemFrame Pydantic model validate đúng
- [ ] `completeness_score` > 0.6 cho 3 sample problems
- [ ] ContradictionExtractor có unit tests pass
- [ ] API endpoints có integration tests pass

## Phase 4 — Reasoning Workflow
- [ ] WorkflowEngine chuyển stage không mất data
- [ ] MethodRecommender trả về >= 3 suggestions có citation
- [ ] Prompt templates có version control
- [ ] LLM output có `provenance` field

## Phase 5 — UI Workspace
- [ ] Session List render đúng trên mobile + desktop
- [ ] Workspace Canvas hiển thị đúng module theo stage
- [ ] Evidence Panel cập nhật realtime khi search
- [ ] Không có console error trên Chrome + Safari
- [ ] Usability: tạo ProblemFrame trong < 10 phút
