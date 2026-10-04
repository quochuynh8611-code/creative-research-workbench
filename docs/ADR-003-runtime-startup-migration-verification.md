---
title: "ADR-003 — Tích hợp Xác minh Migration và Schema vào Chu trình Khởi động Runtime (Runtime Startup Migration Verification)"
topic: "architecture"
source_type: "decision-record"
language: "vi"
tags: ["adr", "database", "alembic", "migrations", "runtime", "startup", "drift-detection", "fail-closed"]
phase: "12.1C"
status: "canonical"
created: "2026-10-04"
---

# ADR-003 — Tích hợp Xác minh Migration và Schema vào Chu trình Khởi động Runtime (Runtime Startup Migration Verification)

## 1. Bối cảnh (Context)

1. Trong các giai đoạn trước (Phase 12.1A và Phase 12.1B):
   - Chúng tôi đã giải quyết nguy cơ sai lệch migration artifact ở cấp độ build/CI (`ADR-002`, kiểm tra tính tươi mới của file migration trong source repo và Docker image).
   - Chúng tôi đã xây dựng module kiểm tra runtime độc lập `app.infrastructure.migrations.runtime_verification` hỗ trợ đọc source heads, đọc database revision, thực hiện preflight và postflight schema catalog validation.
2. Tuy nhiên, trong chu trình triển khai thực tế của container backend:
   - Script khởi động `backend/entrypoint.sh` hiện chỉ thực thi `alembic upgrade head` rồi lập tức chuyển giao quyền điều khiển sang `exec "$@"` (khởi chạy Uvicorn/FastAPI server).
   - Nếu xảy ra lỗi DDL ngầm, mạng chập chờn gây migration dở dang, hoặc cơ sở dữ liệu có schema drift nhưng lệnh Alembic không trả về mã lỗi rõ ràng, ứng dụng vẫn sẽ khởi động bình thường.
   - Hiện tượng này dẫn đến tình trạng container phục vụ các API request trong khi schema database thực tế chưa sẵn sàng (ví dụ thiếu index vector `ix_chunks_embedding_cosine`), gây suy giảm nghiêm trọng độ tin cậy và hiệu năng hệ thống.
3. Do đó, cần có một cơ chế cổng chặn (gate guard) bắt buộc ngay tại chu trình khởi động runtime (Startup / Release Lifecycle) để đảm bảo nguyên tắc **Fail-closed**.

---

## 2. Quyết định Kiến trúc (Architectural Decision)

Chúng tôi quyết định tích hợp bước kiểm tra xác minh migration và schema catalog (Runtime Startup Migration Verification) trực tiếp vào chu trình khởi động của container backend với các nguyên tắc sau:

1. **Thêm bước Orchestration Step giữa Migration và App Server:**
   - Sau khi lệnh `alembic upgrade head` hoàn thành và trước khi gọi `exec "$@"`, container bắt buộc phải kích hoạt bước xác minh postflight qua Python runner.
2. **Sử dụng Python Verification Module thay vì viết SQL thô trong Shell Script:**
   - Toàn bộ logic kết nối cơ sở dữ liệu, truy vấn PostgreSQL catalog (`information_schema.tables`, `pg_indexes`), và kiểm tra thuộc tính index (`ivfflat`, `vector_cosine_ops`) được thực hiện thông qua module Python đã chuẩn hóa `app.infrastructure.migrations.runtime_verification`.
   - Giữ cho shell script `entrypoint.sh` tinh gọn, chỉ đóng vai trò điều phối cấp hệ điều hành.
3. **Xác định Dynamic Expected Head từ Source Directory (Không hardcode Revision):**
   - Không được ghi cứng (hardcode) giá trị revision như `'003'` vào bất kỳ shell script hay mã nguồn khởi động nào.
   - Runtime tự động đọc source heads từ thư mục `alembic/versions` thông qua Alembic `ScriptDirectory`, yêu cầu chính xác 1 head duy nhất và dùng head đó làm căn cứ đối soát (expected revision) với database catalog.
4. **Kỷ luật Chặn An toàn (Fail-closed Policy):**
   - Nếu preflight phát hiện bất thường (không có head hoặc phân nhánh nhiều heads), tiến trình dừng ngay lập tức.
   - Nếu lệnh nâng cấp Alembic trả về exit code khác `0`, tiến trình dừng ngay lập tức.
   - Nếu postflight phát hiện database revision không khớp hoặc thiếu index pgvector yêu cầu, tiến trình in thông báo lỗi chi tiết ra `stderr` và thoát với exit code khác `0` (`exit 1`), tuyệt đối ngăn chặn việc khởi chạy app server.

---

## 3. Các Lựa chọn Đã Cân nhắc (Options Considered)

### Phương án A: Viết truy vấn SQL kiểm tra trực tiếp trong Shell script (`entrypoint.sh` bằng `psql`)
- **Ưu điểm:** Không cần phụ thuộc vào môi trường Python cho bước kiểm tra.
- **Nhược điểm:**
  - Cần cài đặt thêm `postgresql-client` (`psql`) vào production Docker image, làm tăng dung lượng image.
  - Xử lý chuỗi và parse kết quả truy vấn SQL trong POSIX shell rất dễ gặp lỗi, thiếu khả năng kiểm soát type an toàn.
  - Phân tán logic kiểm tra giữa Python codebase và Shell scripts.
- **Đánh giá:** **Bị từ chối.**

### Phương án B (Được chọn): Sử dụng Python Orchestration Runner kết hợp với Module `runtime_verification`
- **Ưu điểm:**
  - Tái sử dụng 100% module `runtime_verification` và models đã có unit test, integration test chặt chẽ.
  - Đọc dynamic source heads chuẩn xác thông qua Alembic API chính quy.
  - Truy vấn database an toàn qua SQLAlchemy connection/engine của backend.
  - Dễ dàng viết test mô phỏng (unit test & integration test) cho toàn bộ runner logic.
- **Đánh giá:** **Được chấp thuận (Canonical Choice).**

### Phương án C: Chỉ dựa vào các bước kiểm tra ở CI / Build Time
- **Ưu điểm:** Giảm thời gian khởi động của container ở môi trường production.
- **Nhược điểm:**
  - Không bảo vệ được hệ thống trong các trường hợp triển khai trên môi trường staging/production thực tế khi target database có thể bị lệch trạng thái hoặc migration chạy không hoàn tất lúc container scale up.
  - Không bắt được runtime transient schema failures.
- **Đánh giá:** **Bị từ chối.**

---

## 4. Đánh đổi (Trade-offs)

- **Tăng độ an toàn & tin cậy vận hành (Operational Reliability):** 🟢 Loại bỏ hoàn toàn nguy cơ app server khởi động phục vụ traffic trên một database có schema không đồng bộ hoặc thiếu index quan trọng.
- **Độ phức tạp khởi động (Startup Complexity):** 🟡 Thêm một bước trung gian trong chuỗi khởi động của container.
- **Thời gian khởi động (Startup Latency):** 🟡 Tăng thêm ~50–200ms cho việc kết nối database và truy vấn catalog khi container bắt đầu chạy (mức tăng này không đáng kể so với thời gian tải Uvicorn và import thư viện).

---

## 5. Hệ quả (Consequences)

1. Tiến trình khởi động của backend container có tính phụ thuộc rõ ràng và minh bạch vào trạng thái sẵn sàng của cơ sở dữ liệu.
2. Cần xây dựng test suite cho startup orchestration runner để đảm bảo mọi nhánh lỗi đều được kích hoạt chính xác (RED -> GREEN ở Phase 12.1C.2 và 12.1C.3).
3. File `entrypoint.sh` cùng với Python migration runner sẽ trở thành cổng thực thi (Point of Enforcement) chuẩn mực cho toàn bộ các môi trường triển khai (Local Compose, Staging, Production).

---

## 6. Nguyên tắc Ràng buộc (Guardrails)

- **Tuyệt đối không hardcode literal revision:** Không viết `'003'` trong shell script hay Python entrypoint runner.
- **Không nuốt lỗi (Never Swallow Failures):** Không dùng `|| true` hoặc cấu trúc bắt lỗi im lặng trong quá trình verification. Mọi ngoại lệ `MigrationVerificationError` phải được log ra `stderr` và trả về non-zero exit code.
- **Chặn đứng Server:** App server (`uvicorn`) chỉ được kích hoạt duy nhất khi postflight verification đã trả về snapshot hợp lệ.

---

## 7. Trạng thái Quyết định (Status)

- **Trạng thái:** Canonical / Pending Implementation (Sẽ được hiện thực hóa trong Phase 12.1C.2 và 12.1C.3).
- **Phạm vi áp dụng:** Toàn bộ backend container lifecycle của dự án Creative Research Workbench.
