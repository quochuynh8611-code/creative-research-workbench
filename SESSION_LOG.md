# SESSION LOG — Creative Research Workbench

> **Mục đích:** File này ghi lại tiến độ làm việc theo từng ngày.  
> Bất kỳ developer hoặc AI assistant nào đọc file này sẽ biết **đã làm gì**, **đang ở đâu**, và **việc tiếp theo là gì**.

---

## 📅 Phiên làm việc: 2026-07-03

### ✅ Đã hoàn thành hôm nay

| # | Commit | Mô tả |
|---|--------|--------|
| 1 | `Initial commit` | Tạo repo GitHub |
| 2 | `chore: initial scaffold` | Scaffold đầy đủ: `/docs`, `/backend`, `/frontend`, `/apps`, CI workflow, `.github/` |
| 3 | `docs: push full Obsidian vault docs` | Push toàn bộ tài liệu từ Obsidian vault → `/docs` |
| 4 | `feat(phase0): add knowledge data dir` | Tạo cấu trúc thư mục `/data/knowledge/` + setup guide |
| 5 | `feat: backend domain scaffold + docker-compose + pgvector` | Backend Python/FastAPI skeleton + docker-compose với PostgreSQL 16 + pgvector |
| 6 | `feat: Next.js 14 frontend scaffold` | Frontend Next.js 14 + TypeScript + TailwindCSS + shadcn/ui skeleton |
| 7 | `docs: knowledge-inventory.md Phase 0 v2` | File inventory 21 files markdown từ vault Sang-Tao với metadata phân loại |

---

### 🗂️ Cấu trúc repo hiện tại

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
│   ├── ADR-001-architecture.md
│   ├── API_CONTRACTS.md
│   ├── DOMAIN_SCHEMA.md
│   ├── PRODUCT_SPEC.md
│   ├── IMPLEMENTATION_ROADMAP.md
│   ├── TEST_PLAN.md
│   ├── UI_MODULE_BREAKDOWN.md
│   ├── GHERKIN_SCENARIOS.md
│   ├── FAILING_INTEGRATION_TEST_SPEC.md
│   ├── Definition of Done.md
│   └── knowledge-inventory.md   ← Phase 0 output
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

### 🐛 8 GitHub Issues đang OPEN

| Issue | Phase | Tiêu đề | Trạng thái |
|-------|-------|---------|------------|
| #1 | Phase 0 | Discovery — Kiểm kê & chuẩn hóa kho tài liệu | 🟡 Gần xong — inventory đã có, cần gắn frontmatter |
| #6 | Phase 0 | Discovery — Kiểm kê & chuẩn hóa kho markdown | 🟡 Duplicate của #1 — cần đóng |
| #8 | Phase 0 | Kiểm kê và gắn nhãn toàn bộ kho markdown | 🟡 Duplicate của #1 — cần đóng |
| #2 | Phase 2 | Ingestion & Retrieval — Pipeline parse markdown + pgvector | 🔴 Chưa bắt đầu |
| #7 | Phase 2 | Ingestion & Retrieval Pipeline | 🔴 Chưa bắt đầu |
| #3 | Phase 3 | Problem Structuring — ProblemFrame, Contradiction, Cause-Effect | 🔴 Chưa bắt đầu |
| #4 | Phase 4 | Reasoning Workflow — WorkflowEngine, Method Recommender | 🔴 Chưa bắt đầu |
| #5 | Phase 5 | UI Workspace — Session List, Canvas, Evidence Panel | 🔴 Chưa bắt đầu |

---

## 🚦 Trạng thái Phase

| Phase | Tên | Trạng thái | Ghi chú |
|-------|-----|-----------|---------|
| **Phase 0** | Discovery — Knowledge Inventory | 🟡 85% | Còn: gắn frontmatter YAML cho 21 files, chọn 10 golden docs, đóng #1/#6/#8 |
| **Phase 1** | Domain & Spec | ✅ Hoàn thành | Tất cả tài liệu spec đã có trong `/docs` |
| **Phase 2** | Ingestion & Retrieval Pipeline | 🔴 Chưa bắt đầu | Next task |
| **Phase 3** | Problem Structuring | 🔴 Chưa bắt đầu | — |
| **Phase 4** | Reasoning Workflow | 🔴 Chưa bắt đầu | — |
| **Phase 5** | UI Workspace | 🔴 Chưa bắt đầu | — |

---

## ⏭️ VIỆC CẦN LÀM TIẾP THEO (theo thứ tự ưu tiên)

### Bước 1 — Hoàn tất Phase 0 (ưu tiên cao)

**Goal:** Đóng Issues #1, #6, #8

**Tasks cụ thể:**
- [ ] Gắn YAML frontmatter chuẩn vào 12 files markdown chính trong vault:
  ```yaml
  ---
  title: "..."
  topic: "architecture|api|domain|product|testing|roadmap|ui|planning"
  source_type: "internal-spec|adr|contract|scenario|plan|checklist"
  language: "vi"
  tags: ["triz", "workflow", "retrieval", "problem-structuring", ...]
  phase: "0|1|2|3|4|5"
  status: "canonical|draft|deprecated"
  ---
  ```
- [ ] Chọn **10 golden documents** làm benchmark retrieval (danh sách đề xuất bên dưới)
- [ ] Cập nhật `docs/knowledge-inventory.md` với danh sách 10 golden docs
- [ ] Đóng Issues #1, #6, #8 trên GitHub

**10 Golden Documents đề xuất:**
1. `ADR-001-architecture.md` — kiến trúc tổng thể
2. `DOMAIN_SCHEMA.md` — schema domain entities
3. `API_CONTRACTS.md` — API endpoints
4. `PRODUCT_SPEC.md` — product intent + user goals
5. `IMPLEMENTATION_ROADMAP.md` — thứ tự ưu tiên
6. `GHERKIN_SCENARIOS.md` — acceptance scenarios
7. `UI_MODULE_BREAKDOWN.md` — UI screens + modules
8. `TEST_PLAN.md` — test strategy
9. `FAILING_INTEGRATION_TEST_SPEC.md` — integration tests
10. `Definition of Done.md` — DoD per phase

---

### Bước 2 — Bắt đầu Phase 2: Ingestion & Retrieval (sau Phase 0)

**Goal:** Đóng Issues #2, #7

**Files cần tạo:**
```
backend/src/app/
├── services/
│   ├── ingestion_service.py     ← parse markdown + frontmatter + chunk
│   └── retrieval_service.py     ← hybrid search (FTS + vector)
├── domain/
│   └── models.py                ← SQLAlchemy models (Document, Chunk, Embedding)
└── api/
    └── routes/
        └── search.py            ← POST /api/v1/search
```

**Tech stack cần setup:**
- `python-frontmatter` — parse YAML frontmatter
- `pgvector` — vector index trên PostgreSQL
- `openai` hoặc `ollama` — embedding model
- `alembic` — database migrations

**Acceptance criteria:**
- Full-text search trả về kết quả < 200ms
- Vector search Recall@5 >= 0.75 trên golden set
- Mọi kết quả có `excerpt` + `source_ref`

---

### Bước 3 — Phase 3: Problem Structuring (sau Phase 2)

**Goal:** Đóng Issue #3

**Core services cần viết:**
- `ProblemStructuringService` — rewrite + normalize problem statement
- `ContradictionExtractor` — extract technical + physical contradiction
- `CauseEffectBuilder` — 5-Why / fishbone

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
| AI/LLM | OpenAI API hoặc Ollama (local) | — |
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
| `docs/knowledge-inventory.md` | Inventory 21 files Phase 0 |

---

## 💬 Context cho AI assistant

Nếu bạn là AI assistant được yêu cầu tiếp tục dự án này:

1. **Đọc `docs/ADR-001-architecture.md`** để hiểu kiến trúc tổng thể
2. **Đọc `docs/DOMAIN_SCHEMA.md`** để hiểu entities và relationships
3. **Xem Issues đang OPEN** trên GitHub để biết việc cần làm
4. **Phase hiện tại là Phase 0 (85%)** — cần hoàn tất frontmatter và golden docs
5. **Bước tiếp theo ngay** là Phase 2: `IngestionService` trong `backend/src/app/services/ingestion_service.py`
6. **Owner:** quochuynh8611-code | **Repo:** creative-research-workbench
7. **Ngôn ngữ làm việc:** Tiếng Việt

---

*Last updated: 2026-07-03 13:00 +07 — Session với Perplexity AI*
