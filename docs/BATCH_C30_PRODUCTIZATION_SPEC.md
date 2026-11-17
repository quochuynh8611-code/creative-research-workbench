# BATCH C30 — PRODUCTIZATION & AI CONFIGURATION SPECIFICATION

- **Tài liệu:** Đặc tả Kỹ thuật & Kiến trúc Hệ thống cho Batch C30
- **Dự án:** Creative Research Workbench
- **Giai đoạn:** Phase 12.5 (Productization, AI Configuration, Onboarding, UX Polish & Deployment Runbook)
- **Trạng thái:** 🟢 APPROVED (Đã cập nhật 4 điều chỉnh từ Founder, sẵn sàng triển khai TDD)
- **Tài liệu tham chiếu:** `docs/ADR-011-productization-ai-configuration.md`, `docs/ADR-001-architecture.md`, `docs/ADR-010-caching-layer.md`
- **Kỷ luật áp dụng:** First-Principles Thinking, Spec-First, Test-First, Blast Radius Defense, Zero-Secret Exposure, Graceful Degradation

---

## 1. Mục Tiêu & Phạm Vi (Objectives & Scope)

### 1.1 Mục Tiêu & 4 Nguyên Tắc Bắt Buộc (Founder Mandates)
Chuẩn bị Creative Research Workbench (CRW) sẵn sàng cho việc sử dụng thực tế (Production-Ready Workbench):
1. **AI Provider Mặc Định:**
   - OpenAI là provider mặc định cho cả LLM (`gpt-4o-mini`) và Embedding (`text-embedding-3-small`).
   - Ollama là lựa chọn local/self-host (`nomic-embed-text` cho embedding, Ollama API cho LLM).
   - KHÔNG mở rộng hay triển khai Gemini trong Batch C30; mã nguồn hiện có Gemini được giữ nguyên khả năng sẵn có, không thêm test mới hay phát triển mới cho Gemini trong C30.
2. **Fallback AI Bắt Buộc:**
   - Khi `OPENAI_API_KEY` thiếu, hết hạn, timeout, hoặc provider lỗi: tự động chuyển về `MockLLMClient` / `MockEmbeddingClient`, hiển thị trạng thái "Mock mode". Không retry vô hạn, không treo request, không làm mất dữ liệu session/note/solution.
   - Timeout kiểm tra AI status tối đa 1.5 giây.
   - Endpoint `/ai-status` KHÔNG gọi LLM sinh nội dung, KHÔNG tính token, KHÔNG tạo chi phí.
3. **AI Status API An Toàn Tuyệt Đối:**
   - Endpoint: `GET /api/v1/system/ai-status`.
   - Chỉ trả metadata an toàn: `status`, `status_label`, `llm provider`, `embedding provider`, `model name`, `fallback_active`.
   - Tuyệt đối không trả API key, secret, stack trace, file path, database query. Bắt buộc có test suite khẳng định không rò rỉ secret.
4. **Runbook & Rollback:**
   - Cập nhật `docs/DEPLOYMENT_GUIDE.md` với quy trình backup trước deploy kèm SHA-256, restore từ backup, stop/rollback container, health check/smoke test sau rollback và quy tắc bảo mật secret nghiêm ngặt.

### 1.2 Phạm Vi Trong (In-Scope)
- **Backend (`backend/src/app`)**:
  - `core/config.py`: Chuẩn hóa các biến môi trường AI (OpenAI mặc định, Ollama local) và runtime.
  - `services/llm_client.py`: Bổ sung `OllamaLLMClient` (gọi HTTP tới Ollama API với retry/timeout an toàn).
  - `api/v1/endpoints/system.py` & `api/v1/router.py`: Endpoint mới `GET /api/v1/system/ai-status`.
  - `main.py`: Global exception handler che chắn lỗi 500, log stack trace an toàn và trả về error ID.
- **Frontend (`apps/web`)**:
  - `features/system/ai-status-badge.tsx`: Hiển thị trạng thái AI ("AI thực tế", "Mock mode", "AI tạm thời không khả dụng") trên Header.
  - `features/onboarding/onboarding-workflow-banner.tsx`: Trực quan hóa chu trình 6 bước TRIZ.
  - `features/session/session-list.tsx`: Tích hợp Onboarding banner, nút "Bắt đầu phiên mẫu", empty state có hướng dẫn.
  - `features/ideation/candidate-solutions.tsx`: Hộp thoại xác nhận trước khi xóa solution.
  - `features/notebook/research-notebook.tsx`: Hộp thoại xác nhận trước khi xóa note.
- **Documentation & Operations (`docs/`)**:
  - `README.md` & `.env.example`: Cập nhật tài liệu cấu hình.
  - `docs/DEPLOYMENT_GUIDE.md`: Bổ sung Standard Operating Runbook & Rollback Plan.

### 1.3 Phạm Vi Ngoài (Out-of-Scope)
- KHÔNG xây dựng AI Coach (AI Coach sẽ được thực hiện riêng biệt tại Batch C31).
- KHÔNG triển khai, mở rộng hay viết test mới cho Gemini trong Batch C30.
- KHÔNG sửa đổi các thư mục deprecated (`apps/api/`, `frontend/`).
- KHÔNG thêm hạ tầng mới (không dùng Redis, Celery, Message Queue).
- KHÔNG sửa đổi database schema (không thêm migration mới, Alembic head giữ nguyên `006`).
- KHÔNG deploy môi trường production thực tế trong batch này.

---

## 2. Kiến Trúc Chi Tiết & Hợp Đồng Dữ Liệu (Detailed Architecture & Contracts)

### 2.1 Backend AI Provider & Safe Status API

#### A. Ollama LLM Client
- Gọi trực tiếp Ollama REST API (`POST {OLLAMA_BASE_URL}/api/generate` hoặc `/api/chat`) qua `httpx`.
- Kế thừa `LLMClient`, trả về `LLMAnalysisOutput`.
- Timeout mặc định: `settings.LLM_TIMEOUT_SECONDS` (10s), retry 2 lần.
- Nếu không kết nối được Ollama daemon: Fallback an toàn về `MockLLMClient` nếu cấu hình `fallback_on_error=True`.

#### B. API Contract: `GET /api/v1/system/ai-status`
- **Mục đích:** Cung cấp thông tin tình trạng kết nối AI cho client mà không để lộ secret.
- **Ràng buộc chi phí & hiệu năng:**
  - Tuyệt đối **KHÔNG gọi LLM sinh nội dung**, **KHÔNG tính token**, **KHÔNG phát sinh chi phí API** khi gọi endpoint này.
  - Sử dụng lightweight ping / capability validation với timeout tối đa **1.5 giây**.
  - Nếu kết nối quá 1.5s hoặc lỗi, tự động đánh dấu `degraded` hoặc `mock` mà không làm treo hệ thống.
- **Endpoint:** `GET /api/v1/system/ai-status`
- **Response Format (200 OK):**
```json
{
  "data": {
    "status": "ready",
    "status_label": "AI thực tế",
    "llm": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "is_real": true,
      "healthy": true
    },
    "embedding": {
      "provider": "openai",
      "model": "text-embedding-3-small",
      "is_real": true,
      "healthy": true
    },
    "fallback_active": false
  }
}
```
- **Quy tắc phân loại trạng thái tổng thể (`status` & `status_label`):**
  1. `ready` ("AI thực tế"): Cả LLM và Embedding đều là provider thực (`openai` hoặc `ollama`) có cấu hình hợp lệ và khả dụng.
  2. `mock` ("Mock mode"): Provider được cấu hình là `mock`, hoặc chưa có `OPENAI_API_KEY` hợp lệ.
  3. `degraded` ("Chế độ suy giảm"): Một trong hai dịch vụ là real nhưng bị lỗi kết nối/timeout (quá 1.5s) và đang tự động fallback về mock.
  4. `unavailable` ("AI tạm thời không khả dụng"): Provider thực gặp sự cố mạng hoặc timeout và không thể hoàn thành yêu cầu.
- **Bảo mật tuyệt đối (Zero-Secret Leak):**
  - Không bao giờ trả về API key, Authorization header, file path, hay database connection string trong response payload.
  - Test suites phải có assertion khẳng định không rò rỉ bất kỳ chuỗi nhạy cảm nào.

#### C. Backend Global Exception Shield
- Đăng ký exception handler toàn cục tại FastAPI:
```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_id = uuid.uuid4().hex[:8]
    logger.error("Unhandled server exception [%s]: %s", error_id, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error. Please try again later.",
            "error_id": error_id
        }
    )
```

---

### 2.2 Frontend UX & Onboarding Architecture (PR 2 Implementation)

#### A. Component `AIStatusBadge`
- Đặt tại góc phải thanh Header trang Sessions (`apps/web/features/session/session-list.tsx`).
- React Query cấu hình tối ưu: `staleTime: 60_000` (60s), `retry: 1`.
- Không block việc render trang khi endpoint `/ai-status` bị lỗi mạng.
- Hiển thị nhãn trực quan:
  - 🟢 Xanh lá: "AI thực tế" (`status === 'ready'`)
  - 🔵 Xanh dương: "Mock mode" (`status === 'mock'`)
  - 🟠 Hổ phách/Đỏ: "AI tạm thời không khả dụng" (`status === 'degraded'` | `'unavailable'` | error)
- Khi hover/click: Hiển thị tooltip mô tả ngắn gọn về tình trạng LLM & Embedding model.
- Bảo mật: Tuyệt đối không hiển thị API key, secret token, stack trace hay query trong DOM.

#### B. Component `OnboardingWorkflowBanner`
- Hiển thị trực quan tại đầu trang Sessions khi `sessions.length === 0`.
- Trình bày 6 chặng của chu trình giải quyết bài toán sáng tạo:
  1. **Intake**: Nhập tình huống khó khăn dạng "Muốn... Nhưng..."
  2. **Structuring**: Phân tách mâu thuẫn kỹ thuật / vật lý & thông số Altshuller.
  3. **Retrieval**: Tra cứu bằng chứng và case studies tương tự trong Knowledge Base.
  4. **Ideation**: Khám phá 40 Nguyên tắc sáng tạo qua 4 Lăng kính (Kỹ thuật, Kinh doanh, Đời sống, 9 Cửa sổ).
  5. **Evaluation**: Phát triển và đánh giá các Phương án Giải pháp (Candidate Solutions).
  6. **Synthesis**: Xuất báo cáo nghiên cứu hoàn chỉnh (Markdown / JSON / PDF Safe Print).

#### C. Quick-Start Sample Session ("Bắt đầu phiên mẫu")
- Nút CTA nổi bật tại Onboarding Banner: "🚀 Bắt đầu phiên mẫu".
- Quy tắc chọn mẫu (Strict Fallback Rule):
  1. Ưu tiên 1: Template `business_delivery_speed_cost` (hoặc alias logistics).
  2. Fallback 2: Template `personal_healthy_meal_time_cost` (hoặc alias nutrition).
  3. Tuyệt đối **KHÔNG dùng `templates[0]`** làm fallback.
  4. Nếu không tìm thấy cả 2 template: Hiển thị thông báo lỗi thân thiện, **KHÔNG tạo session**, **KHÔNG điều hướng**.
- Khi tạo thành công: Tự động chuyển hướng tới `/sessions/${newSession.id}`.

#### D. Safe Destructive Actions (Confirmation Dialogs)
- **Candidate Solutions**: Khi bấm nút "Xóa", hiển thị modal xác nhận:
  *"Bạn có chắc chắn muốn xóa giải pháp [Tên giải pháp]? Thao tác này không thể hoàn tác."*
  Các nút: [Hủy bỏ] (đóng modal, không gọi API) và [Xác nhận xóa] (mới gọi API xóa).
- **Research Notes**: Khi bấm nút "Xóa ghi chú", hiển thị modal xác nhận:
  *"Bạn có chắc chắn muốn xóa ghi chú này không?"*
  Các nút: [Hủy bỏ] (đóng modal, không gọi API) và [Xác nhận xóa] (mới gọi API xóa).

---

### 2.3 Environment & Deployment Specification

#### A. Bảng Ma Trận Biến Môi Trường (.env Contract)

| Tên Biến | Mặc Định | Kiểu | Mô Tả |
| :--- | :--- | :---: | :--- |
| `APP_ENV` | `development` | string | `development` \| `production` \| `test` |
| `DEBUG` | `True` | boolean | Tắt debug ở production |
| `DATABASE_URL` | `postgresql+asyncpg://...` | string | Kết nối PostgreSQL pgvector |
| `LLM_PROVIDER` | `mock` | string | `mock` \| `openai` \| `gemini` \| `ollama` |
| `LLM_MODEL_NAME` | `null` | string | Tùy chọn model (`gpt-4o-mini`, `gemini-1.5-flash`, v.v.) |
| `LLM_TIMEOUT_SECONDS` | `10.0` | float | Thời gian chờ tối đa cho LLM |
| `LLM_MAX_RETRIES` | `2` | int | Số lần thử lại trước khi fallback |
| `EMBEDDING_PROVIDER` | `mock` | string | `mock` \| `openai` \| `gemini` \| `ollama` |
| `EMBEDDING_MODEL_NAME` | `null` | string | Tùy chọn embedding model |
| `OPENAI_API_KEY` | `""` | string | Secret key cho OpenAI |
| `GEMINI_API_KEY` | `""` | string | Secret key cho Google Gemini |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | string | Địa chỉ máy chủ Ollama cục bộ |
| `ALLOWED_ORIGINS` | `["..."]` | JSON list | Danh sách CORS origins được phép |
| `ENABLE_CACHE` | `True` | boolean | Bật/tắt tầng đệm InMemoryTTLCache |
| `NEXT_PUBLIC_API_URL`| `http://localhost:8000` | string | Địa chỉ Backend API cho Web frontend |

---

## 3. Rủi Ro & Đánh Đổi (Risks & Trade-offs)

1. **Rủi ro kiểm tra sức khỏe AI làm chậm API (`/ai-status` latency):**
   - *Giải pháp:* Đặt timeout kiểm tra ping mạng tối đa là 1.5 giây. Nếu quá 1.5 giây không phản hồi, đánh dấu là `degraded` ngay lập tức mà không chặn API.
2. **Rủi ro rò rỉ secret qua logs:**
   - *Giải pháp:* Tuyệt đối không log chuỗi chứa `API_KEY` hoặc authorization headers. Trong endpoint `/ai-status`, chỉ trả về `is_configured: true/false`, không trả về giá trị key hay hash key.
3. **Rủi ro tương thích mẫu Onboarding:**
   - *Giải pháp:* Sử dụng mẫu `tpl-business-logistics` hoặc `tpl-personal-nutrition` đã được kiểm chứng 100% qua Phase 9.3 (`domain_templates.py`).
