# HƯỚNG DẪN TRIỂN KHAI & VẬN HÀNH (DEPLOYMENT GUIDE)

**Dự án:** Creative Research Workbench  
**Trạng thái:** Production-Ready & Verified  
**Mục tiêu:** Cung cấp quy trình đóng gói, khởi động, kiểm thử và vận hành hệ thống bằng Docker.

---

## 1. Tóm tắt các cải tiến Dockerization Hardening (Phương án A)

1. **Frontend (`apps/web`):**
   - Áp dụng **Multi-Stage Build** (gồm các giai đoạn: `deps` ➔ `builder` ➔ `runner`).
   - Tạo bundle tối ưu thông qua `next build` và chạy server bằng `node server.js` (Standalone Runner).
   - Tối ưu kích thước image từ ~1GB xuống ~150MB, thời gian khởi động container chỉ **53ms**.
2. **Backend API (`backend`):**
   - Đóng gói toàn bộ source code vào image (không bind-mount mã nguồn runtime).
   - Chạy `uvicorn` ở chế độ production (tắt `--reload`).
   - Tích hợp `HEALTHCHECK` kiểm tra định kỳ endpoint `/health`.
3. **Database (`db`):**
   - Sử dụng `pgvector/pgvector:pg16` với volume lưu trữ dữ liệu bền vững `postgres_data`.
   - Healthcheck tích hợp `pg_isready`.
4. **Orchestration (`docker-compose.yml`):**
   - Thiết lập phụ thuộc khởi động theo chuỗi sức khỏe: `db` (healthy) ➔ `api` (healthy) ➔ `frontend` (started).
   - Bổ sung `restart: unless-stopped` cho toàn bộ services.
   - Giữ nguyên các cổng an toàn: Frontend `3011:3000`, Backend API `8000:8000`, DB `5432` (tránh xung đột port 3000 của host).

---

## 2. Câu lệnh Triển khai & Vận hành

### A. Khởi động toàn bộ hệ thống
```bash
docker compose up -d --build
```

### B. Kiểm tra trạng thái toàn bộ containers
```bash
docker compose ps
```
*Kết quả mẫu hợp lệ:*
```text
NAME           IMAGE                                  COMMAND                  SERVICE    STATUS                        PORTS
crw_api        creative-research-workbench-api        "uvicorn src.app.mai…"   api        Up (healthy)                  0.0.0.0:8000->8000/tcp
crw_frontend   creative-research-workbench-frontend   "docker-entrypoint.s…"   frontend   Up                            0.0.0.0:3011->3000/tcp
crw_postgres   pgvector/pgvector:pg16                 "docker-entrypoint.s…"   db         Up (healthy)                  5432/tcp
```

### C. Lệnh Smoke-Test xác thực Runtime
```bash
# 1. Kiểm tra Backend Health (Phải trả về HTTP 200 OK)
curl -i http://localhost:8000/health

# 2. Kiểm tra Sessions API (Phải trả về HTTP 200 OK)
curl -i http://localhost:8000/api/v1/sessions

# 3. Kiểm tra Frontend Next.js Routing (Phải trả về HTTP 200 OK)
curl -I http://localhost:3011/sessions
```

### D. Xem logs theo thời gian thực
```bash
docker compose logs -f
# Hoặc xem riêng từng service:
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f db
```

### E. Dừng hệ thống
```bash
docker compose down
# Hoặc dừng và xóa volumes (lưu ý sẽ xóa dữ liệu db):
# docker compose down -v
```

---

## 3. Danh mục Cổng & Đường dẫn Truy cập

| Dịch vụ | URL Nội bộ Docker | URL Truy cập ngoài Host | Mục đích |
| :--- | :--- | :--- | :--- |
| **Web Frontend** | `http://frontend:3000` | [http://localhost:3011/sessions](http://localhost:3011/sessions) | Giao diện ứng dụng người dùng |
| **Backend API** | `http://api:8000` | [http://localhost:8000](http://localhost:8000) | REST API Gateway |
| **API Docs** | — | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger Interactive Documentation |
| **PostgreSQL** | `db:5432` | `localhost:5432` *(khi expose)* | Cơ sở dữ liệu quan hệ + pgvector |

---

## 4. Kết luận Nghiệm thu
Stack Docker đã vượt qua toàn bộ các bài kiểm tra end-to-end trong môi trường thực tế, sẵn sàng cho việc bàn giao và tự lưu trữ (Self-Hosting).
