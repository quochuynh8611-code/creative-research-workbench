---
title: "IMPLEMENTATION ROADMAP CHECKLIST — Creative Research Workbench"
topic: "roadmap"
source_type: "plan"
language: "vi"
tags: ["sprint", "phase", "checklist", "milestone", "priority"]
phase: "1"
status: "canonical"
golden: true
created: "2026-07-03"
---

# IMPLEMENTATION ROADMAP CHECKLIST

> Thứ tự ưu tiên theo phase. Mỗi phase có acceptance gate — phải pass mới được tiếp tục.

---

## Phase 0 — Discovery & Knowledge Inventory
**Goal:** Kiểm kê và chuẩn hóa toàn bộ kho tài liệu

- [x] Kiểm kê 21 file markdown trong vault Sang-Tao
- [x] Phân loại canonical (10) vs draft (11)
- [x] Xác định 10 Golden Documents
- [x] Gắn YAML frontmatter vào 10 Golden Docs
- [x] Cập nhật knowledge-inventory.md

**Acceptance Gate:** `knowledge-inventory.md` hoàn chỉnh, 10 golden docs có frontmatter ✅

---

## Phase 1 — Domain & Spec
**Goal:** Toàn bộ tài liệu đặc tả sẵn sàng

- [x] ADR-001 kiến trúc
- [x] DOMAIN_SCHEMA.md
- [x] API_CONTRACTS.md
- [x] PRODUCT_SPEC.md
- [x] GHERKIN_SCENARIOS.md
- [x] FAILING_INTEGRATION_TEST_SPEC.md
- [x] TEST_PLAN.md
- [x] UI_MODULE_BREAKDOWN.md
- [x] Definition of Done

**Acceptance Gate:** Tất cả spec docs đã có, reviewed ✅

---

## Phase 2 — Ingestion & Retrieval Pipeline
**Goal:** Parse markdown → chunk → embed → store → search

- [ ] Setup Alembic migrations (Document, Chunk, Embedding tables)
- [ ] `ingestion_service.py` — parse frontmatter + chunk markdown
- [ ] Embedding integration (OpenAI hoặc Ollama)
- [ ] `retrieval_service.py` — hybrid FTS + vector search
- [ ] `POST /api/v1/search` endpoint
- [ ] Integration test: ingest 10 golden docs, search trả về đúng

**Acceptance Gate:**
- Full-text search < 200ms
- Vector Recall@5 >= 0.75 trên golden set
- Mọi kết quả có `excerpt` + `source_ref`

---

## Phase 3 — Problem Structuring
**Goal:** Nhận problem statement → normalize → extract contradiction

- [ ] `ProblemStructuringService` — rewrite + normalize
- [ ] `ContradictionExtractor` — technical + physical
- [ ] `CauseEffectBuilder` — 5-Why / Fishbone
- [ ] `POST /api/v1/sessions/{id}/problem-frame` endpoint

**Acceptance Gate:** Gherkin scenarios Phase 3 pass 100%

---

## Phase 4 — Reasoning Workflow
**Goal:** WorkflowEngine dẫn dắt user qua TRIZ steps

- [ ] `WorkflowEngine` — finite state machine
- [ ] `MethodRecommender` — gợi ý inventive principles
- [ ] TRIZ contradiction matrix tích hợp
- [ ] `POST /api/v1/sessions/{id}/next-step` endpoint

**Acceptance Gate:** E2E flow từ problem → principles hoạt động

---

## Phase 5 — UI Workspace
**Goal:** Frontend MVP hoàn chỉnh

- [ ] Session List screen
- [ ] Problem Canvas screen
- [ ] Evidence Panel component
- [ ] Search interface
- [ ] Session state persistence

**Acceptance Gate:** User test: tạo session → nhập problem → xem principles
