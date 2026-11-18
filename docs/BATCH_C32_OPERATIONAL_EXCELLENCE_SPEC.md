# BATCH C32 — OPERATIONAL EXCELLENCE SPECIFICATION

**Dự án:** Creative Research Workbench (CRW)  
**Tài liệu:** Batch C32 Technical Specification (Đã cập nhật theo phê duyệt Founder)  
**Trạng thái:** APPROVED WITH CONSTRAINTS  
**Phiên bản:** v1.1.0  
**Tác giả:** Senior DevOps Engineer / Performance Engineer  

---

## 1. Mục Tiêu & Bối Cảnh (Context & Objectives)

Sau khi hoàn thành Batch C31 (AI Solution Coach & Safety Confirmation Dialogs), hệ thống CRW đã vận hành ổn định trên toàn bộ luồng tư duy TRIZ. Để chuẩn bị cho giai đoạn scale-up và vận hành sản xuất an toàn, **Batch C32 tập trung vào Năng Lực Vận Hành Xuất Sắc (Operational Excellence)**.

### Mục Tiêu Cốt Lõi:
1. **Observability (Khả năng quan sát):** Triển khai Structured JSON Logging và Correlation ID tracing xuyên suốt vòng đời request.
2. **Metrics & Telemetry:** Thu thập các chỉ số hiệu năng cơ bản cho 4 endpoint ưu tiên qua một in-memory collector gọn nhẹ, zero external dependencies.
3. **Load Testing & Benchmarking:** Xây dựng công cụ benchmark tự động hóa cục bộ (sandbox only), đo lường throughput và latency quantiles trên 4 endpoint ưu tiên.
4. **Reliability & Masking:** Masking chặt chẽ mọi chuỗi nhạy cảm (API key, token, password), zero stack trace exposure, và zero secret leakage trong mọi kịch bản.
5. **Operational Runbook:** Chuẩn hóa cẩm nang vận hành, hướng dẫn truy vết lỗi qua Correlation ID, đọc metrics, và chạy benchmark.

---

## 2. Ranh Giới Phạm Vi & Điều Chỉnh Bắt Buộc (Scope Boundaries & Founder Adjustments)

### 4 Điều Chỉnh Bắt Buộc Từ Founder:
1. **Giới Hạn Metrics Collector:**
   - **Chỉ track 4 endpoint ưu tiên:**
     1. `GET /health`
     2. `GET /api/v1/sessions`
     3. `GET /api/v1/system/ai-status`
     4. `POST /api/v1/sessions/{id}/coach/suggestions`
   - **KHÔNG** track toàn bộ route hay lưu request/response body.
   - Mỗi endpoint chỉ giữ rolling buffer tối đa `1000 samples`.
2. **Giới Hạn Benchmark:**
   - Chỉ benchmark 4 endpoint ưu tiên nói trên.
   - Concurrency tối đa: `10`.
   - Requests tối đa cho local test: `100`.
   - **KHÔNG** chạy benchmark đối với môi trường production; script chỉ chạy trên local/sandbox.
3. **Log Masking Chặt Chẽ:**
   - Bắt buộc kiểm thử khẳng định không rò rỉ: `sk-proj`, `Bearer`, `password`, `token`, `api_key`.
   - Log JSON **KHÔNG** chứa stack trace đầy đủ trong response gửi về client (response chỉ trả `error_id` + message chung).
   - Log nội bộ có thể ghi nhận ngữ cảnh chẩn đoán nhưng bắt buộc phải qua bộ lọc sanitization/masking secrets.
4. **Metrics Endpoint Bảo Vệ (Internal-Only):**
   - Endpoint `GET /api/v1/system/metrics` là endpoint nội bộ (internal telemetry), không công khai ra bên ngoài.
   - Tuyệt đối không trả về secrets hoặc chi tiết request/response.
   - Kế hoạch xác thực bảo vệ riêng (API key header / network perimeter) được ghi nhận trong ADR.
5. **In-Memory Reset Là Chấp Nhận Có Chủ Đích:**
   - Metrics sẽ được reset về 0 mỗi khi container backend khởi động lại. Đây là thiết kế chủ đích nhằm giữ hệ thống tinh gọn, không phải là lỗi.

### Ngoài Phạm Vi (OUT-OF-SCOPE):
- **KHÔNG** cài đặt Prometheus, Grafana, Jaeger, OpenTelemetry Collector.
- **KHÔNG** sửa đổi database schema hay tạo migration mới.
- **KHÔNG** thay đổi logic nghiệp vụ TRIZ hay frontend trong PR 1.
- **KHÔNG** deploy production.

---

## 3. Kiến Trúc Kỹ Thuật (Technical Architecture)

```
[Client / Frontend]
        │
        ▼ (Request with optional X-Request-ID)
┌─────────────────────────────────────────────────────────────┐
│ FastApi Stack (crw_api)                                     │
│                                                             │
│  1. CorrelationIdMiddleware                                 │
│     ├── Trích xuất X-Request-ID hoặc sinh UUID4             │
│     ├── Gán correlation_id_ctx (contextvars)                │
│     └── Đính kèm X-Request-ID vào Response Headers          │
│                                                             │
│  2. MetricsMiddleware                                       │
│     ├── Kiểm tra nếu thuộc 4 Priority Endpoints:            │
│     │   - /health                                           │
│     │   - /api/v1/sessions                                  │
│     │   - /api/v1/system/ai-status                          │
│     │   - /api/v1/sessions/{id}/coach/suggestions           │
│     ├── Ghi nhận duration_ms, status_code vào MetricsStore  │
│     └── Bỏ qua các route không thuộc danh mục ưu tiên       │
│                                                             │
│  3. StructuredJsonFormatter (Masking-Enabled)               │
│     ├── Tự động mask sk-proj, Bearer, password, token       │
│     └── Đính kèm correlation_id vào từng log record JSON    │
│                                                             │
│  4. Endpoints & Services                                    │
│     ├── GET /api/v1/system/metrics (Internal Telemetry)     │
│     └── AICoachService ──► Ghi nhận Coach Latency & Fallback │
└─────────────────────────────────────────────────────────────┘
```

### 3.1. Structured Logging & Secret Masking
- **Context Management:** `contextvars.ContextVar[str]` với giá trị mặc định `"-"`.
- **Masking Rules:** Biểu thức chính quy phát hiện và thay thế:
  - `sk-proj-[A-Za-z0-9_-]+` ➔ `sk-proj-***[MASKED]***`
  - `Bearer [A-Za-z0-9_.-]+` ➔ `Bearer ***[MASKED]***`
  - `(password|token|api_key)=['"][^'"]+['"]` ➔ `$1="***[MASKED]***"`
- **Response Safety:** Trả về client khi lỗi 500:
  ```json
  {
    "detail": "Internal server error. Please try again later.",
    "error_id": "a1b2c3d4"
  }
  ```

### 3.2. In-Memory Metrics Collector (4 Priority Endpoints Only)
- **Cấu trúc lưu trữ:**
  - `ENDPOINT_BUFFER_MAXLEN = 1000`
  - Chỉ lưu trữ cho 4 key chuẩn hóa:
    - `health`: `/health`
    - `sessions`: `/api/v1/sessions`
    - `ai_status`: `/api/v1/system/ai-status`
    - `coach_suggestions`: `/api/v1/sessions/{id}/coach/suggestions`
  - Mỗi endpoint sở hữu một `collections.deque(maxlen=1000)` lưu trữ `duration_ms` (float) và bộ đếm HTTP status families (`2xx`, `3xx`, `4xx`, `5xx`).
  - AI Coach Telemetry: `total_calls`, `fallback_calls`, `fallback_rate_pct`, `latency_p50/p95/p99`, `fallback_reasons`.
- **Payload `GET /api/v1/system/metrics`:**
  ```json
  {
    "data": {
      "uptime_seconds": 1250.4,
      "tracked_endpoints": {
        "health": {
          "total_requests": 500,
          "status_counts": { "2xx": 500, "5xx": 0 },
          "error_rate_pct": 0.0,
          "latency_ms": { "p50": 1.2, "p95": 3.4, "p99": 5.1, "mean": 1.5 }
        },
        "sessions": { ... },
        "ai_status": { ... },
        "coach_suggestions": { ... }
      },
      "ai_coach": {
        "total_calls": 24,
        "fallback_calls": 1,
        "fallback_rate_pct": 4.17,
        "latency_ms": { "p50": 32.5, "p95": 85.0, "p99": 95.0, "mean": 38.2 },
        "fallback_reasons": { "LLMTimeout": 1 }
      }
    }
  }
  ```

---

## 4. Kế Hoạch Benchmark Cục Bộ (PR 2)

- **Target Endpoints:** 4 endpoints ưu tiên:
  1. `GET /health`
  2. `GET /api/v1/sessions`
  3. `GET /api/v1/system/ai-status`
  4. `POST /api/v1/sessions/{id}/coach/suggestions`
- **CLI Runner:** `backend/scripts/benchmark.py`
  - Tham số hỗ trợ:
    - `--base-url`: URL server đích (mặc định: `http://localhost:8000`). Bắt buộc localhost / sandbox IP.
    - `--concurrency`: Số workers đồng thời (mặc định: 5, giới hạn tối đa: 10).
    - `--requests`: Tổng số requests mỗi endpoint (mặc định: 50, giới hạn tối đa: 100).
    - `--endpoint`: Endpoint cần test (`all`, `health`, `sessions`, `ai_status`, `coach`, mặc định: `all`).
    - `--output`: Định dạng báo cáo (`table` hoặc `json`, mặc định: `table`).
- **Ràng Buộc An Toàn (Safety Guards):**
  - Concurrency: $c \le 10$. Vượt quá sẽ raise validation error (`ValueError`).
  - Tổng số requests: $n \le 100$. Vượt quá sẽ raise validation error (`ValueError`).
  - Chống chạy trên Production (Anti-Production Guard): Runner chỉ chấp nhận URL localhost/sandbox (`localhost`, `127.0.0.1`, `0.0.0.0`, `testserver`). Mọi hostname khác như `https://api.crw-workbench.com`, `http://staging.crw-workbench.com`, `https://example.com` đều bị chặn lập tức và raise `ValueError`.
  - Zero hard-coded secrets: Output (cả định dạng `table` lẫn `json`) và logs tuyệt đối không chứa unmasked token hay credentials. Runner tự động tái sử dụng Session ID hiện có trong sandbox nếu cần.
  - Phạm vi thực thi: Benchmark chỉ chạy local/sandbox, KHÔNG phải công cụ stress test production. Đây là giới hạn có chủ đích để bảo vệ tài nguyên.
- **Tiêu chuẩn hoàn thành & SLO Informational Baseline:**
  > [!NOTE]
  > Các ngưỡng SLO dưới đây đóng vai trò là **Informational Baseline**, KHÔNG phải hard gate để fail CI hoặc chặn merge. Môi trường local/container/CI runner thường xuyên có độ trễ biến thiên do tài nguyên phần cứng. Nếu p95 vượt ngưỡng, runner chỉ in cảnh báo (warning).
  - `GET /health`: Baseline $p95 < 25ms$, throughput > 50 req/s, error rate 0%.
  - `GET /api/v1/sessions`: Baseline $p95 < 100ms$, error rate 0%.
  - `GET /api/v1/system/ai-status`: Baseline $p95 < 50ms$, error rate 0%.
  - `POST /api/v1/sessions/{id}/coach/suggestions`: Baseline $p95 < 200ms$ (Mock/Fallback mode), error rate 0%.

---

## 5. Chiến Lược Triển Khai 3 PR

1. **PR 1: `feat(ops): structured logging, correlation ID, and in-memory metrics`**
   - Core logging, contextvars correlation ID, in-memory metrics collector (4 priority endpoints), middleware, internal endpoint `GET /api/v1/system/metrics`, unit & integration tests.
2. **PR 2: `feat(ops): benchmark load testing suite`**
   - Script `backend/scripts/benchmark.py` (concurrency $\le 10$, requests $\le 100$, 4 endpoints), local baseline report.
3. **PR 3: `docs(ops): operational runbook, metrics guides, and Batch C32 finalization`**
   - Cập nhật deployment guide, hướng dẫn vận hành và truy vết Correlation ID, chuyển ADR-013 sang `Accepted`.
