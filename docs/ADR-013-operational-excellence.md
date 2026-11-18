# ADR-013: Kiến Trúc Quan Sát, Đo Lường Và Độ Tin Cậy Vận Hành (Operational Excellence Architecture)

- **Trạng thái:** Accepted (Đã cập nhật theo 4 điều chỉnh bắt buộc của Founder)
- **Ngày:** 2026-11-18
- **Tác giả:** Senior DevOps Engineer / Performance Engineer
- **Ngữ cảnh:** Creative Research Workbench (CRW) — Batch C32

---

## 1. Ngữ Cảnh & Vấn Đề (Context & Problem Statement)

Creative Research Workbench đã hoàn thành triển khai tính năng AI Solution Coach (Batch C31). Hệ thống có khả năng xử lý bài toán, định khung mâu thuẫn TRIZ và sinh gợi ý giải pháp. Tuy nhiên, ở góc độ vận hành (DevOps / SRE):
1. **Truy vết sự cố rời rạc:** Log backend hiện tại dùng text formatter thông thường, thiếu `correlation_id` để kết nối chuỗi log của cùng một request từ client đến service và database.
2. **Thiếu khả năng tự quan sát (Zero Self-Telemetry):** Hệ thống không có chỉ số thống kê về độ trễ ($p50/p95/p99$), tỷ lệ lỗi HTTP, hay tần suất fallback của AI Coach.
3. **Chưa có công cụ benchmark định lượng:** Thiếu công cụ đo kiểm chuẩn để đánh giá throughput (RPS) và phát hiện hồi quy hiệu năng trước khi scale-up.
4. **Yêu cầu không thêm hạ tầng nặng:** Là một hệ thống self-hosted tinh gọn, CRW không thể đưa vào các hệ thống phức tạp như Prometheus/Grafana server hay OpenTelemetry Collector trong giai đoạn này.

---

## 2. Các Quyết Định Kiến Trúc & Ràng Buộc Bắt Buộc (Decisions & Constraints)

### Quyết định 1: Triển khai Structured JSON Logging kết hợp Correlation ID và Secret Masking
- **Giải pháp:** Xây dựng `StructuredJsonFormatter` kế thừa từ `logging.Formatter`, tự động định dạng log JSON kèm timestamp UTC ISO, log level, module, function và `correlation_id` từ `contextvars.ContextVar[str]`.
- **Masking:** Tích hợp bộ lọc regex bắt buộc che giấu mọi token/credential: `sk-proj`, `Bearer`, `password`, `token`, `api_key`.
- **Header:** Nhận diện header `X-Request-ID` hoặc `X-Correlation-ID` từ client (nếu có); nếu không, sinh UUID4 ngẫu nhiên (`uuid.uuid4().hex`). Luôn trả về `X-Request-ID` và `X-Correlation-ID` trong response headers.
- **Phản hồi lỗi 500:** Tuyệt đối không trả về stack trace cho client. Client chỉ nhận được `error_id` và thông điệp chung. Log nội bộ ghi nhận chi tiết lỗi đã qua bộ lọc masking.

### Quyết định 2: In-Memory Ring Buffer Metrics Collector Cho 4 Endpoint Ưu Tiên
- **Giới hạn phạm vi:** Bộ thu thập chỉ track chính xác 4 endpoint ưu tiên, KHÔNG track toàn bộ route:
  1. `GET /health`
  2. `GET /api/v1/sessions`
  3. `GET /api/v1/system/ai-status`
  4. `POST /api/v1/sessions/{id}/coach/suggestions`
- **Bộ đệm:** Mỗi endpoint duy trì một `collections.deque(maxlen=1000)` lưu trữ `duration_ms` (float) và bộ đếm HTTP status families. Không lưu request body hay response body.
- **Kế hoạch bảo vệ endpoint `/metrics`:** Endpoint `GET /api/v1/system/metrics` là internal-only. Trong môi trường production, truy cập được giới hạn thông qua network perimeter (chỉ cho phép truy cập từ mạng nội bộ hoặc localhost) và có thể bổ sung API key header trong giai đoạn tiếp theo nếu cần.

### Quyết định 3: Chấp Nhận Có Chủ Đích Việc In-Memory Metrics Bị Reset Khi Restart
- **Giải pháp:** Số liệu thống kê trong `InMemoryMetricsCollector` sẽ reset về 0 mỗi khi container backend khởi động lại.
- **Lý do:** Đây là quyết định chấp nhận có chủ đích nhằm giữ cho hệ thống hoàn toàn tinh gọn, không phụ thuộc vào Redis hay database phụ trợ. Mục đích của metrics này là theo dõi sức khỏe và rolling performance trong phiên vận hành hiện tại (rolling window), không phải lưu trữ kế toán lịch sử dài hạn.

### Quyết định 4: Đo Lường Fallback Riêng Cho AI Solution Coach
- **Giải pháp:** Ghi nhận trực tiếp vào Metrics Collector khi `AICoachService` kích hoạt `RuleBasedCoach` fallback, kèm theo lý do (`LLMTimeout`, `HTTP429`, `InvalidJSON`, `EmptySuggestions`).

### Quyết định 5: Local Benchmark Suite Bị Giới Hạn Tải & Anti-Production Guard
- **Giải pháp:** Cung cấp script độc lập `backend/scripts/benchmark.py` sử dụng `httpx.AsyncClient`.
- **Ràng buộc kiểm thử & Giới hạn có chủ đích:**
  - Benchmark chỉ chạy local/sandbox, **KHÔNG** phải công cụ stress test production. Đây là giới hạn có chủ đích để bảo vệ tài nguyên và loại trừ hoàn toàn nguy cơ tác động tới hạ tầng live.
  - Chỉ đo kiểm 4 endpoint ưu tiên (`/health`, `/sessions`, `/ai-status`, `/coach/suggestions`).
  - Concurrency tối đa $c \le 10$, số request tối đa $n \le 100$. Quá giới hạn sẽ raise `ValueError`.
  - Tích hợp chốt chặn an toàn (Anti-Production Guard): Runner chỉ chấp nhận URL localhost/sandbox (`127.0.0.1`, `localhost`, `0.0.0.0`, `testserver`). Mọi URL/domain khác (ví dụ: `https://api.crw-workbench.com`, `http://staging.crw-workbench.com`, `https://example.com`) đều bị chặn ngay lập tức và raise `ValueError`.
  - Hỗ trợ tham số `--endpoint` và `--output` (báo cáo bảng ASCII hoặc JSON), zero hard-coded secrets. Cả 2 định dạng `table` và `json` đều được kiểm tra nghiêm ngặt không chứa token/secret.
  - **SLO là Informational Baseline, không phải Hard Gate:** Do môi trường dev/container có độ trễ biến thiên và tài nguyên phần cứng khác nhau, các ngưỡng p95 không dùng làm hard gate để fail CI hay chặn merge mà chỉ in cảnh báo (warning) nếu vượt ngưỡng.

---

## 3. Các Phương Án Bị Loại Bỏ (Rejected Alternatives)

| Phương Án | Lý Do Bị Loại Bỏ |
| :--- | :--- |
| **Track Toàn Bộ Tuyến Đường (Catch-all Tracking)** | Gây lãng phí bộ nhớ và CPU cho các endpoint tĩnh hoặc endpoint ít sử dụng; chỉ 4 endpoint ưu tiên là đại diện cho sức khỏe và hiệu năng cốt lõi của hệ thống. |
| **Prometheus + Grafana Container Stack** | Quá nặng nề cho giai đoạn hiện tại (chiếm thêm 500MB+ RAM và 2 container), vi phạm triết lý tinh gọn của doanh nghiệp 1 người. |
| **Lưu Metrics vào PostgreSQL Database** | Gây contention và ô nhiễm dữ liệu nghiệp vụ; việc ghi metrics liên tục vào disk sẽ làm giảm throughput của PostgreSQL. |
| **Lưu Trữ Lịch Sử Metrics Vĩnh Viễn** | Yêu cầu thêm hạ tầng time-series DB (như InfluxDB/TimescaleDB), không phù hợp với mục tiêu rolling-window telemetry. |

---

## 4. Hậu Quả & Đánh Đổi (Consequences & Trade-offs)

### Tích cực:
- Nâng cao 100% khả năng truy vết sự cố: Mọi log đều gắn liền với Correlation ID.
- Giám sát sức khỏe 4 endpoint cốt lõi thời gian thực qua `GET /api/v1/system/metrics` mà không tốn tài nguyên.
- Kiểm soát hoàn toàn nguy cơ rò rỉ secret qua cơ chế masking đa tầng.
- Tinh gọn tuyệt đối: Tiêu tốn < 100KB RAM cho toàn bộ telemetry.

### Đánh đổi (Trade-offs):
- Metrics bị reset khi restart container: Đã được chấp nhận có chủ đích (xem Quyết định 3).

---

## 5. Chiến Lược Rollback (Rollback Strategy)

1. `CorrelationIdMiddleware` và `MetricsMiddleware` được thiết kế fail-safe: Nếu gặp lỗi nội bộ, middleware sẽ gọi `call_next(request)` bình thường để không làm gián đoạn request của người dùng.
2. Có thể revert PR một cách an toàn mà không ảnh hưởng tới dữ liệu PostgreSQL (do không có migration hay schema change).
