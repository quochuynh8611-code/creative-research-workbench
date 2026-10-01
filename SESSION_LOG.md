# SESSION LOG — Creative Research Workbench

> **Mục đích:** File này ghi lại tiến độ làm việc theo từng ngày.  
> Bất kỳ developer hoặc AI assistant nào đọc file này sẽ biết **đã làm gì**, **đang ở đâu**, và **việc tiếp theo là gì**.

---

## 🚦 Trạng thái tổng quan (cập nhật: 2026-09-30)

| Phase | Tên | Trạng thái | Commit cuối |
|---|---|---|---|
| **Phase 0** | Discovery — Knowledge Inventory | ✅ 100% DONE | `de18e19` |
| **Phase 1** | Domain Spec & ADR | ✅ 100% DONE | `de18e19` |
| **Phase 2** | Ingestion & Hybrid Retrieval | ✅ 100% DONE | `fc42df8` |
| **Phase 3** | Problem Structuring & TRIZ | ✅ 100% DONE | `f14432b` |
| **Phase 4** | Workflow Engine & FSM | ✅ 100% DONE | `d6a8b5f` |
| **Phase 5.1–5.2** | Frontend Baseline & API Types | ✅ DONE | `927ffb5` |
| **Phase 5.3** | Session List Full CRUD | ✅ DONE | `7d0f9fc` |
| **Phase 5.4** | Problem Canvas & Intake Form | ✅ DONE | `7495062` |
| **Phase 5.5** | Workflow Stepper & FSM UI | ✅ DONE | `3e1865e` |
| **Phase 5.6** | TRIZ Principle Suggestions & Evidence Panel | ✅ DONE | `ced26b8` |
| **Phase 5.7** | Search Overlay (Cmd+K) | ✅ DONE | `caf107b` |
| **Phase 5.8** | Legacy Quarantine & Docs | ✅ DONE | `268ebb0` |
| **Docker Hardening** | Multi-stage build, healthcheck, production runtime | ✅ DONE | `246825e` |
| **Phase 5.9** | Session Lifecycle — Archive/Restore | ✅ DONE | `4c3855e` |
| **Phase 6.3 (QW-1)** | Full TRIZ Canonical 39×39 Matrix & Bilingual Parameters | ✅ DONE | `f0a0885` |
| **Phase 7.1 (QW-2)** | Wire Problem Canvas & Smart Tab Routing | ✅ DONE | `0ca4d8f` |
| **Phase 9.1 (QW-5)** | Export Markdown GFM & Native Browser Print PDF | ✅ DONE | `bc9b1f3` |
| **Phase 6.1 (QW-3)** | Real Embedding Engine (OpenAI & Gemini) & Polymorphic Factory | ✅ DONE | `13c4376` |
| **Phase 6.2 (QW-4)** | LLM Problem Structuring Service & AI Trust Contract | ✅ DONE | `96efc84` |
| **Phase 7.4** | Candidate Solutions Persistence & Session-Scoped REST API | ✅ DONE | Pending commit |
| **Phase 6–12** | Professional Upgrade (AI Core, Canvas, Export…) | 🔵 IN PROGRESS | — |

---

## 📅 Phiên làm việc: 2026-10-01 (Phase 7.4 — Candidate Solutions Persistence)

### ✅ Đã hoàn thành trong phiên này

| # | Task | Chi tiết |
|---|---|---|
| 1 | **ORM Model `CandidateSolution`** | Bổ sung class `CandidateSolution(Base)` khớp 100% với DDL Migration `002`, quan hệ `ResearchSession.candidate_solutions` (`cascade="all, delete-orphan"`) |
| 2 | **Session-Scoped Endpoints** | Triển khai đầy đủ RESTful API trong `sessions.py`: `GET`, `POST`, `PATCH`, `DELETE /api/v1/sessions/{session_id}/solutions` |
| 3 | **Session Isolation & IDOR Guard** | Kiểm tra ranh giới phiên đa tầng `WHERE id = :sol_id AND session_id = :session_id`, ngăn chặn hoàn toàn IDOR |
| 4 | **Pydantic Validation & Sanitization** | Chặn title/mechanism whitespace, giới hạn status enum (`candidate`, `accepted`, `rejected`), scores `[0.0, 1.0]` |
| 5 | **Frontend API Client & Contract Types** | Cập nhật `types.ts` và `api-client.ts` (`listCandidateSolutions`, `createCandidateSolution`, `updateCandidateSolution`, `deleteCandidateSolution`) |
| 6 | **Test-First Suite** | 9 Integration tests (`test_candidate_solutions_api.py`) + 4 Frontend Contract tests (`api-client.test.ts`) đạt 100% PASS |

---

## 📅 Phiên làm việc: 2026-10-01 (Phase 6.2 — LLM Problem Structuring Service)

### ✅ Đã hoàn thành trong phiên này

| # | Task | Chi tiết |
|---|---|---|
| 1 | **Phase 6.2 — LLM Client Engine** | Xây dựng `OpenAILLMClient` (`gpt-4o-mini`, JSON output) và `GeminiLLMClient` (`gemini-1.5-flash`, REST via `httpx`) |
| 2 | **Polymorphic LLM Factory** | `get_llm_client(provider)` hỗ trợ `openai`, `gemini`, `mock` qua biến môi trường `LLM_PROVIDER` |
| 3 | **AI Problem Analysis Service** | `AIAnalysisService` bóc tách JSON, validate nghiêm ngặt không đoán thông số ngoài 39 TRIZ parameters, prompt versioning `2026-10-01.v1` |
| 4 | **AI Trust Contract Endpoint** | `POST /api/v1/sessions/{id}/ai/analyze-problem` trả về gợi ý tạm thời (zero auto-overwrite vào DB, không đổi FSM state) |
| 5 | **Graceful Fallback & Degradation** | Tự động fallback sang Rule-Based analysis khi LLM timeout, 429, hoặc ném ngoại lệ kèm `provenance: "rule_based_fallback"` |
| 6 | **Comprehensive Test Matrix** | 12 Unit tests (`test_llm_clients.py`) + 5 Integration tests (`test_ai_analysis_api.py`) đạt 100% pass |

---

## 📅 Phiên làm việc: 2026-10-01 (Phase 6.1 — Real Embedding Engine & Factory)

### ✅ Đã hoàn thành trong phiên này

| # | Task | Chi tiết |
|---|---|---|
| 1 | **Phase 6.1 — Embedding Client Engine** | Xây dựng `OpenAIEmbeddingClient` (`text-embedding-3-small`, 1536 dim) và `GeminiEmbeddingClient` (`text-embedding-004`, 1536 dim) |
| 2 | **Polymorphic Factory** | `get_embedding_client(provider)` hỗ trợ `openai`, `gemini`, `mock` qua biến môi trường `EMBEDDING_PROVIDER` |
| 3 | **Graceful Degradation & Resiliency** | Tự động fallback về `MockEmbeddingClient` khi thiếu API key hoặc sau 2 lần retry có exponential backoff |
| 4 | **Re-embed CLI Script** | `backend/src/app/scripts/reembed_chunks.py` cho phép re-embed toàn bộ hoặc các chunk zero-vector theo batch |
| 5 | **Test-First Coverage** | Unit test suite `test_embedding_clients.py` (13 tests) + Integration test `test_real_embedding_integration.py` (2 tests) pass 100% |

---

## 🔎 Chi tiết Phase 5.9 (commit `4c3855e`)

### Backend thay đổi
- **`backend/src/app/api/v1/endpoints/sessions.py`:**
  - `POST /api/v1/sessions/{id}/archive` → chuyển status sang `archived`
  - `POST /api/v1/sessions/{id}/restore` → chuyển status sang `active`
  - `GET /api/v1/sessions` mặc định lọc `status != archived`
  - `GET /api/v1/sessions?status=archived` trả archived sessions
  - Fix `db.commit()` cho `POST /api/v1/sessions` (bug gốc)
  - Fix `RuntimeError: generator didn't stop after throw()` trong `get_db` dependency

- **Tests mới:**
  - `backend/tests/integration/test_session_lifecycle.py` — lifecycle integration test
  - `backend/tests/integration/test_session_persistence.py` — cập nhật coverage

### Frontend thay đổi
- **`apps/web/features/session/session-list.tsx`:**
  - Tab "Đang hoạt động" / "Đã lưu trữ" với `useQuery` riêng per tab
  - Nút "Lưu trữ" + confirmation modal với cảnh báo dữ liệu được bảo toàn
  - Nút "Khôi phục" trong tab archived
  - `archiveMutation` + `restoreMutation` với `useMutation`
- **`apps/web/lib/api-client.ts`:** Thêm `archiveSession()`, `restoreSession()`

### Spec docs mới
- `docs/PHASE_5.9_SESSION_LIFECYCLE_PLAN.md`
- `docs/PHASE_5.9_SESSION_LIFECYCLE_SPEC.md`

---

## 🔎 Chi tiết Docker Hardening (commit `246825e`)

| Thành phần | Trước | Sau |
|---|---|---|
| **Frontend runtime** | `npm run dev` | `next build` + Node.js slim runner (multi-stage) |
| **Backend runtime** | `uvicorn --reload` + bind-mount source | `uvicorn` (no reload), no bind-mount |
| **Dependency chain** | None | `db healthy → api healthy → frontend starts` |
| **Restart policy** | None | `unless-stopped` cho cả 3 services |
| **Healthcheck** | None | `/health` endpoint (backend), `pg_isready` (db) |
| **NEXT_PUBLIC_API_URL** | Hardcode localhost | Passed via `ARG` + `ENV` trong Dockerfile |

**Smoke test đã pass (end-to-end):**
```
✅ curl -i http://localhost:8000/health → HTTP 200
✅ curl -i http://localhost:8000/api/v1/sessions → HTTP 200
✅ curl -I http://localhost:3011/ → HTTP 200
```

---

## 📋 Danh sách commit đầy đủ (2026-09-29 → 2026-09-30)

| Hash | Ngày | Nội dung |
|---|---|---|
| `fc42df8` | 2026-09-29 10:52 | test(ingestion): add integration tests and consolidate test harness |
| `8d7c9d0` | 2026-09-29 11:06 | feat(retrieval): support session-bound hybrid search |
| `7b9d62c` | 2026-09-29 11:25 | feat(search-api): connect hybrid retrieval endpoint |
| `f14432b` | 2026-09-29 11:48 | feat(problem-structuring): add TRIZ framing service and endpoint |
| `a80407f` | 2026-09-29 12:39 | feat(session): persist research sessions and validate creation |
| `d6a8b5f` | 2026-09-29 12:59 | feat(workflow): add FSM engine, method recommender, and next-step API |
| `ac2210d` | 2026-09-29 13:15 | feat(sessions): implement session query and detail APIs |
| `927ffb5` | 2026-09-29 14:03 | feat(web): align frontend API contracts and types |
| `bef5986` | 2026-09-29 14:11 | chore(web): restore buildable frontend baseline |
| `3e6d12d` | 2026-09-29 14:26 | feat(web): wire session list read path |
| `7d0f9fc` | 2026-09-30 10:31 | feat(session): complete phase 5.3 session list, write path and filter enhancements |
| `7495062` | 2026-09-30 10:31 | feat(intake): connect problem frame mutation and structuring canvas view (phase 5.4) |
| `3e1865e` | 2026-09-30 10:31 | feat(workflow): implement 6-stage TRIZ stepper and next-step FSM transition (phase 5.5) |
| `ced26b8` | 2026-09-30 10:31 | feat(ideation,retrieval): add TRIZ principle suggestions and evidence panel (phase 5.6) |
| `caf107b` | 2026-09-30 10:31 | feat(search): implement global search overlay with Cmd+K and debounced hybrid search (phase 5.7) |
| `268ebb0` | 2026-09-30 10:31 | docs(architecture): quarantine legacy folders and consolidate canonical source of truth (phase 5.8) |
| `246825e` | 2026-09-30 11:01 | chore(docker): harden deployment stack with multi-stage nextjs runner, healthchecks and deployment guide |
| `4c3855e` | 2026-09-30 14:16 | feat(session): phase 5.9 session lifecycle — archive/restore soft-delete with tests and spec docs |

---

## ⏭️ VIỆC CẦN LÀM TIẾP THEO

### Được recommend theo thứ tự ưu tiên (từ Professional Upgrade Roadmap)

> Xem chi tiết tại: `docs/PROFESSIONAL_UPGRADE_ROADMAP.md`

| # | Phase | Task | Effort | Impact |
|---|---|---|---|---|
| **QW-1** | 6.3 | Import full TRIZ 39×39 matrix JSON + 39 parameters bilingual | ~4h | 🔴 High |
| **QW-2** | 7.1 | Wire `/sessions/[id]` page → Problem Canvas (hiện chỉ có 299 bytes) | ~3h | 🔴 High |
| **QW-3** | 6.1 | Implement `OpenAIEmbeddingClient` / `GeminiEmbeddingClient` thay `MockEmbeddingClient` | ~4h | 🔴 High |
| **QW-4** | 7.2 | `ResearchNote` model + CRUD endpoints + UI | ~4h | 🟠 Medium |
| **QW-5** | 9.1 | Export session as Markdown/PDF | ~3h | 🟠 Medium |
| **QW-6** | 6.2 | `AIAnalysisService` với LLM problem analysis (Gemini Flash) | ~6h | 🟠 Medium |
| **QW-7** | 12.4 | Khởi tạo Alembic + IVFFlat index migration | ~2h | 🟡 Low |

---

## 🏗️ Kiến trúc hiện tại (Canonical)

```
creative-research-workbench/
├── backend/                    ← ✅ CANONICAL backend
│   ├── Dockerfile              ← multi-stage python build
│   ├── pyproject.toml
│   └── src/app/
│       ├── api/v1/endpoints/
│       │   ├── sessions.py     ← CRUD + archive/restore + next-step
│       │   ├── search.py       ← hybrid search
│       │   └── solutions.py    ← stub
│       ├── domain/
│       │   └── models.py       ← 5 ORM models + 2 value objects
│       └── services/
│           ├── ingestion_service.py       ← FrontmatterParser + Chunker + EmbeddingClient
│           ├── retrieval_service.py       ← Hybrid FTS + pgvector + RRF fusion
│           ├── problem_structuring_service.py  ← TRIZ rule-based contradiction extraction
│           ├── method_recommender.py      ← 40 TRIZ principles (partial)
│           └── workflow_engine.py         ← FSM 6 stages
├── apps/web/                   ← ✅ CANONICAL frontend
│   ├── Dockerfile              ← multi-stage next build + node runner
│   ├── app/                    ← Next.js 14 App Router
│   │   ├── page.tsx            ← redirect → /sessions
│   │   └── sessions/
│   │       ├── page.tsx        ← SessionList
│   │       └── [id]/page.tsx   ← Session detail (⚠️ placeholder — QW-2)
│   ├── features/
│   │   ├── session/            ← SessionList, tabs, archive modal ✅
│   │   ├── intake/             ← IntakeForm (wired to API) ✅
│   │   ├── structuring/        ← NormalizedView, ContradictionBadge ✅
│   │   ├── retrieval/          ← EvidencePanel ✅
│   │   ├── ideation/           ← PrincipleSuggestions ✅
│   │   └── search/             ← SearchOverlay (Cmd+K) ✅
│   └── lib/
│       ├── api-client.ts       ← 8 typed functions
│       └── types.ts            ← TypeScript types
├── docker-compose.yml          ← hardened: db → api → frontend chain
└── docs/
    ├── PROFESSIONAL_UPGRADE_ROADMAP.md  ← 🆕 Plan Phase 6–12
    ├── DEPLOYMENT_GUIDE.md
    ├── PHASE_5.9_SESSION_LIFECYCLE_SPEC.md
    └── ... (21 docs tổng cộng)

apps/api/   ← ⚠️ DEPRECATED (xem DEPRECATED.md)
frontend/   ← ⚠️ DEPRECATED (xem DEPRECATED.md)
```

---

## 🔧 Stack công nghệ

| Layer | Tech | Notes |
|---|---|---|
| Backend | Python 3.12 + FastAPI | sync SQLAlchemy, psycopg2-binary |
| Database | PostgreSQL 16 + pgvector | pgvector/pgvector:pg16 docker image |
| ORM | SQLAlchemy 2.x | sync engine, `Base.metadata.create_all` |
| Embedding | `MockEmbeddingClient` | ⚠️ zero-vectors — cần swap thật (QW-3) |
| Frontend | Next.js 14 App Router + TypeScript | |
| UI | TailwindCSS + shadcn/ui | |
| State/Fetch | TanStack Query v5 + Zustand | |
| Container | Docker Compose (hardened) | |
| CI | GitHub Actions | |

---

## 🔒 Ràng buộc bất biến

1. ❌ Không hard delete — chỉ soft delete / archive
2. ❌ Không sửa `backend/uv.lock` trừ khi thêm dependency được phê duyệt
3. ❌ Không thay đổi schema DB mà không có migration rõ ràng
4. ❌ Không đụng `apps/api/` và `frontend/` (legacy)
5. ✅ Mọi phase mới phải có test trước khi code (test-first)
6. ✅ Session data persistence 100% — không mất data user

---

## 📝 Lịch sử phiên làm việc (tóm tắt)

| Phiên | Ngày/Giờ | Agent | Kết quả |
|---|---|---|---|
| Phiên 1 | 2026-07-03 ~15:00 | Perplexity | Phase 0 hoàn thành, 10 Golden Docs |
| Phiên 2 | 2026-07-03 17:00 | Perplexity | Xác nhận frontmatter, repo structure |
| Phiên 3 | 2026-07-03 19:51 | Perplexity | `models.py` hoàn thành (commit `bd55790`) |
| Phiên 4 | 2026-09-29 10:52–14:26 | Antigravity | Phase 2–4 hoàn chỉnh backend, Phase 5.1–5.3 frontend baseline |
| Phiên 5 | 2026-09-30 10:31–11:01 | Antigravity | Phase 5.4–5.8 commits, Docker Hardening, deployment docs |
| **Phiên 6** | **2026-09-30 11:01–14:16** | **Antigravity** | **Phase 5.9 archive/restore, bug fix commit, Professional Upgrade Roadmap** |

---

## 💬 Context cho AI assistant — Đọc trước khi tiếp tục

1. **State hiện tại:** Tất cả Phase 0–5.9 đã DONE và commit. Repo sạch (chỉ `backend/uv.lock` untracked — bình thường).
2. **File chính cần đọc:**
   - `docs/PROFESSIONAL_UPGRADE_ROADMAP.md` — plan Phase 6–12
   - `backend/src/app/domain/models.py` — domain entities
   - `backend/src/app/services/` — 5 core services
   - `apps/web/lib/api-client.ts` — 8 API functions
   - `apps/web/lib/types.ts` — TypeScript types
3. **Khoảng trống nghiêm trọng nhất cần fix trước:**
   - `EmbeddingClient = MockEmbeddingClient` → vector search vô dụng
   - `/sessions/[id]/page.tsx` chỉ có 299 bytes placeholder
   - TRIZ matrix chỉ có 10/1263 cells
4. **Quick wins gợi ý tiếp theo:** xem bảng "VIỆC CẦN LÀM TIẾP THEO" ở trên
5. **Owner:** quochuynh8611-code | **Ngôn ngữ làm việc:** Tiếng Việt

---

*Last updated: 2026-09-30 14:16 +07 — Phiên 6 với Antigravity IDE*

---

## 📅 Phiên làm việc: 2026-07-03 (Phiên 3 — 19:51 +07)

### ✅ Đã hoàn thành trong phiên này

| # | Task | Kết quả |
|---|------|---------|
| 1 | **`models.py` — Phase 2 Step 1** | ✅ DONE — commit `bd55790` |
| 2 | Cập nhật SESSION_LOG.md | ✅ File này |

---

### 🔎 Chi tiết `models.py` (commit `bd55790`)

**File:** `backend/src/app/domain/models.py`

**5 SQLAlchemy ORM Models đã implement:**

| Model | Bảng DB | Điểm quan trọng |
|-------|---------|-----------------|
| `Document` | `documents` | `content_hash UNIQUE` chống duplicate; `ARRAY(String)` cho tags; Index trên `topic`, `golden`, `status` |
| `Chunk` | `chunks` | `Vector(1536)` pgvector cho embedding; CASCADE DELETE từ Document; Index `(document_id, chunk_index)` |
| `ResearchSession` | `research_sessions` | FSM field `workflow_state: str`; Enum `active/paused/completed/archived` |
| `ProblemFrame` | `problem_frames` | TRIZ fields `improving_parameter`, `worsening_parameter`; CASCADE từ Session |
| `Contradiction` | `contradictions` | `ARRAY(Integer)` cho `suggested_principles`; CASCADE từ ProblemFrame |

**2 Value Objects (dataclass, không map DB):**

- `IngestResult` — trả về từ `IngestionService.ingest()`: `status`, `document_id`, `chunks_created`, `embeddings_created`
- `SearchResult` — trả về từ `RetrievalService.search()`: `chunk_id`, `source_ref`, `excerpt`, `score`, `metadata`

**Quyết định kỹ thuật quan trọng:**
> IVFFlat cosine index trên `Chunk.embedding` **KHÔNG** tạo trong `metadata.create_all()`.  
> Sẽ tạo qua **Alembic migration riêng** sau khi ingest ≥1000 rows.  
> Lý do: IVFFlat lỗi trên bảng rỗng.

---

## 🗂️ Cấu trúc repo hiện tại

```
creative-research-workbench/
├── README.md
├── SESSION_LOG.md              ← file này
├── .env.example
├── .gitignore
├── docker-compose.yml          ← PostgreSQL 16 + pgvector + backend + frontend
├── .github/
│   ├── workflows/ci.yml        ← GitHub Actions CI
│   └── ISSUE_TEMPLATE/
├── docs/                       ← Toàn bộ tài liệu từ Obsidian vault
│   ├── ADR-001-architecture.md          ← ⭐ GOLDEN + frontmatter ✅
│   ├── API_CONTRACTS.md                 ← ⭐ GOLDEN + frontmatter ✅
│   ├── DOMAIN_SCHEMA.md                 ← ⭐ GOLDEN + frontmatter ✅
│   ├── PRODUCT_SPEC.md                  ← ⭐ GOLDEN + frontmatter ✅
│   ├── IMPLEMENTATION_ROADMAP.md        ← ⭐ GOLDEN + frontmatter ✅
│   ├── UI_MODULE_BREAKDOWN.md           ← ⭐ GOLDEN + frontmatter ✅
│   ├── TEST_PLAN.md                     ← ⭐ GOLDEN + frontmatter ✅
│   ├── GHERKIN_SCENARIOS.md             ← ⭐ GOLDEN + frontmatter ✅
│   ├── FAILING_INTEGRATION_TEST_SPEC.md ← ⭐ GOLDEN + frontmatter ✅
│   ├── definition-of-done.md            ← ⭐ GOLDEN + frontmatter ✅
│   └── knowledge-inventory.md           ← Phase 0 output ✅
├── backend/
│   ├── pyproject.toml
│   └── src/app/
│       ├── api/routes/
│       │   └── search.py       ← 🔴 Phase 2 Step 4 — chưa tạo
│       ├── domain/
│       │   └── models.py       ← ✅ DONE (5 models + 2 value objects)
│       └── services/
│           ├── ingestion_service.py  ← 🔴 Phase 2 Step 2 — NEXT
│           └── retrieval_service.py  ← 🔴 Phase 2 Step 3 — chưa tạo
├── frontend/
│   ├── package.json
│   └── src/
│       ├── app/
│       ├── components/
│       └── lib/
└── apps/
```

---

## 🐛 GitHub Issues — Trạng thái mới nhất

| Issue | Phase | Tiêu đề | Trạng thái |
|-------|-------|---------|------------|
| #1 | Phase 0 | Discovery — Kiểm kê & chuẩn hóa kho tài liệu | ✅ CLOSED — Completed |
| #6 | Phase 0 | Discovery — Kiểm kê & chuẩn hóa kho markdown | ✅ CLOSED — Duplicate |
| #8 | Phase 0 | Kiểm kê và gắn nhãn toàn bộ kho markdown | ✅ CLOSED — Duplicate |
| #2 | Phase 2 | Ingestion & Retrieval — Pipeline parse markdown + pgvector | 🟡 **IN PROGRESS** |
| #7 | Phase 2 | Ingestion & Retrieval Pipeline | 🔴 Cần đóng/merge với #2 |
| #3 | Phase 3 | Problem Structuring — ProblemFrame, Contradiction, Cause-Effect | 🔴 Chưa bắt đầu |
| #4 | Phase 4 | Reasoning Workflow — WorkflowEngine, Method Recommender | 🔴 Chưa bắt đầu |
| #5 | Phase 5 | UI Workspace — Session List, Canvas, Evidence Panel | 🔴 Chưa bắt đầu |

---

## 🚦 Trạng thái Phase

| Phase | Tên | Trạng thái | Ghi chú |
|-------|-----|-----------|---------| 
| **Phase 0** | Discovery — Knowledge Inventory | ✅ **100% DONE** | 21 files, 10 Golden Docs, frontmatter ✅ |
| **Phase 1** | Domain & Spec | ✅ Hoàn thành | Tất cả spec docs có trong `/docs` |
| **Phase 2** | Ingestion & Retrieval Pipeline | 🟡 **IN PROGRESS (1/4)** | `models.py` ✅ → `ingestion_service.py` 🔴 NEXT |
| **Phase 3** | Problem Structuring | 🔴 Chưa bắt đầu | — |
| **Phase 4** | Reasoning Workflow | 🔴 Chưa bắt đầu | — |
| **Phase 5** | UI Workspace | 🔴 Chưa bắt đầu | — |

---

## ⏭️ VIỆC CẦN LÀM TIẾP THEO

### Phase 2 — Step 2: `ingestion_service.py`

**File cần tạo:**
```
backend/src/app/services/ingestion_service.py
```

**Trách nhiệm của IngestionService:**
1. Nhận path của 1 file markdown
2. Parse YAML frontmatter → map vào `Document` fields
3. Tính SHA-256 của nội dung → so sánh với `content_hash` trong DB (nếu trùng → skip, trả về `IngestResult.already_exists()`)
4. Chunk văn bản: 512 tokens/chunk, overlap 50 tokens (dùng `tiktoken`)
5. Gọi OpenAI `text-embedding-3-small` → lấy vector 1536 dim cho mỗi chunk
6. Lưu `Document` + danh sách `Chunk` (với embedding) vào PostgreSQL
7. Trả về `IngestResult` với `chunks_created`, `embeddings_created`

**Signature dự kiến:**
```python
class IngestionService:
    def __init__(self, db_session: AsyncSession, openai_client: AsyncOpenAI): ...
    
    async def ingest(self, filepath: Path) -> IngestResult: ...
    async def ingest_directory(self, dirpath: Path, glob: str = "**/*.md") -> list[IngestResult]: ...
```

**Failing tests cần viết TRƯỚC (TDD — Phase 2 Step 2):**
```python
# tests/integration/test_ingestion.py
async def test_ingest_golden_doc_creates_document_record(db_session, sample_md_file):
    """GIVEN: 1 markdown file hợp lệ với frontmatter
       WHEN: IngestionService.ingest(filepath) được gọi
       THEN: Document record được tạo trong DB với đúng metadata"""
    ...

async def test_ingest_creates_chunks_with_embeddings(db_session, sample_md_file):
    """GIVEN: 1 markdown file hợp lệ
       WHEN: ingest() hoàn thành
       THEN: >= 1 Chunk record có embedding vector != None"""
    ...

async def test_duplicate_ingest_skipped_by_content_hash(db_session, sample_md_file):
    """GIVEN: 1 file đã được ingest
       WHEN: ingest() được gọi lại với cùng file
       THEN: IngestResult.status == 'already_exists', không tạo thêm record"""
    ...
```

**Dependencies đã khai báo trong `pyproject.toml`:**
- `python-frontmatter` — parse YAML frontmatter ✅ (cần xác nhận)
- `pgvector` — SQLAlchemy integration ✅
- `openai` — async client ✅ (cần xác nhận)
- `tiktoken` — token counting cho chunking ✅ (cần xác nhận)
- `alembic` — DB migrations ✅ (cần xác nhận)

**Sau Step 2:** tiếp tục với `retrieval_service.py` (Step 3) → `search.py` API route (Step 4).

---

## 🔧 Stack công nghệ

| Layer | Tech | Version |
|-------|------|---------| 
| Backend | Python + FastAPI | 3.12 / 0.110+ |
| Database | PostgreSQL + pgvector | 16 / 0.7+ |
| ORM | SQLAlchemy (async) | 2.x |
| Frontend | Next.js + TypeScript | 14 / 5+ |
| UI | TailwindCSS + shadcn/ui | 3.4 / latest |
| State | Zustand | 4+ |
| API Client | TanStack Query | 5+ |
| AI/LLM | OpenAI API (text-embedding-3-small, dim=1536) | — |
| Container | Docker Compose | — |
| CI | GitHub Actions | — |

---

## 📚 Tài liệu tham khảo chính

| File | Mô tả |
|------|-------|
| `docs/ADR-001-architecture.md` | Kiến trúc tổng thể — đọc đầu tiên |
| `docs/PRODUCT_SPEC.md` | Product intent + user goals |
| `docs/DOMAIN_SCHEMA.md` | Entity schema — nguồn truth cho database |
| `docs/API_CONTRACTS.md` | API endpoints — nguồn truth cho backend/frontend |
| `docs/IMPLEMENTATION_ROADMAP.md` | Thứ tự phase + criteria |
| `docs/FAILING_INTEGRATION_TEST_SPEC.md` | Integration tests cần viết cho Phase 2 |
| `docs/knowledge-inventory.md` | Inventory 21 files Phase 0 |

---

## 💬 Context cho AI assistant

Nếu bạn là AI assistant được yêu cầu tiếp tục dự án này:

1. **Đọc `docs/ADR-001-architecture.md`** để hiểu kiến trúc tổng thể
2. **Đọc `docs/DOMAIN_SCHEMA.md`** để hiểu entities và relationships
3. **Đọc `docs/FAILING_INTEGRATION_TEST_SPEC.md`** để biết failing tests cần implement
4. **Đọc `backend/src/app/domain/models.py`** để hiểu các models đã có
5. **Phase hiện tại: Phase 2, Step 2** — implement `ingestion_service.py`
6. **Quy trình bắt buộc: TDD** — viết failing tests trước, implement sau
7. **Bước tiếp theo ngay lập tức:**
   - Viết `tests/integration/test_ingestion.py` với 3 failing tests (Gherkin Given-When-Then)
   - Implement `backend/src/app/services/ingestion_service.py`
   - Chạy tests → Green
8. **Sau ingestion_service:** tiếp tục `retrieval_service.py` → `search.py` API route
9. **Owner:** quochuynh8611-code | **Repo:** creative-research-workbench
10. **Ngôn ngữ làm việc:** Tiếng Việt

---

## 📝 Lịch sử phiên làm việc

| Phiên | Ngày/Giờ | Kết quả |
|-------|----------|---------|
| Phiên 1 | 2026-07-03 ~15:00 | Phase 0 hoàn thành, 10 Golden Docs, Issues #1/#6/#8 closed |
| Phiên 2 | 2026-07-03 17:00 | Xác nhận frontmatter, kiểm tra repo structure |
| **Phiên 3** | **2026-07-03 19:51** | **`models.py` hoàn thành (commit `bd55790`) — Phase 2 Step 1 DONE** |

---

*Last updated: 2026-07-03 19:51 +07 — Phiên 3 với Perplexity AI*
