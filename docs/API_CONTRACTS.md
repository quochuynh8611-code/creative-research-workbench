---
title: "API CONTRACTS — Creative Research Workbench MVP"
topic: api
source_type: contract
language: vi
tags: [rest-api, endpoints, json, versioned, openapi]
golden: true
phase: 0
created_at: 2026-07-03
---

# API CONTRACTS — Creative Research Workbench MVP

## Purpose
Xác định API contract mức MVP giữa frontend workspace và backend workflow engine.

## Conventions
- Base path: `/api/v1`
- Content type: `application/json`
- Error envelope:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "problem_frame is incomplete",
    "details": ["goal is required"]
  }
}
```
- Mọi object có `id`, `created_at`, `updated_at`.

## 1. Sessions

### POST /api/v1/sessions
Tạo research session mới.
```json
// Request
{ "title": "string", "domain": "technical|business|education|personal|research|other", "tags": [] }
// Response 201
{ "id": "uuid", "title": "string", "slug": "string", "status": "draft", "created_at": "datetime" }
```

### GET /api/v1/sessions
Lấy danh sách sessions.
```json
// Response 200
{ "data": [Session], "meta": { "total": 0, "page": 1, "per_page": 20 } }
```

### GET /api/v1/sessions/{id}
Lấy chi tiết session.

### PATCH /api/v1/sessions/{id}
Cập nhật session.

### DELETE /api/v1/sessions/{id}
Xóa session (soft delete).

## 2. Problem Intake

### POST /api/v1/sessions/{id}/problem-frames
Nhận raw problem statement, sinh ProblemFrame.
```json
// Request
{ "raw_statement": "string" }
// Response 201
{ "id": "uuid", "rewritten_statement": "string", "goal": "string", "constraints": [], "completeness_score": 0.0 }
```

### GET /api/v1/sessions/{id}/problem-frames
Lấy danh sách ProblemFrame của session.

### GET /api/v1/sessions/{id}/problem-frames/{frame_id}
Lấy chi tiết ProblemFrame.

## 3. Structuring

### POST /api/v1/sessions/{id}/problem-frames/{frame_id}/contradictions
Extract contradictions từ ProblemFrame.
```json
// Response 201
{ "id": "uuid", "type": "technical|physical", "improving_parameter": "string", "worsening_parameter": "string", "suggested_principles": [] }
```

## 4. Retrieval

### POST /api/v1/search
Hybrid search trên knowledge base.
```json
// Request
{ "query": "string", "session_id": "uuid", "top_k": 5 }
// Response 200
{ "results": [{ "source_file": "string", "excerpt": "string", "score_hybrid": 0.0, "chunk_index": 0 }] }
```

## 5. Method Suggestions

### GET /api/v1/sessions/{id}/method-suggestions
Lấy danh sách method suggestions.

### POST /api/v1/sessions/{id}/method-suggestions/generate
Generate method suggestions dựa trên ProblemFrame + retrieved docs.

## 6. Workflow

### POST /api/v1/sessions/{id}/advance
Chuyển session sang stage tiếp theo.
```json
// Request
{ "to_stage": "structuring|retrieval|ideation|evaluation|synthesis" }
// Response 200
{ "session_id": "uuid", "previous_stage": "string", "current_stage": "string" }
```
