---
title: "PHASE 8 EXECUTION SPEC — Knowledge Base Management"
topic: "knowledge-base"
source_type: "execution-spec"
language: "vi"
tags: ["phase-8", "knowledge-base", "documents-api", "ingestion", "upload", "spec"]
phase: "8"
status: "draft"
golden: false
created: "2026-10-02"
---

# PHASE 8 EXECUTION SPEC — Knowledge Base Management (Iteration 1: Vertical Slice)

> **Mục tiêu:** Xây dựng Vertical Slice hoàn chỉnh cho tính năng Quản lý Tri thức (Knowledge Base Management), bao gồm bộ REST API quản lý Documents trên Backend và giao diện trang `/knowledge` trên Frontend Web App.

---

## 1. Phân loại Hiện trạng (Fact / Gap / Assumption / Decision)

### A. Fact đã xác minh:
1. **Schema & Migration:** Bảng `documents` và `chunks` đã tồn tại trong database (được tạo bởi `backend/alembic/versions/001_baseline_schema.py`). Bảng `documents` có ràng buộc `content_hash UNIQUE`, các trường metadata (`topic`, `source_type`, `status`, `golden`), và quan hệ 1-N với `chunks` (`cascade="all, delete-orphan"`).
2. **Ingestion Service:** `backend/src/app/services/ingestion_service.py` đã có logic bóc tách YAML frontmatter, tính toán SHA-256 hash, chunking văn bản 512 tokens bằng `cl100k_base`, gọi `EmbeddingClient` tạo vector 1536 dim, và commit atomic transaction.
3. **Retrieval Service:** `backend/src/app/services/retrieval_service.py` thực hiện hybrid search (FTS + pgvector) trên bảng `chunks` và `documents`.
4. **Dependencies:** Backend đã có `python-multipart>=0.0.9`, `python-frontmatter>=1.1.0`.

### B. Gap:
1. **Backend Endpoint:** Chưa có file `backend/src/app/api/v1/endpoints/documents.py` và chưa đăng ký router `/documents` trong `router.py`.
2. **In-Memory Ingest:** `IngestionService` chỉ hỗ trợ method `ingest(filepath: str)` đọc từ disk; chưa có method `ingest_bytes` nhận bytes từ file upload multipart.
3. **Frontend API & Page:** `apps/web/lib/api-client.ts` chưa có các hàm quản lý Documents, và `apps/web/app/knowledge/page.tsx` chưa tồn tại.

### C. Assumption:
1. Iteration 1 chỉ hỗ trợ upload các file định dạng Markdown (`.md`) và Plain Text (`.txt`).
2. Giới hạn dung lượng file upload tối đa là 10MB mỗi file.
3. Knowledge Base là kho tri thức toàn cục (global corpus), không phân vùng theo từng session cá nhân (Session / IDOR boundary = N/A).

### D. Decision đã chốt:
1. **Vertical Slice nhỏ:** Chỉ tập trung hoàn thiện API CRUD Documents và trang `/knowledge` tối thiểu trước; chưa làm DocumentViewer bridge với `EvidencePanel`/`SearchOverlay` hay đồ thị 3D.
2. **Duplicate Upload:** Khi upload file có `content_hash` đã tồn tại, backend trả về `HTTP 200 OK` với payload `{"data": {"status": "already_exists", "document_id": "..."}}`.
3. **Golden Guard:** Cấm tuyệt đối việc xóa tài liệu có cờ `golden = True` (trả về `HTTP 403 Forbidden`).
4. **Không sửa `layout.tsx`:** Giữ nguyên root layout ở iteration 1 để đảm bảo zero regression trên các luồng hiện tại.

---

## 2. Scope & Boundaries

### Trong phạm vi (In-Scope):

#### 1. Backend Enhancements:
- **`IngestionService` Extension:** Bổ sung method `ingest_bytes(raw_bytes: bytes, filename: str, filepath: str | None = None) -> IngestResult`.
- **`backend/src/app/api/v1/endpoints/documents.py` (Tạo mới):**
  - `GET /api/v1/documents`: Danh sách documents, hỗ trợ query params: `topic`, `source_type`, `status`, `golden`, `q` (tìm theo title/filename), `limit` (default 50), `offset` (default 0). Trả về `{ data: DocumentItem[], meta: { total: int } }`.
  - `GET /api/v1/documents/{id}`: Chi tiết document kèm danh sách chunks và nội dung tóm tắt.
  - `POST /api/v1/documents/upload`: Nhận file upload qua `multipart/form-data` (`UploadFile`), gọi `ingest_bytes`, trả về thông tin document đã tạo hoặc trạng thái `already_exists`.
  - `DELETE /api/v1/documents/{id}`: Kiểm tra `golden == True` -> trả về 403; nếu không -> xóa document và cascade xóa toàn bộ chunks liên quan.
- **Router Registration:** Đăng ký router `/documents` trong `backend/src/app/api/v1/router.py`.

#### 2. Frontend Enhancements:
- **Type Definitions (`apps/web/lib/types.ts`):** `DocumentItem`, `DocumentDetail`, `DocumentChunkItem`, `DocumentListResponse`, `DocumentUploadResponse`.
- **API Client (`apps/web/lib/api-client.ts`):** `listDocuments`, `getDocument`, `uploadDocument`, `deleteDocument`.
- **Page `/knowledge` (`apps/web/app/knowledge/page.tsx`):**
  - Thanh tiêu đề và nút "Nạp tài liệu" (Upload).
  - Thanh tìm kiếm và bộ lọc nhanh theo `topic`, `status`, `golden`.
  - Bảng danh sách tài liệu hiển thị: Tiêu đề, Tên file, Topic, Tags, Số chunks, Status, Golden Badge, Ngày tạo, Nút xem chi tiết, Nút xóa.
  - **Upload Modal:** Chọn file `.md`/`.txt`, hiển thị trạng thái loading khi đang chunk và embed, thông báo dedup rõ ràng.
  - **Delete Confirmation Dialog:** Xác nhận xóa đối với tài liệu thường; cảnh báo/disable đối với Golden Documents.
  - **Detail View Modal/Drawer đơn giản:** Xem metadata đầy đủ và danh sách các chunk đã phân tách của tài liệu.

### Ngoài phạm vi (Out-of-Scope):
- Không sửa `apps/web/app/layout.tsx`.
- Không hỗ trợ định dạng PDF/DOCX trong iteration này.
- Chưa kết nối bridge DocumentViewer vào `EvidencePanel` và `SearchOverlay`.
- Chưa làm 3D Knowledge Graph (`react-force-graph`).
- Không chạm vào 10 file untracked out-of-scope.

---

## 3. API Contracts Specification

### 3.1 `GET /api/v1/documents`
**Query Parameters:**
- `q`: string (optional) — tìm kiếm theo title hoặc filename
- `topic`: string (optional)
- `status`: string (optional) — canonical | draft | deprecated
- `golden`: boolean (optional)
- `limit`: int (default: 50, min: 1, max: 100)
- `offset`: int (default: 0, min: 0)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "filename": "ADR-001-architecture.md",
      "filepath": "docs/ADR-001-architecture.md",
      "title": "ADR-001 — Kiến trúc cho Creative Research Workbench",
      "topic": "architecture",
      "source_type": "decision-record",
      "language": "vi",
      "tags": ["adr", "workflow-engine", "pgvector"],
      "phase": "1",
      "status": "canonical",
      "golden": true,
      "content_hash": "a1b2c3...",
      "chunks_count": 4,
      "created_at": "2026-10-01T10:00:00Z",
      "updated_at": "2026-10-01T10:00:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

### 3.2 `GET /api/v1/documents/{id}`
**Response (200 OK):**
```json
{
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "filename": "ADR-001-architecture.md",
    "filepath": "docs/ADR-001-architecture.md",
    "title": "ADR-001 — Kiến trúc cho Creative Research Workbench",
    "topic": "architecture",
    "source_type": "decision-record",
    "language": "vi",
    "tags": ["adr", "workflow-engine"],
    "phase": "1",
    "status": "canonical",
    "golden": true,
    "content_hash": "a1b2c3...",
    "chunks_count": 2,
    "created_at": "2026-10-01T10:00:00Z",
    "updated_at": "2026-10-01T10:00:00Z",
    "chunks": [
      {
        "id": "uuid-chunk-1",
        "chunk_index": 0,
        "token_count": 140,
        "content": "Nội dung đoạn 1..."
      }
    ]
  }
}
```

### 3.3 `POST /api/v1/documents/upload`
**Request:** `multipart/form-data` with field `file: UploadFile`

**Response (200 OK — Thành công tạo mới):**
```json
{
  "data": {
    "status": "success",
    "document_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "filename": "new-doc.md",
    "title": "Tài liệu nghiên cứu mới",
    "chunks_created": 3,
    "embeddings_created": 3
  }
}
```

**Response (200 OK — Trùng lặp content_hash):**
```json
{
  "data": {
    "status": "already_exists",
    "document_id": "existing-doc-uuid",
    "filename": "new-doc.md",
    "message": "Tài liệu này đã tồn tại trong Knowledge Base."
  }
}
```

### 3.4 `DELETE /api/v1/documents/{id}`
**Response (200 OK):**
```json
{
  "status": "deleted",
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```
**Response (403 Forbidden — Nếu tài liệu là Golden):**
```json
{
  "detail": "Không được phép xóa tài liệu Golden chuẩn."
}
```

---

## 4. Blast Radius & Sensitivity Points

- **Backend Blast Radius:** Khu biệt hoàn toàn trong `documents.py` và `ingestion_service.py`. Không ảnh hưởng tới `sessions.py`, `search.py`, hay `triz.py`.
- **Database Safety:** Không có schema migration mới. Sử dụng transaction an toàn, tự động rollback nếu quá trình chunking/embedding gặp sự cố.
- **Golden Data Protection:** Endpoint `DELETE` chặn cứng từ tầng controller để đảm bảo an toàn tuyệt đối cho 10 tài liệu Golden.

---

## 5. Acceptance Criteria

1. **AC-1 (List Documents):** `GET /api/v1/documents` trả về danh sách tài liệu phân trang, hỗ trợ lọc theo topic, status, golden và tìm kiếm theo tên.
2. **AC-2 (Get Document Detail):** `GET /api/v1/documents/{id}` trả về metadata chi tiết kèm danh sách chunks.
3. **AC-3 (Upload Markdown/Text):** `POST /api/v1/documents/upload` nạp thành công file `.md` có frontmatter, tự động chunk, tạo embedding vector và lưu vào DB.
4. **AC-4 (Dedup Content Hash):** Khi upload file trùng nội dung, API trả về 200 OK với `status: 'already_exists'` và ID tài liệu cũ.
5. **AC-5 (Delete Non-Golden Document):** `DELETE /api/v1/documents/{id}` xóa thành công document thường và cascade xóa toàn bộ chunks liên quan.
6. **AC-6 (Golden Document Delete Guard):** `DELETE /api/v1/documents/{id}` đối với tài liệu `golden=True` trả về HTTP 403 Forbidden.
7. **AC-7 (Frontend Knowledge Page):** Trang `/knowledge` hiển thị bảng tài liệu, hỗ trợ tìm kiếm/lọc, modal upload file, modal xem chi tiết và modal xóa an toàn.
8. **AC-8 (Zero Quality Regression):** Tất cả backend và frontend test suites đạt 100% PASS, type-check đạt 0 lỗi.
