---
title: "FAILING INTEGRATION TEST SPEC — Creative Research Workbench MVP"
topic: "testing"
source_type: "spec"
language: "vi"
tags: ["integration-test", "failing", "tdd", "red-green", "pytest", "testcontainers"]
phase: "2"
status: "canonical"
golden: true
created: "2026-07-03"
---

# FAILING INTEGRATION TEST SPEC — MVP

> Đây là các integration test CẦN VIẾT TRƯỚC khi implement Phase 2.
> Tất cả tests bên dưới phải ở trạng thái **RED (failing)** khi chưa có implementation.
> Mục tiêu: đưa về **GREEN** sau khi implement xong Phase 2.

---

## Setup

```python
# conftest.py
import pytest
from testcontainers.postgres import PostgresContainer
from sqlalchemy import create_engine
from app.domain.models import Base

@pytest.fixture(scope="session")
def db_engine():
    with PostgresContainer("pgvector/pgvector:pg16") as pg:
        engine = create_engine(pg.get_connection_url())
        Base.metadata.create_all(engine)
        yield engine
```

---

## Test 1: Ingest golden document

```python
def test_ingest_golden_document(db_engine):
    """RED: IngestionService chưa tồn tại — sẽ ImportError"""
    from app.services.ingestion_service import IngestionService
    
    service = IngestionService(db_engine)
    result = service.ingest("docs/ADR-001-architecture.md")
    
    assert result.status == "success"
    assert result.document_id is not None
    assert result.chunks_created >= 1
    assert result.embeddings_created >= 1
```

---

## Test 2: Chặn duplicate ingest

```python
def test_duplicate_ingest_rejected(db_engine):
    """RED: chưa có content_hash dedup logic"""
    from app.services.ingestion_service import IngestionService
    
    service = IngestionService(db_engine)
    service.ingest("docs/ADR-001-architecture.md")
    result2 = service.ingest("docs/ADR-001-architecture.md")
    
    assert result2.status == "already_exists"
```

---

## Test 3: Hybrid search trả kết quả

```python
def test_hybrid_search_returns_results(db_engine):
    """RED: RetrievalService chưa tồn tại"""
    from app.services.ingestion_service import IngestionService
    from app.services.retrieval_service import RetrievalService
    
    # Ingest golden docs trước
    ingestor = IngestionService(db_engine)
    for doc in GOLDEN_DOCS:
        ingestor.ingest(doc)
    
    retriever = RetrievalService(db_engine)
    results = retriever.search("mâu thuẫn kỹ thuật", top_k=5)
    
    assert len(results) >= 1
    assert results[0].excerpt is not None
    assert results[0].source_ref is not None
    assert results[0].score > 0
```

---

## Test 4: Search latency < 200ms

```python
import time

def test_search_latency(db_engine):
    """RED: chưa có index và optimization"""
    from app.services.retrieval_service import RetrievalService
    
    retriever = RetrievalService(db_engine)
    
    start = time.perf_counter()
    retriever.search("nguyên tắc sáng tạo TRIZ", top_k=5)
    elapsed_ms = (time.perf_counter() - start) * 1000
    
    assert elapsed_ms < 200
```

---

## Chạy tests

```bash
# Chạy tất cả integration tests (expect RED khi chưa implement)
pytest backend/tests/integration/ -v --tb=short

# Sau khi implement Phase 2 — expect GREEN
pytest backend/tests/integration/ -v
```
