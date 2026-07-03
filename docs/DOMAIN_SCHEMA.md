---
title: "DOMAIN SCHEMA — Creative Research Workbench"
topic: domain-model
source_type: schema
language: vi
tags: [entity, pydantic, yaml, uuid, problem-frame, contradiction]
golden: true
phase: 0
created_at: 2026-07-03
---

# DOMAIN SCHEMA — Creative Research Workbench

## Purpose
Đặc tả schema mức domain cho MVP để khóa chặt ngữ nghĩa dữ liệu trước khi triển khai database, API contract và integration tests.

## Design Rules
- Mọi object quan trọng phải có `id`, `created_at`, `updated_at`.
- Mọi output do LLM hỗ trợ sinh ra phải có `provenance` và `review_status`.
- Các trường mang tính suy luận phải tách riêng khỏi dữ liệu gốc do người dùng nhập.
- Các quan hệ stateful phải cho phép snapshot/versioning.

## 1. ResearchSession
```yaml
ResearchSession:
  id: uuid
  title: string
  slug: string
  domain: enum[technical, business, education, personal, research, other]
  status: enum[draft, active, under_review, synthesized, archived]
  tags: string[]
  current_problem_frame_id: uuid
  owner_id: uuid
  created_at: datetime
  updated_at: datetime
```

## 2. ProblemFrame
```yaml
ProblemFrame:
  id: uuid
  session_id: uuid
  version: int
  raw_statement: string           # Nguyên văn người dùng nhập
  rewritten_statement: string     # LLM-assisted rewrite
  goal: string
  constraints: string[]
  affected_entities: string[]
  failure_signals: string[]
  completeness_score: float       # 0.0 – 1.0
  provenance: string              # Prompt + model version
  review_status: enum[pending, accepted, rejected]
  created_at: datetime
  updated_at: datetime
```

## 3. Contradiction
```yaml
Contradiction:
  id: uuid
  problem_frame_id: uuid
  type: enum[technical, physical]
  improving_parameter: string
  worsening_parameter: string
  description: string
  suggested_principles: string[]  # TRIZ inventive principles
  provenance: string
  created_at: datetime
```

## 4. CauseEffectChain
```yaml
CauseEffectChain:
  id: uuid
  problem_frame_id: uuid
  method: enum[fishbone, five_why]
  root_causes: string[]
  chain_nodes: CauseNode[]
  provenance: string
  created_at: datetime

CauseNode:
  id: uuid
  label: string
  parent_id: uuid | null
  depth: int
```

## 5. RetrievedDocument
```yaml
RetrievedDocument:
  id: uuid
  session_id: uuid
  query: string
  source_file: string
  chunk_index: int
  excerpt: string
  score_fulltext: float
  score_vector: float
  score_hybrid: float
  retrieved_at: datetime
```

## 6. MethodSuggestion
```yaml
MethodSuggestion:
  id: uuid
  session_id: uuid
  method_name: string
  rationale: string
  citation_ids: uuid[]            # Trỏ về RetrievedDocument
  confidence: float
  provenance: string
  created_at: datetime
```

## 7. CandidateSolution
```yaml
CandidateSolution:
  id: uuid
  session_id: uuid
  title: string
  description: string
  supporting_citations: uuid[]
  evaluation_scores: EvaluationScore[]
  provenance: string
  created_at: datetime

EvaluationScore:
  axis: enum[feasibility, impact, originality, resource_cost]
  score: float  # 0.0 – 1.0
  rationale: string
```
