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
> *Ghi chú đối soát (Batch C24): Phase 11 đã được hiện thực hóa đầy đủ qua các batch nền tảng trước (`analytics_service.py`, `analytics.py`, `analytics-dashboard.tsx`). Batch C24 xác nhận 4/4 backend integration tests và 27/27 frontend tests PASS, type-check 0 lỗi; schema production là `{ data, generated_at }`.*

- [x] 11.1 Analytics Overview Aggregation Service & API (`GET /api/v1/analytics/overview`; verified: `test_analytics_overview_api.py` 4/4 passed)
- [x] 11.2 Frontend Analytics Dashboard & Contextual Deep Links (verified: `analytics-dashboard.test.tsx` 27/27 passed)
- [x] 11.3 Actionable Empty-State Guidance & Quality Indicators (verified: `analytics-dashboard.test.tsx`)
- [x] 11.4 Accessibility, Semantic Landmarks & Interactive Refresh Feedback (verified: `analytics-dashboard.test.tsx`)

**Acceptance Gate:** Phase 11 Acceptance Gate PASS 100% ✅ (4/4 backend tests, 27/27 frontend tests, type-check 0 lỗi).

---

## Phase 12 — Quality & Performance Hardening
**Goal:** Đảm bảo độ tin cậy và hiệu năng cấp production
> *Ghi chú đối soát (Batch C25-C28): Phase 12.1 đã hoàn thành qua migration `003_add_vector_cosine_index.py`. Phase 12.2 và 12.4 đã được hiện thực hóa qua migration `004_create_background_jobs_table.py`, BackgroundJob model, JobService, async upload, entrypoint runner wiring và runtime verification. Batch C28 hoàn tất 12.3: In-process LRU+TTL Caching Layer (`InMemoryTTLCache`) cho Search và Analytics với zero new dependencies, fail-safe degradation và mutation invalidation. Toàn bộ Phase 12 đã hoàn thành 100%.*

- [x] 12.1 IVFFlat Index cho pgvector khi dataset đạt ngưỡng quy mô (verified: migration 003_add_vector_cosine_index.py, test_alembic_migrations.py 3/3 scenarios PASS qua CI)
- [x] 12.2 Async Background Processing cho các tác vụ nặng (verified: migration 004, BackgroundJob model, JobService, POST /upload?async=true trả về 202, GET /jobs/{id}, test_background_job_service.py 5/5 passed, integration tests PASS qua CI)
- [x] 12.3 Caching Layer cho Search và Analytics (verified: `InMemoryTTLCache`, search SHA256 deterministic key, analytics TTL 60s + `refresh` param, mutation invalidation trên documents và sessions, fail-safe degradation, `test_caching_layer.py` 6/6 passed, `test_caching_api.py` 5/5 passed)
- [x] 12.4 Migration Lifecycle & Schema Freshness Hardening (Phase 12.1A + 12.1C; verified: ADR-002, ADR-003, entrypoint.sh startup runner, test_migration_artifact_freshness.py, test_runtime_verification.py, CI image checks)

**Acceptance Gate:** Phase 12 Acceptance Gate PASS 100% ✅ (12.1, 12.2, 12.3, 12.4 hoàn tất đầy đủ và được kiểm chứng qua CI/CD).

---

## Phase 13 — Batch C30: Productization & AI Configuration
**Goal:** Chuẩn bị CRW sẵn sàng sử dụng thực tế (Productization): AI provider an toàn (OpenAI/Ollama/Mock fallback), Onboarding UX 6 bước TRIZ, Confirmation Modals chống mất mát dữ liệu, và Standard Operating Runbook.

- [x] **PR 1: Backend AI Safety & Status API** (Branch: `feat/c30-backend-ai-safety`, PR #63 merged vào `main` tại `0116765056993e738cb955ec1e1d233db2e03dc5`; verified: `GET /api/v1/system/ai-status` bảo mật, Ollama client, global exception shield, 518/518 backend tests PASS).
- [x] **PR 2: Frontend UX, Onboarding Banner & Confirmation Dialogs** (Branch: `feat/c30-frontend-onboarding-ux`, PR #64 merged vào `main` tại `7811be584d197335a6f3266f1be07a0042758f02`; verified: `AIStatusBadge` kết nối `/ai-status`, `OnboardingWorkflowBanner` 6 bước TRIZ với quy tắc template fallback logistics -> nutrition -> error, `ConfirmationModal` trước khi xóa Solution và Note, 66/66 web suites, 767/767 tests PASS).
- [x] **PR 3: Docs & Operations Runbook** (Branch: `docs/c30-deployment-runbook`, PR #65 merged vào `main` tại `575221847b2b32d4f563dbc86a22f53688132776`; verified: chuẩn hóa `.env.example`, nâng cấp `docs/DEPLOYMENT_GUIDE.md` thành Standard Operating Runbook toàn diện với backup SHA-256 / restore / rollback / smoke test, rà soát Docker plan & gap docs).

**Acceptance Gate:** Batch C30 Acceptance Gate PASS 100% ✅ (PR #63, PR #64, PR #65 đã merge và 3/3 checks CI trên `main` PASS).

---

## Phase 14 — Batch C31: AI Solution Coach
**Goal:** Mở rộng AI Solution Coach thành trợ lý phân tích và gợi ý giải pháp theo ngữ cảnh TRIZ: gợi ý có căn cứ cứng (Hard Grounding), giới hạn tối đa 5 suggestions, fallback Rule-Based Heuristic xác định khi LLM offline/lỗi, và giao diện phê duyệt Human-in-the-Loop với ConfirmationModal.

- [x] **PR 1: Backend AI Coach & Heuristic Fallback API** (Branch: `feat/c31-backend-ai-coach`, PR #66 merged vào `main` tại `3bcf44fbe740d7fa7f3eae4eed34a4c6cc53d415`; verified: `AICoachService`, `RuleBasedCoach`, `generate_coach_suggestions` trên Mock/OpenAI/Ollama, `POST /api/v1/sessions/{id}/coach/suggestions`, hard grounding filter, cap 5, zero db mutation, 11/11 new tests, 180 unit tests PASS).
- [x] **PR 2: Frontend AI Coach Panel & Confirmation Dialogs** (Branch: `feat/c31-frontend-ai-coach-panel`, PR #67 merged vào `main` tại `a0458f27c6d3317125ce6cd383deee8d15fc0061`; verified: `AICoachPanel` 5 states, contract validation, cap 5 displayed với thông báo ưu tiên, chỉ solution_candidate có nút Lưu thành Giải pháp, confirmation modal trước khi lưu Solution/Note, dismiss local-only, 13/13 web tests PASS).
- [x] **PR 3: Docs, Runbook Smoke Test & Roadmap Finalization** (Branch: `docs/c31-ai-coach-runbook`, PR #68 merged vào `main` tại `045e8a1753d9c07e5ae205121bd6ffaf52c129be`; verified: bổ sung smoke test AI Coach an toàn, không tạo dữ liệu rác, xử lý grep an toàn, cập nhật roadmap Batch C31 và ADR-012).

**Acceptance Gate:** Batch C31 Acceptance Gate PASS 100% ✅ (PR #66, PR #67, PR #68 đã merge và 3/3 checks CI trên `main` PASS).

---

## Phase 15 — Batch C32: Operational Excellence & Observability
**Goal:** Nâng cao độ tin cậy vận hành, khả năng tự quan sát (Observability), đo kiểm hiệu năng định lượng (Benchmarking) và chuẩn hóa runbook vận hành cho Creative Research Workbench mà không làm nặng hạ tầng.

- [x] **PR 1: Backend Observability, Structured Logging, Correlation ID & In-Memory Metrics** (Branch: `feat/c32-backend-observability`, PR #69 merged vào `main` tại `c1ed300087e803562b80b2b2c4326e8c3e23de33`; verified: `StructuredJsonFormatter`, contextvars correlation ID middleware, `InMemoryMetricsCollector` cho 4 endpoint ưu tiên, bộ theo dõi AI Coach fallback, endpoint nội bộ `GET /api/v1/system/metrics`, masking secret đa tầng, 14/14 new tests, 203/203 unit tests PASS).
- [x] **PR 2: Benchmark Suite & Local Load Testing** (Branch: `feat/c32-benchmark-suite`, PR #70 merged vào `main` tại `26f5f9e84bee8531a8b251d17152ed5739668551`; verified: script bất đồng bộ `backend/scripts/benchmark.py`, concurrency $\le 10$, requests $\le 100$, Anti-Production Guard chặn domain production/staging, informational SLO baselines, output table/JSON bảo mật tuyệt đối, 15/15 unit tests PASS).
- [x] **PR 3: Runbook Update & Operational Documentation** (Branch: `docs/c32-operational-runbook`, PR #71 merged vào `main` tại `e976f297075ba47feeca272009a91d3434aeb2de`; verified: bổ sung mục 13 Operational Runbook và mục 11.F/G/H Troubleshooting trong `docs/DEPLOYMENT_GUIDE.md`, cập nhật tiến độ Batch C32 trong `docs/IMPLEMENTATION_ROADMAP.md`, chuyển `docs/ADR-013-operational-excellence.md` sang Accepted).

**Acceptance Gate:** Batch C32 Acceptance Gate PASS 100% ✅ (PR #69, PR #70, PR #71 đã merge và 3/3 checks CI trên `main` PASS).

---

## Phase 16 — Batch C33: Productization & Onboarding
**Goal:** Hoàn thiện trải nghiệm người dùng mới và khả năng trình diễn sản phẩm (Demo) chuyên nghiệp cho stakeholder: Welcome Onboarding Modal 3 bước linh hoạt (1-click dismiss), Sample Data Seeder bất đồng bộ với Anti-Production Guard và tính lũy đẳng đa tầng, cùng Kịch bản Demo 5 phút chuẩn mực.

- [x] **PR 1: Welcome Onboarding Modal & Quick-Start Flow** (Branch: `feat/c33-productization-onboarding`, PR #72 merged vào `main` tại `75f2e990bde01c6dcd38fcfbcb7d8d73c5b43a25`; verified: component `WelcomeOnboardingModal` 3 bước TRIZ, 1-click skip ghi nhận `localStorage`, nút header "Hướng dẫn nhanh" replay tour, quick-start từ domain template, 6/6 frontend unit tests PASS, 786/786 web tests PASS, 203/203 backend unit tests PASS).
- [x] **PR 2: Demo Data Seeder & Stakeholder Demo Script** (Branch: `feat/c33-demo-seeder`, PR #73 merged vào `main` tại `3698172004d0b8d94974637bab35b9ac28cce8f3`; verified: script `backend/scripts/seed_demo_data.py` nạp đúng 2 demo sessions với 1 problem frame, $\le 2$ notes, $\le 2$ solutions, Anti-Production Guard chặn URL ngoài/production, multi-criteria idempotency kiểm tra cả tiền tố `[DEMO]` và title chính xác, output table/JSON bảo mật zero secret leak, `docs/DEMO_SCRIPT.md` kịch bản demo 5 phút, 13/13 unit tests PASS, 216/216 backend unit tests PASS).
- [x] **PR 3: Productization Finalization, Deployment Guide & Roadmap** (Branch: `docs/c33-productization-runbook`; verified: bổ sung mục 14 Productization Runbook và mục 11.I/J Troubleshooting trong `docs/DEPLOYMENT_GUIDE.md`, cập nhật `docs/IMPLEMENTATION_ROADMAP.md` đóng hoàn tất Batch C33, chuyển `docs/ADR-014-productization-onboarding.md` sang Accepted).

**Acceptance Gate:** Batch C33 Acceptance Gate PASS 100% ✅ (PR #72, PR #73 đã merge, PR #74 hoàn tất và 3/3 checks CI trên `main` PASS).

---

## Phase 17 — Batch C34: TRIZ Toolkit Advanced
**Goal:** Nâng cao chiều sâu phương pháp luận TRIZ trong sản phẩm: Thuật giải ARIZ 6 bước rút gọn, 8 Quy luật Tiến hóa Kỹ thuật Altshuller kinh điển (TESE) và Ma trận Phân tích 5 nhóm Tài nguyên (Resource Taxonomy) với zero database schema mutation và bảo toàn nhận thức.

- [x] **PR 1: Backend Static Data, Read-Only Endpoints & Context Schema Validation** (Branch: `feat/c34-triz-toolkit-advanced`, PR #75 merged vào `main` tại `1f031a0b78f32044960009d8ba39704544744333`; verified: 3 tệp JSON tĩnh, 3 endpoints read-only, Pydantic discriminated union `TrizArizContext`, `TrizEvolutionContext`, `TrizResourceContext`, 7/7 new tests, 223/223 backend unit tests PASS).
- [x] **PR 2: Frontend Advanced TRIZ Components & Session Integration** (Branch: `feat/c34-frontend-triz-advanced`, PR #76 merged vào `main` tại `42e6ed0d5998be31069251f74c1e08ba1ed2ff20`; verified: `ArizStepperPanel` 6 bước trong tab Structuring, `EvolutionPatternsExplorer` 8 quy luật và `ResourceAnalysisPanel` 5 tabs trong tab Ideation, runtime context validators, 14/14 new frontend tests, 800/800 web tests PASS, CI 3/3 checks PASS).
- [x] **PR 3: Productization Runbook, Documentation & Batch C34 Finalization** (Branch: `docs/c34-triz-advanced-runbook`, PR #77 merged vào `main` tại `292eb7e8ef7efb796908c41db17a538ad87d2e93`; verified: bổ sung mục 15 TRIZ Advanced Runbook trong `docs/DEPLOYMENT_GUIDE.md`, cập nhật `docs/IMPLEMENTATION_ROADMAP.md` đóng hoàn tất Batch C34, chuyển `docs/ADR-015-triz-toolkit-advanced.md` sang Accepted).

**Acceptance Gate:** Batch C34 Acceptance Gate PASS 100% ✅ (PR #75, PR #76, PR #77 đã merge và 3/3 checks CI trên `main` PASS. Batch C34 đóng hoàn tất).

---

## Phase 18 — Batch C35: Domain, Lens & Workflow Expansion
**Goal:** Mở rộng phạm vi ứng dụng của Creative Research Workbench sang các lĩnh vực liên ngành: 3 domain mới (Healthcare, Education, Sustainability), 3 lăng kính TRIZ 9-Windows mới (Systems Thinking, Design Thinking, Lean Startup), và 3 Workflow Profiles (Standard TRIZ, Rapid Prototyping, Stakeholder Alignment) với zero database schema mutation và bảo toàn nhận thức.

- [x] **PR 1: Backend Domain Templates, 9-Windows Multi-Lens & Workflow Profiles** (Branch: `feat/c35-domain-lens-workflow-expansion`, PR #78 merged vào `main` tại `15c7a960df768f5c3dafc9259163273e3bf9bcf5`; verified: 6 domain templates mới cho healthcare/education/sustainability, 3 lăng kính 9-windows mới trong `triz_nine_windows.json`, catalog 3 workflow profiles, route `GET /api/v1/sessions/workflow-profiles`, 11/11 expansion tests, 229/229 backend unit tests PASS).
- [x] **PR 2: Frontend Multi-Lens Tabs, Domain Resolver & Workflow Guidance** (Branch: `feat/c35-frontend-multi-lens`, PR #79 merged vào `main` tại `515591b76d7915e801187f5dd0ca6effc696cd09`; verified: segmented controls 6 tabs với horizontal scroll trên mobile, dynamic domain-to-lens resolver cho 3 domain mới, component `WorkflowProfileGuidance` 3 profiles tích hợp vào `SessionDetail`, client API read-only contract, 11/11 new tests, 811/811 web tests PASS).
- [x] **PR 3: Backend Integration & E2E Workflow Validation** (Branch: `feat/c35-integration-e2e-validation`, PR #80 merged vào `main` tại `a167eb2568fdebd68cc6fcd2efee2f54001fc97a`; verified: 5 backend integration tests `test_c35_e2e_workflow_integration.py` không dùng Testcontainers, 4 frontend integration tests `c35-workflow-lens-integration.test.tsx` mock ở network/client layer, 239/239 backend tests PASS, 815/815 web tests PASS, CI run 44450784524 trên `main` 3/3 PASS).

**Acceptance Gate:** Batch C35 Acceptance Gate PASS 100% ✅ (PR #78, PR #79, PR #80 đã merge và 3/3 checks CI trên `main` PASS. Batch C35 đóng hoàn tất).

---

## Phase 19 — Batch C36: Research Synthesis, Provenance & Export Completeness
**Goal:** Hoàn thiện 100% tính truy nguyên (Provenance), làm giàu siêu dữ liệu xuất bản Markdown và JSON snapshot (domain, tags, và 4 nguồn tri thức mới: ARIZ, Evolution, Resource, AI Coach), tối ưu hóa trải nghiệm lựa chọn domain và lưu trữ bền vững Workflow Profile trên frontend, đồng thời kiểm chứng tính toàn vẹn khép kín E2E Export Roundtrip với zero database schema mutation.

- [x] **PR 1: Backend Provenance & Export Serialization Enrichment** (Branch: `feat/c36-backend-export-provenance`, PR #81 merged vào `main` tại `51b64ad8383a8f5c9281a6c4217da7dcfe1fe686`; verified: `session.domain` và `tags` trong JSON export, YAML frontmatter & overview trong Markdown export, định dạng 4 nguồn provenance mới có defensive inline escaping, làm giàu AI report payload, 10/10 new tests, 239/239 backend tests PASS).
- [x] **PR 2: Frontend Domain Labels & Workflow Persistence** (Branch: `feat/c36-frontend-domain-labels-workflow-persistence`, PR #82 merged vào `main` tại `e313da98dddb1faa48380ec133f7de2afaf69c60`; verified: `DOMAIN_LABELS` bổ sung tiếng Việt cho `healthcare` và `sustainability`, `DOMAIN_OPTIONS` mở rộng 3 domain mới trong form tạo & filter session, `WorkflowProfileGuidance` persistence an toàn qua `localStorage` với key versioning `v1`, 818/818 web tests PASS, CI 3/3 checks PASS).
- [x] **PR 3: E2E Export Roundtrip Verification & Documentation** (Branch: `feat/c36-e2e-export-roundtrip-docs`; verified: 5 backend integration tests trong `test_c36_export_synthesis_integration.py` bao phủ đầy đủ 4 nguồn provenance, roundtrip import không suy hao và edge case domain rỗng không crash qua Zero Testcontainers, 4 frontend integration tests trong `c36-export-roundtrip-integration.test.tsx` kiểm chứng chu trình tải xuống blob và cơ chế phục hồi lỗi, cập nhật mục 16 trong `DEPLOYMENT_GUIDE.md`, nghiệm thu `ADR-017` chuyển sang Accepted).

**Acceptance Gate:** Batch C36 Acceptance Gate PASS 100% ✅ (PR #81, PR #82 đã merge và PR #3 hoàn thành verification toàn diện. Batch C36 đóng hoàn tất).

---

## Phase 20 — Batch C37: Founder Experience Validation & UX Hardening
**Goal:** Kiểm chứng trải nghiệm Founder trên local stack, xử lý UX issue nhỏ theo test-first, và thiết lập backlog C38 mà không mở rộng tính năng.

- [x] PR 1: C37 Spec & ADR-018 (PR #84 merged)
- [x] PR 2: C37-UX-01 Export Feedback & Filename Polish
- [x] PR 2: C37-UX-02 Direct Navigation After Template Creation
- [x] PR #85 merged vào main tại 92401715a4e3b5feef15c9267e6ddedcba1f8a6c
- [x] CI merge commit 3/3 PASS (Run ID 44529526861)
- [x] Lô 1 Founder Verified
- [x] Lô 2 Founder Verified 7/7
- [x] Lô 3 Founder Verified 6/6
- [x] Error Recovery simulation DEFERRED to C38 QA Debt
- [x] Test artifacts archived safely

**Acceptance Gate:** Batch C37 COMPLETE 100% (Error Recovery simulation DEFERRED; không tính là verified).

### C38 Backlog
- C38-GAP-01: Per-note tagging — Product Gap (Lô 2: COMPLETE)
- C38-GAP-02: AI Coach editable draft form — Product Gap (Lô 4: COMPLETE)
- C38-GAP-03: Extended-lens save from 9-Windows — Product Gap (Lô 3: COMPLETE)
- C38-GAP-04: Browser network failure simulation — QA Debt (Lô 1: COMPLETE)
- C38-GAP-05: Form field accessibility improvements — Accessibility Polish (Lô 1: COMPLETE)

---

## Phase 21 — Batch C38: Founder Product Hardening
**Goal:** Hoàn thiện 5 hạng mục tinh chỉnh sản phẩm và xử lý nợ kỹ thuật theo phản hồi thực tế của Founder, thực hiện theo 4 lô nghiêm ngặt với kỷ luật Test-First, bảo toàn dữ liệu nháp và zero database schema mutation.

- [x] **Lô 1: Quality Foundation (Accessibility & Network Failure Resilience)** (PR #87 squash-merged vào `main` tại `63ad56778f3e5ca8b7890cf2c62c2f6dbe6feef3`; verified: C38-GAP-05 form field accessibility theo chuẩn WCAG 2.1 AA với `role="alert"`, `aria-required`, `aria-invalid`, `aria-describedby` và focus management; C38-GAP-04 bảo toàn dữ liệu nháp Founder khi gặp sự cố mạng `TypeError: Failed to fetch` hoặc HTTP 500; 16/16 new tests PASS; CI 3/3 PASS: `frontend-lint`, `backend-test`, `web-test`).
- [x] **Lô 2: Notebook Tagging** (PR #88 squash-merged vào `main` tại `82016dc`; verified: C38-GAP-01 per-note tagging theo kiến trúc chuẩn hóa Phương án B với 2 bảng `tags` và `note_tags`; hỗ trợ tạo note có tag, lọc note theo tag, gỡ liên kết tag `DELETE .../notes/{id}/tags/{slug}`, cập nhật danh sách tag `PUT .../notes/{id}/tags`; bảo toàn canonical tags khi gỡ hoặc xóa note; migration 007 additive kèm safe downgrade; bảo toàn draft input khi gặp sự cố mạng hoặc HTTP 500; 11/11 backend tests PASS, 6/6 frontend tagging tests PASS; full backend 642/642 PASS; full frontend 849/849 PASS; CI 3/3 PASS: `frontend-lint`, `backend-test`, `web-test`).
- [x] **Lô 3: Extended-Lens Save** (PR #89 squash-merged vào `main` tại `be403dc`; verified: C38-GAP-03 lưu insight từ 3 extended lenses `systems_thinking`, `design_thinking`, `lean_startup` vào Research Notebook; mở rộng validation Pydantic và TypeScript hỗ trợ đủ 6 lenses; bảo toàn source context và xuất khẩu Markdown; fail-closed từ chối lens không hợp lệ với HTTP 422; zero database migration với Alembic head giữ nguyên 007; 10/10 backend integration tests PASS, 11/11 frontend validator & save tests PASS; full backend 652/652 PASS; full frontend 860/860 PASS; CI 3/3 PASS: `frontend-lint`, `backend-test`, `web-test`).
- [x] **Lô 4: AI Coach Editable Draft** (PR #90 squash-merged vào `main` tại `deba237`; verified: C38-GAP-02 thay thế confirmation modal tĩnh bằng `EditableDraftModal`; cho phép Founder xem trước và chỉnh sửa tiêu đề, cơ chế, nội dung, loại ghi chú và tags trước khi lưu; bảo toàn bản nháp AI gốc; áp dụng Unsaved-Changes Guard khi form dirty; hợp đồng Append-Only Save không bao giờ ghi đè lên giải pháp, ghi chú hiện có hoặc Notebook draft; bảo toàn 100% dữ liệu nháp khi gặp sự cố mạng hoặc HTTP 500 kèm zero partial item; 10/10 AI Coach editable draft tests PASS; 13/13 AI Coach regression tests PASS; full backend 652/652 PASS; full frontend 870/870 PASS; CI 3/3 PASS: `frontend-lint`, `backend-test`, `web-test`).

**Acceptance Gate:** Batch C38 COMPLETE 100% ✅ (Đóng chính thức sau Founder close-out verification).
- 5 GAPs COMPLETE:
  - C38-GAP-01: Per-note tagging — COMPLETE (Lô 2, PR #88 → `82016dc`)
  - C38-GAP-02: AI Coach editable draft form — COMPLETE (Lô 4, PR #90 → `deba237`)
  - C38-GAP-03: Extended-lens save from 9-Windows — COMPLETE (Lô 3, PR #89 → `be403dc`)
  - C38-GAP-04: Browser network failure simulation — COMPLETE (Lô 1, PR #87 → `63ad567`)
  - C38-GAP-05: Form field accessibility improvements — COMPLETE (Lô 1, PR #87 → `63ad567`)
- 4 PRs Squash-Merged:
  - PR #87 → `63ad567` (Lô 1: Quality Foundation — Accessibility & Draft Preservation)
  - PR #88 → `82016dc` (Lô 2: Notebook Tagging)
  - PR #89 → `be403dc` (Lô 3: Extended-Lens Save from 9-Windows)
  - PR #90 → `deba237` (Lô 4: AI Coach Editable Draft Form)
- Close-Out Verification Evidence:
  - Backend: 652/652 PASS (100% GREEN)
  - Frontend: 870/870 PASS across 82 suites (100% GREEN)
  - Migration & Runtime: 24/24 integration tests PASS (100% GREEN)
  - Alembic Head: 007 (`007_create_tags_and_note_tags_tables.py`, zero migration in Lô 3 & 4)
  - Secret Scan: 0 findings (Clean)
  - Deferred items: 0

---

## Phase 22 — Batch C39: Multi-Session Export & Safe Archive (C39-FEAT-02)
**Goal:** Xây dựng tính năng xuất lưu trữ hàng loạt (Multi-Session Batch Export) ra tệp nén ZIP chứa tài liệu Markdown tổng hợp và snapshot JSON, hỗ trợ lựa chọn nhiều phiên (multi-select), lọc theo thẻ/ngày/trạng thái và tùy chọn lưu trữ an toàn (Safe Archive), tuân thủ nghiêm ngặt kỷ luật Test-First, bảo toàn dữ liệu Founder/Golden Documents và zero schema mutation.

- [x] **Lô 1: Backend Batch Export Service & Streaming API** (commit `2c69bd6`; verified: Service `SessionExportService.create_multi_session_zip_archive` tạo in-memory streaming ZIP với `manifest.json`, `markdown/`, `json/`; endpoint `POST /api/v1/sessions/batch-export` hỗ trợ cả `session_ids` và `filters`; tùy chọn `archive_after_export` cập nhật `status='archived'` an toàn; chặn quá tải với ngưỡng an toàn 100 phiên trả về HTTP 422 `X-Error-Code: EXCEED_BATCH_LIMIT`; 10/10 integration tests PASS, 12/12 unit tests PASS; full backend 665/665 PASS; Alembic head giữ nguyên 007).
- [x] **Lô 2: Frontend API Client & Accessible BatchExportModal** (commit `146d964`; verified: `api-client.ts` thêm `batchExportSessions(request)`; modal `BatchExportModal` đạt chuẩn WCAG 2.1 AA với `role="dialog"`, `aria-modal="true"`, focus trap, escape key, focus restoration, `role="alert"`; hỗ trợ 3 định dạng `markdown`, `json`, `both`; checkbox an toàn `archive_after_export`; xử lý streaming blob download trực tiếp không tạo file client tạm; 10/10 component tests PASS; full frontend 880/880 PASS; lint 0 errors, 0 warnings).
- [x] **Lô 3: Frontend Multi-Select & SessionList Integration** (commit `d144fb3`; verified: Tích hợp multi-select checkbox trên từng thẻ session card kèm `aria-label`; Master checkbox chọn/bỏ chọn tất cả phiên trên trang; FloatingBatchToolbar cố định chân trang hiển thị bộ đếm `aria-live="polite"`, nút "Xuất các phiên đã chọn" và "Bỏ chọn tất cả"; Nút "Xuất lưu trữ hàng loạt" trên header mở modal theo bộ lọc; Tự động dọn dẹp cache `['sessions']` và reset selection khi xuất thành công kèm lưu trữ; 8/8 integration tests PASS; 50/50 session tests PASS; full frontend 888/888 PASS; lint 0 errors, 0 warnings).
- [/] **Lô 4: E2E Smoke, Documentation & Close-Out** (IN PROGRESS; verified: Full backend 665/665 PASS; Full frontend 888/888 PASS; Migration & Runtime 40/40 PASS; Alembic head 007; Secret scan 0 findings; cập nhật API Contracts, Roadmap, ADR-020, Spec C39 và test spec).

**Acceptance Gate:** Batch C39 Lô 1, 2, 3 COMPLETE; Lô 4 Close-Out Verification IN PROGRESS.



