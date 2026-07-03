---
title: "DOMAIN SCHEMA — Creative Research Workbench"
topic: "domain-model"
source_type: "schema"
language: "vi"
tags: ["entity", "pydantic", "yaml", "uuid", "sqlalchemy", "pgvector"]
phase: "1"
status: "canonical"
golden: true
created: "2026-07-03"
---

# DOMAIN SCHEMA — Creative Research Workbench

> Đây là nguồn chân lý (source of truth) cho tất cả entity trong hệ thống.
> Mọi SQLAlchemy model, Pydantic schema, và API response phải tuân thủ định nghĩa này.

---

## Core Entities

### ResearchSession
```yaml
ResearchSession:
  id: UUID (PK)
  title: str
  description: str | null
  status: enum [active, paused, completed, archived]
  workflow_state: str  # FSM state
  created_at: datetime
  updated_at: datetime
```

### ProblemFrame
```yaml
ProblemFrame:
  id: UUID (PK)
  session_id: UUID (FK → ResearchSession)
  raw_statement: str
  normalized_statement: str | null
  domain: str | null
  contradiction_type: enum [technical, physical, none, unknown]
  improving_parameter: str | null
  worsening_parameter: str | null
  created_at: datetime
```

### Contradiction
```yaml
Contradiction:
  id: UUID (PK)
  problem_frame_id: UUID (FK → ProblemFrame)
  type: enum [technical, physical]
  statement: str
  suggested_principles: list[int]  # TRIZ principle numbers
  created_at: datetime
```

### Document
```yaml
Document:
  id: UUID (PK)
  filename: str
  filepath: str
  title: str
  topic: str
  source_type: str
  language: str
  tags: list[str]
  phase: str
  status: enum [canonical, draft, deprecated]
  golden: bool
  content_hash: str  # SHA256 for dedup
  created_at: datetime
  updated_at: datetime
```

### Chunk
```yaml
Chunk:
  id: UUID (PK)
  document_id: UUID (FK → Document)
  content: str
  chunk_index: int
  token_count: int
  embedding: vector(1536)  # pgvector
  created_at: datetime
```

---

## Relationships

```
ResearchSession 1──* ProblemFrame
ProblemFrame    1──* Contradiction
Document        1──* Chunk
```

---

## Constraints

- `ResearchSession.status` DEFAULT `active`
- `Chunk.embedding` INDEX `ivfflat` với `lists=100`
- `Document.content_hash` UNIQUE (chống duplicate ingest)
- `ProblemFrame.session_id` ON DELETE CASCADE
