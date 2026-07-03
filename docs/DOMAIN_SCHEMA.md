# DOMAIN SCHEMA — Creative Research Workbench

## Purpose
Tài liệu này đặc tả schema mức domain cho MVP để khóa chặt ngữ nghĩa dữ liệu trước khi triển khai database, API contract và integration tests.

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
  research_session_id: uuid
  version: integer
  raw_problem_statement: text
  normalized_problem_statement: text
  goal: text
  constraints: Constraint[]
  affected_entities: EntityRef[]
  failure_signals: string[]
  success_criteria: string[]
  assumptions: string[]
  available_resources: Resource[]
  domain: enum[...]
  completeness_score: number
  missing_fields: string[]
  provenance:
    source: enum[user_input, system_inference, analyst_edit]
    source_refs: string[]
  review_status: enum[pending, accepted, corrected]
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
  context_description: text
  suggested_principles: TRIZPrinciple[]
  provenance: Provenance
  review_status: ReviewStatus
```

## 4. CandidateSolution
```yaml
CandidateSolution:
  id: uuid
  research_session_id: uuid
  title: string
  mechanism: text
  inspired_by: string[]
  source_citations: Citation[]
  assumptions: string[]
  risks: string[]
  evaluation_scores: EvaluationScore[]
  status: enum[draft, under_review, accepted, rejected]
  provenance: Provenance
```
