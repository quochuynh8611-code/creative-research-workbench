# HƯỚNG DẪN TRIỂN KHAI & SỔ TAY VẬN HÀNH (STANDARD OPERATING RUNBOOK)

**Dự án:** Creative Research Workbench (CRW)  
**Tài liệu:** Standard Operating Runbook (Phục vụ Self-Host & Production-Ready Operations)  
**Phiên bản:** v1.1.0 (Chuẩn hóa Batch C30)  
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
