"""
runner.py — Runtime Migration Startup Runner & Verification Orchestration

Orchestrates the complete migration rollout and verification lifecycle:
  1. Resolves DATABASE_URL and Alembic configurations dynamically.
  2. Reads source heads dynamically (no hardcoded revisions).
  3. Executes preflight checks (verifies strictly single linear head).
  4. Runs Alembic migration upgrade to head.
  5. Executes schema-level postflight verification against PostgreSQL catalog.
  6. Enforces fail-closed behavior: exits non-zero if any step fails.
"""
from __future__ import annotations

import argparse
import os
import pathlib
import sys
from typing import TYPE_CHECKING

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine

from app.core.config import settings
from app.infrastructure.migrations.runtime_verification import (
    MigrationRuntimeSnapshot,
    MigrationVerificationError,
    read_database_revision,
    read_source_heads,
    verify_postflight,
    verify_preflight,
)

if TYPE_CHECKING:
    from sqlalchemy.engine import Connection


def get_database_url(database_url: str | None = None) -> str:
    """
    Resolve and normalize database URL for synchronous migration execution.

    Precedence:
      1. Explicit database_url argument
      2. os.environ["DATABASE_URL"]
      3. settings.DATABASE_URL
    """
    raw_url = (
        (database_url or "").strip()
        or os.environ.get("DATABASE_URL", "").strip()
        or (str(getattr(settings, "DATABASE_URL", "")) or "").strip()
    )

    if not raw_url:
        raise MigrationVerificationError(
            "DATABASE_URL environment variable is not set or empty."
        )

    # Normalize asyncpg dialect for sync migration engine
    if "postgresql+asyncpg://" in raw_url:
        return raw_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    if raw_url.startswith("asyncpg://"):
        return raw_url.replace("asyncpg://", "postgresql+psycopg2://")

    return raw_url


def resolve_alembic_paths(
    config_path: str | pathlib.Path | None = None,
    script_location: str | pathlib.Path | None = None,
) -> tuple[str, str]:
    """
    Discover locations of alembic.ini and the alembic script directory.
    """
    # 1. Config path resolution
    resolved_cfg: pathlib.Path | None = None
    if config_path:
        resolved_cfg = pathlib.Path(config_path).resolve()
    else:
        candidates = [
            pathlib.Path("alembic.ini"),
            pathlib.Path("/app/alembic.ini"),
            pathlib.Path(__file__).resolve().parents[4] / "alembic.ini",
        ]
        for candidate in candidates:
            if candidate.exists():
                resolved_cfg = candidate.resolve()
                break

    if not resolved_cfg or not resolved_cfg.exists():
        resolved_cfg = pathlib.Path("alembic.ini").resolve()

    # 2. Script location resolution
    resolved_script: pathlib.Path | None = None
    if script_location:
        resolved_script = pathlib.Path(script_location).resolve()
    else:
        candidates = [
            pathlib.Path("alembic"),
            pathlib.Path("/app/alembic"),
            pathlib.Path(__file__).resolve().parents[4] / "alembic",
        ]
        for candidate in candidates:
            if candidate.exists() and candidate.is_dir():
                resolved_script = candidate.resolve()
                break

    if not resolved_script or not resolved_script.exists():
        resolved_script = pathlib.Path("alembic").resolve()

    return str(resolved_cfg), str(resolved_script)


def run_migration_and_verify(
    *,
    config_path: str | pathlib.Path | None = None,
    script_location: str | pathlib.Path | None = None,
    database_url: str | None = None,
    connection: Connection | None = None,
) -> MigrationRuntimeSnapshot:
    """
    Execute end-to-end migration lifecycle with dual-check preflight and postflight guards.

    Args:
        config_path: Optional path to alembic.ini.
        script_location: Optional path to alembic script directory.
        database_url: Optional database connection URL.
        connection: Optional existing SQLAlchemy connection (for tests).

    Returns:
        MigrationRuntimeSnapshot with verified runtime state.

    Raises:
        MigrationVerificationError: If preflight or postflight fails.
        RuntimeError / Exception: If migration execution fails.
    """
    db_url = get_database_url(database_url)
    cfg_file, script_dir = resolve_alembic_paths(config_path, script_location)

    # 1. Dynamic Head Discovery
    source_heads = read_source_heads(script_dir)

    # 2. Dual-check Preflight Guard: check source heads & current DB revision
    if connection is not None:
        db_rev_before = read_database_revision(connection)
        verify_preflight(source_heads=source_heads, database_revision=db_rev_before)
    else:
        engine = create_engine(db_url, pool_pre_ping=True)
        try:
            with engine.connect() as conn:
                db_rev_before = read_database_revision(conn)
                verify_preflight(source_heads=source_heads, database_revision=db_rev_before)
        finally:
            engine.dispose()

    expected_head = source_heads[0]

    # 3. Configure and execute Alembic upgrade
    cfg = Config(cfg_file)
    cfg.set_main_option("script_location", script_dir)
    cfg.set_main_option("sqlalchemy.url", db_url.replace("%", "%%"))

    command.upgrade(cfg, "head")

    # 4. Schema-level Postflight Catalog Verification
    if connection is not None:
        snapshot = verify_postflight(connection, expected_head=expected_head)
    else:
        engine = create_engine(db_url, pool_pre_ping=True)
        try:
            with engine.connect() as conn:
                snapshot = verify_postflight(conn, expected_head=expected_head)
        finally:
            engine.dispose()

    return snapshot


def main(argv: list[str] | None = None) -> int:
    """
    CLI Entrypoint for container startup orchestration.

    Returns:
        0 on verification success; 1 on failure (with error logged to stderr).
    """
    parser = argparse.ArgumentParser(
        description="Runtime Migration Verification & Startup Runner"
    )
    parser.add_argument("--config", dest="config_path", default=None, help="Path to alembic.ini")
    parser.add_argument("--script-location", dest="script_location", default=None, help="Path to alembic directory")
    parser.add_argument("--database-url", dest="database_url", default=None, help="Database connection URL")

    args = parser.parse_args(argv)

    try:
        snapshot = run_migration_and_verify(
            config_path=args.config_path,
            script_location=args.script_location,
            database_url=args.database_url,
        )
        sys.stdout.write(
            f"==> Migration and schema verified successfully: "
            f"revision='{snapshot.database_revision}', index='{snapshot.index_name}'\n"
        )
        return 0
    except MigrationVerificationError as err:
        sys.stderr.write(f"ERROR: Runtime migration verification failed: {err}\n")
        return 1
    except Exception as err:
        sys.stderr.write(f"ERROR: Unexpected error during migration rollout: {err}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
