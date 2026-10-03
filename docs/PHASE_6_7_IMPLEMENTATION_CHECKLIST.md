# PHASE 6 & 7 IMPLEMENTATION CHECKLIST

> **Dự án**: Creative Research Workbench
> **Phiên bản kế hoạch**: Execution-Grade Implementation Checklist (Refined)
> **Trạng thái**: Chờ phê duyệt trước khi lập trình
> **Nguyên tắc**: Spec-first, Test-first, Read-before-write, Deterministic-first, Blast Radius kiểm soát chặt chẽ

---

## 1. Bản đồ Thứ tự Thực thi Khuyến nghị (Refined Execution Order)

```
[Track 0: Foundation & Two-Stage Alembic Migrations] (Blast Radius: TRUNG BÌNH)
  ├── 001_baseline_schema.py (5 bảng hiện có)
  └── 002_add_research_notes_and_candidate_solutions.py (2 bảng mới)
         │
         ▼
[Track 1: Phase 6.3 — Full TRIZ 39×39 Matrix & 39 Params] (Blast Radius: THẤP)
  ├── Deterministic-first, 100% offline, zero API dependencies
  └── Nâng cấp ProblemStructuringService & MethodRecommender
         │
         ▼
[Track 2: Phase 6.1 — Real Embedding Engine & Fallback] (Blast Radius: TRUNG BÌNH)
  ├── Tác động Ingestion, Retrieval, config, re-embed path
  └── OpenAIEmbeddingClient / GeminiEmbeddingClient với Graceful Fallback
         │
         ▼
[Track 3: Phase 7.2 — Research Notes Backend Persistence] (Blast Radius: TRUNG BÌNH)
  ├── Model ORM + REST API CRUD /notes
  └── AI Trust Contract: Không auto-overwrite, chỉ lưu khi user chủ động
         │
         ▼
[Track 4: Phase 7.1 & 7.2 — Research Canvas & Notebook UI] (Blast Radius: THẤP)
  ├── Thay thế placeholder tab notebook bằng ResearchNotebook component
  └── Phân loại màu sắc note_type, trích dẫn citation
         │
         ▼
[Track 5: Phase 9.1 — Markdown Session Export] (Blast Radius: RẤT THẤP)
  └── Read-only endpoint GET /export?format=md + Nút Download UI
```

---

## 2. Chi tiết Checklist từng Hạng mục

### 📋 Track 0: Foundation & Two-Stage Database Migration (Alembic Setup) — [x] COMPLETED
- **Mức độ rủi ro**: **TRUNG BÌNH** (Đã hoàn tất cấu hình baseline 001 và pre-approved feature 002)
- **Trạng thái**: ✅ **DONE** (100% tests passed, rollback verified)
- **Tasks**:
  - [x] Khởi tạo thư mục `backend/alembic/` và file cấu hình `backend/alembic.ini`.
  - [x] Cấu hình `backend/alembic/env.py` hỗ trợ async engine và type `Vector` của pgvector.
  - [x] **Migration 001 (`001_baseline_schema.py`)**:
    - [x] Chỉ chứa định nghĩa 5 bảng hiện tại: `documents`, `chunks`, `research_sessions`, `problem_frames`, `contradictions`.
    - [x] Viết hàm `upgrade()` và `downgrade()` chuẩn cho 5 bảng.
  - [x] **Migration 002 (`002_add_research_notes_and_candidate_solutions.py`)**:
    - [x] Tạo mới bảng `research_notes` (FK trỏ tới `research_sessions.id` ON DELETE CASCADE).
    - [x] Tạo mới bảng `candidate_solutions` (FK trỏ tới `research_sessions.id` ON DELETE CASCADE).
    - [x] Viết hàm `upgrade()` và `downgrade()` hoàn chỉnh cho 2 bảng mới.
  - [x] **Test-First**: Viết test suite `backend/tests/integration/test_alembic_migrations.py`:
    - [x] Kiểm tra chạy `alembic upgrade 001` thành công 5 bảng.
    - [x] Kiểm tra chạy `alembic upgrade head` (qua 002) thành công 7 bảng.
    - [x] Kiểm tra chạy `alembic downgrade 001` gỡ bỏ an toàn 2 bảng mới, 5 bảng gốc không bị ảnh hưởng.
    - [x] Kiểm tra chạy `alembic downgrade base` dọn dẹp sạch sẽ.

---

### 📋 Track 1: Phase 6.3 — Full TRIZ 39×39 Altshuller Matrix — ⏸ BLOCKED (UNDER QUARANTINE REVIEW)
- **Mức độ rủi ro**: **THẤP - TRUNG BÌNH** (Yêu cầu dữ liệu ma trận có nguồn gốc xác minh rõ ràng)
- **Trạng thái hiện tại**: ⚠️ **BLOCKED / NOT APPROVED FOR PRODUCTION**. Ma trận synthetic hiện tại chỉ đóng vai trò scaffold/test fixture tạm thời. Tuyệt đối không đưa vào production lookup trước khi source procurement, verification & user approval hoàn tất.
- **Data Procurement & Quarantine Tasks (In-Progress)**:
  - [x] Cách ly dataset synthetic (`QUARANTINED_SYNTHETIC_SCAFFOLD`, `is_canonical=false`).
  - [ ] Thẩm định Source Evidence Pack (tối đa 3 ứng viên có URL, commit SHA, checksum, license xác minh).
  - [ ] Đối chiếu và phê duyệt 1 candidate chính và 1 candidate đối chiếu độc lập.
  - [ ] Thiết lập Discrepancy Report schema cho các ô khác biệt giữa các nguồn.
  - [ ] Nhập bảng Altshuller chuẩn hóa với các ô rỗng nguyên bản (empty-cell fidelity so với artifact đã tải).
  - [ ] Cập nhật Test-First suite với assertions kiểm tra tính đúng đắn tri thức (Knowledge Correctness):
    - Toàn bộ không gian tọa độ 39×39 = 1,521 coordinates (trong đó 1,482 ô ngoài đường chéo, 39 ô đường chéo).
    - Không hardcode diagonal=[] hay ranking principles khi chưa có contract/source evidence từ artifact tải về.
  - [ ] Tạo file dữ liệu chuẩn `backend/src/app/data/triz_matrix_39x39.json` (sau khi được user phê duyệt) chứa:
    - 39 thông số kỹ thuật (Số thứ tự 1–39, Tên tiếng Việt, Tên tiếng Anh, Định nghĩa).
    - Toàn bộ 1,521 tọa độ matrix với số ô populated/empty được kiểm đếm chính xác từ dataset thật.
    - 40 nguyên tắc sáng tạo kèm giải thích ý nghĩa (explanation) và ví dụ ứng dụng.
  - [ ] **Test-First**: Viết test suite `backend/tests/integration/test_triz_full_matrix.py`:
    - [ ] Test schema toàn vẹn và provenance metadata của file JSON khi backend khởi động.
    - [ ] Test nhận diện từ khóa cho đủ 39 thông số (tiếng Việt và tiếng Anh).
    - [ ] Test tra cứu cặp mâu thuẫn bất kỳ trong không gian tọa độ 39x39 trả về đúng danh sách nguyên tắc từ dataset đã thẩm định.
  - [ ] Cập nhật `backend/src/app/services/problem_structuring_service.py` (sau khi diff được duyệt).
  - [ ] Cập nhật `backend/src/app/services/method_recommender.py` (sau khi diff được duyệt).

---

### 📋 Track 2: Phase 6.1 — Real Embedding Engine & Graceful Fallback (AI Core)
- **Mức độ rủi ro**: **TRUNG BÌNH** (Ảnh hưởng Ingestion, Retrieval, biến môi trường và re-embedding)
- **Backend Tasks**:
  - [ ] **Test-First**: Viết test suite `backend/tests/integration/test_embedding_client.py`:
    - [ ] Test `MockEmbeddingClient` trả về zero-vectors.
    - [ ] Test `OpenAIEmbeddingClient` tạo vector 1536 dim.
    - [ ] Test `GeminiEmbeddingClient` tương thích SDK.
    - [ ] Test Graceful Fallback: Khi API bị timeout / 429 / sai key, tự động chuyển về Mock client và log warning mà không crash request.
  - [ ] Hiện thực hóa các client trong `backend/src/app/services/ingestion_service.py` (hoặc package `app.services.embedding`):
    - [ ] `OpenAIEmbeddingClient` sử dụng `openai` library đã có trong dependencies.
    - [ ] `GeminiEmbeddingClient`.
    - [ ] Factory `get_embedding_client(provider: str)`.
  - [ ] Cập nhật cấu hình trong `backend/src/app/core/config.py`:
    - [ ] `EMBEDDING_PROVIDER: str = "mock"` (options: `mock`, `openai`, `gemini`)
    - [ ] `OPENAI_API_KEY: str | None = None`
    - [ ] `OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"`
    - [ ] `GEMINI_API_KEY: str | None = None`
  - [ ] Viết CLI script `backend/scripts/reembed_chunks.py` hỗ trợ cập nhật vector theo batch có rate limit.
  - [ ] Chạy lại `backend/tests/integration/test_retrieval.py` đảm bảo RRF hybrid search hoạt động chính xác với real vectors.

---

### 📋 Track 3: Phase 7.2 — Research Notes & Persistence (Backend)
- **Mức độ rủi ro**: **TRUNG BÌNH** (Thêm thực thể ORM mới, API CRUD, ràng buộc dữ liệu)
- **Database & Backend Tasks**:
  - [ ] Cập nhật `backend/src/app/domain/models.py`:
    - [ ] Thêm model `ResearchNote` (fields: `id`, `session_id`, `content`, `note_type`, `source_chunk_id`, `created_at`, `updated_at`).
    - [ ] Thêm model `CandidateSolution` (fields: `id`, `session_id`, `title`, `mechanism`, `status`, `novelty_score`, `feasibility_score`, `risk_notes`, `created_at`, `updated_at`).
    - [ ] Bổ sung relationship vào `ResearchSession`.
  - [ ] **Test-First**: Viết test suite `backend/tests/integration/test_research_notes_api.py`:
    - [ ] Test `POST /api/v1/sessions/{id}/notes` tạo note thành công.
    - [ ] Test `GET /api/v1/sessions/{id}/notes` lấy danh sách notes theo session.
    - [ ] Test `DELETE /api/v1/sessions/{id}/notes/{note_id}` xóa note.
    - [ ] Test AI Trust Contract: Kiểm tra AI suggestions không được tự ý ghi đè vào `problem_frames`.
    - [ ] Test 404 và 422 error handling.
  - [ ] Cập nhật routes trong `backend/src/app/api/v1/endpoints/sessions.py` hoặc thêm `notes.py`.
  - [ ] Cập nhật `backend/src/app/api/v1/endpoints/solutions.py` kết nối SQLAlchemy persistence thật.

---

### 📋 Track 4: Phase 7.1 & 7.2 — Research Canvas & Notebook UI (Frontend)
- **Mức độ rủi ro**: **THẤP** (Mở rộng UI component trên nền tảng React Query đã có)
- **Frontend Tasks**:
  - [ ] Cập nhật `apps/web/lib/api-client.ts` thêm các hàm: `listSessionNotes`, `createSessionNote`, `deleteSessionNote`.
  - [ ] **Test-First**: Viết test suite `apps/web/features/session/__tests__/research-notebook.test.tsx`:
    - [ ] Test render danh sách notes theo các tab/badge màu sắc (`insight`, `hypothesis`, `decision`, v.v.).
    - [ ] Test thêm note mới và kích hoạt mutation React Query.
    - [ ] Test xóa note có modal xác nhận.
  - [ ] Tạo component `ResearchNotebook` tại `apps/web/features/session/research-notebook.tsx`.
  - [ ] Cập nhật `apps/web/features/session/session-detail.tsx`:
    - [ ] Thay thế placeholder tab `notebook` bằng `ResearchNotebook`.
    - [ ] Thêm nút "Ghi chú nhanh" (Quick Note) trực tiếp từ kết quả `EvidencePanel` và `PrincipleSuggestions`.

---

### 📋 Track 5: Phase 9.1 — Markdown Session Export (Quick-Win)
- **Mức độ rủi ro**: **RẤT THẤP** (Read-only query, không thay đổi trạng thái hệ thống)
- **Backend & Frontend Tasks**:
  - [ ] **Test-First**: Viết test suite `backend/tests/integration/test_session_export.py`:
    - [ ] Test `GET /api/v1/sessions/{id}/export?format=md` trả về status 200, Content-Type `text/markdown`, chứa đầy đủ Frontmatter, Problem Analysis, Principles, Evidence và Notes.
    - [ ] Test 404 khi export session không tồn tại.
  - [ ] Tạo service `backend/src/app/services/session_export_service.py` format Markdown chuẩn mực (Gfm, tables, callout blocks).
  - [ ] Thêm route `GET /api/v1/sessions/{id}/export` vào `backend/src/app/api/v1/endpoints/sessions.py`.
  - [ ] Thêm nút `Xuất báo cáo (Markdown)` trên Header của `session-detail.tsx`.

---

## 3. Pre-Flight & Post-Flight Quality Gates

| Gate | Điều kiện kiểm tra | Lệnh xác minh |
|---|---|---|
| **Gate 1: Migration Verification** | 001 $\rightarrow$ 002 $\rightarrow$ downgrade 001 $\rightarrow$ downgrade base | `pytest backend/tests/integration/test_alembic_migrations.py` |
| **Gate 2: Backend Lint & Typecheck** | Zero errors | `ruff check backend/src` và `mypy backend/src` |
| **Gate 3: Backend Integration Tests** | 100% Passed, coverage $\ge 85\%$ | `pytest backend/tests/integration` |
| **Gate 4: Frontend Lint & Typecheck** | Zero errors | `npm run lint` và `npm run type-check` (trong `apps/web`) |
| **Gate 5: Frontend Tests** | 100% Passed | `npm test` (trong `apps/web`) |
| **Gate 6: Live Container Smoke Test** | Container health checks pass | `docker compose up -d --build && curl -f http://localhost:8000/health` |
