# DOMAIN SCHEMA — Creative Research Workbench

## Core Entities

### ResearchSession
```
id: UUID
title: string
problem_statement: string
domain: enum [technical, business, education, personal, research]
status: enum [draft, active, archived]
tags: string[]
created_at: datetime
updated_at: datetime
```

### ProblemFrame
```
id: UUID
session_id: UUID (FK)
goal: string
constraints: string[]
affected_entities: string[]
failure_signals: string[]
success_criteria: string[]
contradictions: Contradiction[]
functions: FunctionNode[]
cause_effect_chain: CauseEffectNode[]
```

### Contradiction
```
id: UUID
problem_frame_id: UUID (FK)
type: enum [technical, physical]
improving_parameter: string
worsening_parameter: string
context: string
```

### MethodSuggestion
```
id: UUID
session_id: UUID (FK)
method_name: string
rationale: string
preconditions: string[]
expected_output: string
cited_sources: SourceRef[]
ranking_score: float
```

### CandidateSolution
```
id: UUID
session_id: UUID (FK)
title: string
mechanism: string
linked_methods: string[]
cited_sources: SourceRef[]
novelty_score: float
feasibility_score: float
risk_notes: string
status: enum [candidate, accepted, rejected]
```

### KnowledgeChunk
```
id: UUID
source_file: string
section_title: string
content: string
topic: enum [contradiction, function, evolution, business, case_study, learning]
embedding: vector(1536)
tags: string[]
```

### SourceRef
```
chunk_id: UUID (FK → KnowledgeChunk)
excerpt: string
relevance_score: float
```

### ResearchNote
```
id: UUID
session_id: UUID (FK)
content: string
note_type: enum [insight, hypothesis, decision, question, action]
created_at: datetime
```
