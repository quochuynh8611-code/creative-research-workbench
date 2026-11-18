# HƯỚNG DẪN TRIỂN KHAI & SỔ TAY VẬN HÀNH (STANDARD OPERATING RUNBOOK)

**Dự án:** Creative Research Workbench (CRW)  
**Tài liệu:** Standard Operating Runbook (Phục vụ Self-Host & Production-Ready Operations)  
**Phiên bản:** v1.2.0 (Chuẩn hóa Batch C32 — Operational Excellence)  
**Ràng buộc bảo mật:** Zero Secret Exposure — Tuyệt đối không commit credentials hoặc API keys.

---

## 1. Yêu Cầu Tiên Quyết (Prerequisites)

Trước khi khởi động hoặc vận hành Creative Research Workbench, máy chủ hoặc máy trạm phải đáp ứng:

1. **Docker Engine & CLI:**
   - Docker Engine phiên bản >= `24.0.0`
   - Docker Compose phiên bản >= `v2.20.0`
   - Kiểm tra bằng lệnh:
     ```bash
     docker --version && docker compose version
     ```
2. **Tài nguyên phần cứng khuyến nghị:**
   - RAM: Tối thiểu 4GB (Khuyến nghị 8GB nếu chạy kèm Ollama LLM cục bộ)
   - Ổ cứng: Tối thiểu 10GB dung lượng trống cho Docker images và volume PostgreSQL
3. **Cổng mạng (Ports) khả dụng trên Host:**
   - `3011`: Cổng truy cập Web Frontend (tránh xung đột với cổng 3000 của các ứng dụng khác)
   - `8000`: Cổng API Gateway Backend (FastAPI)
   - `5433`: Cổng PostgreSQL + pgvector expose ngoài host (tránh xung đột với PostgreSQL mặc định cổng 5432)
   - Kiểm tra cổng trống trước khi chạy:
     ```bash
     lsof -i :3011 -i :8000 -i :5433
     ```

---

## 2. Thiết Lập Môi Trường (Environment Setup)

1. **Khởi tạo file cấu hình `.env`:**
   Sao chép từ bản mẫu an toàn `.env.example`:
   ```bash
   cp .env.example .env
   chmod 600 .env
   ```
2. **Nguyên tắc cấu hình `DATABASE_URL` theo ngữ cảnh:**
   - **Chạy bên trong Docker Stack:** `docker-compose.yml` đã được định tuyến tự động đến container `db` qua mạng nội bộ:
     ```env
     DATABASE_URL=postgresql+asyncpg://crw_user:crw_password@db:5432/crw_dev
     ```
   - **Chạy ứng dụng trực tiếp trên Host (Local Python Dev kết nối container DB):**
     ```env
     DATABASE_URL=postgresql+asyncpg://crw_user:crw_password@localhost:5433/crw_dev
     ```
3. **Cấu hình AI Provider:**
   - **Chế độ Mặc định (Mock Mode — Không tốn chi phí, không cần mạng):**
     ```env
     LLM_PROVIDER=mock
     EMBEDDING_PROVIDER=mock
     ```
   - **Chế độ OpenAI (AI Thực tế):**
     ```env
     LLM_PROVIDER=openai
     EMBEDDING_PROVIDER=openai
     OPENAI_API_KEY=sk-proj-your-real-key-here
     ```
   - **Chế độ Ollama (Mô hình Ngôn ngữ Cục bộ / Self-hosted):**
     ```env
     LLM_PROVIDER=ollama
     EMBEDDING_PROVIDER=ollama
     # Nếu truy cập từ container sang host: http://host.docker.internal:11434
     OLLAMA_BASE_URL=http://localhost:11434
     ```

---

## 3. Khởi Động Hệ Thống (Start Stack)

Khởi động toàn bộ stack 3 tầng (Database ➔ Backend API ➔ Web Frontend) ở chế độ daemon ngầm:
```bash
docker compose up -d --build
```

**Thứ tự khởi động phụ thuộc đảm bảo an toàn:**
1. Container `crw_postgres` khởi động và đạt trạng thái `healthy` (`pg_isready` PASS).
2. Container `crw_api` chạy migration verification qua `entrypoint.sh` và đạt trạng thái `healthy` (`curl /health` PASS).
3. Container `crw_frontend` bắt đầu phục vụ traffic Next.js Standalone.

---

## 4. Dừng Hệ Thống (Stop Stack)

1. **Dừng an toàn (Bảo toàn dữ liệu nghiên cứu):**
   ```bash
   docker compose stop
   ```
   *Hoặc hạ containers nhưng bảo lưu Volume:*
   ```bash
   docker compose down
   ```
2. **CẢNH BÁO MẤT DỮ LIỆU VỚI `-v`:**
   > [!CAUTION]
   > Tuyệt đối **KHÔNG** sử dụng `docker compose down -v` trong môi trường sản xuất hoặc khi đang lưu trữ dữ liệu thật. Cờ `-v` sẽ xóa sạch vĩnh viễn Volume `postgres_data` chứa toàn bộ sessions, notes, và embeddings.

---

## 5. Kiểm Tra Sức Khỏe Containers (Health Checks)

Kiểm tra trạng thái hoạt động của toàn bộ dịch vụ:
```bash
docker compose ps
```

*Mẫu kết quả hợp lệ chuẩn:*
```text
NAME           IMAGE                                  COMMAND                  SERVICE    STATUS                        PORTS
crw_postgres   pgvector/pgvector:pg16                 "docker-entrypoint.s…"   db         Up (healthy)                  0.0.0.0:5433->5432/tcp
crw_api        creative-research-workbench-api        "/app/entrypoint.sh …"   api        Up (healthy)                  0.0.0.0:8000->8000/tcp
crw_frontend   creative-research-workbench-frontend   "node server.js"         frontend   Up                            0.0.0.0:3011->3000/tcp
```

---

## 6. Kiểm Thử Nhanh Sau Khởi Động (Smoke Tests)

Thực hiện chuỗi lệnh xác thực đa chiều tự động cho toàn bộ stack (Core Services & AI Solution Coach):

```bash
# 1. Kiểm tra Backend API Liveness (Phải trả về HTTP 200 OK)
curl -s -o /dev/null -w "Backend Health: %{http_code}\n" http://localhost:8000/health

# 2. Kiểm tra Safe AI Status Endpoint (Phải trả về HTTP 200 OK kèm provider metadata, không lộ secret)
curl -s http://localhost:8000/api/v1/system/ai-status | jq .

# 3. Kiểm tra Sessions REST API (Phải trả về HTTP 200 OK)
curl -s -o /dev/null -w "Sessions API: %{http_code}\n" http://localhost:8000/api/v1/sessions

# 4. Kiểm tra Frontend SSR & Routing (Phải trả về HTTP 200 OK)
curl -s -o /dev/null -w "Frontend Web: %{http_code}\n" http://localhost:3011/sessions

# 5. Kiểm tra AI Solution Coach Endpoint (Batch C31 — Read-only Preview)
# 5.1. Lấy Session ID hiện có (KHÔNG tự tạo dữ liệu mới để test)
SESSION_ID=$(curl -s http://localhost:8000/api/v1/sessions | jq -r '.data[0].id // empty')

if [ -z "$SESSION_ID" ]; then
  echo "INFO: Chưa có session nào trong cơ sở dữ liệu để kiểm tra Coach."
  echo "Hướng dẫn: Vui lòng truy cập http://localhost:3011/sessions để tạo một phiên nghiên cứu thủ công trước khi chạy smoke test cho AI Coach."
else
  echo "Tìm thấy Session: $SESSION_ID. Tiến hành kiểm tra AI Coach..."

  # Gọi Coach suggestions API (pure query preview, không ghi vào database)
  COACH_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/v1/sessions/${SESSION_ID}/coach/suggestions")

  # Kiểm tra envelope và summary
  SUMMARY=$(echo "$COACH_RESPONSE" | jq -r '.data.summary // empty')
  if [ -n "$SUMMARY" ]; then
    echo "✓ Coach Summary: $SUMMARY"
  else
    echo "Lỗi: Không nhận được summary từ Coach API. Phản hồi thô:"
    echo "$COACH_RESPONSE" | jq .
  fi

  # Kiểm tra số lượng gợi ý (Tối đa 5 suggestions)
  SUGGESTIONS_COUNT=$(echo "$COACH_RESPONSE" | jq '.data.suggestions | length')
  echo "✓ Số gợi ý nhận được: $SUGGESTIONS_COUNT (Quy định: tối đa 5)"

  # Kiểm tra Hard Grounding (Tất cả gợi ý bắt buộc có căn cứ)
  echo "$COACH_RESPONSE" | jq -r '.data.suggestions[] | "  - [\(.category)] \(.title) -> Nguồn: \(.source_grounding.source_type) (\(.source_grounding.source_reference))"'

  # Kiểm tra Provenance (Phân biệt rõ ràng ai_coach vs rule_based_fallback)
  PROVENANCE=$(echo "$COACH_RESPONSE" | jq -r '.data.provenance // empty')
  echo "✓ Nguồn gốc gợi ý: $PROVENANCE (ai_coach hoặc rule_based_fallback)"

  # Kiểm tra Zero Secret Leakage (Sử dụng cấu trúc if/else an toàn với exit code)
  if echo "$COACH_RESPONSE" | grep -Eiq "(sk-proj|bearer|password|supersecret|stack_trace|filepath|database query)"; then
    echo "CẢNH BÁO BẢO MẬT: Phát hiện chuỗi nhạy cảm hoặc kỹ thuật trong phản hồi!" >&2
  else
    echo "✓ An toàn: Zero Secret Leakage."
  fi
fi
```

---

## 7. Sao Lưu Dữ Liệu Kèm Checksum SHA-256 (Database Backup)

Thực hiện sao lưu logic toàn diện với định dạng nén tối ưu (Custom format `-F c`) và tính toán mã băm SHA-256 để chống lỗi hỏng dữ liệu:

```bash
# Tạo thư mục chứa backup nếu chưa có
mkdir -p backups

# Định nghĩa tên file sao lưu có dấu thời gian ISO
BACKUP_FILE="backups/crw_backup_$(date +%Y%m%d_%H%M%S).dump"

# Tiến hành dump dữ liệu từ container PostgreSQL
docker compose exec -T db pg_dump -U crw_user -d crw_dev -F c -b -v > "$BACKUP_FILE"

# Tạo checksum SHA-256
shasum -a 256 "$BACKUP_FILE" > "$BACKUP_FILE.sha256"

# Xác nhận hoàn tất
echo "Backup hoàn tất: $BACKUP_FILE"
cat "$BACKUP_FILE.sha256"
```

---

## 8. Khôi Phục Dữ Liệu An Toàn (Database Restore)

Trước khi phục hồi, **bắt buộc** phải xác thực tính toàn vẹn của file backup thông qua mã băm SHA-256:

```bash
# Chỉ định file backup cần khôi phục (Ví dụ: backups/crw_backup_20261117_120000.dump)
TARGET_BACKUP="backups/crw_backup_YYYYMMDD_HHMMSS.dump"

# 1. BẮT BUỘC: Xác thực tính toàn vẹn qua SHA-256
if shasum -a 256 -c "$TARGET_BACKUP.sha256"; then
  echo "Xác thực Checksum SHA-256 thành công. Tiến hành khôi phục..."
else
  echo "LỖI BẢO MẬT: Checksum SHA-256 không khớp! File backup có thể bị hỏng hoặc bị can thiệp." >&2
  exit 1
fi

# 2. Khôi phục dữ liệu bằng pg_restore (clean các bảng cũ trước khi nạp)
docker compose exec -T db pg_restore -U crw_user -d crw_dev --clean --if-exists -v < "$TARGET_BACKUP"

# 3. Chạy lại verification của migration runner để đảm bảo tính nhất quán của schema
docker compose exec -T api python -m app.infrastructure.migrations.runner
```

---

## 9. Quy Trình Rollback Container & Image

Khi gặp sự cố sau khi triển khai phiên bản mới, thực hiện rollback theo các bước:

1. **Khôi phục mã nguồn về commit / tag ổn định trước đó:**
   ```bash
   git checkout <LAST_KNOWN_STABLE_COMMIT_SHA>
   ```
2. **Rebuild và khởi động lại container mà không ảnh hưởng tới Volume:**
   ```bash
   docker compose up -d --build
   ```
3. **Xác nhận tính tương thích của Schema:**
   Container `crw_api` khi khởi động sẽ tự động chạy preflight guard. Nếu schema hiện tại không tương thích, container sẽ fail-fast và báo lỗi trong log, bảo vệ an toàn cho dữ liệu.
4. **Kiểm tra trạng thái phục hồi:**
   ```bash
   docker compose ps
   curl -i http://localhost:8000/health
   ```

---

## 10. Giám Sát & Truy Vết Nhật Ký (Log Inspection)

1. **Theo dõi nhật ký toàn bộ hệ thống thời gian thực:**
   ```bash
   docker compose logs -f
   ```
2. **Theo dõi nhật ký riêng từng dịch vụ:**
   ```bash
   docker compose logs -f api        # Backend FastAPI logs
   docker compose logs -f frontend   # Next.js Server logs
   docker compose logs -f db         # PostgreSQL database logs
   ```
3. **Lọc và tìm kiếm lỗi runtime:**
   ```bash
   docker compose logs api --tail=200 | grep -i "error"
   docker compose logs db --tail=100 | grep -i "fatal"
   ```

---

## 11. Xử Lý Sự Cố Phổ Biến (Troubleshooting)

### A. Xung đột cổng kết nối (Port Conflict)
- **Triệu chứng:** Lỗi `Bind for 0.0.0.0:8000 failed: port is already allocated` hoặc `port 3011 is already allocated`.
- **Khắc phục:**
  1. Kiểm tra tiến trình đang chiếm cổng:
     ```bash
     lsof -i :8000 -i :3011 -i :5433
     ```
  2. Nếu là tiến trình cũ bị treo, giải phóng tiến trình hoặc đổi cổng mapping phía host trong `docker-compose.yml`.

### B. Lệch Schema / Migration Mismatch
- **Triệu chứng:** Container `crw_api` thoát đột ngột (Exited 1), log báo `MigrationVerificationError`.
- **Khắc phục:**
  1. Xem chi tiết log khởi động của API:
     ```bash
     docker compose logs api
     ```
  2. Kiểm tra phiên bản Alembic hiện hành so với mã nguồn:
     ```bash
     docker compose exec db psql -U crw_user -d crw_dev -c "SELECT version_num FROM alembic_version;"
     ```
  3. Chạy thủ công runner kiểm tra:
     ```bash
     docker compose exec api python -m app.infrastructure.migrations.runner
     ```

### C. AI Provider Bị Gián Đoạn hoặc Quá Hạn Mức (Degraded / Timeout)
- **Triệu chứng:** Giao diện hiển thị badge màu vàng "AI tạm thời không khả dụng", hoặc log ghi nhận timeout từ OpenAI/Ollama.
- **Khắc phục:**
  1. Kiểm tra endpoint `/api/v1/system/ai-status`:
     ```bash
     curl -s http://localhost:8000/api/v1/system/ai-status | jq .
     ```
  2. Nếu dùng OpenAI: Xác thực lại `OPENAI_API_KEY` còn hạn ngạch tín dụng.
  3. Nếu dùng Ollama: Xác nhận daemon Ollama đang hoạt động và model đã được nạp (`ollama list`).
  4. Hệ thống đã có cơ chế fail-safe tự động chuyển về Mock mode, đảm bảo các tác vụ quản lý session, note, export không bị treo hay mất dữ liệu.

### D. Lỗi CORS Origin Mismatch
- **Triệu chứng:** Trình duyệt báo lỗi `Access to fetch at ... from origin 'http://localhost:3011' has been blocked by CORS policy`.
- **Khắc phục:**
  Kiểm tra biến `ALLOWED_ORIGINS` trong `.env` hoặc `docker-compose.yml`, đảm bảo chứa đúng URL host và cổng mà trình duyệt đang sử dụng.

### E. AI Solution Coach Tự Động Kích Hoạt Rule-Based Fallback
- **Triệu chứng:** Thẻ gợi ý hiển thị nhãn màu hổ phách "Rule-based fallback" thay vì "AI Coach", hoặc log ghi nhận timeout > 10s từ LLM client.
- **Bản chất:** Đây là hành vi an toàn theo thiết kế (Dual-Layer Fallback & Resilient Heuristics). Khi OpenAI/Ollama gặp lỗi mạng, quá hạn ngạch (429) hoặc timeout, hệ thống tự động kích hoạt bộ Heuristic dựa trên 40 nguyên tắc sáng tạo TRIZ để không gián đoạn công việc của nhà nghiên cứu.
- **Khắc phục nếu muốn dùng AI thực tế:**
  1. Kiểm tra trạng thái AI tại `/api/v1/system/ai-status`.
  2. Kiểm tra log backend: `docker compose logs api --tail=100 | grep -i "coach"`.
  3. Nếu sử dụng OpenAI: Xác nhận `OPENAI_API_KEY` hợp lệ và tài khoản còn quota.
  4. Nếu sử dụng Ollama: Xác nhận Ollama daemon đang chạy và có thể truy cập từ mạng Docker (`curl http://host.docker.internal:11434/api/tags`).

### F. Truy Vết Và Giám Sát Fallback Của AI Coach Thời Gian Thực
- **Triệu chứng:** Cần phân tích lý do hệ thống chuyển sang Fallback (do timeout, lỗi JSON, hay rate-limit 429).
- **Cách quan sát:**
  1. Tra cứu chỉ số tổng hợp fallback qua endpoint metrics nội bộ:
     ```bash
     curl -s http://localhost:8000/api/v1/system/metrics | jq '.data.ai_coach_fallbacks'
     ```
  2. Lọc log có cấu trúc (JSON) để xem chi tiết mã lý do và session ID:
     ```bash
     docker compose logs api --tail=200 | grep "fallback_reason"
     ```
- **Khắc phục:**
  - `LLMTimeout`: Kiểm tra độ trễ mạng hoặc tải GPU/CPU của Ollama daemon.
  - `HTTP429`: Kiểm tra hạn mức sử dụng (billing quota) trên dashboard OpenAI.
  - `InvalidJSON` / `EmptySuggestions`: Kiểm tra prompt và model output format.

### G. In-Memory Metrics Bị Reset Sau Khi Khởi Động Lại Container
- **Triệu chứng:** Sau khi restart container `crw_api`, endpoint `/api/v1/system/metrics` trả về `sample_count: 0` cho các endpoint.
- **Bản chất:** Đây là hành vi có chủ đích theo thiết kế kiến trúc tinh gọn (ADR-013 Quyết định 3). Hệ thống sử dụng bộ đệm vòng (ring buffer max 1000) trên RAM để bảo vệ hiệu năng và không phụ thuộc vào hạ tầng ngoài (Redis/TimescaleDB).
- **Khắc phục / Vận hành:**
  - Nếu cần lưu trữ số liệu phục vụ phân tích dài hạn, thiết lập cronjob định kỳ cào dữ liệu từ `GET /api/v1/system/metrics` ra file snapshot JSON trước khi bảo trì/restart container.

### H. Anti-Production Guard Chặn Chạy Benchmark
- **Triệu chứng:** Khi chạy `backend/scripts/benchmark.py`, terminal báo lỗi:
  `[ERROR] Validation failed: Anti-Production Guard: Host '...' is not permitted.`
- **Bản chất:** Chốt chặn an toàn có chủ đích (ADR-013 Quyết định 5) nhằm ngăn chặn tuyệt đối nguy cơ vô tình bắn tải vào hạ tầng staging hay production. Runner chỉ chấp nhận: `localhost`, `127.0.0.1`, `0.0.0.0`, `testserver`.
- **Khắc phục:**
  - Đảm bảo tham số `--base-url` trỏ vào đúng sandbox nội bộ (mặc định: `http://localhost:8000`). Không cố gắng bypass guard trên môi trường production.

### I. Seeder Bị Chặn Bởi Anti-Production Guard
- **Triệu chứng:** Khi chạy script seeder `seed_demo_data.py`, terminal báo lỗi:
  `Error: Anti-Production Guard: Host 'api.crw-workbench.com' is not permitted. Demo seeder only allowed against localhost/sandbox environments...`
- **Bản chất:** Chốt chặn an toàn kiến trúc (ADR-014 Quyết định 2) ngăn chặn việc vô tình nạp dữ liệu mẫu vào môi trường staging hay production. Seeder chỉ chấp nhận các host: `localhost`, `127.0.0.1`, `0.0.0.0`, `testserver`.
- **Khắc phục:**
  - Seeder được thiết kế thuần túy cho môi trường phát triển cục bộ và sandbox phục vụ chuẩn bị demo. Đảm bảo tham số `--base-url` luôn trỏ vào `http://localhost:8000` hoặc sandbox IP tương đương.

### J. Seeder Tự Động Bỏ Qua (Skip) Do Trùng Dữ Liệu Demo & Hướng Dẫn Nạp Lại
- **Triệu chứng:** Kết quả chạy seeder báo cáo:
  `Sessions Created: 0, Sessions Skipped: 2`, và cột trạng thái hiển thị `skipped_existing`.
- **Bản chất:** Tính lũy đẳng đa tiêu chí (Multi-criteria Idempotency) tự động phát hiện hệ thống đã tồn tại các phiên nghiên cứu có tiền tố `[DEMO]` hoặc có tiêu đề chính xác khớp với bài toán mẫu.
- **Quy tắc vận hành & Hướng dẫn nạp lại:**
  - **Chạy Lần 2 Không Tạo Trùng:** Nếu script seeder được chạy lại lần 2 (hoặc nhiều lần) trên cùng một sandbox, hệ thống tự động nhận diện và **skip cả 2 session**, bảo đảm không bao giờ sinh ra dữ liệu trùng lặp rác.
  - **Khôi Phục / Nạp Lại:** Nếu người dùng chủ động xóa hoặc archive các session `[DEMO]` trên giao diện hoặc qua API, hệ thống sẽ phát hiện phiên mẫu chưa có và cho phép script seeder nạp lại toàn bộ dữ liệu mẫu ban đầu một cách an toàn.

---

## 12. Quy Tắc Bảo Mật & Quản Trị Bí Mật (Secret Handling Rules)

1. **Không Lưu Secret Trong Kho Mã Nguồn:**
   - Tuyệt đối không commit file `.env`, API key, token, private key vào Git repository.
   - Luôn đảm bảo `.env` nằm trong danh sách `.gitignore`.
2. **Quyền Hạn Tệp Tin:**
   - Thiết lập quyền đọc hạn chế cho `.env` trên máy chủ: `chmod 600 .env`.
3. **Không Ghi Secret Vào Nhật Ký (Logs):**
   - Endpoint `/api/v1/system/ai-status` chỉ trả về cờ boolean `configured: true/false` và tên model; không bao giờ trả về API key.
   - Không in `settings.OPENAI_API_KEY` hoặc chuỗi mật khẩu database ra stdout/stderr trong mã nguồn.

---

## 13. Sổ Tay Vận Hành & Đo Lường Hệ Thống (Operational Excellence Runbook — Batch C32)

### 13.1. Truy Vết Yêu Cầu Qua Correlation ID (End-to-End Request Tracing)
Backend tự động quản lý Correlation ID cho mọi HTTP request nhằm kết nối chuỗi log xuyên suốt từ API Gateway đến Service và Database:
1. **Truyền Correlation ID từ Client:**
   Client có thể chủ động đính kèm header `X-Request-ID` hoặc `X-Correlation-ID` trong request:
   ```bash
   curl -i -H "X-Request-ID: req-audit-test-001" http://localhost:8000/api/v1/sessions
   ```
2. **Quy Tắc Nhận Diện & Phản Hồi Header (Validation & Echo Behavior):**
   - **Trường hợp Client Gửi Header:** Nếu client gửi `X-Request-ID` (hoặc `X-Correlation-ID`), backend nhận diện và **echo lại chính xác giá trị đó** trong response headers (`X-Request-ID: req-audit-test-001` và `X-Correlation-ID: req-audit-test-001`).
   - **Trường hợp Client Không Gửi:** Backend **tự động sinh một UUID4 ngẫu nhiên** (`uuid.uuid4().hex`) để gán cho request.
   - Backend **luôn trả về cả 2 headers** `X-Request-ID` và `X-Correlation-ID` trong mọi response headers để đảm bảo tính tương thích hai chiều.
3. **Tra cứu log tập trung theo Correlation ID:**
   Toàn bộ log được định dạng JSON có cấu trúc (`timestamp`, `level`, `correlation_id`, `module`, `message`). Để xem toàn bộ hành trình xử lý của một request:
   ```bash
   docker compose logs api | grep '"correlation_id": "req-audit-test-001"'
   ```
4. **Bảo mật phản hồi lỗi 500 (Zero Stack Trace Leak):**
   Khi có lỗi hệ thống nội bộ, response gửi về client chỉ chứa `error_id` (chính là `correlation_id`) và thông báo tổng quát, tuyệt đối không lộ stack trace hay cấu trúc database:
   ```json
   {
     "error": "Internal server error",
     "error_id": "req-audit-test-001"
   }
   ```
   Kỹ sư vận hành sử dụng `error_id` này để tra cứu chính xác traceback đã được che giấu secret trong log container.

### 13.2. Giám Sát Hiệu Năng Thời Gian Thực (Internal System Metrics)
Backend duy trì một bộ đếm in-memory ring buffer (tối đa 1000 mẫu gần nhất) cho 4 endpoint cốt lõi:
- **Endpoint nội bộ:** `GET http://localhost:8000/api/v1/system/metrics`
- **Lệnh kiểm tra:**
  ```bash
  curl -s http://localhost:8000/api/v1/system/metrics | jq .
  ```
- **Cấu trúc dữ liệu giám sát:**
  - `endpoints`: Thống kê chi tiết cho `/health`, `/api/v1/sessions`, `/api/v1/system/ai-status`, `/api/v1/sessions/{id}/coach/suggestions`.
    - `sample_count`: Số mẫu trong bộ đệm rolling (tối đa 1000).
    - `duration_ms`: Phân vị độ trễ (`min`, `max`, `mean`, `p50`, `p90`, `p95`, `p99`).
    - `status_codes`: Phân loại mã HTTP theo nhóm (`2xx`, `3xx`, `4xx`, `5xx`).
  - `ai_coach_fallbacks`: Giám sát tần suất fallback của AI Solution Coach.
    - `total_fallbacks`: Tổng số lần kích hoạt Rule-Based Heuristics.
    - `by_reason`: Phân rã theo nguyên nhân (`LLMTimeout`, `HTTP429`, `InvalidJSON`, `EmptySuggestions`).

### 13.3. Đo Kiểm Tải Cục Bộ (Local Benchmark Suite)
Creative Research Workbench tích hợp sẵn công cụ benchmark bất đồng bộ nội bộ tại `backend/scripts/benchmark.py`:
1. **Lệnh chạy cơ bản (Đo kiểm 4 endpoint mặc định với 20 requests, 5 workers):**
   ```bash
   python -m backend.scripts.benchmark --requests 20 --concurrency 5 --output table
   ```
2. **Các tham số điều khiển:**
   - `--base-url`: URL server đích (mặc định: `http://localhost:8000`). Bắt buộc localhost / sandbox IP.
   - `--concurrency`: Số workers đồng thời (mặc định: 5, giới hạn an toàn tối đa: 10).
   - `--requests`: Số requests gửi đi (mặc định: 50, giới hạn an toàn tối đa: 100).
   - `--endpoint`: Endpoint cần đo (`all`, `health`, `sessions`, `ai_status`, `coach`).
   - `--output`: Định dạng báo cáo (`table` hoặc `json`).
3. **Quy định về ngưỡng Informational SLO:**
   - `/health`: Baseline $p95 < 25ms$, throughput > 50 req/s, error rate 0%.
   - `/api/v1/sessions`: Baseline $p95 < 100ms$, error rate 0%.
   - `/api/v1/system/ai-status`: Baseline $p95 < 50ms$, error rate 0%.
   - `/api/v1/sessions/{id}/coach/suggestions`: Baseline $p95 < 200ms$ (Mock/Fallback), error rate 0%.
   > [!NOTE]
   > Các ngưỡng SLO trên là **Informational Baseline**, nếu p95 vượt ngưỡng, runner sẽ in cảnh báo `WARN` nhưng không chặn build hay trả exit code lỗi.

---

## 14. Sổ Tay Vận Hành & Trình Diễn Sản Phẩm (Productization Runbook — Batch C33)

### 14.1. Nạp Dữ Liệu Demo Cho Môi Trường Local / Sandbox (Sample Data Seeder)
Creative Research Workbench tích hợp sẵn công cụ CLI nạp dữ liệu mẫu bất đồng bộ qua REST API tại `backend/scripts/seed_demo_data.py`:
1. **Lệnh chạy cơ bản (Hiển thị dạng bảng):**
   ```bash
   python -m backend.scripts.seed_demo_data --base-url http://localhost:8000 --format table
   ```
2. **Lệnh chạy xuất tệp tin JSON:**
   ```bash
   python -m backend.scripts.seed_demo_data --base-url http://localhost:8000 --format json --output demo_seed_summary.json
   ```
3. **Ràng buộc an toàn cốt lõi & Giới hạn môi trường:**
   - **Chỉ Chạy Local / Sandbox:** Anti-Production Guard chỉ cho phép chạy với `localhost`, `127.0.0.1`, `0.0.0.0`, `testserver`. Đây không phải là công cụ nạp dữ liệu production.
   - **Giới hạn số lượng nạp (Strict Bounds):** Chỉ seed đúng chính xác **2 demo sessions**:
     - *Mẫu 1 (Business):* Tối ưu hóa Tốc độ Giao hàng & Chi phí Logistics chặng cuối (1 problem frame, 2 notes, 2 solutions).
     - *Mẫu 2 (Software):* Tăng cường Bảo mật Đa tầng & Giảm Độ trễ API Gateway (1 problem frame, 1 note, 1 solution).
   - **Xác thực lệnh & Hành vi chạy lại (Validation & Re-run Behavior):**
     - **Chạy lần 2 tự động Skip:** Nếu chạy lại lệnh trên cùng một môi trường sandbox đã có sẵn dữ liệu mẫu, seeder tự động nhận diện cả tiền tố `[DEMO]` và tiêu đề chính xác để skip cả 2 session (`Sessions Created: 0, Sessions Skipped: 2`), bảo đảm không tạo trùng lặp.
     - **Tái nạp sau khi dọn dẹp:** Nếu người dùng xóa hoặc archive các session `[DEMO]`, script seeder sẽ nhận diện trạng thái chưa có và cho phép nạp lại đầy đủ 2 phiên mẫu ban đầu.
   - **Bảo mật tuyệt đối (Zero Secret Leak):** Cả định dạng Table và JSON đều được lọc qua bộ che giấu token nhạy cảm (`mask_secrets_in_text`), không để lộ API keys hay Bearer tokens.

### 14.2. Kịch Bản Trình Diễn Cho Stakeholder Trong 5 Phút (Stakeholder Demo Walkthrough)
- **Tài liệu kịch bản chuẩn:** Tham khảo [docs/DEMO_SCRIPT.md](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/docs/DEMO_SCRIPT.md).
- **Phân bổ 5 mốc thời gian:**
  - `0:00 - 0:45` | Mở đầu, giới thiệu triết lý TRIZ + AI Coach, Welcome Onboarding modal 3 bước, 1-click skip.
  - `0:45 - 1:45` | Mở session `[DEMO] Tối ưu Tốc độ Giao hàng & Chi phí Logistics`, phân tích mâu thuẫn (`speed` vs `loss_of_money`).
  - `1:45 - 2:45` | Khám phá Research Notes (thời gian chết, micro-hub) và Ma trận TRIZ (Nguyên tắc 10, 1, 35).
  - `2:45 - 4:00` | AI Solution Coach (Hard Grounding, cap 5), lưu giải pháp qua ConfirmationModal (Human-in-the-Loop).
  - `4:00 - 5:00` | Tab Synthesis, tổng hợp kế hoạch và giao diện in `@media print` sạch sẽ sẵn sàng xuất PDF.

### 14.3. Quy Trình Tiền Kiểm Tra Cho Người Thuyết Trình (Pre-Demo Health Check)
Trước khi bắt đầu buổi demo với đối tác hoặc ban lãnh đạo, người thuyết trình thực hiện checklist 4 bước:
1. **Kiểm tra sức khỏe Backend:**
   ```bash
   curl -s http://localhost:8000/health | jq .
   # Kỳ vọng: {"status": "ok"}
   ```
2. **Kiểm tra trạng thái AI Provider:**
   ```bash
   curl -s http://localhost:8000/api/v1/system/ai-status | jq .
   # Kỳ vọng: status hiển thị "configured" hoặc "ready", không rò rỉ API key
   ```
3. **Nạp dữ liệu mẫu an toàn:**
   ```bash
   python -m backend.scripts.seed_demo_data --base-url http://localhost:8000 --format table
   # Kỳ vọng: Bảng tóm tắt hiển thị 2 sessions sẵn sàng (created hoặc skipped_existing)
   ```
4. **Kiểm tra giao diện người dùng:**
   - Truy cập `http://localhost:3000/sessions`.
   - Xác nhận có 2 session mẫu bắt đầu bằng `[DEMO]`.
   - Xác nhận huy hiệu `AI Status Badge` ở góc trên bên phải hiển thị màu xanh (`READY`).

---

## 15. Sổ Tay Vận Hành TRIZ Nâng Cao (TRIZ Advanced Toolkit Runbook — Batch C34)

### 15.1. Hướng Dẫn Sử Dụng ARIZ Stepper (6 Bước Rút Gọn)
- **Vị trí trên giao diện:** Tab **Phân tích Cấu trúc (Structuring)** -> Card mở rộng `Thuật giải giải quyết vấn đề sáng chế (ARIZ 6 bước rút gọn)` (ngay dưới khối TRIZ 9-Windows).
- **Mục đích:** Hướng dẫn nhà nghiên cứu và kỹ sư bóc tách bài toán cấp 3, cấp 4 phức tạp thành mô hình mâu thuẫn vật lý và hướng tới Kết quả Lý tưởng Cuối cùng (IFR).
- **Quy trình 6 bước cốt lõi:**
  1. `B1_CHON_HE_THONG`: Chọn hệ thống kỹ thuật và phát biểu bài toán ban đầu (Mini-problem).
  2. `B2_MO_HINH_BAI_TOAN`: Xây dựng mô hình bài toán và xác định cặp thông số mâu thuẫn.
  3. `B3_PHAN_TICH_VUNG_XUNG_DOT`: Khoanh vùng không gian (OZ) và thời gian (OT) thao tác xảy ra xung đột.
  4. `B4_DINH_NGHIA_IFR`: Định nghĩa Kết quả Lý tưởng Cuối cùng (IFR-1 & IFR-2) và mâu thuẫn vật lý.
  5. `B5_HUY_DONG_NGUON_LUC`: Khai thác tối đa các nguồn lực Chất - Trường (SFR) sẵn có miễn phí.
  6. `B6_THAY_THE_HOAC_CHUYEN_DOI`: Chuyển đổi bài toán sang cấp siêu hệ thống/phân hệ hoặc áp dụng chiến lược phân tách.
- **Thao tác lưu sổ tay:** Nhập ghi chú giải pháp tại từng bước -> Bấm `Lưu vào sổ tay` -> Ghi chép tự động gắn `source_context` định danh `triz_ariz` (bước 1..6) vào Research Notebook.

### 15.2. Hướng Dẫn Sử Dụng Evolution Patterns Explorer (8 Quy Luật Kinh Điển)
- **Vị trí trên giao diện:** Tab **Ý tưởng & Nguyên tắc (Ideation)** -> Khối `8 Quy luật Tiến hóa Kỹ thuật (Altshuller)`.
- **Mục đích:** Định vị nấc tiến hóa hiện tại của sản phẩm/công nghệ và dự đoán bước nhảy vọt tương lai (Evolutionary Leap).
- **Danh mục 8 quy luật:**
  1. *Tính đầy đủ:* Đủ 4 bộ phận (nguồn năng lượng, động cơ, truyền động, cơ cấu công tác).
  2. *Dẫn truyền năng lượng:* Dòng năng lượng lưu thông tự do (cơ học -> thủy lực -> điện từ).
  3. *Điều phối nhịp điệu:* Phối hợp tần số, dao động và nhịp hoạt động.
  4. *Nâng cao tính lý tưởng:* Tỷ số Lợi ích / (Chi phí + Tác hại) tiến dần đến vô cực.
  5. *Phát triển không đều:* Các bộ phận phát triển với tốc độ khác nhau sinh ra mâu thuẫn.
  6. *Chuyển sang siêu hệ thống:* Đơn hệ -> Đa hệ kép -> Tích hợp siêu hệ thống.
  7. *Chuyển dịch Vĩ mô sang Vi mô:* Cơ học thô -> Bột mịn -> Chất lỏng/khí -> Trường/Plasma.
  8. *Tăng tính động:* Hệ thống cứng -> Có khớp -> Đàn hồi linh hoạt -> Trường tự thích nghi.
- **Thao tác lưu sổ tay:** Click mở rộng quy luật -> Xem lộ trình các giai đoạn và ví dụ đa lĩnh vực (Kỹ thuật, Phần mềm, Kinh doanh) -> Nhập ghi chú -> Bấm `Lưu vào sổ tay` (ngữ cảnh `triz_evolution`).

### 15.3. Hướng Dẫn Sử Dụng Resource Analysis Panel (5 Nhóm Tài Nguyên)
- **Vị trí trên giao diện:** Tab **Ý tưởng & Nguyên tắc (Ideation)** -> Khối `Phân tích Nguồn lực TRIZ (5 nhóm tài nguyên)`.
- **Mục đích:** Tìm kiếm các nguồn lực sẵn có, giá rẻ hoặc miễn phí xung quanh hệ thống để đạt IFR mà không phát sinh chi phí.
- **5 Nhóm tài nguyên (Tabs):**
  - `substance` (Chất): Vật liệu cấu thành, phụ phẩm, chất thải, môi trường tự nhiên.
  - `field` (Trường): Cơ, nhiệt, điện, từ, quang học, trọng lực (MATChEM).
  - `time` (Thời gian): Thời gian chuẩn bị, thời gian chết (idle time), chu kỳ hoạt động.
  - `space` (Không gian): Khoảng trống bên trong, bề mặt tiếp xúc, chiều thẳng đứng 3D.
  - `information` (Thông tin): Tín hiệu tự phát, trạng thái màu sắc, rung động, dữ liệu đo đạc.
- **Thao tác lưu sổ tay:** Chuyển đổi tab -> Đánh dấu checklist các nguồn lực tiềm năng -> Ghi chép phát hiện -> Bấm `Lưu vào sổ tay` (ngữ cảnh `triz_resource`).

### 15.4. Hướng Dẫn Truy Vết Bằng Correlation ID (Distributed Tracing)
- Mọi request HTTP gửi tới API backend tự động được gán mã định danh duy nhất thông qua header `X-Correlation-ID`.
- Khi client gửi kèm header `X-Correlation-ID: <custom-uuid>`, backend sẽ giữ nguyên mã đó xuyên suốt contextvars và đính kèm vào mọi dòng structured JSON log:
  ```json
  {"timestamp": "2026-11-18T13:00:00Z", "level": "INFO", "correlation_id": "c34-trace-uuid", "message": "Fetching ARIZ steps"}
  ```
- **Lệnh curl mẫu kiểm tra correlation ID:**
  ```bash
  curl -i -H "X-Correlation-ID: c34-test-trace-001" http://localhost:8000/api/v1/triz/ariz-steps
  # Header trả về phải có: X-Correlation-ID: c34-test-trace-001
  ```
- **Validation quy chuẩn Correlation ID:**
  - Nếu header phản hồi **không echo lại** `X-Correlation-ID`, kiểm tra ngay cấu hình middleware tại `backend/src/app/core/middleware/correlation_id.py` xem middleware đã được đăng ký trong FastAPI app (`main.py`) hay chưa.

### 15.5. Hướng Dẫn Đọc & Giám Sát Metrics Nội Bộ (`/api/v1/system/metrics`)
- Endpoint: `GET /api/v1/system/metrics` (In-memory, reset khi restart server, không lộ secret).
- **Lệnh truy vấn:**
  ```bash
  curl -s http://localhost:8000/api/v1/system/metrics | jq .
  ```
- **Các trường chỉ số cần theo dõi:**
  - `uptime_seconds`: Thời gian server hoạt động liên tục.
  - `endpoints`: Đếm lượt gọi, mã trạng thái HTTP và độ trễ ($p50, p95$) của từng route (bao gồm cả các route `/api/v1/triz/*`).
  - `ai_coach_fallbacks`:
    - `total_fallbacks`: Số lần kích hoạt Rule-Based Heuristic khi LLM gặp sự cố.
    - `by_reason`: Phân rã nguyên nhân (`LLMTimeout`, `HTTP429`, `InvalidJSON`, `EmptySuggestions`).

### 15.6. Hướng Dẫn Xử Lý Sự Cố Phổ Biến (Troubleshooting FAQ & Command Validation)
1. **Sự cố 1: ARIZ Stepper không hiển thị dữ liệu hoặc báo lỗi mạng**
   - *Triệu chứng:* Component hiển thị alert lỗi kèm nút "Thử lại".
   - *Command Validation bắt buộc:*
     - Kiểm tra kết nối endpoint qua curl:
       ```bash
       curl -s http://localhost:8000/api/v1/triz/ariz-steps | jq .total_steps
       # Kỳ vọng: 6
       ```
     - **Nếu endpoint không load:** Bắt buộc kiểm tra tệp tĩnh JSON tại `backend/src/app/data/triz_ariz_steps.json`. Xác thực tính hợp lệ của JSON bằng lệnh:
       ```bash
       python -m json.tool backend/src/app/data/triz_ariz_steps.json > /dev/null && echo "JSON OK"
       ```
     - Kiểm tra backend container logs: `docker compose logs api --tail=50`.
2. **Sự cố 2: Evolution Explorer hoặc Resource Analysis Panel không load**
   - *Triệu chứng:* Giao diện báo lỗi truy vấn dữ liệu từ máy chủ.
   - *Command Validation bắt buộc:*
     - Kiểm tra endpoint Evolution:
       ```bash
       curl -s http://localhost:8000/api/v1/triz/evolution-trends | jq .total_trends
       # Kỳ vọng: 8
       ```
     - Kiểm tra endpoint Resource Taxonomy:
       ```bash
       curl -s http://localhost:8000/api/v1/triz/resource-taxonomy | jq .total_categories
       # Kỳ vọng: 5
       ```
     - **Nếu endpoint không load:** Bắt buộc kiểm tra tính hợp lệ của tệp tĩnh:
       ```bash
       python -m json.tool backend/src/app/data/triz_evolution_trends.json > /dev/null
       python -m json.tool backend/src/app/data/triz_resource_taxonomy.json > /dev/null
       ```
3. **Sự cố 3: AI Coach tự động rơi vào chế độ Rule-Based Heuristic Fallback**
   - *Triệu chứng:* Gợi ý giải pháp có chú thích `[Rule-Based Heuristic Fallback]`, metrics `total_fallbacks` tăng lên.
   - *Command Validation bắt buộc:*
     - **Bắt buộc kiểm tra `/api/v1/system/ai-status`:**
       ```bash
       curl -s http://localhost:8000/api/v1/system/ai-status | jq .
       ```
     - Xác nhận trường `status` và `provider`:
       - Nếu status là `disabled` hoặc `unconfigured`: Cần cấu hình khóa hợp lệ `OPENAI_API_KEY` (hoặc khởi động Ollama cục bộ).
       - Nếu status là `error`: Kiểm tra kết nối mạng ra ngoài hoặc quota tài khoản AI provider.
     - *Lưu ý:* Cơ chế fallback là tính năng an toàn fail-safe được thiết kế có chủ đích, bảo đảm phiên nghiên cứu không bao giờ bị gián đoạn hay treo hệ thống.


