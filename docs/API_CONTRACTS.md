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
