# ADR-001 — Kiến trúc cho Creative Research Workbench

## Status
Proposed

## Context
Sản phẩm cần chuyển một kho tài liệu TRIZ và tư duy sáng tạo thành một công cụ hỗ trợ nghiên cứu có workflow. Bài toán không chỉ là hỏi đáp trên tài liệu, mà là hỗ trợ problem framing, method recommendation, case retrieval và reasoning persistence.

## Decision
Chọn kiến trúc module theo hướng **Workflow Engine + Retrieval Layer + Reasoning Assist Layer**, thay vì chỉ xây một chatbot RAG đơn thuần.

## Architecture Overview

### 1. Knowledge Ingestion Layer
- Nguồn vào là các file markdown.
- Mỗi file được chuẩn hóa metadata: title, topic, source_type, language, tags.
- Chunk theo semantic section thay vì chunk theo số ký tự thuần túy.

### 2. Retrieval Layer
- Full-text search để recall cao.
- Vector search để tăng semantic relevance.
- Hybrid ranking để cân bằng precision và recall.
- Kết quả retrieval phải trả về excerpt + source reference.

### 3. Problem Structuring Layer
- Chuẩn hóa input người dùng thành ProblemFrame.
- Tạo các object: contradiction, functions, cause-effect nodes, resources.
- Đây là lớp domain logic quan trọng nhất.

### 4. Reasoning Assist Layer
- LLM được dùng để: viết lại problem statement, đề xuất câu hỏi làm rõ, gợi ý công cụ, sinh candidate solutions có citation.
- LLM không được là nguồn chân lý duy nhất.

### 5. Workflow Engine
- Điều phối tiến trình theo stage: intake → structuring → retrieval → ideation → evaluation → synthesis.
- Mỗi stage có input/output contract rõ ràng.

### 6. Persistence Layer
- Lưu research sessions, notes, snapshots, decision log.
- MVP dùng PostgreSQL + pgvector.

## Why Not Pure Chatbot RAG
- Chatbot RAG yếu ở việc ép người dùng đi qua quy trình nghiên cứu.
- Chatbot khó duy trì domain state như contradiction map, function map, rejected ideas.

## Chosen Trade-off
- Dùng rule/schema để khóa cấu trúc dữ liệu quan trọng.
- Dùng retrieval để cung cấp bằng chứng.
- Dùng LLM như reasoning assistant trong phạm vi được ràng buộc.

## Tech Stack Decision
- **Backend**: Python 3.12 + FastAPI
- **Database**: PostgreSQL 16 + pgvector
- **LLM**: OpenAI API hoặc Ollama (local)
- **Frontend**: React + Vite + TailwindCSS
- **Infra**: Docker Compose

## Consequences
### Positive
- Có cấu trúc rõ ràng cho mở rộng lâu dài.
- Kiểm chứng được qua citation và workflow stage.
- Dễ viết integration tests theo từng stage.

### Negative
- Phức tạp hơn chatbot MVP thông thường.
- Cần thiết kế domain model kỹ để tránh overengineering.
