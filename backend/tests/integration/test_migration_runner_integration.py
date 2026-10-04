"""
test_migration_runner_integration.py — Integration tests for Runtime Migration Runner

Validates end-to-end execution of `run_migration_and_verify` against a real PostgreSQL database:
  1. test_runner_e2e_full_rollout_and_verification:
     Given clean database,
     When run_migration_and_verify is called,
     Then migrates database up to head, verifies pgvector ivfflat index, and returns valid snapshot.

  2. test_runner_e2e_idempotency_when_already_at_head:
     Given database already migrated to head,
     When run_migration_and_verify is called again,
     Then succeeds without error and confirms head revision.
"""
from __future__ import annotations

import pathlib

import pytest
from sqlalchemy import Engine, text

from app.infrastructure.migrations.runner import run_migration_and_verify
from app.infrastructure.migrations.runtime_verification import MigrationRuntimeSnapshot

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
ALEMBIC_INI_PATH = REPO_ROOT / "alembic.ini"
ALEMBIC_DIR = REPO_ROOT / "alembic"


def _clean_database(engine: Engine) -> None:
    """Clean all database tables and types for test isolation."""
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS candidate_solutions CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS research_notes CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS contradictions CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS problem_frames CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS research_sessions CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS chunks CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS documents CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))
        conn.execute(text("DROP TYPE IF EXISTS contradictiontype CASCADE"))
        conn.execute(text("DROP TYPE IF EXISTS sessionstatus CASCADE"))
        conn.execute(text("DROP TYPE IF EXISTS documentstatus CASCADE"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))


@pytest.fixture(autouse=True)
def cleanup_after_test(sync_engine: Engine):
    """Ensure database is restored to clean state after each test."""
    yield
    _clean_database(sync_engine)
    from app.domain.models import Base

    Base.metadata.create_all(sync_engine)


def test_runner_e2e_full_rollout_and_verification(sync_engine: Engine) -> None:
    """
    Given: Clean disposable database with vector extension.
    When: run_migration_and_verify is executed.
    Then: Upgrades database to source head, verifies pgvector index, and returns valid snapshot.
    """
    _clean_database(sync_engine)
    url_str = sync_engine.url.render_as_string(hide_password=False)

    snapshot = run_migration_and_verify(
        config_path=str(ALEMBIC_INI_PATH),
        script_location=str(ALEMBIC_DIR),
        database_url=url_str,
    )

    assert isinstance(snapshot, MigrationRuntimeSnapshot)
    assert snapshot.database_revision == "003"
    assert snapshot.index_name == "ix_chunks_embedding_cosine"
    assert "ivfflat" in snapshot.index_definition.lower()
    assert "vector_cosine_ops" in snapshot.index_definition.lower()

    # Query catalog directly to independently confirm
    with sync_engine.connect() as conn:
        current_rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert current_rev == "003"


def test_runner_e2e_idempotency_when_already_at_head(sync_engine: Engine) -> None:
    """
    Given: Database already at head revision '003'.
    When: run_migration_and_verify is executed again.
    Then: Succeeds idempotently without error and confirms snapshot.
    """
    _clean_database(sync_engine)
    url_str = sync_engine.url.render_as_string(hide_password=False)

    # First run
    run_migration_and_verify(
        config_path=str(ALEMBIC_INI_PATH),
        script_location=str(ALEMBIC_DIR),
        database_url=url_str,
    )

    # Second run (idempotent)
    snapshot = run_migration_and_verify(
        config_path=str(ALEMBIC_INI_PATH),
        script_location=str(ALEMBIC_DIR),
        database_url=url_str,
    )

    assert snapshot.database_revision == "003"
    assert snapshot.index_name == "ix_chunks_embedding_cosine"
