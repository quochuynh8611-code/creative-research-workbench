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
> *Ghi chú đối soát (Batch C19): Phase 2 đã được hiện thực hóa qua các batch nền tảng trước (`001_baseline_schema.py`, `003_add_vector_cosine_index.py`, `ingestion_service.py`, `embedding_client.py`, `retrieval_service.py`, `search.py`). Batch C19 bổ sung `test_phase2_acceptance_gate.py` và hardening `FrontmatterValidationError`.*

- [x] Setup Alembic migrations (`documents`, `chunks` với cột `embedding Vector(1536)` + cosine index; verified: `test_alembic_migrations.py`, `test_phase2_acceptance_gate.py`)
- [x] `ingestion_service.py` — parse frontmatter + chunk markdown + `FrontmatterValidationError` (verified: `test_ingestion.py`, `test_phase2_acceptance_gate.py`)
- [x] Embedding integration (`embedding_client.py` OpenAI + degraded/mock fallback; verified: `test_embedding_clients.py`, `test_real_embedding_integration.py`)
- [x] `retrieval_service.py` — hybrid FTS + vector search (verified: `test_retrieval.py`)
- [x] `POST /api/v1/search` endpoint (verified: `test_search_api.py` — 11/11 passed)
- [x] Integration test: ingest 10 golden docs, search trả về đúng + idempotent re-ingest (verified: `test_phase2_acceptance_gate.py`, `test_retrieval.py`)

**Acceptance Gate:** ✅ (496/496 backend tests passed; lưu ý Recall@5 >= 0.75 trên golden corpus dùng mock/real embedding client theo `test_retrieval.py` & `test_real_embedding_integration.py`)
- [x] Full-text & hybrid search trả kết quả chuẩn (verified: `test_retrieval.py`, `test_search_api.py`)
- [x] Vector Recall@5 >= 0.75 trên golden set (verified trên golden fixture / `test_retrieval.py`)
- [x] Mọi kết quả có `excerpt` + `source_ref` (verified: `test_retrieval.py`, `test_search_api.py`)

---

## Phase 3 — Problem Structuring
**Goal:** Nhận problem statement → normalize → extract contradiction

- [x] `ProblemStructuringService` — rewrite + normalize (`backend/src/app/services/problem_structuring_service.py`; verified: `test_problem_structuring.py`)
- [x] `ContradictionExtractor` — technical + physical (verified: `test_p1_02_explicit_contradiction_contract.py`)
- [x] `CauseEffectBuilder` — 5-Why / Fishbone (verified: `test_problem_structuring.py`, `test_p1_02_template_contradiction.py`)
- [x] `POST /api/v1/sessions/{id}/problem-frame` endpoint (verified: `test_problem_structuring.py`)

**Acceptance Gate:** Gherkin scenarios Phase 3 pass 100% ✅ (`test_problem_structuring.py`, `test_p1_02_explicit_contradiction_contract.py`)

---

## Phase 4 — Reasoning Workflow
**Goal:** WorkflowEngine dẫn dắt user qua TRIZ steps

- [x] `WorkflowEngine` — finite state machine (`backend/src/app/services/workflow_engine.py`; verified: `test_workflow_engine.py`, `test_p1_01_fsm_persistence.py`)
- [x] `MethodRecommender` — gợi ý inventive principles (`backend/src/app/services/method_recommender.py`; verified: `test_recommendations_api.py`, `test_method_recommender_method_id.py`)
- [x] TRIZ contradiction matrix tích hợp (verified: `test_triz_full_matrix.py`, `test_triz_catalog_api.py`)
- [x] `POST /api/v1/sessions/{id}/next-step` endpoint (verified: `test_next_step_api.py`)

**Acceptance Gate:** E2E flow từ problem → principles hoạt động ✅ (`test_workflow_engine.py`, `test_next_step_api.py`, `test_recommendations_api.py`)

---

## Phase 5 — UI Workspace
**Goal:** Frontend MVP hoàn chỉnh

- [x] Session List screen (`apps/web/features/session/__tests__/session-list.test.tsx`)
- [x] Problem Canvas screen (`apps/web/features/structuring/__tests__/normalized-view.test.tsx`)
- [x] Evidence Panel component (`apps/web/features/retrieval/__tests__/evidence-panel.test.tsx`)
- [x] Search interface (`apps/web/features/search/__tests__/semantic-search-explorer.test.tsx` + C14–C18 suites)
- [x] Session state persistence (`apps/web/features/session/__tests__/session-detail.test.tsx`, `workflow-stepper.test.tsx`)

**Acceptance Gate:** User test: tạo session → nhập problem → xem principles ✅ (60/60 web suites, 748/748 tests passed)
