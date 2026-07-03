---
title: "ADR-001 — Kiến trúc cho Creative Research Workbench"
topic: "architecture"
source_type: "decision-record"
language: "vi"
tags: ["adr", "workflow-engine", "retrieval", "reasoning", "pgvector", "fastapi"]
phase: "1"
status: "canonical"
golden: true
created: "2026-07-03"
---

# ADR-001 — Kiến trúc cho Creative Research Workbench

## Bối cảnh

Hệ thống cần hỗ trợ người dùng giải quyết các bài toán sáng tạo phức tạp theo phương pháp luận TRIZ. Yêu cầu cốt lõi:
- Tìm kiếm tài liệu kết hợp full-text + semantic vector
- Hướng dẫn người dùng qua từng bước của quy trình TRIZ
- Lưu trữ trạng thái phiên làm việc (session state)

## Quyết định

Sử dụng kiến trúc **Workflow Engine + Retrieval Layer** thay vì RAG thuần túy.

### Lý do từ chối RAG thuần
- RAG thuần không kiểm soát được thứ tự bước trong quy trình TRIZ
- Không có state management cho session
- Khó enforce business rules (ví dụ: phải xác định contradiction trước khi đề xuất inventive principles)

### Kiến trúc được chọn

```
┌─────────────────────────────────────────┐
│            Frontend (Next.js 14)        │
│  Session List │ Problem Canvas │ Panel  │
└─────────────────┬───────────────────────┘
                  │ REST API
┌─────────────────▼───────────────────────┐
│           Backend (FastAPI)             │
│  WorkflowEngine → MethodRecommender     │
│  IngestionService │ RetrievalService     │
│  ProblemStructuringService              │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│        PostgreSQL 16 + pgvector         │
│  documents │ chunks │ embeddings        │
│  sessions  │ problem_frames             │
└─────────────────────────────────────────┘
```

## Hệ quả

- **Tích cực:** Kiểm soát flow TRIZ rõ ràng, dễ test từng bước, state persistent
- **Rủi ro:** Phức tạp hơn RAG đơn giản — cần WorkflowEngine đủ linh hoạt
- **Giảm thiểu:** Bắt đầu với finite state machine đơn giản, mở rộng sau

## Trạng thái

**Accepted** — 2026-07-03
