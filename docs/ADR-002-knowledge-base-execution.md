---
title: "ADR-002 — Kiến trúc Quản lý và Thực thi Cơ sở Tri thức (Knowledge Base Execution Architecture)"
topic: "architecture"
source_type: "decision-record"
language: "vi"
tags: ["adr", "phase-8", "knowledge-base", "ingestion", "documents-api", "fastapi", "pgvector"]
phase: "8"
status: "accepted"
golden: true
created: "2026-11-16"
---

# ADR-002 — Kiến trúc Quản lý và Thực thi Cơ sở Tri thức (Knowledge Base Execution Architecture)

## 1. Bối cảnh (Context)

Creative Research Workbench cần một kho tri thức nền tảng (Knowledge Base) linh hoạt nhưng tuyệt đối an toàn để phục vụ nghiên cứu và giải quyết bài toán sáng tạo theo phương pháp luận TRIZ:
- Hệ thống đã có `IngestionService` hỗ trợ bóc tách frontmatter, chunking văn bản 512 tokens (`cl100k_base`), tính toán mã băm SHA-256 chống trùng lặp, và nhúng vector 1536 chiều với pgvector.
- `RetrievalService` thực hiện tìm kiếm lai (Hybrid Search: FTS `tsvector` + Vector cosine distance qua RRF fusion).
- Kho tri thức hiện hữu chứa các tài liệu chuẩn mực (Golden Documents) như các nguyên tắc TRIZ, ADRs kiến trúc, và tri thức miền.
- **Vấn đề đặt ra:** Cần mở rộng bộ REST API quản lý tài liệu (`POST /upload`, `PUT /{id}`, `DELETE /{id}`) cho Phase 8, cho phép nạp mới, cập nhật nội dung (re-chunk, re-embed nguyên tử) và xóa tài liệu, đồng thời bảo vệ nghiêm ngặt tính toàn vẹn của các tài liệu Golden.

---

## 2. Các Quyết định Kiến trúc (Decisions)

### Quyết định 1: Không thay đổi Database Schema, tái sử dụng IngestionService
- **Quyết định:** Giữ nguyên schema cơ sở dữ liệu hiện tại (001–006 baseline). Bảng `documents` và `chunks` với quan hệ cascade delete và ràng buộc `content_hash UNIQUE` đã đáp ứng hoàn hảo yêu cầu của Phase 8.
- **Lý do:** Blast radius của việc thay đổi schema là rất cao. Việc tái sử dụng cấu trúc bảng và logic chunking/embedding sẵn có của `IngestionService` đảm bảo tính nhất quán và loại bỏ rủi ro migration.

### Quyết định 2: Bổ sung endpoint cập nhật `PUT /api/v1/documents/{document_id}` nguyên tử
- **Quyết định:** Cung cấp endpoint `PUT /api/v1/documents/{document_id}` nhận payload `DocumentUpdateRequest` (chứa `content: str`, và tùy chọn `title`, `topic`, `tags`).
- **Cơ chế thực thi trong một Transaction duy nhất (Atomic Execution):**
  1. Kiểm tra tài liệu tồn tại: nếu không tìm thấy, trả về `404 Not Found`.
  2. **Golden Document Guard:** Nếu `document.golden == True`, lập tức từ chối với `403 Forbidden` (`detail: "Không thể cập nhật Golden Document chuẩn tắc của hệ thống."`).
  3. Bóc tách YAML frontmatter (nếu có) bằng `FrontmatterParser.parse(content)`.
  4. Tính toán mã băm SHA-256 mới của `content`. Nếu hash này trùng lặp với một document khác trong hệ thống, trả về `409 Conflict`.
  5. Xóa toàn bộ các `Chunk` cũ thuộc về `document_id`.
  6. Phân đoạn nội dung mới thành các chunks thông qua `MarkdownChunker(max_tokens=512, overlap_tokens=50)`.
  7. Sinh embedding vector 1536 chiều cho các chunks mới thông qua `EmbeddingClient` và chuẩn hóa kích thước vector.
  8. Lưu các `Chunk` mới và cập nhật metadata của `Document` (`title`, `topic`, `tags`, `content_hash`, `updated_at`).
  9. Commit transaction.
- **Lý do:** Đảm bảo dữ liệu văn bản và vector chunks luôn đồng bộ 100%, không bị trạng thái phân mảnh (dangling chunks hay out-of-sync embeddings).

### Quyết định 3: Bảo vệ Golden Documents tuyệt đối (Dual Hard Guard)
- **Quyết định:** Cả hai thao tác xóa (`DELETE /api/v1/documents/{id}`) và cập nhật (`PUT /api/v1/documents/{id}`) đều áp dụng chốt chặn cứng:
  - Nếu `document.golden is True` -> trả về HTTP `403 Forbidden`.
- **Lý do:** Ngăn chặn tuyệt đối mọi hành vi vô tình hay cố ý làm biến đổi hoặc xóa bỏ các tài liệu Golden gốc của hệ thống.

### Quyết định 4: Deduplication khi nạp (`POST /upload`)
- **Quyết định:** Khi người dùng upload một tài liệu có SHA-256 `content_hash` trùng với tài liệu đã tồn tại trong DB:
  - Trả về HTTP `200 OK` với body `{"data": {"status": "already_exists", "document_id": "...", "message": "..."}}`.
  - Không tạo thêm bất kỳ record nào trong bảng `documents` hay `chunks`.
- **Lý do:** Idempotency chuẩn mực, tránh phình to database và giảm tải cho embedding model.

### Quyết định 5: Đồng bộ tức thì với Retrieval Layer
- **Quyết định:** Do `RetrievalService` truy vấn trực tiếp trên bảng `chunks` (FTS `to_tsvector` + pgvector `<=>`), mọi thao tác tạo mới, cập nhật hoặc xóa đều có hiệu lực ngay lập tức trong kết quả tìm kiếm `POST /api/v1/search` mà không cần tiến trình re-indexing nền phức tạp.

---

## 3. Luồng Dữ Liệu & Ranh Giới Giao Tác (Data Flow & Transaction Boundaries)

```
[Client Request]
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ FastAPI Controller (documents.py)                      │
│ - Validate Schema / File Size (<= 10MB)                │
│ - Golden Document Guard Check                          │
└──────────────┬─────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────┐
│ Ingestion / Parsing / Vectorization                    │
│ - FrontmatterParser (Extract metadata & body)          │
│ - MarkdownChunker (cl100k_base, 512 tokens, 50 overlap)│
│ - EmbeddingClient (1536-dim vector standardization)   │
└──────────────┬─────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────┐
│ PostgreSQL 16 + pgvector (Single Transaction)          │
│ - Upload: INSERT Document + Chunks                     │
│ - Update: DELETE old Chunks -> INSERT new Chunks ->    │
│           UPDATE Document                              │
│ - Delete: DELETE Document (CASCADE Chunks)             │
│ - Commit / Rollback on Error                           │
└────────────────────────────────────────────────────────┘
```

---

## 4. Hệ quả & Giảm thiểu Rủi ro (Consequences & Blast Radius)

- **Tích cực:**
  - Hoàn thiện đầy đủ năng lực CRUD cho Knowledge Base.
  - An toàn 100% cho 10 tài liệu Golden.
  - Zero regression: không ảnh hưởng tới các module `sessions`, `search`, hay `triz`.
  - Kiểm thử tự động dễ dàng cô lập và bảo đảm độ bao phủ cao.
- **Rủi ro & Giảm thiểu:**
  - *Rủi ro OOM với file lớn:* Giới hạn kích thước file upload 10MB (`MAX_UPLOAD_SIZE_BYTES`).
  - *Rủi ro vector dimension lệch chuẩn:* Chuẩn hóa vector nghiêm ngặt về 1536 chiều trước khi insert vào PostgreSQL.

---

## 5. Trạng thái (Status)

**Accepted** — 2026-11-16 (Đã được phê duyệt bởi Founder).
