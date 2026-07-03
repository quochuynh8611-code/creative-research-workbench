# SESSION LOG — Creative Research Workbench

> **Mục đích:** File này ghi lại tiến độ làm việc theo từng ngày.  
> Bất kỳ developer hoặc AI assistant nào đọc file này sẽ biết **đã làm gì**, **đang ở đâu**, và **việc tiếp theo là gì**.

---

## 📅 Phiên làm việc: 2026-07-03 (Phiên 2 — 17:00 +07)

### ✅ Đã hoàn thành trong phiên này

| # | Task | Kết quả |
|---|------|---------|
| 1 | Xác nhận YAML frontmatter trên 10 Golden Docs | ✅ Tất cả đã có frontmatter chuẩn trong `/docs` |
| 2 | Đóng Issue #6 | ✅ Closed as duplicate of #1 |
| 3 | Đóng Issue #8 | ✅ Closed as duplicate of #1 |
| 4 | Đóng Issue #1 | ✅ Closed as completed — Phase 0 100% DONE |
| 5 | Cập nhật SESSION_LOG.md | ✅ File này |

---

## 🗂️ Cấu trúc repo hiện tại

```
creative-research-workbench/
├── README.md
├── SESSION_LOG.md          ← file này
├── .env.example
├── .gitignore
├── docker-compose.yml      ← PostgreSQL 16 + pgvector + backend + frontend
├── .github/
│   ├── workflows/ci.yml    ← GitHub Actions CI
│   └── ISSUE_TEMPLATE/
├── docs/                   ← Toàn bộ tài liệu từ Obsidian vault
│   ├── ADR-001-architecture.md       ← ⭐ GOLDEN + frontmatter ✅
│   ├── API_CONTRACTS.md              ← ⭐ GOLDEN + frontmatter ✅
│   ├── DOMAIN_SCHEMA.md              ← ⭐ GOLDEN + frontmatter ✅
│   ├── PRODUCT_SPEC.md               ← ⭐ GOLDEN + frontmatter ✅
│   ├── IMPLEMENTATION_ROADMAP.md     ← ⭐ GOLDEN + frontmatter ✅
│   ├── UI_MODULE_BREAKDOWN.md        ← ⭐ GOLDEN + frontmatter ✅
│   ├── TEST_PLAN.md                  ← ⭐ GOLDEN + frontmatter ✅
│   ├── GHERKIN_SCENARIOS.md          ← ⭐ GOLDEN + frontmatter ✅
│   ├── FAILING_INTEGRATION_TEST_SPEC.md ← ⭐ GOLDEN + frontmatter ✅
│   ├── definition-of-done.md         ← ⭐ GOLDEN + frontmatter ✅
│   └── knowledge-inventory.md        ← Phase 0 output ✅
├── backend/                ← Python FastAPI (skeleton)
│   ├── pyproject.toml
│   └── src/app/
│       ├── api/
│       ├── domain/
│       └── services/
├── frontend/               ← Next.js 14 (skeleton)
│   ├── package.json
│   └── src/
│       ├── app/
│       ├── components/
│       └── lib/
└── apps/                   ← Monorepo apps (reserved)
```

---

## 🐛 GitHub Issues — Trạng thái mới nhất

| Issue | Phase | Tiêu đề | Trạng thái |
|-------|-------|---------|------------|
| #1 | Phase 0 | Discovery — Kiểm kê & chuẩn hóa kho tài liệu | ✅ CLOSED — Completed |
| #6 | Phase 0 | Discovery — Kiểm kê & chuẩn hóa kho markdown | ✅ CLOSED — Duplicate |
| #8 | Phase 0 | Kiểm kê và gắn nhãn toàn bộ kho markdown | ✅ CLOSED — Duplicate |
| #2 | Phase 2 | Ingestion & Retrieval — Pipeline parse markdown + pgvector | 🔴 **NEXT TASK** |
| #7 | Phase 2 | Ingestion & Retrieval Pipeline | 🔴 Cần đóng/merge với #2 |
| #3 | Phase 3 | Problem Structuring — ProblemFrame, Contradiction, Cause-Effect | 🔴 Chưa bắt đầu |
| #4 | Phase 4 | Reasoning Workflow — WorkflowEngine, Method Recommender | 🔴 Chưa bắt đầu |
| #5 | Phase 5 | UI Workspace — Session List, Canvas, Evidence Panel | 🔴 Chưa bắt đầu |

---

## 🚦 Trạng thái Phase

| Phase | Tên | Trạng thái | Ghi chú |
|-------|-----|-----------|---------|
| **Phase 0** | Discovery — Knowledge Inventory | ✅ **100% DONE** | 21 files kiểm kê, 10 Golden Docs, frontmatter ✅, Issues #1/#6/#8 closed |
| **Phase 1** | Domain & Spec | ✅ Hoàn thành | Tất cả tài liệu spec đã có trong `/docs` |
| **Phase 2** | Ingestion & Retrieval Pipeline | 🔴 **NEXT — Bắt đầu ngay** | Issues #2, #7 |
| **Phase 3** | Problem Structuring | 🔴 Chưa bắt đầu | — |
| **Phase 4** | Reasoning Workflow | 🔴 Chưa bắt đầu | — |
| **Phase 5** | UI Workspace | 🔴 Chưa bắt đầu | — |

---

## ⏭️ VIỆC CẦN LÀM TIẾP THEO

### Phase 2 — Ingestion & Retrieval Pipeline

**Goal:** Đóng Issues #2, #7

**Files cần tạo (theo thứ tự):**

```
backend/src/app/
├── domain/
│   └── models.py                ← 1. SQLAlchemy models: Document, Chunk, Embedding
├── services/
│   ├── ingestion_service.py     ← 2. Parse markdown + frontmatter + chunk
│   └── retrieval_service.py     ← 3. Hybrid search (FTS + vector)
└── api/
    └── routes/
        └── search.py            ← 4. POST /api/v1/search
```

**Dependencies cần thêm vào `pyproject.toml`:**
- `python-frontmatter` — parse YAML frontmatter
- `pgvector` — vector index trên PostgreSQL
- `openai` — embedding model (text-embedding-3-small)
- `alembic` — database migrations
- `tiktoken` — đếm tokens cho chunking

**Acceptance Criteria (từ FAILING_INTEGRATION_TEST_SPEC.md):**
- Full-text search trả về kết quả < 200ms
- Vector search Recall@5 >= 0.75 trên 10 Golden Documents
- Mọi kết quả có `excerpt` + `source_ref` + `score`
- `POST /api/v1/search` trả về HTTP 200 với payload đúng schema API_CONTRACTS.md

**Failing tests cần viết trước (TDD):**
```python
# tests/integration/test_ingestion.py
def test_ingest_golden_doc_creates_document_record(): ...
def test_ingest_creates_chunks_with_embeddings(): ...
def test_duplicate_ingest_skipped_by_content_hash(): ...

# tests/integration/test_retrieval.py  
def test_search_returns_results_under_200ms(): ...
def test_vector_search_recall_at_5_on_golden_set(): ...
def test_search_response_has_excerpt_and_source_ref(): ...
```

---

## 🔧 Stack công nghệ

| Layer | Tech | Version |
|-------|------|---------|
| Backend | Python + FastAPI | 3.12 / 0.110+ |
| Database | PostgreSQL + pgvector | 16 / 0.7+ |
| Frontend | Next.js + TypeScript | 14 / 5+ |
| UI | TailwindCSS + shadcn/ui | 3.4 / latest |
| State | Zustand | 4+ |
| API Client | TanStack Query | 5+ |
| AI/LLM | OpenAI API (text-embedding-3-small) | — |
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
4. **Phase hiện tại là Phase 2** — Ingestion & Retrieval Pipeline
5. **Bước tiếp theo ngay:** Viết failing integration tests → sau đó implement `models.py` → `ingestion_service.py` → `retrieval_service.py` → `search.py`
6. **Quy trình bắt buộc:** TDD — viết test thất bại trước, implement sau
7. **Owner:** quochuynh8611-code | **Repo:** creative-research-workbench
8. **Ngôn ngữ làm việc:** Tiếng Việt

---

*Last updated: 2026-07-03 17:07 +07 — Session 2 với Perplexity AI*
