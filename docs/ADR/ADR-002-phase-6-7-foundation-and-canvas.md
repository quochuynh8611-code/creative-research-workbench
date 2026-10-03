# ADR-002 — Kiến trúc Nền tảng AI Core, Full TRIZ Matrix, Two-Stage Schema Migration và Research Canvas

> **Tài liệu**: Architecture Decision Record (ADR)
> **Số hiệu**: ADR-002
> **Trạng thái**: Proposed (Chờ phê duyệt trước khi lập trình)
> **Ngày**: 2026-09-30
> **Tác giả**: Technical Architect & Staff Software Engineer
> **Liên kết tham chiếu**: [`docs/ADR/ADR-001-architecture.md`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/docs/ADR/ADR-001-architecture.md), [`docs/PHASE_6_7_EXECUTION_SPEC.md`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/docs/PHASE_6_7_EXECUTION_SPEC.md)

---

## 1. Context & Problem Statement

Hệ thống Creative Research Workbench sau Phase 5.9 đối mặt với các quyết định kiến trúc quan trọng:

1. **Quản lý Database Schema**: Cần chuyển từ `Base.metadata.create_all()` sang Alembic với quy trình phân tách rõ rệt: **Migration 001 (Baseline 5 bảng gốc)** và **Migration 002 (Bảng mới `research_notes` & `candidate_solutions`)**.
2. **Thứ tự thực thi Domain vs External AI**: Cần ưu tiên làm phần tri thức tất định (Deterministic - Full TRIZ 39×39 Altshuller Matrix) trước khi tích hợp External API Embedding để tối ưu hóa tính độc lập và độ tin cậy của domain core.
3. **AI Trust Contract & Non-Destructive Policy**: Làm rõ việc AI Output chỉ là gợi ý tạm thời (ephemeral suggestion), không bao giờ tự động ghi đè domain entities, và phân định 3 tầng xuất xứ tri thức (Rule-based vs Altshuller Matrix vs AI Hypothesis).
4. **Kiến trúc Embedding Client**: Xây dựng Factory đa hình có cơ chế Graceful Fallback để đảm bảo pipeline không bao giờ sập khi gặp lỗi mạng/API key.
5. **Mô hình Dữ liệu Notes & Export**: Lưu trữ Notes thành bảng quan hệ có ràng buộc khóa ngoại và xuất báo cáo Markdown từ Server-Side.

---

## 2. Decision Matrix & Lựa chọn Kiến trúc

### Quyết định 1: Two-Stage Alembic Migrations (Tách Baseline & Features)
- **Lựa chọn**: Thiết lập Alembic với 2 file migration tuần tự rõ ràng:
  - `001_baseline_schema.py`: Ghi nhận nguyên vẹn 5 bảng hiện có (`documents`, `chunks`, `research_sessions`, `problem_frames`, `contradictions`).
  - `002_add_research_notes_and_candidate_solutions.py`: Tạo mới 2 bảng `research_notes` và `candidate_solutions`.
- **Lý do**: Cho phép kiểm thử rollback từng giai đoạn độc lập (`downgrade 001` vs `downgrade base`), bảo vệ tuyệt đối an toàn dữ liệu.

### Quyết định 2: Thực thi Deterministic Track (TRIZ 39×39) Trước AI External Track
- **Lựa chọn**: Triển khai Full TRIZ 39×39 static JSON và mở rộng 39 parameters **trước** khi triển khai Real Embedding Engine.
- **Lý do**:
  - 100% offline, zero external dependencies, zero chi phí API, không phụ thuộc mạng.
  - Củng cố lõi phân tích mâu thuẫn của `ProblemStructuringService` và `MethodRecommender` ngay lập tức.
  - Tạo nền tảng bài toán chuẩn xác cho các bước tìm kiếm và ghi chú phía sau.

### Quyết định 3: AI Trust Contract & Provenance Tiers
- **Lựa chọn**:
  - Dữ liệu AI sinh ra ở Phase 6 chỉ mang tính chất **gợi ý tạm thời (ephemeral suggestion)** trên UI.
  - Nghiêm cấm mọi hành vi tự động ghi đè (auto-overwrite) vào `ProblemFrame` hay `Contradiction`.
  - Phân định rõ 3 tầng: `rule_based`, `altshuller_matrix_39x39`, và `ai_hypothesis`.
  - Logging provenance đầy đủ; chưa lưu raw chat log vào DB ở Phase 6 để giảm thiểu blast radius.

### Quyết định 4: Factory Đa hình cho EmbeddingClient với Graceful Fallback
- **Lựa chọn**: Abstract interface `EmbeddingClient` với các implementation `OpenAIEmbeddingClient`, `GeminiEmbeddingClient`, `MockEmbeddingClient`.
- **Lý do**: Khi API bên ngoài timeout hoặc lỗi 429, hệ thống tự động fallback về Mock/FTS mà không gián đoạn request người dùng.

### Quyết định 5: Bảng quan hệ Độc lập cho Notes và Server-Side Export
- **Lựa chọn**: Bảng `research_notes` liên kết `session_id` (`ON DELETE CASCADE`), endpoint `GET /api/v1/sessions/{id}/export?format=md` sinh Markdown trực tiếp từ backend.

---

## 3. Consequences & Blast Radius Re-Assessment

| Tầng rủi ro | Mức độ Blast Radius | Biện pháp Phòng vệ & Rollback |
|---|---|---|
| **Track 0: Two-Stage Migrations** | **TRUNG BÌNH** | Tách riêng 001 và 002. Rollback bằng `alembic downgrade 001` hoặc `alembic downgrade base`. |
| **Track 1: Full TRIZ 39×39 (Deterministic)** | **THẤP** | Dữ liệu tĩnh in-memory $O(1)$, zero external calls. Rollback bằng git revert file JSON. |
| **Track 2: Real Embeddings (AI Core)** | **TRUNG BÌNH** | Tác động ingestion/retrieval. Graceful fallback về Mock/FTS khi có lỗi. Rollback qua env `EMBEDDING_PROVIDER=mock`. |
| **Track 3: Notes DB & API Persistence** | **TRUNG BÌNH** | Thêm bảng mới, FK CASCADE. Rollback qua `alembic downgrade 001`. |
| **Track 4: Notebook UI & Canvas** | **THẤP** | Component UI thay thế placeholder, bọc ErrorBoundary. |
| **Track 5: Markdown Export** | **RẤT THẤP** | Read-only endpoint, zero DB mutation. |
