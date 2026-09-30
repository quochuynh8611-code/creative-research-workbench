# DOCKERIZATION GAP ANALYSIS & DEPLOYMENT READINESS

**Dự án:** Creative Research Workbench  
**Trạng thái:** Bản phân tích kỹ thuật (Technical Audit)  
**Mục tiêu:** Đánh giá khoảng cách giữa Docker stack local-dev hiện tại và tiêu chuẩn Deployable Production Stack.

---

## 1. Hiện trạng Docker Stack hiện tại

| Thành phần | Hiện trạng | Nhận định |
| :--- | :--- | :--- |
| **Database (`db`)** | `pgvector/pgvector:pg16`, volume `postgres_data`, có healthcheck `pg_isready`. | ✅ **Rất tốt:** Đã có healthcheck và persistent volume chuẩn. |
| **Backend API (`api`)** | `python:3.11-slim`, mount source code `./backend:/app`, lệnh `uvicorn src.app.main:app --reload`. | ⚠️ **Dev-only:** Đang chạy reload mode, chưa có Docker healthcheck, phụ thuộc bind mount. |
| **Frontend Web (`frontend`)** | `node:20-slim`, `npm ci`, lệnh `npm run dev -- --hostname 0.0.0.0 --port 3000`. | ⚠️ **Dev-only:** Đang chạy Next.js dev server, chưa tối ưu multi-stage build (`next build`), image size lớn (~1GB). |
| **Orchestration (`compose`)** | 1 file `docker-compose.yml`, network bridge mặc định, port `3011:3000` & `8000:8000`. | ⚠️ **Chưa hoàn chỉnh:** Thiếu `restart policy`, thiếu startup dependency `condition: service_healthy` từ api -> frontend. |

---

## 2. Bảng phân tích chi tiết các khoảng cách (Gaps)

### Gap 1: Dev Runtime vs Deployable / Production Runtime
- **Frontend:** Đang chạy `next dev` tốn CPU, memory leak theo thời gian và tốc độ render chậm hơn so với production bundle.
  - *Giải pháp:* Thiết kế Dockerfile multi-stage build (Stages: `deps` -> `builder` -> `runner` standalone) để tạo bundle tĩnh tối ưu qua `next build`, kích thước image giảm còn ~150MB.
- **Backend:** Đang chạy `uvicorn --reload` và mount volume trực tiếp.
  - *Giải pháp:* Trong Dockerfile, copy toàn bộ mã nguồn vào image và chạy uvicorn ở chế độ production (tắt `--reload`, cấu hình loglevel chuẩn).

### Gap 2: Thiếu Healthcheck cho API & Frontend
- Service `api` chưa có `healthcheck` trong `docker-compose.yml` (hoặc Dockerfile).
- Service `frontend` chỉ có `depends_on: [api]` (chỉ chờ container api start, không chờ api healthy), dẫn đến trường hợp frontend khởi động xong trước khi backend sẵn sàng phục vụ endpoint `/api/v1/sessions`.
  - *Giải pháp:* Thêm healthcheck `curl -f http://127.0.0.1:8000/health` cho api và cấu hình `depends_on: { api: { condition: service_healthy } }` cho frontend.

### Gap 3: Khởi tạo Database Extension & Migration Strategy
- `pgvector` yêu cầu extension `vector` phải được enable.
- Mặc dù backend tự động chạy `Base.metadata.create_all` khi khởi động, cần đảm bảo extension vector luôn sẵn sàng ngay từ lúc khởi tạo database instance.
  - *Giải pháp:* Đảm bảo chuỗi kết nối và init script postgres tự động chạy `CREATE EXTENSION IF NOT EXISTS vector;`.

### Gap 4: Xử lý biến môi trường Client-side (`NEXT_PUBLIC_API_URL`)
- Trong Next.js, các biến `NEXT_PUBLIC_*` được nướng (bake) vào bundle lúc build client-side. Khi chạy trong Docker container, nếu client truy cập từ trình duyệt ngoài host thì URL API phải là `http://localhost:8000` (hoặc domain public).
  - *Giải pháp:* Khai báo rõ ràng trong `ARG` / `ENV` của Dockerfile và `.env.example`.

### Gap 5: Persistent Volumes & Restart Policies
- Chưa có cấu hình `restart: unless-stopped` để tự động khôi phục container khi daemon khởi động lại hoặc gặp sự cố.
  - *Giải pháp:* Bổ sung restart policy cho cả 3 services `db`, `api`, `frontend`.

---

## 3. Phân loại Quyết định (One-Way vs Two-Way Doors)

| Quyết định | Loại quyết định | Đánh giá & Rủi ro |
| :--- | :--- | :--- |
| **Tên Volume `postgres_data`** | 🚪 **One-Way Door** | Giữ nguyên tên volume để không làm mất liên kết dữ liệu database cục bộ của người dùng. |
| **Cổng ánh xạ `3011:3000` & `8000:8000`** | 🚪 **Two-Way Door** | Rất an toàn, tuyệt đối không đụng cổng 3000 của host. |
| **Multi-stage Dockerfile cho Frontend** | 🚪 **Two-Way Door** | Tách target `runner` (deployable) và giữ `Dockerfile` sạch, có thể rollback bằng `git restore`. |
| **Tách biệt Compose files (Dev vs Prod)** | 🚪 **Two-Way Door** | Cung cấp file compose rõ ràng, không phá vỡ quy trình local dev hiện tại. |
