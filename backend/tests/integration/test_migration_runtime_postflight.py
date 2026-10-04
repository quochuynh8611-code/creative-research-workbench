"""
test_migration_runtime_postflight.py — Integration tests for Runtime Migration Dual-check Preflight & Schema-level Postflight

Given/When/Then Test Contracts:
  1. test_runtime_preflight_reports_source_head_and_database_current:
     Given disposable database migrated to baseline '002',
     When reading source heads from ScriptDirectory and current revision from database,
     Then source head is ['003'] and database revision is '002' (preflight detects pending migration).

  2. test_schema_postflight_verifies_revision_and_cosine_index:
     Given disposable database upgraded to '003',
     When querying PostgreSQL catalog for version and indexes,
     Then version is '003', index 'ix_chunks_embedding_cosine' exists with 'vector_cosine_ops' and lists=10.

  3. test_schema_postflight_preserves_document_and_chunk_counts:
     Given database at baseline '002' with existing document and chunk records,
     When upgrading to revision '003',
     Then document and chunk counts remain unchanged and version becomes '003'.

  4. test_runtime_postflight_fails_on_revision_drift:
     Given expected source head '003' and mismatched database revision '002',
     When running the runtime postflight verification contract,
     Then an AssertionError is raised containing both expected and actual revision identifiers.
"""
from __future__ import annotations

import pathlib
import uuid

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, text

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
ALEMBIC_INI_PATH = REPO_ROOT / "alembic.ini"
ALEMBIC_DIR = REPO_ROOT / "alembic"


def _get_alembic_config(engine: Engine) -> Config:
    """Create Alembic Config pointing to alembic.ini with engine connection string."""
    cfg = Config(str(ALEMBIC_INI_PATH))
    url_str = engine.url.render_as_string(hide_password=False).replace("%", "%%")
    cfg.set_main_option("sqlalchemy.url", url_str)
    cfg.set_main_option("script_location", str(ALEMBIC_DIR))
    return cfg


def _get_script_directory() -> ScriptDirectory:
    """Create ScriptDirectory to read source migration heads."""
    cfg = Config(str(ALEMBIC_INI_PATH))
    cfg.set_main_option("script_location", str(ALEMBIC_DIR))
    return ScriptDirectory.from_config(cfg)


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


def _get_database_revision(engine: Engine) -> str | None:
    """Read current revision_num from database alembic_version table if exists."""
    with engine.connect() as conn:
        table_exists = conn.execute(
            text(
                "SELECT EXISTS ("
                "  SELECT 1 FROM information_schema.tables "
                "  WHERE table_name = 'alembic_version'"
                ")"
            )
        ).scalar()
        if not table_exists:
            return None
        return conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).scalar()


def assert_migration_runtime_postflight(expected_head: str, actual_revision: str | None) -> None:
    """
    Contract helper for runtime postflight verification.
    Raises AssertionError if database revision drifts from expected source head.
    """
    if actual_revision != expected_head:
        raise AssertionError(
            f"Migration drift detected: expected revision '{expected_head}', "
            f"but database is at '{actual_revision}'"
        )


@pytest.fixture(autouse=True)
def cleanup_after_test(sync_engine: Engine):
    """Ensure database is restored to clean state after each test."""
    yield
    _clean_database(sync_engine)
    from app.domain.models import Base

    Base.metadata.create_all(sync_engine)


def test_runtime_preflight_reports_source_head_and_database_current(sync_engine: Engine) -> None:
    """
    Test A: Runtime preflight dual-check reports source head and database revision.
    Given: Disposable database migrated to baseline '002'.
    When: Reading source heads from ScriptDirectory and current revision from database.
    Then: Source head is ['003'] and database revision is '002' (recognizes pending migration).
    """
    _clean_database(sync_engine)
    cfg = _get_alembic_config(sync_engine)

    # Migrate up to 002
    command.upgrade(cfg, "002")

    # 1. Source heads inspection
    script = _get_script_directory()
    source_heads = script.get_heads()
    assert source_heads == ["003"], f"Expected source head ['003'], got {source_heads}"

    # 2. Database current revision inspection
    current_rev = _get_database_revision(sync_engine)
    assert current_rev == "002", f"Expected database revision '002', got '{current_rev}'"

    # 3. Dual-check contract: Preflight identifies pending migration before upgrade
    assert source_heads[0] != current_rev, (
        "Dual-check preflight must detect difference between source head and database revision "
        "when migrations are pending."
    )


def test_schema_postflight_verifies_revision_and_cosine_index(sync_engine: Engine) -> None:
    """
    Test B: Schema-level postflight verifies revision '003' and pgvector IVFFlat cosine index.
    Given: Disposable database upgraded to head ('003').
    When: Querying PostgreSQL catalog for alembic_version and pg_indexes.
    Then: Revision is '003', index 'ix_chunks_embedding_cosine' exists with 'vector_cosine_ops' and lists=10.
    """
    _clean_database(sync_engine)
    cfg = _get_alembic_config(sync_engine)

    # Upgrade to head (003)
    command.upgrade(cfg, "head")

    current_rev = _get_database_revision(sync_engine)
    assert current_rev == "003", f"Expected revision '003' after upgrade, got '{current_rev}'"

    # Query catalog for chunks indexes
    with sync_engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT indexname, indexdef FROM pg_indexes "
                "WHERE tablename = 'chunks' AND indexname = 'ix_chunks_embedding_cosine'"
            )
        ).fetchall()

        assert len(rows) == 1, "Expected exactly 1 index named 'ix_chunks_embedding_cosine'"
        index_name, index_def = rows[0][0], rows[0][1]

        assert index_name == "ix_chunks_embedding_cosine"
        index_def_lower = index_def.lower()

        assert "ivfflat" in index_def_lower, f"Expected 'ivfflat' in indexdef, got: {index_def}"
        assert "vector_cosine_ops" in index_def_lower, (
            f"Expected 'vector_cosine_ops' in indexdef, got: {index_def}"
        )
        assert "lists" in index_def_lower and "10" in index_def_lower, (
            f"Expected lists = 10 option in indexdef, got: {index_def}"
        )


def test_schema_postflight_preserves_document_and_chunk_counts(sync_engine: Engine) -> None:
    """
    Test C: Schema-level postflight preserves document and chunk counts across migration 002 -> 003.
    Given: Database at baseline '002' with existing document and chunk records.
    When: Upgrading to revision '003'.
    Then: Record counts before and after remain identical and version is '003'.
    """
    _clean_database(sync_engine)
    cfg = _get_alembic_config(sync_engine)

    # Establish baseline 002
    command.upgrade(cfg, "002")

    doc_id = uuid.uuid4()
    chunk_id = uuid.uuid4()
    test_vector = [0.1] * 1536

    with sync_engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO documents (id, filename, filepath, title, content_hash, status, golden) "
                "VALUES (:id, 'postflight_test.md', 'docs/postflight_test.md', 'Postflight Test Doc', "
                "'postflight_hash_1', 'canonical', true)"
            ),
            {"id": doc_id},
        )
        conn.execute(
            text(
                "INSERT INTO chunks (id, document_id, content, chunk_index, token_count, embedding) "
                "VALUES (:id, :doc_id, 'Sample chunk content for postflight verification', 0, 12, :emb)"
            ),
            {"id": chunk_id, "doc_id": doc_id, "emb": str(test_vector)},
        )

    with sync_engine.connect() as conn:
        doc_count_before = conn.execute(text("SELECT count(*) FROM documents")).scalar()
        chunk_count_before = conn.execute(text("SELECT count(*) FROM chunks")).scalar()

    assert doc_count_before == 1
    assert chunk_count_before == 1

    # Upgrade from 002 to 003
    command.upgrade(cfg, "head")

    with sync_engine.connect() as conn:
        doc_count_after = conn.execute(text("SELECT count(*) FROM documents")).scalar()
        chunk_count_after = conn.execute(text("SELECT count(*) FROM chunks")).scalar()
        current_rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()

    assert doc_count_after == doc_count_before == 1, (
        f"Document count mismatch: before={doc_count_before}, after={doc_count_after}"
    )
    assert chunk_count_after == chunk_count_before == 1, (
        f"Chunk count mismatch: before={chunk_count_before}, after={chunk_count_after}"
    )
    assert current_rev == "003", f"Expected revision '003', got '{current_rev}'"


def test_runtime_postflight_fails_on_revision_drift() -> None:
    """
    Test D: Runtime postflight contract fails explicitly with descriptive message on revision drift.
    Given: Expected source head is '003' and actual database revision is '002'.
    When: Running assert_migration_runtime_postflight.
    Then: Raises AssertionError containing both expected '003' and actual '002'.
    """
    expected_head = "003"
    stale_db_revision = "002"

    with pytest.raises(AssertionError) as exc_info:
        assert_migration_runtime_postflight(
            expected_head=expected_head,
            actual_revision=stale_db_revision,
        )

    error_msg = str(exc_info.value)
    assert "003" in error_msg, f"Expected '003' in drift failure message, got: {error_msg}"
    assert "002" in error_msg, f"Expected '002' in drift failure message, got: {error_msg}"
    assert "drift" in error_msg.lower(), f"Expected 'drift' in message, got: {error_msg}"
