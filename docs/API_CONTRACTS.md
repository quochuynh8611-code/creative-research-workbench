---
title: "API CONTRACTS — Creative Research Workbench MVP"
topic: "api"
source_type: "contract"
language: "vi"
tags: ["rest-api", "endpoints", "json", "versioned", "fastapi", "mvp"]
phase: "1"
status: "canonical"
golden: true
created: "2026-07-03"
---

# API CONTRACTS — Creative Research Workbench MVP

> Base URL: `/api/v1`  
> Format: JSON  
> Auth: Bearer token (Phase 2+), anonymous session (Phase 1 MVP)

---

## Sessions

### POST /sessions
Tạo phiên nghiên cứu mới.

**Request:**
```json
{
  "title": "Phân tích mâu thuẫn trong thiết kế bánh răng",
  "description": "Optional"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "title": "...",
  "status": "active",
  "created_at": "ISO8601"
}
```

### GET /sessions
Danh sách sessions. Query params: `status`, `limit`, `offset`.

### GET /sessions/{id}
Lấy chi tiết session + problem_frame hiện tại.

### POST /sessions/batch-export
Xuất lưu trữ hàng loạt (Multi-Session Batch Export & Safe Archive) nhiều phiên nghiên cứu ra tệp nén ZIP dưới dạng streaming response (Batch C39, C39-FEAT-02).

**Request:**
```json
{
  "session_ids": ["uuid-1", "uuid-2"],
  "filters": {
    "status": "active",
    "domain": "business",
    "q": "pin lithium",
    "tag": "silicon",
    "date_from": "2026-01-01T00:00:00Z",
    "date_to": "2026-12-31T23:59:59Z"
  },
  "format": "both",
  "archive_after_export": false
}
```

**Response 200 (`application/zip`):**
Binary ZIP file stream chứa:
- `manifest.json`: Siêu dữ liệu lô xuất, tổng số phiên, mục lục phiên.
- `markdown/{slug}_{id_prefix}.md`: Tài liệu Markdown tổng hợp cho từng phiên.
- `json/{slug}_{id_prefix}.json`: Snapshot dữ liệu JSON đầy đủ cho từng phiên.

**Mã lỗi quy chuẩn:**
- `400 Bad Request`: Không truyền cả `session_ids` lẫn `filters`.
- `404 Not Found`: Không tìm thấy phiên nào khớp với yêu cầu.
- `422 Unprocessable Content`: Số lượng phiên khớp vượt quá ngưỡng an toàn tối đa (100 phiên). Header: `X-Error-Code: EXCEED_BATCH_LIMIT`.

---

## Problem Frames

### POST /sessions/{session_id}/problem-frame
Tạo/cập nhật problem frame cho session.

**Request:**
```json
{
  "raw_statement": "Bánh răng cần cứng để chịu lực nhưng mềm để giảm rung",
  "domain": "mechanical"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "normalized_statement": "...",
  "contradiction_type": "technical|physical|none",
  "parameters": [...]
}
```

---

## Search & Retrieval

### POST /search
Hybrid search: full-text + vector.

**Request:**
```json
{
  "query": "nguyên tắc phân tách mâu thuẫn vật lý",
  "top_k": 5,
  "filters": {
    "topic": ["architecture", "domain-model"],
    "phase": "2"
  }
}
```

**Response 200:**
```json
{
  "results": [
    {
      "chunk_id": "uuid",
      "source_ref": "docs/ADR-001-architecture.md",
      "excerpt": "...",
      "score": 0.92,
      "metadata": { "topic": "architecture", "status": "canonical" }
    }
  ],
  "latency_ms": 145
}
```

---

## Health

### GET /health
```json
{ "status": "ok", "version": "0.1.0" }
```
