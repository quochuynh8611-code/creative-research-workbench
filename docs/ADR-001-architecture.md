---
title: "ADR-001 — Kiến trúc cho Creative Research Workbench"
topic: architecture
source_type: decision-record
language: vi
tags: [adr, workflow-engine, retrieval, reasoning, mvp]
golden: true
phase: 0
created_at: 2026-07-03
---

# ADR-001 — Kiến trúc cho Creative Research Workbench

## Status
Proposed

## Context
Sản phẩm cần chuyển một kho tài liệu TRIZ và tư duy sáng tạo thành một công cụ hỗ trợ nghiên cứu có workflow. Bài toán không chỉ là hỏi đáp trên tài liệu, mà là hỗ trợ problem framing, method recommendation, case retrieval và reasoning persistence.

## Decision Drivers
- Cần citation rõ ràng từ tài liệu nguồn.
- Cần hỗ trợ workflow nghiên cứu theo bước.
- Cần blast radius thấp ở giai đoạn MVP.
- Cần dễ thay thế từng thành phần nếu chất lượng chưa đạt.
- Cần phù hợp với dữ liệu markdown hiện có.

## Decision
Chọn kiến trúc module theo hướng **Workflow Engine + Retrieval Layer + Reasoning Assist Layer**, thay vì chỉ xây một chatbot RAG đơn thuần.

## Architecture Overview

### 1. Knowledge Ingestion Layer
- Nguồn vào là các file markdown trong thư mục hiện tại.
- Mỗi file được chuẩn hóa metadata: title, topic, source_type, language, tags.
- Chunk theo semantic section thay vì chunk theo số ký tự thuần túy.

### 2. Retrieval Layer
- Full-text search để recall cao.
- Vector search để tăng semantic relevance.
- Hybrid ranking để cân bằng precision và recall.
- Kết quả retrieval phải trả về excerpt + source reference.

### 3. Problem Structuring Layer
- Nhận raw problem statement từ người dùng.
- Rewrite, normalize và extract ProblemFrame có cấu trúc.
- Identify contradiction (technical/physical), cause-effect chain, function model.

### 4. Workflow Engine
- State machine điều phối các stage: intake → structuring → retrieval → ideation → evaluation → synthesis.
- Mỗi stage có input schema, output schema và transition condition rõ ràng.
- Trạng thái workflow được persist trong database.

### 5. Reasoning Assist Layer
- LLM được gọi theo từng stage, không gọi tự do.
- Prompt được template hóa, có version control.
- Output LLM phải có provenance và review_status.

### 6. API Layer
- JSON-over-HTTP, versioned (`/api/v1`).
- Mọi response có error envelope chuẩn.
- Frontend workspace giao tiếp hoàn toàn qua API.

## Consequences
- **Tốt**: Mỗi layer có thể test và thay thế độc lập.
- **Tốt**: Citation rõ ràng vì retrieval tách biệt với reasoning.
- **Chấp nhận được**: Phức tạp hơn RAG thuần — nhưng đây là tradeoff có chủ ý.
- **Rủi ro**: Workflow engine cần thiết kế state machine cẩn thận.

## Alternatives Considered
1. **Pure RAG chatbot** — Đơn giản hơn nhưng không hỗ trợ workflow có cấu trúc.
2. **LangGraph agent** — Powerful nhưng khó debug và blast radius cao.
3. **Notion-like document editor** — Không phải công cụ nghiên cứu có reasoning.
