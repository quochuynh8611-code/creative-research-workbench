"""
runtime_verification.py — Runtime Migration Verification & Drift Detection

Provides dual-check preflight and schema-level postflight verification contracts:
  1. read_source_heads: Reads current migration heads from source script directory.
  2. read_database_revision: Inspects current revision from database catalog.
  3. verify_preflight: Validates single linear head in source before migration rollout.
  4. verify_postflight: Validates database revision and pgvector IVFFlat index existence in catalog.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text

if TYPE_CHECKING:
    from sqlalchemy.engine import Connection


@dataclass(frozen=True)
class MigrationRuntimeSnapshot:
    """Immutable snapshot capturing runtime migration metadata and schema verification status."""

    source_heads: tuple[str, ...]
    database_revision: str | None
    index_name: str | None
    index_definition: str | None


class MigrationVerificationError(RuntimeError):
    """Raised when runtime migration verification fails or drift is detected."""

    pass


def read_source_heads(script_location: str) -> tuple[str, ...]:
    """
    Read all current migration heads from the source Alembic script directory.

    Args:
        script_location: Path to the alembic directory containing env.py and versions.

    Returns:
        tuple of head revision strings.
    """
    cfg = Config()
    cfg.set_main_option("script_location", script_location)
    script = ScriptDirectory.from_config(cfg)
    return tuple(script.get_heads())


def read_database_revision(connection: Connection) -> str | None:
    """
    Read current revision from the alembic_version table in the target database.

    Args:
        connection: SQLAlchemy connection to the target database.

    Returns:
        Current revision_num string, or None if the table does not exist or is empty.
    """
    table_exists = connection.execute(
        text(
            "SELECT EXISTS ("
            "  SELECT 1 FROM information_schema.tables "
            "  WHERE table_name = 'alembic_version'"
            ")"
        )
    ).scalar()

    if not table_exists:
        return None

    return connection.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).scalar()


def verify_preflight(
    *,
    source_heads: tuple[str, ...],
    database_revision: str | None,
) -> None:
    """
    Verify preflight conditions before running migrations.

    Ensures that source repository has a valid, non-divergent migration lineage (exactly 1 head).

    Args:
        source_heads: Tuple of source heads from read_source_heads.
        database_revision: Current database revision from read_database_revision.

    Raises:
        MigrationVerificationError: If no heads or multiple/divergent heads exist.
    """
    if not source_heads:
        raise MigrationVerificationError(
            "No migration heads found in source directory (missing/empty heads)."
        )

    if len(source_heads) > 1:
        raise MigrationVerificationError(
            f"Multiple/divergent migration heads detected: {source_heads}. "
            "Alembic branches must be merged before rollout."
        )


def verify_postflight(
    connection: Connection,
    *,
    expected_head: str,
    table_name: str = "chunks",
    index_name: str = "ix_chunks_embedding_cosine",
) -> MigrationRuntimeSnapshot:
    """
    Verify postflight conditions after running migrations.

    Validates:
      1. Database current revision matches expected_head.
      2. Required pgvector index exists on target table.
      3. Index uses correct access method (ivfflat) and operator class (vector_cosine_ops).

    Args:
        connection: SQLAlchemy connection to the target database.
        expected_head: Expected revision_num string (e.g. '003').
        table_name: Target table name (default: 'chunks').
        index_name: Target index name (default: 'ix_chunks_embedding_cosine').

    Returns:
        MigrationRuntimeSnapshot with verified schema details.

    Raises:
        MigrationVerificationError: If revision drifts or index definition is missing/invalid.
    """
    current_revision = read_database_revision(connection)

    if current_revision != expected_head:
        raise MigrationVerificationError(
            f"Migration drift detected: expected revision '{expected_head}', "
            f"but database is at '{current_revision}'"
        )

    rows = connection.execute(
        text(
            "SELECT indexname, indexdef FROM pg_indexes "
            "WHERE tablename = :table_name AND indexname = :index_name"
        ),
        {"table_name": table_name, "index_name": index_name},
    ).fetchall()

    if not rows:
        raise MigrationVerificationError(
            f"Missing expected index '{index_name}' on table '{table_name}'."
        )

    found_index_name = str(rows[0][0])
    found_index_def = str(rows[0][1])
    index_def_lower = found_index_def.lower()

    if "ivfflat" not in index_def_lower or "vector_cosine_ops" not in index_def_lower:
        raise MigrationVerificationError(
            f"Index '{index_name}' has invalid access method or operator class: {found_index_def}. "
            "Expected 'ivfflat' access method and 'vector_cosine_ops' operator class."
        )

    return MigrationRuntimeSnapshot(
        source_heads=(expected_head,),
        database_revision=current_revision,
        index_name=found_index_name,
        index_definition=found_index_def,
    )
