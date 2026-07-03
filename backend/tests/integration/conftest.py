"""
conftest.py — Phase 2 Integration Test Fixtures

Sử dụng testcontainers để spin up PostgreSQL 16 + pgvector thực trong môi trường test.
Không cần docker-compose — testcontainers tự quản lý container lifecycle.

REQUIRES (trong môi trường chạy test):
  - Docker daemon đang chạy
  - pip install 'testcontainers[postgres]'
"""
from __future__ import annotations

import os
import pathlib
from typing import Generator

import pytest
from sqlalchemy import Engine, create_engine, text

# Path gốc của repo để resolve đường dẫn golden docs
REPO_ROOT = pathlib.Path(__file__).parent.parent.parent.parent
DOCS_DIR = REPO_ROOT / "docs"

# 10 Golden Documents — nguồn chân lý benchmark retrieval
GOLDEN_DOCS: list[str] = [
    str(DOCS_DIR / "ADR-001-architecture.md"),
    str(DOCS_DIR / "API_CONTRACTS.md"),
    str(DOCS_DIR / "DOMAIN_SCHEMA.md"),
    str(DOCS_DIR / "PRODUCT_SPEC.md"),
    str(DOCS_DIR / "IMPLEMENTATION_ROADMAP.md"),
    str(DOCS_DIR / "UI_MODULE_BREAKDOWN.md"),
    str(DOCS_DIR / "TEST_PLAN.md"),
    str(DOCS_DIR / "GHERKIN_SCENARIOS.md"),
    str(DOCS_DIR / "FAILING_INTEGRATION_TEST_SPEC.md"),
    str(DOCS_DIR / "definition-of-done.md"),
]

# Benchmark queries tương ứng với mỗi Golden Doc (từ knowledge-inventory.md)
GOLDEN_QUERIES: list[str] = [
    "Tại sao chọn workflow engine thay vì RAG thuần?",
    "API endpoint nào dùng để tạo session mới?",
    "ProblemFrame có những trường nào?",
    "Phần mềm giải quyết bài toán gì cho người dùng?",
    "Phase 2 bao gồm những task gì?",
    "Screen Workspace Canvas có những component gì?",
    "Acceptance gate cho Phase 2 là gì?",
    "Scenario nào test việc tạo ProblemFrame?",
    "Integration test nào cần viết đầu tiên?",
    "Definition of Done cho một feature backend là gì?",
]


@pytest.fixture(scope="session")
def db_engine() -> Generator[Engine, None, None]:
    """
    Spin up PostgreSQL 16 + pgvector trong Docker container thực.
    Schema được tạo từ SQLAlchemy models (sẽ import khi Phase 2 implement xong).
    
    RED STATE: fixture này sẽ fail tại `from app.domain.models import Base`
    cho đến khi models.py được implement.
    """
    try:
        from testcontainers.postgres import PostgresContainer
    except ImportError as e:
        pytest.skip(f"testcontainers không được cài: {e}")

    # Import models — sẽ ImportError khi chưa implement (RED)
    from app.domain.models import Base  # type: ignore[import]

    with PostgresContainer("pgvector/pgvector:pg16") as pg:
        engine = create_engine(pg.get_connection_url())

        # Enable pgvector extension
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()

        # Tạo toàn bộ tables từ SQLAlchemy models
        Base.metadata.create_all(engine)

        yield engine

        # Teardown: drop all (container sẽ bị xóa cùng)
        Base.metadata.drop_all(engine)
