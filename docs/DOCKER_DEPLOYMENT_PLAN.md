# DOCKER DEPLOYMENT PLAN & ARCHITECTURE STRATEGY

**Dự án:** Creative Research Workbench  
**Trạng thái:** Kế hoạch kỹ thuật đề xuất — Chờ phê duyệt trước khi thực thi  
**Nguyên tắc:** Blast radius thấp, an toàn dữ liệu, giữ nguyên port 3000 host cho phần mềm khác.

---

## 1. So sánh 2 Phương án Kiến trúc Docker

```
                               ┌────────────────────────────────────────────────────────┐
                               │                    DOCKER OPTIONS                      │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │
                    ┌─────────────────────────────────────┴─────────────────────────────────────┐
                    ▼                                                                           ▼
      [PHƯƠNG ÁN A: UNIFIED COMPOSE]                                            [PHƯƠNG ÁN B: SEPARATED COMPOSE]
  - 1 file `docker-compose.yml` duy nhất                                     - `docker-compose.yml` (Production/Deployable)
  - Hardened multi-stage build cho Frontend                                  - `docker-compose.dev.yml` (Local Dev override)
  - Production-ready FastAPI Backend                                        - Tách biệt rõ ràng dev bind-mount vs prod copy
  - Setup 1 lệnh duy nhất: `docker compose up -d`                             - Phù hợp môi trường CI/CD & Multi-server
```

### Chi tiết Phương án A: Unified Hardened Compose (Khuyến nghị cho Self-Host / VPS)
- **Cấu trúc:** Giữ 1 file `docker-compose.yml` duy nhất được nâng cấp toàn diện:
  - Frontend: Build qua Next.js Standalone Runner (tối ưu hiệu năng, bảo mật, nhẹ).
  - Backend: Chạy Uvicorn production mode (không reload trong image build), có healthcheck `curl http://127.0.0.1:8000/health`.
  - Database: `pgvector:pg16` với volume `postgres_data` và `pg_isready`.
  - Chuỗi phụ thuộc chuẩn: `db (healthy)` -> `api (healthy)` -> `frontend (healthy)`.
  - Restart Policy: `restart: unless-stopped`.
- **Ưu điểm:** Cực kỳ gọn gàng, trải nghiệm người dùng tối ưu: chỉ cần `docker compose up -d --build` là toàn bộ hệ thống khởi động hoàn hảo.
- **Rủi ro:** Khi muốn dev hot-reload bằng Docker thì cần chỉnh command hoặc chạy trực tiếp bằng host Terminal.

### Chi tiết Phương án B: Tách biệt `docker-compose.yml` (Prod) và `docker-compose.dev.yml` (Dev)
- **Cấu trúc:**
  - `docker-compose.yml`: Dùng cho production/staging deployment.
  - `docker-compose.dev.yml`: Kích hoạt bind-mount `./backend:/app` và `npm run dev` cho frontend.
- **Ưu điểm:** Rạch ròi 100% giữa môi trường dev và môi trường triển khai thực tế.
- **Nhược điểm:** Cần truyền nhiều flags lệnh khi khởi động cục bộ (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up`).

---

## 2. Thiết kế Dockerfile mục tiêu

### A. Frontend (`apps/web/Dockerfile` Multi-Stage)
```dockerfile
# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# Stage 3: Runner
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

### B. Backend (`backend/Dockerfile` Hardened)
```dockerfile
FROM python:3.11-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY src ./src
EXPOSE 8000
HEALTHCHECK --interval=5s --timeout=5s --retries=5 \
  CMD curl -f http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "src.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

---

## 3. Kế hoạch Smoke-Test & Verification Sau Triển Khai

Sau khi triển khai, thực hiện smoke-test tự động theo 4 bước:
1. **DB Verification:** `docker compose exec db pg_isready -U crw_user -d crw_dev` trả về exit code 0.
2. **API Verification:** `curl -sS -i http://localhost:8000/health` trả về `HTTP/1.1 200 OK` và JSON `{"status":"ok"}`.
3. **Frontend Verification:** `curl -sS -I http://localhost:3011/sessions` trả về `HTTP/1.1 200 OK`.
4. **End-to-End In-Container Integration:** Frontend gọi API qua browser tại `http://localhost:3011/sessions` hiển thị danh sách sessions thật từ backend.

---

## 4. Khuyến nghị Kỹ thuật (Technical Recommendation)

👉 **Khuyến nghị lựa chọn: PHƯƠNG ÁN A (Unified Hardened Compose)**
- Lý do: Phù hợp nhất với giai đoạn hiện tại của dự án — vừa sẵn sàng deploy ngay lên máy chủ VPS / staging bằng 1 lệnh duy nhất, vừa giữ blast radius tối thiểu, cấu trúc repo gọn gàng, không gây phân mảnh cấu hình.
