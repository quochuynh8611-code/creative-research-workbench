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

## 1. Sessions

### POST /api/v1/sessions
```json
// Request
{ "title": "Cải thiện năng suất nghiên cứu", "domain": "research", "tags": ["triz"] }

// Response 201
{ "data": { "id": "ses_001", "title": "...", "status": "draft", "created_at": "..." } }
```

### GET /api/v1/sessions
Query params: `status`, `domain`, `q`, `limit`, `cursor`

### GET /api/v1/sessions/{session_id}
### PATCH /api/v1/sessions/{session_id}
### DELETE /api/v1/sessions/{session_id}

## 2. Problem Frames

### POST /api/v1/sessions/{session_id}/problem-frames
```json
{ "raw_problem_statement": "Làm thế nào để tăng retention của sản phẩm?" }
```

### GET /api/v1/sessions/{session_id}/problem-frames/{frame_id}
### PATCH /api/v1/sessions/{session_id}/problem-frames/{frame_id}

## 3. Workflow Stages

### POST /api/v1/sessions/{session_id}/advance
```json
{ "to_stage": "structuring" }
```

## 4. Retrieval

### POST /api/v1/search
```json
{ "query": "technical contradiction resolution", "session_id": "ses_001", "limit": 10 }
```

### Response
```json
{
  "results": [
    { "chunk_id": "...", "excerpt": "...", "source": "TRIZ_40_Principles.md", "score": 0.87 }
  ]
}
```

## 5. Methods

### GET /api/v1/sessions/{session_id}/method-suggestions
Trả về danh sách công cụ TRIZ được đề xuất dựa trên ProblemFrame hiện tại.

## 6. Candidate Solutions

### POST /api/v1/sessions/{session_id}/solutions
### GET /api/v1/sessions/{session_id}/solutions
### PATCH /api/v1/sessions/{session_id}/solutions/{solution_id}
