---
title: "ADR-011 — Chuẩn hóa Cấu hình AI, Onboarding và Đóng gói Vận hành (Productization & AI Configuration)"
topic: "architecture"
source_type: "decision-record"
language: "vi"
tags: ["adr", "productization", "ai-configuration", "onboarding", "ux-polish", "deployment", "runbook"]
phase: "12.5"
status: "accepted"
golden: true
created: "2026-11-17"
---

# ADR-011 — Chuẩn hóa Cấu hình AI, Onboarding và Đóng gói Vận hành (Productization & AI Configuration)

## 1. Bối cảnh (Context)

1. **Hiện trạng Kiến trúc AI:**
   - Hệ thống Creative Research Workbench (CRW) đã hoàn tất Phase 12 (Quality & Performance Hardening với IVFFlat Indexing, Async Background Jobs và InMemoryTTLCache).
   - Module `backend/src/app/services/embedding_client.py` đã hỗ trợ các provider `mock`, `openai`, `gemini`, `ollama`.
   - Module `backend/src/app/services/llm_client.py` hiện hỗ trợ `mock`, `openai`, `gemini`, nhưng còn thiếu client `ollama` và chưa có cơ chế kiểm tra sức khỏe AI tổng hợp.
   - Chưa có endpoint an toàn cho phép Frontend hoặc bộ điều hành truy vấn trạng thái thực của AI (AI Provider, mô hình đang hoạt động, fallback mode) mà không để lộ khóa bí mật (API keys/secrets).

2. **Hiện trạng Trải nghiệm Người dùng (UX & Onboarding):**
   - Chưa có màn hình/banner Onboarding hướng dẫn luồng tư duy TRIZ 6 bước: `Intake` ➔ `Structuring` ➔ `Retrieval` ➔ `Ideation` ➔ `Evaluation` ➔ `Synthesis`.
   - Các hành động mang tính hủy hoại (destructive actions) như xóa Candidate Solution hoặc xóa Research Note hiện diễn ra ngay lập tức khi bấm nút xóa mà chưa có hộp thoại xác nhận (Confirmation Dialog/Modal), tiềm ẩn rủi ro mất dữ liệu nghiên cứu do vô tình thao tác.
   - Các empty-state còn đơn điệu, chưa điều hướng hành động kế tiếp (next-action guidance).
   - Lỗi 500 unhandled exceptions từ backend chưa có global handler bọc an toàn, có thể trả về chi tiết kỹ thuật nội bộ hoặc stack trace.

3. **Hiện trạng Đóng gói & Vận hành (Deployment & Operations):**
   - Các biến môi trường `ALLOWED_ORIGINS`, `NEXT_PUBLIC_API_URL`, `DATABASE_URL` cần được tài liệu hóa và chuẩn hóa qua `.env.example`.
   - Cần runbook chuẩn cho: Start, Stop, Backup DB (`pg_dump` với SHA-256), Restore DB, Health check, Smoke test và xử lý các lỗi thường gặp (Port conflict, CORS, AI key expiration).

---

## 2. Quyết định Kiến trúc (Architectural Decision)

Chúng tôi quyết định áp dụng bộ giải pháp đóng gói chuẩn hóa (Productization Blueprint) cho Batch C30 bao gồm:

### 2.1 An toàn & Nhận thức Trạng thái AI (Safe AI Status & Polymorphic Fallback)
1. **AI Provider Mặc định & Lựa chọn Local**:
   - OpenAI (`gpt-4o-mini`, `text-embedding-3-small`) là provider mặc định cho cả LLM và Embedding.
   - Ollama là lựa chọn local/self-host.
   - Giữ nguyên mã Gemini hiện có, không mở rộng, không thêm test mới cho Gemini trong Batch C30.
2. **Bổ sung OllamaLLMClient**: Hoàn thiện đa hình LLM (`MockLLMClient`, `OpenAILLMClient`, `GeminiLLMClient`, `OllamaLLMClient`) sử dụng `httpx` gọi `/api/generate` hoặc `/api/chat` của Ollama cục bộ.
3. **Endpoint An toàn `GET /api/v1/system/ai-status`**:
   - Tuyệt đối **không** trả về bất kỳ API key, secret token hay thông tin xác thực nhạy cảm nào.
   - Cung cấp siêu dữ liệu an toàn: `status` (`ready` | `mock` | `degraded` | `unavailable`), `status_label` ("AI thực tế" | "Mock mode" | "AI tạm thời không khả dụng"), chi tiết `provider`, `model`, `healthy`, `fallback_active`.
   - Timeout kiểm tra AI status tối đa 1.5 giây.
   - Endpoint `/ai-status` **không** gọi LLM sinh nội dung, không tính token, không tạo chi phí API.
4. **Graceful Fallback**: Bất kỳ lỗi mạng, hết hạn key hoặc rate limit từ External AI API đều tự động fallback về `MockLLMClient` / `MockEmbeddingClient` kèm logging cảnh báo, không bao giờ làm sập (crash 500) session, notebook hay export. Không retry vô hạn, không treo request, không làm mất dữ liệu.

### 2.2 Onboarding 6 Bước & Khởi Tạo Nhanh (Guided Onboarding & Quick-Start)
1. Xây dựng component `OnboardingWorkflowBanner` trên giao diện Sessions giải thích trực quan chu trình TRIZ 6 bước.
2. Cung cấp nút bấm "Khởi tạo Phiên mẫu Nhanh" (Quick-Start Sample Session) kích hoạt từ Domain Templates có sẵn (`triz_domain_templates`), giúp người dùng mới lập tức có dữ liệu mẫu để trải nghiệm đầy đủ các tab.
3. Bổ sung Empty State giàu ngữ cảnh kèm nút điều hướng hành động kế tiếp cho Session, Contradiction, Solution, Research Note và Export.

### 2.3 UX Polish & Kiểm soát Ranh giới An toàn (Safe Destructive UX & Error Shield)
1. **Confirmation Dialog trước khi Xóa**:
   - Áp dụng modal xác nhận cho thao tác xóa Candidate Solution (`candidate-solutions.tsx`).
   - Áp dụng modal xác nhận cho thao tác xóa Research Note (`research-notebook.tsx`).
2. **Global Exception Shield**:
   - Đăng ký exception handler toàn cục tại FastAPI (`main.py`) bắt mọi ngoại lệ không xử lý, log stack trace nội bộ kèm error ID, và trả về client HTTP 500 với thông điệp trung tính: `{"detail": "Internal server error. Please try again later.", "error_id": "..."}`.

### 2.4 Chuẩn hóa Vận hành & Runbook
1. Đồng bộ `.env.example` với đầy đủ các khóa môi trường.
2. Cập nhật `docs/DEPLOYMENT_GUIDE.md` với Runbook chi tiết gồm 6 quy trình: Khởi động, Dừng, Sao lưu, Phục hồi, Kiểm định sức khỏe (Smoke tests), và Xử lý sự cố.

---

## 3. Các Phương Án Bị Từ Chối (Rejected Alternatives)

1. **Tích hợp AI Coach Agent ngay trong Batch C30**:
   - *Lý do từ chối:* Vi phạm phạm vi batch. Batch C30 tập trung ổn định nền tảng (productization, onboarding, UX, deployment). AI Coach là tính năng nghiệp vụ sâu, sẽ được triển khai độc lập tại Batch C31 theo nguyên tắc Blast Radius Defense.
2. **Lưu trữ API Key trong Database hoặc cho phép cập nhật qua UI**:
   - *Lý do từ chối:* Tăng bề mặt tấn công bảo mật, yêu cầu mã hóa at-rest (KMS/Vault) và quản lý phân quyền phức tạp. Biến môi trường (`.env` server-side) là tiêu chuẩn an toàn tối ưu cho workbench nghiên cứu cục bộ.
3. **Thêm Redis để quản lý AI rate-limiting và session**:
   - *Lý do từ chối:* Vi phạm nguyên tắc tinh gọn hạ tầng đã cam kết tại `ADR-004` và `ADR-010`. In-process fallback và `InMemoryTTLCache` là đủ cho nhu cầu hiện tại.

---

## 4. Hệ Quả & Đánh Đổi (Consequences & Trade-offs)

### Tích cực:
- Người dùng có thể khởi chạy và làm quen với hệ thống trong vòng dưới 1 phút nhờ Onboarding và Sample Session.
- Hệ thống hoạt động an toàn kể cả khi không có API key hay khi mất kết nối mạng.
- Loại bỏ hoàn toàn nguy cơ vô tình xóa mất dữ liệu nghiên cứu và rò rỉ stack trace.
- Quy trình triển khai, sao lưu và phục hồi được tài liệu hóa rõ ràng.

### Đánh đổi / Rủi ro:
- Cần duy trì tính đồng bộ giữa UI và các template nghiên cứu khi cập nhật cấu trúc bài toán.
- Việc kiểm tra kết nối AI (`healthy check`) cần có timeout ngắn (≤ 2s) để tránh làm nghẽn endpoint `/ai-status`.

---

## 5. Kế Hoạch Rollback (Rollback Plan)
- Mọi thay đổi đều là additive (bổ sung thêm API `/system/ai-status`, component UI mới, modal xác nhận).
- Không có thay đổi schema database (Alembic head giữ nguyên `006`).
- Nếu có sự cố, có thể revert commit nhánh hoặc tắt tính năng AI thông qua biến môi trường `LLM_PROVIDER=mock`.
