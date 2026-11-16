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

---

## Phase 6 — AI Core & Real Embedding Engine
**Goal:** Tích hợp mô hình nhúng thực tế và chuẩn hóa vector 1536 chiều
> *Ghi chú đối soát (Batch C20-C21): Hoàn thành tích hợp Ollama / OpenAI embedding client với padding chuẩn 1536 dim, benchmark ngữ nghĩa xác định, và đồng bộ chỉ báo trạng thái trên UI.*

- [x] Tích hợp `EmbeddingClient` thực tế (Ollama / OpenAI / Deterministic Semantic Client; verified: `test_real_embedding_integration.py`, `test_embedding_clients.py`)
- [x] Chuẩn hóa kích thước vector 1536 chiều bảo toàn cấu trúc pgvector (verified: `test_real_embedding_integration.py`)
- [x] Benchmark ngữ nghĩa xác định cho test suite (verified: `test_real_embedding_integration.py`)
- [x] UI Embedding Status Panel và TRIZ Matrix Lookup (verified: `apps/web/features/session/__tests__/embedding-status-panel.test.tsx`, `triz-matrix-lookup.test.tsx`)

**Acceptance Gate:** Phase 6 Acceptance Gate PASS 100% ✅ (`test_real_embedding_integration.py`, 505/505 backend tests passed).

---

## Phase 7 — Research Canvas & Candidate Solutions
**Goal:** Quản lý không gian giải pháp ứng viên (Candidate Solutions) và liên kết nguồn gốc ghi chép
> *Ghi chú đối soát: Đã hoàn thiện qua các batch nền tảng với đầy đủ FSM lifecycle, lưu trữ Candidate Solutions, đánh giá điểm Novelty/Feasibility, và Note Source Context.*

- [x] Quản lý Candidate Solutions (`CandidateSolution` model, API CRUD; verified: `test_candidate_solutions_api.py`)
- [x] Đánh giá Novelty/Feasibility và trạng thái giải pháp (candidate/accepted/rejected; verified: `test_candidate_solutions_api.py`)
- [x] Lưu trữ liên kết ngữ cảnh nguồn gốc ghi chép (Note Source Context; verified: `test_note_source_context_api.py`, `test_note_source_context_schema.py`)
- [x] Giao diện Canvas và Sổ tay nghiên cứu (verified: `apps/web/features/ideation/__tests__/candidate-solutions.test.tsx`, `research-notebook.test.tsx`)

**Acceptance Gate:** Phase 7 Acceptance Gate PASS 100% ✅ (`test_candidate_solutions_api.py`, `test_note_source_context_api.py`).

---

## Phase 8 — Knowledge Base Management
**Goal:** Quản lý vòng đời tài liệu tri thức (CRUD Documents & Chunks)
> *Ghi chú đối soát (Batch C22): Hoàn thành bộ REST API CRUD Knowledge Base với ADR-002, re-chunking/re-embedding nguyên tử, và bảo vệ kép Golden Documents.*

- [x] ADR-002 Kiến trúc Quản lý và Thực thi Cơ sở Tri thức (`docs/ADR-002-knowledge-base-execution.md`)
- [x] API List & Detail Documents (`GET /api/v1/documents`, `GET /api/v1/documents/{id}`; verified: `test_documents_api.py`)
- [x] API Upload Document Markdown/Text (`POST /api/v1/documents/upload`; verified: `test_documents_api.py`, `test_knowledge_base_execution.py`)
- [x] API Update Document với re-chunking và re-embedding nguyên tử (`PUT /api/v1/documents/{id}`; verified: `test_knowledge_base_execution.py`)
- [x] API Delete Document có cascade chunks và bảo vệ cứng Golden Documents (`DELETE /api/v1/documents/{id}`; verified: `test_documents_api.py`, `test_knowledge_base_execution.py`)

**Acceptance Gate:** Phase 8 Acceptance Gate PASS 100% ✅ (`test_knowledge_base_execution.py` 5/5 passed, 510/510 backend tests passed).

---

## Phase 9 — Export & Synthesis
**Goal:** Biến kết quả nghiên cứu thành artifact có thể chia sẻ (Markdown / JSON Snapshot / Safe PDF Print & AI Synthesis)
> *Ghi chú đối soát (Batch C23): Phase 9 đã được hiện thực hóa phần lớn qua các batch nền tảng trước (`session_export_service.py`, `session_import_service.py`, `ai_report_service.py`, `sessions.py`, `session-detail.tsx`, `session-list.tsx`). Batch C23 bổ sung `test_phase9_acceptance_gate.py` xác nhận toàn diện 4 kịch bản Gherkin cốt lõi và đo lường latency < 2s.*

- [x] 9.1 Xuất phiên nghiên cứu ra định dạng Markdown chuẩn TRIZ tích hợp Candidate Solutions (`GET /api/v1/sessions/{id}/export?format=md|markdown`; verified: `test_session_export_api.py`, `test_phase9a_export_synthesis.py`, `test_phase9_acceptance_gate.py`)
- [x] 9.1 Xuất snapshot JSON đầy đủ cấu trúc phiên để sao lưu (`GET /api/v1/sessions/{id}/export?format=json`; verified: `test_phase9a_export_synthesis.py`, `test_phase9_acceptance_gate.py`)
- [x] 9.1 Chiến lược xuất PDF an toàn qua client-side printing `@media print` theo ADR-006 (Zero dependency blast radius; verified: `test_session_export_api.py`, `apps/web/features/session/__tests__/session-detail.test.tsx`)
- [x] 9.2 Bộ tạo báo cáo nghiên cứu AI Synthesis preview-only không ghi đè DB (`POST /api/v1/sessions/{id}/ai/generate-report`; verified: `test_phase9a_export_synthesis.py`)
- [x] 9.3 Nhập phiên từ snapshot JSON và khởi tạo từ Domain Templates (`POST /api/v1/sessions/import`, `POST /api/v1/sessions/from-template`, `GET /api/v1/sessions/templates`; verified: `test_phase9_3_import_templates.py`, `test_phase9_acceptance_gate.py`)
- [x] 9.4 Giao diện Export Dropdown Picker và Tab Synthesis trên Frontend (verified: `apps/web/features/session/__tests__/session-detail.test.tsx`, `session-list.test.tsx`)

**Acceptance Gate:** Phase 9 Acceptance Gate PASS 100% ✅ (Chứng minh qua `test_phase9_acceptance_gate.py` 4/4 passed, `test_session_export_api.py` 6/6 passed, `test_phase9a_export_synthesis.py` 6/6 passed, `test_phase9_3_import_templates.py` 12/12 passed; latency export < 2s, content integrity 100%).

---

## Phase 10 — Advanced Search & Discovery
**Goal:** Nâng cao năng lực tìm kiếm ngữ nghĩa và phát hiện tri thức liên phiên

- [x] 10.1 Tự động ánh xạ 39 thông số Altshuller song ngữ (verified: `test_triz_full_matrix.py`, `test_business_auto_map_api.py`)
- [x] 10.2 Cross-Session Knowledge Discovery tìm bài toán tương đồng (verified: `test_cross_session_search_api.py`, `apps/web/features/session/__tests__/cross-session-discovery-frontend.test.tsx`)
- [x] 10.3 Semantic KB Explorer & Search Facets Aggregation (verified: `test_search_api.py`, `apps/web/features/search/__tests__/search-backend-facets-aggregate-counts.test.tsx`)

**Acceptance Gate:** Phase 10 Acceptance Gate PASS 100% ✅ (`test_cross_session_search_api.py`, `test_search_api.py`).

---

## Phase 11 — Analytics & Research Intelligence
**Goal:** Dashboard phân tích trực quan toàn bộ hệ thống tri thức và bài toán

- [ ] 11.1 Analytics Overview Aggregation Service & API (`GET /api/v1/analytics/overview`)
- [ ] 11.2 Frontend Analytics Dashboard & Contextual Deep Links
- [ ] 11.3 Actionable Empty-State Guidance & Quality Indicators
- [ ] 11.4 Accessibility, Semantic Landmarks & Interactive Refresh Feedback

**Acceptance Gate:** Trạng thái chưa hoàn tất (đang triển khai theo kế hoạch tiếp theo).

---

## Phase 12 — Quality & Performance Hardening
**Goal:** Đảm bảo độ tin cậy và hiệu năng cấp production

- [ ] 12.1 IVFFlat Index cho pgvector khi dataset đạt ngưỡng quy mô
- [ ] 12.2 Async Background Processing cho các tác vụ nặng
- [ ] 12.3 Caching Layer cho Search và Analytics
- [ ] 12.4 Migration Lifecycle & Schema Freshness Hardening

**Acceptance Gate:** Trạng thái chưa hoàn tất (đang chờ kích hoạt sau Phase 11).
