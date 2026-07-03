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
- Chuẩn hóa input người dùng thành ProblemFrame.
- Tạo các object: contradiction, functions, cause-effect nodes, resources.

### 4. Reasoning Assist Layer
- LLM được dùng để viết lại problem statement, đề xuất câu hỏi làm rõ, gợi ý công cụ.
- LLM không được là nguồn chân lý duy nhất.

### 5. Workflow Engine
- Điều phối tiến trình theo stage: intake → structuring → retrieval → ideation → evaluation → synthesis.
- Mỗi stage có input/output contract rõ ràng.

### 6. Persistence Layer
- Lưu research sessions, notes, snapshots, decision log.
- MVP dùng PostgreSQL + pgvector.

## Data Contracts

### ProblemFrame
```json
{
  "problem_statement": "string",
  "goal": "string",
  "constraints": ["string"],
  "affected_entities": ["string"],
  "failure_signals": ["string"],
  "success_criteria": ["string"],
  "domain": "string"
}
```

### MethodSuggestion
```json
{
  "method_name": "string",
  "rationale": "string",
  "preconditions": ["string"],
  "expected_output": "string",
  "cited_sources": ["string"]
}
```

### CandidateSolution
```json
{
  "title": "string",
  "mechanism": "string",
  "linked_methods": ["string"],
  "cited_sources": ["string"],
  "novelty_score": "float",
  "feasibility_score": "float",
  "risk_notes": "string"
}
```

## Why Not Pure Chatbot RAG
- Chatbot RAG tốt cho hỏi đáp nhưng yếu ở việc ép người dùng đi qua quy trình nghiên cứu.
- Khó duy trì domain state như contradiction map, function map, rejected ideas.

## Chosen Trade-off
- Dùng rule/schema để khóa cấu trúc dữ liệu quan trọng.
- Dùng retrieval để cung cấp bằng chứng.
- Dùng LLM như reasoning assistant trong phạm vi được ràng buộc.

## Next Decisions Needed
- Chọn stack frontend.
- Chọn DB và vector store.
- Quyết định local-first hay web-first cho bản đầu.
