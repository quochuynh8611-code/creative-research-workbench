---
title: "IMPLEMENTATION ROADMAP — Creative Research Workbench"
topic: roadmap
source_type: planning
language: vi
tags: [sprint, phase, checklist, milestone, mvp]
golden: true
phase: 0
created_at: 2026-07-03
---

# IMPLEMENTATION ROADMAP — Creative Research Workbench

## Goal
Xây dựng MVP theo từng phase có Definition of Done rõ ràng. Mỗi phase độc lập và có thể test được.

## Phase 0 — Discovery
- [x] Kiểm kê và gắn nhãn toàn bộ kho markdown
- [x] Chuẩn hóa taxonomy: contradiction, function, evolution, business, case-study, learning
- [x] Chọn 10 tài liệu vàng làm benchmark retrieval
- [x] Tạo `docs/knowledge-inventory.md`
- [x] Thêm YAML frontmatter vào 10 golden documents

## Phase 1 — Domain & Spec
- [ ] Khóa DOMAIN_SCHEMA.md (entity + field)
- [ ] Khóa API_CONTRACTS.md (endpoint + payload)
- [ ] Viết GHERKIN scenarios cho các user flow chính
- [ ] Viết FAILING_INTEGRATION_TEST_SPEC
- [ ] Định nghĩa Definition of Done cho mỗi phase

## Phase 2 — Ingestion & Retrieval
- [ ] Viết IngestionService: đọc markdown → parse frontmatter → chunk theo heading
- [ ] Tạo PostgreSQL schema với pgvector
- [ ] Tạo vector embeddings (OpenAI hoặc Ollama)
- [ ] Viết RetrievalService: hybrid search (full-text + vector)
- [ ] Expose endpoint POST /api/v1/search
- [ ] Benchmark offline: Recall@5 >= 0.75 trên golden set

## Phase 3 — Problem Structuring
- [ ] Implement ProblemFrame Pydantic model
- [ ] Viết ProblemStructuringService
- [ ] Implement ContradictionExtractor
- [ ] Implement CauseEffectBuilder
- [ ] API endpoints: POST/GET /problem-frames

## Phase 4 — Reasoning Workflow
- [ ] Thiết kế WorkflowEngine state machine
- [ ] Viết MethodRecommender
- [ ] Viết IdeaStudio
- [ ] Viết EvaluationMatrix
- [ ] API: POST /sessions/{id}/advance

## Phase 5 — UI Workspace
- [ ] Screen: Session List
- [ ] Screen: Session Workspace (sidebar + canvas + evidence panel)
- [ ] Stage modules: Intake, Structuring, Retrieval, Methods, Ideation, Evaluation
- [ ] Integration với backend API
