---
title: "ADR-004 — Kiến trúc Knowledge Base Management & Vertical Slice Strategy"
topic: "architecture"
source_type: "decision-record"
language: "vi"
tags: ["adr", "phase-8", "knowledge-base", "ingestion", "vertical-slice", "fastapi", "nextjs"]
phase: "8"
status: "draft"
golden: false
created: "2026-10-02"
---

# ADR-004 — Kiến trúc Knowledge Base Management & Vertical Slice Strategy

## 1. Bối cảnh (Context)

Creative Research Workbench đã xây dựng các core capabilities:
- Ingestion pipeline (`IngestionService`) hỗ trợ bóc tách frontmatter, chunking `cl100k_base`, SHA-256 deduplication, và vector embedding.
- Retrieval service (`RetrievalService`) hỗ trợ Hybrid search (FTS + Vector cosine + RRF).
- Problem canvas, note tracking, candidate solution tracking và AI problem framing.

Tuy nhiên:
- Kho tài liệu Knowledge Base (`documents` và `chunks`) hiện chỉ được nạp qua CLI/script hoặc seed migration.
- Người dùng chưa có giao diện trực quan để xem danh mục tài liệu, kiểm tra các tài liệu Golden, nạp thêm tài liệu Markdown/Text mới, hoặc xóa tài liệu lỗi thời.
- Cần thiết lập kiến trúc quản lý Knowledge Base hoàn chỉnh nhưng phân kỳ theo phương pháp **Vertical Slice** an toàn.

---

## 2. Phân loại Hiện trạng (Facts vs Gaps vs Assumptions)

### Fact đã xác minh:
1. **Database Schema:** Migration `001_baseline_schema.py` đã tạo đầy đủ bảng `documents` (có `content_hash UNIQUE`, `golden`, `status`, metadata) và `chunks` (FK `ondelete="CASCADE"`, `embedding Vector(1536)`).
2. **Ingestion Engine:** `IngestionService` đã hoàn chỉnh pipeline xử lý Markdown, YAML frontmatter, tính toán SHA-256 hash và persist atomic transaction.
3. **Dependencies:** Backend đã có sẵn `python-multipart>=0.0.9`, `python-frontmatter>=1.1.0`, `tiktoken>=0.7.0`.

### Gaps:
1. **Backend Endpoints:** Chưa có router `/documents` trong `backend/src/app/api/v1/endpoints/`.
2. **Ingestion Interface:** `IngestionService` hiện chỉ có method `ingest(filepath: str)` đọc từ disk, chưa có helper xử lý `bytes` trực tiếp từ HTTP upload.
3. **Frontend Management:** Chưa có route `/knowledge` trên `apps/web/app/`.

### Assumptions (Cần kiểm soát):
1. Người dùng trong iteration 1 chỉ nạp các file tài liệu định dạng Markdown (`.md`) hoặc Plain Text (`.txt`) có kích thước < 10MB.
2. Việc quản lý tài liệu Knowledge Base là global (áp dụng chung cho toàn bộ workbench), không bị phân lập theo từng session (Session/IDOR boundary = N/A).

---

## 3. Quyết định Kiến trúc (Decisions)

### Quyết định 1: Triển khai Vertical Slice tối thiểu trước (Iteration 1)
- **Quyết định:** Thay vì làm đồng thời Ingestion UI + Full Document Viewer Bridge + 3D Knowledge Graph, Iteration 1 chỉ tập trung hoàn thiện một vertical slice trọn vẹn:
  1. Backend REST API (`GET /documents`, `GET /documents/{id}`, `POST /documents/upload`, `DELETE /documents/{id}`).
  2. Frontend trang `/knowledge` độc lập (Document list, Filters, Upload modal, Delete confirm, Detail Drawer/Panel đơn giản).
- **Lý do:** Giảm thiểu blast radius, bảo vệ code base đang ổn định, cho phép test end-to-end độc lập trước khi tích hợp vào canvas.

### Quyết định 2: Ingestion từ HTTP Upload qua `ingest_bytes`
- **Quyết định:** Mở rộng `IngestionService` với method `ingest_bytes(raw_bytes: bytes, filename: str, ...)` để xử lý trực tiếp buffer trong bộ nhớ.
- **Lý do:** Tránh ghi file tạm ra disk của container, loại trừ race condition và file descriptor leak.

### Quyết định 3: Xử lý Duplicate Upload (200 OK + `already_exists`)
- **Quyết định:** Khi upload file có `content_hash` đã tồn tại, backend trả về `HTTP 200 OK` với payload `{"data": {"status": "already_exists", "document_id": "..."}}`.
- **Lý do:** Tránh ném lỗi 4xx gây hiểu nhầm là lỗi hệ thống; cho phép UI hiển thị thông báo trạng thái nhẹ nhàng cho người dùng.

### Quyết định 4: Bảo vệ Golden Documents tuyệt đối (Hard Guard)
- **Quyết định:** Khi gọi `DELETE /api/v1/documents/{id}`, nếu `document.golden == True`, backend lập tức từ chối và trả về `HTTP 403 Forbidden` (`detail: "Không được phép xóa tài liệu Golden chuẩn"`).
- **Lý do:** Ngăn chặn việc vô tình làm mất 10 tài liệu Golden cốt lõi của hệ thống.

### Quyết định 5: Không sửa `apps/web/app/layout.tsx` trong Iteration 1
- **Quyết định:** Giữ nguyên `layout.tsx`. Trang `/knowledge` hoạt động như một standalone route và có thể được truy cập trực tiếp qua URL hoặc sub-navigation riêng.
- **Lý do:** Đảm bảo zero regression trên toàn bộ các route hiện hữu.

---

## 4. Hệ quả & Rủi ro (Consequences & Blast Radius)

- **Tích cực:**
  - Hệ thống có khả năng tự nạp thêm tri thức mới mà không cần can thiệp shell/CLI.
  - Zero DB migration risk do schema đã có sẵn từ migration 001.
  - Test suites độc lập, dễ dàng kiểm thử và cô lập lỗi.
- **Rủi ro & Giảm thiểu:**
  - *Rủi ro OOM khi upload file lớn:* Đặt giới hạn kích thước file upload tối đa 10MB trên cả FastAPI và Next.js.
  - *Rủi ro mất chunks/embeddings khi xóa:* PostgreSQL FK `CASCADE` bảo đảm xóa sạch sẽ không để lại orphan chunks.

---

## 5. Trạng thái

**Draft** — 2026-10-02 (Đang chờ phê duyệt)
