# SESSION LOG — Creative Research Workbench

> **Mục đích:** File này ghi lại tiến độ làm việc theo từng ngày.  
> Bất kỳ developer hoặc AI assistant nào đọc file này sẽ biết **đã làm gì**, **đang ở đâu**, và **việc tiếp theo là gì**.

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
