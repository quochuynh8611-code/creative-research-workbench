# API CONTRACTS — Creative Research Workbench MVP

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
Tạo research session mới.

### GET /api/v1/sessions
Liệt kê sessions (filter: status, domain, q, limit, cursor).

### GET /api/v1/sessions/:sessionId
Lấy chi tiết session.

### PATCH /api/v1/sessions/:sessionId
Cập nhật metadata session.

## 2. Problem Intake

### POST /api/v1/sessions/:sessionId/problem-frames
Tạo version mới của problem frame.

### POST /api/v1/sessions/:sessionId/problem-frames/clarify
Nhận raw statement, trả về câu hỏi làm rõ.

### GET /api/v1/sessions/:sessionId/problem-frames/:frameId
Lấy chi tiết problem frame.

## 3. Structuring

### POST /api/v1/sessions/:sessionId/contradictions
Tạo contradiction từ problem frame.

### POST /api/v1/sessions/:sessionId/function-models
Tạo function model.

### POST /api/v1/sessions/:sessionId/cause-effect-chains
Tạo chuỗi nhân quả.

## 4. Knowledge Retrieval

### POST /api/v1/retrieve
Truy xuất đoạn tài liệu liên quan.

Request:
```json
{
  "query": "contradiction in resource allocation",
  "session_id": "ses_001",
  "top_k": 5,
  "filters": { "topic": ["contradictions", "triz-40-principles"] }
}
```

## 5. Method Recommendation

### POST /api/v1/sessions/:sessionId/method-suggestions
Đề xuất công cụ TRIZ phù hợp.

## 6. Ideation

### POST /api/v1/sessions/:sessionId/candidate-solutions
Sinh candidate solutions.

### GET /api/v1/sessions/:sessionId/candidate-solutions
Liệt kê và so sánh.

## 7. Research Notebook

### POST /api/v1/sessions/:sessionId/notes
Thêm note vào bất kỳ stage nào.

### GET /api/v1/sessions/:sessionId/notes
Lấy notes với filter theo stage và type.
