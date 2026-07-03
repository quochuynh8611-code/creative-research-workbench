# ADR-001 — Kiến trúc cho Creative Research Workbench

## Status
Proposed

## Context
Sản phẩm cần chuyển một kho tài liệu TRIZ và tư duy sáng tạo thành một công cụ hỗ trợ nghiên cứu có workflow. Bài toán không chỉ là hỏi đáp trên tài liệu, mà là hỗ trợ problem framing, method recommendation, case retrieval và reasoning persistence.

## Decision
Chọn kiến trúc module theo hướng **Workflow Engine + Retrieval Layer + Reasoning Assist Layer**.

## Architecture Layers

### 1. Knowledge Ingestion Layer
- Nguồn vào là các file markdown.
- Metadata: title, topic, source_type, language, tags.
- Chunk theo semantic section.

### 2. Retrieval Layer
- Full-text search (high recall).
- Vector search (semantic relevance).
- Hybrid ranking.
- Output: excerpt + source reference.

### 3. Problem Structuring Layer
- Input → ProblemFrame.
- Objects: contradiction, functions, cause-effect nodes, resources.
- Domain logic — không phó mặc cho LLM.

### 4. Reasoning Assist Layer
- LLM dùng để: rewrite problem statement, đề xuất câu hỏi làm rõ, gợi ý công cụ, sinh candidate solutions có citation.
- LLM không là nguồn chân lý duy nhất.

### 5. Workflow Engine
- Stages: intake → structuring → retrieval → ideation → evaluation → synthesis.
- Mỗi stage có input/output contract rõ ràng.

### 6. Persistence Layer
- Research sessions, notes, snapshots, decision log.
- MVP: PostgreSQL.
- Embeddings: pgvector.

## Why Not Pure Chatbot RAG
- RAG tốt cho hỏi đáp, yếu ở việc ép người dùng đi qua quy trình nghiên cứu có cấu trúc.
- Sản phẩm này cần workflow, không chỉ cần retrieval.

## Consequences
- Phức tạp hơn chatbot RAG ở giai đoạn đầu.
- Dễ mở rộng và kiểm thử hơn khi sản phẩm lớn lên.
- Mỗi layer có thể thay thế độc lập.
