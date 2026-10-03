# PHASE 6 & 7 EXECUTION SPECIFICATION — AI Core & Research Canvas

> **Document Status**: Canonical Execution Specification (Refined)
> **Target Release**: Phase 6 (AI Core & TRIZ Matrix) & Phase 7 (Research Canvas & Notes) + Phase 9.1 (Export)
> **Author**: Technical Architecture & Staff Software Engineering
> **Date**: 2026-09-30
> **References**: [`docs/PROFESSIONAL_UPGRADE_ROADMAP.md`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/docs/PROFESSIONAL_UPGRADE_ROADMAP.md), [`docs/DOMAIN_SCHEMA.md`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/docs/DOMAIN_SCHEMA.md), [`docs/API_CONTRACTS.md`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/docs/API_CONTRACTS.md), [`docs/definition-of-done.md`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/docs/definition-of-done.md)

---

## 1. Executive Summary & Problem Framing

Creative Research Workbench đã hoàn thiện phần khung nền tảng (Phase 1–5.9) bao gồm:
- Mô hình Domain cơ bản (`ResearchSession`, `ProblemFrame`, `Contradiction`, `Document`, `Chunk`).
- Ingestion & Hybrid Search pipeline (FTS + Vector + Reciprocal Rank Fusion - RRF).
- Quản lý vòng đời Session (Archive/Restore soft-delete an toàn).
- Frontend Next.js 14 App Router cơ bản kết nối intake form, normalized view, và workflow stepper.

Tuy nhiên, hệ thống vẫn tồn tại các **khoảng trống kỹ thuật (critical gaps)** cần giải quyết theo trình tự nghiêm ngặt:
1. Quản lý schema database đang phụ thuộc vào `Base.metadata.create_all()` khi khởi động server, thiếu Alembic migration hai bước (Baseline $\rightarrow$ Features) có thể audit và rollback.
2. Ma trận mâu thuẫn TRIZ bị thu hẹp (chỉ 10 cặp thông số, 16 nguyên tắc được map trong mã nguồn).
3. `EmbeddingClient` hiện là `MockEmbeddingClient` (zero-vectors), khiến vector search không có ý nghĩa ngữ nghĩa thực tế.
4. Thiếu mô hình và API cho **Research Notes / Insights** và **Candidate Solutions** có lưu trữ bền vững (persistence).
5. Trang chi tiết `/sessions/[id]` có tab Notebook còn là placeholder, chưa có tính năng ghi chú dạng khối và chưa có công cụ xuất báo cáo Markdown (Phase 9.1).

---

## 2. Phạm vi Dự án (Scope Boundaries)

### 2.1. In-Scope (Phase 6–7 + Phase 9.1 Early Track)
1. **Foundation & Two-Stage Migration Track**:
   - **Migration 001 (`001_baseline_schema.py`)**: Đóng gói chính xác và độc lập 5 bảng hiện có (`documents`, `chunks`, `research_sessions`, `problem_frames`, `contradictions`).
   - **Migration 002 (`002_add_research_notes_and_candidate_solutions.py`)**: Tạo mới các bảng `research_notes` và `candidate_solutions` có quan hệ khóa ngoại bảo vệ.
2. **Phase 6.3 — Full TRIZ 39×39 Altshuller Matrix & 39 Parameters (Deterministic Track)**:
   - Tạo bộ dữ liệu chuẩn `backend/src/app/data/triz_matrix_39x39.json` (đủ 39 thông số, 1,263 ô ma trận Altshuller chuẩn hóa quốc tế).
   - Mở rộng từ điển nhận diện `_PARAMETER_KEYWORDS` từ 8 lên đủ 39 thông số kỹ thuật TRIZ (song ngữ Việt – Anh).
   - Nâng cấp `MethodRecommender` và `ProblemStructuringService` để tra cứu từ ma trận 39x39 đầy đủ, trả về tên nguyên tắc, giải thích ý nghĩa (explanation) và ví dụ ứng dụng (examples).
3. **Phase 6.1 — Real Embedding Engine (AI Core)**:
   - Hiện thực hóa `OpenAIEmbeddingClient` (`text-embedding-3-small`, 1536 dims) và `GeminiEmbeddingClient`.
   - Cung cấp Factory đa hình qua biến môi trường `EMBEDDING_PROVIDER=openai|gemini|mock`.
   - Cơ chế Fallback an toàn (Graceful degradation): Nếu thiếu API Key hoặc lỗi mạng, tự động fallback sang `MockEmbeddingClient` kèm structured warning log mà không làm gián đoạn request.
   - Script tiện ích CLI để re-embed toàn bộ `chunks` hiện có trong database.
4. **Phase 7.2 — Research Notes & Persistence**:
   - SQLAlchemy Model & Migration 002: `ResearchNote(id, session_id, content, note_type, source_chunk_id, created_at, updated_at)`.
   - Note types: `insight`, `hypothesis`, `decision`, `question`, `action`.
   - RESTful API CRUD: `GET /api/v1/sessions/{id}/notes`, `POST /api/v1/sessions/{id}/notes`, `DELETE /api/v1/sessions/{id}/notes/{note_id}`.
5. **Phase 7.1 — Problem Canvas Shell & Notebook UI**:
   - Hoàn thiện canvas tương tác trên `/sessions/[id]`.
   - Thay thế placeholder tab `notebook` bằng component `ResearchNotebook` quản lý danh sách notes theo phân loại và đính kèm trích dẫn tài liệu.
6. **Phase 9.1 — Markdown Session Export (Quick-Win)**:
   - Endpoint backend: `GET /api/v1/sessions/{id}/export?format=md`.
   - Xuất toàn bộ tiến trình nghiên cứu (Metadata, Problem Statement, TRIZ Analysis, Principles, Evidence, Notes) thành file Markdown chuẩn mực có frontmatter.
   - Nút Export tải về trực tiếp từ Session Header trên UI.

### 2.2. Out-of-Scope (Dành cho các Phase tiếp theo)
- Hệ thống tài khoản đa người dùng (Multi-tenancy / Auth) và cộng tác thời gian thực qua WebSockets (Phase 13+).
- Giao diện Upload File đa định dạng PDF/DOCX (Phase 8.1).
- Knowledge Graph 3D Interactive rendering (Phase 8.3).
- Tự động ghi đè dữ liệu Session bằng AI mà không có người dùng xác nhận.

---

## 3. Tiêu chí Đầu vào & Đầu ra (Entry & Exit Criteria)

### 3.1. Entry Criteria
- [x] Toàn bộ test suite Phase 1–5.9 đang đạt trạng thái **GREEN** (`100% passed`).
- [x] Docker compose môi trường dev chạy ổn định (`db`, `api`, `frontend`).
- [x] Đã hoàn thành khảo sát thực trạng source code và xác minh 100% các giả định.
- [x] Specification, ADR và Test Matrix được cập nhật và phê duyệt.

### 3.2. Exit Criteria (Definition of Done)
- [ ] **Alembic Two-Stage**:
  - `alembic upgrade 001` khởi tạo thành công 5 bảng baseline.
  - `alembic upgrade 002` khởi tạo thành công 2 bảng mở rộng (`research_notes`, `candidate_solutions`).
  - `alembic downgrade -1` và `alembic downgrade base` chạy thành công mà không gây orphan tables hay lỗi SQL.
- [ ] **TRIZ Matrix 39×39**:
  - 100% 39 thông số kỹ thuật được nhận diện qua từ khóa tiếng Việt và tiếng Anh.
  - Ma trận 39x39 trả về đúng danh sách nguyên tắc Altshuller chuẩn.
- [ ] **Embedding Engine**:
  - `OpenAIEmbeddingClient` / `GeminiEmbeddingClient` vượt qua Unit & Integration tests.
  - Khi mock API key hoặc timeout: Graceful fallback hoạt động, không sinh mã lỗi 500.
  - Benchmark Recall@5 trên 10 Golden Documents với real embeddings đạt $\ge 0.85$.
- [ ] **Research Notes**:
  - 100% test CRUD Notes (API và DB) pass.
  - UI thêm, xóa, lọc note hoạt động mượt mà với React Query.
- [ ] **Export**:
  - Xuất Markdown tạo ra cấu trúc tài liệu hoàn chỉnh, không rỗng, thời gian phản hồi < 1000ms.
- [ ] **Test Coverage & Hygiene**:
  - Backend integration test coverage $\ge 85\%$ cho các module mới.
  - Zero linting errors (`ruff check`, `eslint`), zero typing errors (`mypy`, `tsc --noEmit`).

---

## 4. Rà soát & Đánh giá lại Blast Radius (Re-assessed Blast Radius)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              RE-ASSESSED BLAST RADIUS                                  │
├──────────────────────┬───────────┬─────────────────────────────────────────────────────┤
│ Component            │ Mức độ    │ Phân tích chi tiết rủi ro & Phạm vi ảnh hưởng       │
├──────────────────────┼───────────┼─────────────────────────────────────────────────────┤
│ Track 0: Migration   │ TRUNG BÌNH│ Thay đổi schema DDL; cần tách baseline vs features  │
│ Track 1: TRIZ Matrix │ THẤP      │ 100% deterministic, dữ liệu tĩnh, zero side-effect  │
│ Track 2: Embeddings  │ TRUNG BÌNH│ Tác động Ingestion, Retrieval, config, re-embed     │
│ Track 3: Notes DB/API│ TRUNG BÌNH│ Thêm bảng mới, quan hệ khóa ngoại CASCADE, router   │
│ Track 4: Notebook UI │ THẤP      │ UI component mới thay thế placeholder tab           │
│ Track 5: MD Export   │ RẤT THẤP  │ Read-only endpoint, không mutate database state     │
└──────────────────────┴───────────┴─────────────────────────────────────────────────────┘
```

### Chiến lược phòng thủ & Kiểm soát rủi ro:
1. **Phòng thủ Track 0 (Migration)**:
   - Tách làm 2 file migration rõ ràng. Migration 001 là snapshot bất biến của schema hiện tại.
2. **Phòng thủ Track 2 (Real Embeddings - Blast Radius Trung Bình)**:
   - Rủi ro: Thất bại API bên thứ 3 (timeout, quota limit 429, sai key) làm nghẽn luồng nạp tài liệu (`IngestionService`) và tìm kiếm (`RetrievalService`).
   - Biện pháp: Cô lập client qua interface `EmbeddingClient`, thiết lập retry có backoff tối đa 2 lần, và tự động fallback về `MockEmbeddingClient` hoặc Full-Text Search. Script `reembed_chunks.py` chạy theo batch có kiểm soát rate limit.
3. **Phòng thủ Track 3 (Notes Persistence - Blast Radius Trung Bình)**:
   - Rủi ro: Thao tác xóa Session hoặc Note gây lỗi foreign key constraint hoặc lock transaction.
   - Biện pháp: Khóa ngoại `session_id` với `ON DELETE CASCADE`, sử dụng transaction độc lập cho từng thao tác CRUD Note.

---

## 5. Kế hoạch Phục hồi & Rollback (Rollback Plan)

1. **Database Rollback**:
   - Rollback feature notes/solutions: `alembic downgrade 001`.
   - Rollback toàn bộ: `alembic downgrade base`.
2. **Embedding Configuration Rollback**:
   - Nếu OpenAI/Gemini API gặp sự cố hoặc vượt ngân sách: Chuyển `EMBEDDING_PROVIDER=mock` trong `.env` và restart container API trong 5 giây.
3. **Frontend Component Rollback**:
   - Toàn bộ tab Notebook được bọc trong React ErrorBoundary; nếu API lỗi sẽ hiển thị Fallback UI mà không làm hỏng các tab Intake, Structuring và Retrieval.

---

## 6. AI Trust Contract & Chính sách Căn cứ Tri thức (Grounding & Provenance)

### 6.1. Nguyên tắc Bất biến: Không Tự Động Ghi Đè (Zero Auto-Overwrite)
- **Dữ liệu AI là Ephemeral Suggestion**: Mọi kết quả do AI/LLM phân tích (ví dụ: gợi ý từ khóa, đề xuất câu mâu thuẫn) ở Phase 6 chỉ được hiển thị dưới dạng **gợi ý tạm thời trên giao diện người dùng**.
- **Tuyệt đối KHÔNG tự ý ghi đè Domain Entities**: Backend và Frontend KHÔNG BAO GIỜ tự động cập nhật các trường cốt lõi (`ProblemFrame.normalized_statement`, `ProblemFrame.contradiction_type`, `Contradiction.suggested_principles`) bằng output của AI trừ khi người dùng chủ động nhấn nút **"Chấp nhận gợi ý AI"** (Explicit User Confirmation).

### 6.2. Phân định Ba Tầng Xuất xứ Tri thức (Knowledge Provenance Tiers)
Mọi dữ liệu hiển thị hoặc trả về từ hệ thống phải được phân loại rõ ràng theo 3 tầng:

1. **Tầng 1 — Deterministic Rule-Based**:
   - Trích xuất thông số dựa trên từ khóa `_PARAMETER_KEYWORDS` và cấu trúc câu regex.
   - Gắn nhãn provenance: `provenance: "rule_based"`.
2. **Tầng 2 — Matrix-Based Altshuller**:
   - Tra cứu trực tiếp từ bảng 1,263 ô ma trận TRIZ 39×39 chính thức.
   - Gắn nhãn provenance: `provenance: "altshuller_matrix_39x39"`.
3. **Tầng 3 — AI-Generated / LLM Hypothesis**:
   - Phân tích mở rộng, tóm tắt hoặc gợi ý của mô hình ngôn ngữ.
   - Gắn nhãn provenance: `provenance: "ai_hypothesis"` kèm metadata chi tiết.

### 6.3. Quản lý Provenance, Logging & Persistence Boundary trong Phase 6
- **Metadata Response**: Các API có sự tham gia của AI trả về khối `_meta`:
  ```json
  "_meta": {
    "provenance": "ai_hypothesis",
    "provider": "openai",
    "model": "text-embedding-3-small",
    "prompt_version": "v1.0",
    "latency_ms": 142
  }
  ```
- **Structured Logging**: Mọi tương tác AI được ghi log dạng JSON ở mức `INFO`:
  `{"event": "ai_interaction", "provider": "openai", "model": "text-embedding-3-small", "prompt_id": "problem_structuring_v1", "tokens_used": 128, "latency_ms": 142}`.
- **Ranh giới Persistence (Persistence Boundary)**:
  - Ở Phase 6: **CHƯA tạo bảng lưu trữ lịch sử chat/prompt AI thô** để giữ blast radius ở mức tối thiểu.
  - AI Output chỉ được lưu bền vững vào database khi người dùng bấm **"Lưu thành Research Note"** (chuyển thành một bản ghi trong bảng `research_notes` với `note_type: "insight"` hoặc `"hypothesis"`).

---

## 7. Chính sách Quản lý Dữ liệu & Schema Migration Chi tiết

### 7.1. Cấu trúc 2 Bước Migration

#### Bước 1: `001_baseline_schema.py` (5 Bảng hiện tại)
Phản ánh đúng 100% schema hiện có trong [`backend/src/app/domain/models.py`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/domain/models.py):
- `documents`
- `chunks`
- `research_sessions`
- `problem_frames`
- `contradictions`

#### Bước 2: `002_add_research_notes_and_candidate_solutions.py` (2 Bảng mới)
Tạo 2 bảng mới với cấu trúc chuẩn:
- `research_notes`: Lưu ghi chú, giả thuyết, insight.
- `candidate_solutions`: Lưu các giải pháp ứng viên.

```sql
-- Migration 002 DDL
CREATE TABLE research_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    note_type VARCHAR(32) NOT NULL DEFAULT 'insight',
    source_chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX ix_research_notes_session_id ON research_notes(session_id);
CREATE INDEX ix_research_notes_note_type ON research_notes(note_type);

CREATE TABLE candidate_solutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
    title VARCHAR(512) NOT NULL,
    mechanism TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'candidate',
    novelty_score DOUBLE PRECISION DEFAULT 0.0,
    feasibility_score DOUBLE PRECISION DEFAULT 0.0,
    risk_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX ix_candidate_solutions_session_id ON candidate_solutions(session_id);
```

---

## 8. Tiêu chuẩn Quan sát (Observability) & Đánh giá (Evaluation)

1. **Metrics & SLOs**:
   - **Vector Embedding Latency**: p95 < 500ms (với Real API), < 5ms (với Mock).
   - **TRIZ Matrix Lookup Latency**: p99 < 1ms (In-memory indexed lookup).
   - **Research Notes CRUD Latency**: p95 < 50ms.
   - **Session Export Latency**: p95 < 300ms.
2. **Retrieval Evaluation Benchmark**:
   - Chạy test suite `test_retrieval_benchmark.py` định kỳ kiểm tra Recall@5 và MRR trên 10 Golden Documents.
