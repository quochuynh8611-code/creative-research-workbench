# DOMAIN SCHEMA — Creative Research Workbench

## Design Rules
- Mọi object quan trọng phải có `id`, `created_at`, `updated_at`.
- Mọi output do LLM hỗ trợ sinh ra phải có `provenance` và `review_status`.
- Các trường mang tính suy luận phải tách riêng khỏi dữ liệu gốc do người dùng nhập.

## 1. ResearchSession
```yaml
ResearchSession:
  id: uuid
  title: string
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
  completeness_score: number
  review_status: enum[pending, accepted, corrected]
```

## 3. Contradiction
```yaml
Contradiction:
  id: uuid
  type: enum[technical, physical, business, organizational]
  improve_parameter: string
  worsen_parameter: string
  statement: text
  confidence: number
  cited_source_ids: uuid[]
  review_status: enum[pending, accepted, rejected]
```

## 4. MethodSuggestion
```yaml
MethodSuggestion:
  id: uuid
  method_name: string
  rationale: text
  preconditions: string[]
  expected_output: text
  cited_sources: SourceRef[]
  review_status: enum[pending, accepted, rejected]
```

## 5. CandidateSolution
```yaml
CandidateSolution:
  id: uuid
  title: string
  mechanism: text
  linked_methods: uuid[]
  cited_sources: SourceRef[]
  novelty_score: number
  feasibility_score: number
  risk_notes: text
  review_status: enum[draft, accepted, rejected]
```

## 6. ResearchNote
```yaml
ResearchNote:
  id: uuid
  session_id: uuid
  stage: enum[intake, structuring, retrieval, ideation, evaluation, synthesis]
  type: enum[insight, assumption, question, decision, hypothesis]
  content: text
  linked_entity_id: uuid
  created_at: datetime
```
