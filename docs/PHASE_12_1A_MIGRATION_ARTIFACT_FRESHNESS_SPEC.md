# PHASE 12.1A — MIGRATION ARTIFACT FRESHNESS & DRIFT DETECTION SPECIFICATION

- **Tài liệu:** Đặc tả kỹ thuật & Quy chuẩn vận hành Phase 12.1A
- **Dự án:** Creative Research Workbench
- **Trạng thái:** 🟢 APPROVED SPEC (Chuẩn hóa sau sự cố rollout Phase 12.1)
- **Tài liệu liên quan:** `docs/ADR-002-migration-artifact-freshness.md`
- **Kỷ luật áp dụng:** Spec-first, Test-first, Dual-check Preflight, Schema-level Postflight

---

## 1. Problem Statement & Mục tiêu

### Bối cảnh & Vấn đề
Trong kiến trúc phân tán giữa Host Workspace và Docker Containers:
- Migration files (`backend/alembic/versions/*.py`) được sinh ra và chỉnh sửa trực tiếp trên host.
- Database PostgreSQL (`crw_postgres`) chạy trong container độc lập có expose port ra host (`5433:5432`).
- Backend container (`crw_api`) được build từ Docker image tĩnh, không tự động nhận các file migration mới trên host trừ khi được rebuild.
- Khi kỹ sư thực thi `docker exec crw_api alembic upgrade head`, lệnh hoàn thành với mã thoát `0` nhưng không nâng cấp database vì container không thấy file migration mới nhất. Điều này dẫn đến hiện tượng **Migration Artifact Drift** và tạo cảm giác an toàn giả tạo (False Sense of Success).

### Mục tiêu Phase 12.1A
1. Thiết lập quy chuẩn kiểm tra **Độ tươi mới của Migration Artifacts (Artifact Freshness)** trước khi thực thi lệnh nâng cấp schema.
2. Định nghĩa quy trình rollout chuẩn cho môi trường phát triển cục bộ (Local Host Execution) và môi trường container hóa (CI / Release Phase).
3. Đảm bảo 100% các lần thay đổi schema đều được xác minh độc lập ở cấp độ Database Catalog (Postgres system catalogs) thay vì chỉ tin cậy vào exit code của tiến trình Alembic.

---

## 2. Phạm vi (Scope & Out-of-Scope)

### Trong phạm vi (In-Scope):
1. Đặc tả quy trình Dual-check Preflight (`alembic current` vs `alembic heads`).
2. Quy định lệnh thực thi migration cho môi trường phát triển local qua host toolchain (`uv run alembic`).
3. Tiêu chuẩn xác minh Postflight qua truy vấn SQL trực tiếp (`alembic_version`, `pg_indexes`, `information_schema`).
4. Gherkin Scenarios mô tả các ca kiểm thử phát hiện sai lệch artifact.

### Ngoài phạm vi (Out-of-Scope):
1. Không sửa đổi mã nguồn ứng dụng (`backend/src/`).
2. Không thay đổi cấu hình runtime production của Docker Compose trong đợt này.
3. Không can thiệp vào các logic nghiệp vụ của `RetrievalService` hay `IngestionService`.

---

## 3. Quy chuẩn Vận hành Rollout (Standard Rollout Protocol)

Mọi thao tác migration trên môi trường phát triển cục bộ bắt buộc tuân theo 4 bước:

### Bước 1: Dual-check Preflight
```bash
cd backend
DATABASE_URL="postgresql+asyncpg://crw_user:crw_password@localhost:5433/crw_dev" uv run alembic current
DATABASE_URL="postgresql+asyncpg://crw_user:crw_password@localhost:5433/crw_dev" uv run alembic heads
```
- **Điều kiện tiếp tục**: `current` phải phản ánh revision hiện tại của DB, và `heads` phải phản ánh revision mới nhất trong thư mục `backend/alembic/versions/`. Nếu `current == heads` nhưng có migration mới vừa viết, phải dừng ngay để kiểm tra đường dẫn file.

### Bước 2: Snapshot Baseline
```bash
docker exec crw_postgres psql -U crw_user -d crw_dev -c "SELECT version_num FROM alembic_version;"
docker exec crw_postgres psql -U crw_user -d crw_dev -c "SELECT count(*) AS doc_count FROM documents; SELECT count(*) AS chunk_count FROM chunks;"
```

### Bước 3: Thực thi Nâng cấp (Host Execution)
```bash
cd backend
DATABASE_URL="postgresql+asyncpg://crw_user:crw_password@localhost:5433/crw_dev" uv run alembic upgrade head
```

### Bước 4: Schema-level Postflight Verification
```bash
docker exec crw_postgres psql -U crw_user -d crw_dev -c "SELECT version_num FROM alembic_version;"
docker exec crw_postgres psql -U crw_user -d crw_dev -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'chunks';"
docker exec crw_postgres psql -U crw_user -d crw_dev -c "SELECT count(*) AS doc_count FROM documents; SELECT count(*) AS chunk_count FROM chunks;"
```

---

## 4. Gherkin Scenarios cho Phase 12.1A

```gherkin
Feature: Migration Artifact Freshness and Drift Detection

  Scenario: Preflight detects stale migration artifacts when container is outdated
    Given một file migration mới "003_add_vector_cosine_index.py" tồn tại trên host workspace
    And backend container "crw_api" được build từ image cũ chỉ có migration "001" và "002"
    When kỹ sư kiểm tra "alembic heads" từ bên trong container "crw_api"
    Then kết quả trả về là "002"
    And hệ thống xác định có sự sai lệch (drift) so với "heads" thực tế trên host là "003"
    And chặn việc thực thi rollout qua container stale

  Scenario: Host-first rollout successfully applies latest migration revision
    Given cơ sở dữ liệu local "crw_dev" đang ở revision "002"
    And host workspace chứa migration "003" với head hợp lệ
    When thực thi lệnh "uv run alembic upgrade head" từ host kết nối port 5433
    Then database "crw_dev" được nâng cấp thành công lên revision "003"
    And index "ix_chunks_embedding_cosine" xuất hiện trong catalog "pg_indexes"

  Scenario: Schema-level postflight catches missing DDL artifacts
    Given lệnh "alembic upgrade head" trả về exit code 0
    When thực hiện truy vấn trực tiếp vào PostgreSQL catalog
    Then kiểm tra bảng "alembic_version" phải khớp chính xác với target revision
    And kiểm tra metadata cấu trúc bảng/index phải tồn tại theo đúng đặc tả DDL
    And số lượng bản ghi hiện có không bị mất mát hoặc biến đổi ngoài ý muốn
```

---

## 5. Tiêu chuẩn Đánh giá Hoàn thành (Definition of Done)

- [x] Tài liệu `ADR-002-migration-artifact-freshness.md` được phê duyệt và lưu trữ trong `docs/`.
- [x] Đặc tả `PHASE_12_1A_MIGRATION_ARTIFACT_FRESHNESS_SPEC.md` được phê duyệt.
- [x] Đã áp dụng và nghiệm thu thành công quy trình trên database `crw_dev` ở Phase 12.1.
