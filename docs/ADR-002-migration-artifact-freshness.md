---
title: "ADR-002 — Quản trị Độ tươi mới của Migration Artifacts (Migration Artifact Freshness & Drift Detection)"
topic: "architecture"
source_type: "decision-record"
language: "vi"
tags: ["adr", "database", "alembic", "migrations", "docker", "operations"]
phase: "12"
status: "canonical"
golden: true
created: "2026-10-04"
---

# ADR-002 — Quản trị Độ tươi mới của Migration Artifacts (Migration Artifact Freshness & Drift Detection)

## Bối cảnh

Trong chu trình phát triển và vận hành hệ thống Creative Research Workbench:
1. Cơ sở dữ liệu PostgreSQL (`crw_postgres` / `crw_dev`) chạy dưới dạng container Docker độc lập.
2. Mã nguồn backend và các file migration Alembic mới (`backend/alembic/versions/`) được tạo và quản lý trên máy trạm cục bộ (host workspace).
3. Trong sự cố rollout Phase 12.1, lệnh `docker exec crw_api alembic upgrade head` trả về exit code `0` nhưng thực tế không áp dụng migration `003` vào database vì container `crw_api` sử dụng Docker image được build trước đó và không chứa file migration `003` mới.
4. Hiện tượng này tạo ra trạng thái **Silent Success / False Positive**: Lệnh nâng cấp báo thành công (do container đã ở head của chính nó tại `002`), nhưng database thực tế chưa nhận được thay đổi DDL từ workspace host (`003`).

## Quyết định Kiến trúc

Chúng tôi quyết định chuẩn hóa **Quy trình Quản trị Độ tươi mới của Migration Artifacts** và kỷ luật kiểm soát migration hai lớp (Dual-check Preflight + Schema-level Postflight):

### 1. Phân định Phương thức Thực thi Migration theo Môi trường
- **Môi trường Phát triển Cục bộ (Local Development)**:
  - Khuyến nghị thực thi Alembic trực tiếp từ Host workspace thông qua `uv run alembic upgrade head` với kết nối tới database container qua port mapping (mặc định: `localhost:5433/crw_dev`).
  - Đảm bảo toàn bộ migration file mới nhất trên filesystem host được nhận diện tức thì mà không phụ thuộc vào chu kỳ build lại Docker image backend.
- **Môi trường CI / Staging / Production**:
  - Migration chỉ được thực thi sau khi Docker image backend được build mới nhất từ commit tương ứng, hoặc chạy qua release phase chuyên biệt trong pipeline CI/CD.

### 2. Kỷ luật Dual-check Preflight
Trước khi thực hiện bất kỳ lệnh `alembic upgrade` nào, bắt buộc kiểm tra đồng thời hai giá trị:
1. `alembic current`: Đọc revision thực tế đang lưu trong bảng `alembic_version` của target database.
2. `alembic heads`: Đọc revision mới nhất hiện có trong thư mục migration artifacts nguồn.
3. **Quy tắc chặn (Gate Guard)**: Nếu `current == heads` trong khi kỹ sư vừa tạo migration mới, hệ thống đang gặp lỗi **Stale Migration Artifacts**. Phải dừng rollout ngay để kiểm tra nguồn artifact.

### 3. Kỷ luật Schema-level Postflight Verification
- Không coi exit code `0` của `alembic upgrade` là bằng chứng duy nhất của việc rollout thành công.
- Bắt buộc xác minh độc lập qua truy vấn trực tiếp vào PostgreSQL catalog:
  - `SELECT version_num FROM alembic_version;`
  - Kiểm tra sự tồn tại của bảng, cột, hoặc index tương ứng trong `pg_indexes` / `information_schema`.
  - Kiểm tra tính toàn vẹn số lượng bản ghi (`count(*)`) trước và sau nâng cấp.

## Các Phương án Đã Cân nhắc

### Phương án 1: Chỉ chạy migration qua container backend mà không kiểm tra heads
- **Từ chối**: Tiềm ẩn rủi ro cao gây silent drift giữa host codebase và database runtime.

### Phương án 2: Tự động `docker cp` file migration vào container đang chạy
- **Từ chối**: Thao tác mang tính tạm bợ, có thể để lại state không đồng nhất giữa container filesystem và image gốc.

### Phương án 3 (Được chọn): Chuẩn hóa Host-first CLI cho Local Dev kèm quy trình Dual-check Preflight / Postflight
- **Chấp thuận**: Tận dụng tối đa môi trường quản lý gói `uv`, đảm bảo tính minh bạch 100% của migration artifacts và tương thích hoàn toàn với kiến trúc container hóa.

## Hệ quả

- **Tích cực:**
  - Loại bỏ hoàn toàn lỗi false-positive khi triển khai migration.
  - Đảm bảo database luôn phản ánh chính xác schema mong muốn của codebase.
  - Quy trình rollout và rollback rõ ràng, có thể kiểm chứng độc lập.
- **Chi phí:**
  - Kỹ sư/Agent cần thực hiện bước preflight kiểm tra `current` và `heads` trước khi nâng cấp.

## Trạng thái

- **Trạng thái:** Canonical / Accepted (Áp dụng từ Phase 12.1).
