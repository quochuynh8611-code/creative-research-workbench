# PHASE 6.1 — REAL EMBEDDING ENGINE IMPLEMENTATION CHECKLIST

> **Dự án**: Creative Research Workbench
> **Phiên bản kế hoạch**: Execution-Grade Implementation Checklist (Phase 6.1)
> **Trạng thái**: DRAFT — Chờ phê duyệt trước khi tiến hành code
> **Nguyên tắc**: Spec-first, Test-first, Read-before-write, Graceful-degradation, Zero-500-errors, Blast Radius kiểm soát chặt chẽ
> **Căn cứ**: [ADR-007](docs/ADR/ADR-007-phase-6-1-real-embedding-strategy.md), [PHASE_6_1_REAL_EMBEDDING_ENGINE_SPEC.md](docs/PHASE_6_1_REAL_EMBEDDING_ENGINE_SPEC.md), [PHASE_6_1_REAL_EMBEDDING_ENGINE_GHERKIN_MATRIX.md](docs/PHASE_6_1_REAL_EMBEDDING_ENGINE_GHERKIN_MATRIX.md)

---

## 1. Trình Tự Thực Thi Tổng Thể (Execution Sequence)

```
[Bước 1: Phê Duyệt Spec & ADR] (Blast Radius: ZERO)
  ├── ADR-007 (Real Embedding Strategy)
  ├── PHASE_6_1_REAL_EMBEDDING_ENGINE_SPEC.md
  └── PHASE_6_1_REAL_EMBEDDING_ENGINE_GHERKIN_MATRIX.md
         │
         ▼
[Bước 2: Test-First Hardening] (Blast Radius: THẤP)
  ├── Bổ sung unit tests cho retry/backoff & fallback trong test_embedding_clients.py
  └── Bổ sung test CLI reembed_chunks.py với các cờ tham số
         │
         ▼
[Bước 3: Runtime Polish & Hardening] (Blast Radius: TRUNG BÌNH)
  ├── Rà soát embedding_client.py (OpenAI / Gemini / Factory)
  ├── Tối ưu hóa script reembed_chunks.py (batching, exception safety)
  └── Đảm bảo zero-vector guard trong retrieval_service.py
         │
         ▼
[Bước 4: Toàn Diện Verification & Static Analysis] (Blast Radius: THẤP)
  ├── Static checks: ruff check, mypy backend/src
  ├── Unit & Integration tests (PostgreSQL/pgvector testcontainers)
  └── 100% test suite GREEN
         │
         ▼
[Bước 5: Human Approval Gate & Merge] (Blast Radius: ZERO)
```

---

## 2. Chi Tiết Từng Bước Thực Thi

### 📋 Bước 1: Spec & ADR Approval (Phê Duyệt Tài Liệu Thiết Kế)
- **Mức độ rủi ro (Blast Radius)**: **ZERO** (Chỉ tài liệu Markdown)
- **Tasks**:
  - [x] Soạn thảo `docs/ADR/ADR-007-phase-6-1-real-embedding-strategy.md`.
  - [x] Soạn thảo `docs/PHASE_6_1_REAL_EMBEDDING_ENGINE_SPEC.md`.
  - [x] Soạn thảo `docs/PHASE_6_1_REAL_EMBEDDING_ENGINE_GHERKIN_MATRIX.md`.
  - [x] Soạn thảo `docs/PHASE_6_1_REAL_EMBEDDING_ENGINE_IMPLEMENTATION_CHECKLIST.md`.
  - [ ] Trình duyệt Human Review để nhận lệnh APPROVE IMPLEMENTATION.
- **Rollback Note**: Xóa hoặc revert các file tài liệu nếu không được duyệt.

---

### 📋 Bước 2: Test-First Hardening (Bổ Sung & Củng Cố Test Suite)
- **Mức độ rủi ro (Blast Radius)**: **THẤP** (Chỉ tác động thư mục `tests/`)
- **Tasks**:
  - [ ] Kiểm tra và bổ sung unit test cho `OpenAIEmbeddingClient` khi API trả mã lỗi 429 (Rate Limit).
  - [ ] Kiểm tra và bổ sung unit test cho `GeminiEmbeddingClient` khi REST API trả HTTP 400 hoặc 500.
  - [ ] Kiểm tra test `test_reembed_all_chunks_logic` với cờ `--only-zero` và `--batch-size`.
  - [ ] Đảm bảo `DeterministicFakeEmbeddingClient` trong `test_real_embedding_integration.py` bao phủ đầy đủ kịch bản RRF Semantic Ranking.
- **Rollback Note**: Revert file test về trạng thái commit trước nếu test không hợp lệ.

---

### 📋 Bước 3: Runtime Polish & Hardening (Hoàn Thiện Mã Nguồn Runtime)
- **Mức độ rủi ro (Blast Radius)**: **TRUNG BÌNH** (Tác động `embedding_client.py` và `reembed_chunks.py`)
- **Tasks**:
  - [ ] Rà soát `embedding_client.py`:
    - [ ] Đảm bảo hàm `_standardize_dim` xử lý an toàn mọi kích thước vector đầu vào (padding zero hoặc truncate về 1536).
    - [ ] Đảm bảo log cảnh báo không in API key ra ngoài.
    - [ ] Đảm bảo `fallback_on_error=True` mặc định hoạt động trơn tru.
  - [ ] Rà soát `reembed_chunks.py`:
    - [ ] Hỗ trợ chuyển đổi connection string `asyncpg` $\rightarrow$ `psycopg2` an toàn.
    - [ ] Bổ sung logging tiến độ rõ ràng theo từng batch.
    - [ ] Bắt ngoại lệ và rollback session nếu một batch thất bại.
  - [ ] Rà soát `retrieval_service.py`:
    - [ ] Xác nhận điều kiện `if all(v == 0.0 for v in query_vector): return []` hoạt động ổn định.
- **Rollback Note**: Revert các file `src/app/` nếu phát sinh lỗi hồi quy.

---

### 📋 Bước 4: Toàn Diện Verification & Static Analysis (Kiểm Thử Toàn Bộ)
- **Mức độ rủi ro (Blast Radius)**: **THẤP** (Read-only execution)
- **Tasks**:
  - [ ] Chạy `uv run --project backend ruff check backend/src`.
  - [ ] Chạy `uv run --project backend mypy backend/src`.
  - [ ] Chạy `uv run --project backend pytest backend/tests/unit/test_embedding_clients.py`.
  - [ ] Chạy `uv run --project backend pytest backend/tests/integration/test_real_embedding_integration.py`.
  - [ ] Chạy toàn bộ backend test suite: `uv run --project backend pytest backend/tests/`.
  - [ ] Chạy frontend static & test checks (`npm run type-check`, `npm test`) để đảm bảo không có tác động chéo.
- **Rollback Note**: Sửa triệt để các warning/error phát hiện trong quá trình kiểm thử.

---

### 📋 Bước 5: Human Approval Gate & Safe Commit
- **Mức độ rủi ro (Blast Radius)**: **ZERO**
- **Tasks**:
  - [ ] Báo cáo tóm tắt kết quả kiểm thử.
  - [ ] Trình duyệt Human Review để xin phê duyệt Commit Phase 6.1.
  - [ ] Chỉ commit khi có lệnh `APPROVE COMMIT`.
