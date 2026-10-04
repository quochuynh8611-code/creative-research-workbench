"""
test_migration_runner.py — Unit Tests for Runtime Migration Startup Runner

Contract & Scenarios Tested:
  1. test_runner_happy_path_success:
     Given 1 valid source head and successful migration + postflight,
     When run_migration_and_verify is executed,
     Then returns MigrationRuntimeSnapshot and calls upgrade and postflight in order.

  2. test_runner_fails_on_missing_database_url:
     Given no DATABASE_URL in parameters or environment,
     When run_migration_and_verify is executed,
     Then raises MigrationVerificationError before attempting connection.

  3. test_runner_fails_on_multiple_source_heads_at_preflight:
     Given divergent source heads ('003a', '003b'),
     When run_migration_and_verify is executed,
     Then raises MigrationVerificationError at preflight and does not call command.upgrade.

  4. test_runner_fails_when_alembic_upgrade_fails:
     Given alembic upgrade raises an error,
     When run_migration_and_verify is executed,
     Then raises exception and does not call verify_postflight.

  5. test_runner_fails_when_postflight_detects_drift:
     Given postflight verification detects revision drift or missing index,
     When run_migration_and_verify is executed,
     Then raises MigrationVerificationError.

  6. test_cli_main_exits_0_on_success:
     Given successful run_migration_and_verify,
     When main() CLI entrypoint is executed,
     Then exits with returncode 0.

  7. test_cli_main_exits_1_and_writes_stderr_on_verification_error:
     Given run_migration_and_verify raises MigrationVerificationError,
     When main() CLI entrypoint is executed,
     Then exits with code 1 and writes descriptive message to stderr.
"""
from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

import pytest
from app.infrastructure.migrations.runtime_verification import (
    MigrationRuntimeSnapshot,
    MigrationVerificationError,
)
from app.infrastructure.migrations.runner import (
    get_database_url,
    main,
    run_migration_and_verify,
)


def test_get_database_url_prefers_explicit_argument() -> None:
    """Explicit argument overrides environment and settings."""
    url = get_database_url("postgresql+asyncpg://user:pass@localhost:5432/testdb")
    assert url.startswith("postgresql+psycopg2://") or url.startswith("postgresql://")
    assert "testdb" in url


def test_get_database_url_raises_when_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Raises MigrationVerificationError if DATABASE_URL is empty."""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with patch("app.infrastructure.migrations.runner.settings") as mock_settings:
        mock_settings.DATABASE_URL = ""
        with pytest.raises(MigrationVerificationError) as exc_info:
            get_database_url(None)
        assert "database_url" in str(exc_info.value).lower()


def test_runner_happy_path_success() -> None:
    """
    Given: 1 valid source head ('003') and successful migration.
    When: run_migration_and_verify is executed.
    Then: Returns valid MigrationRuntimeSnapshot.
    """
    mock_snapshot = MigrationRuntimeSnapshot(
        source_heads=("003",),
        database_revision="003",
        index_name="ix_chunks_embedding_cosine",
        index_definition="CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops)",
    )

    with (
        patch("app.infrastructure.migrations.runner.read_source_heads", return_value=("003",)) as mock_heads,
        patch("app.infrastructure.migrations.runner.read_database_revision", return_value="002") as mock_read_db,
        patch("app.infrastructure.migrations.runner.verify_preflight") as mock_preflight,
        patch("app.infrastructure.migrations.runner.command.upgrade") as mock_upgrade,
        patch("app.infrastructure.migrations.runner.create_engine") as mock_create_engine,
        patch("app.infrastructure.migrations.runner.verify_postflight", return_value=mock_snapshot) as mock_postflight,
    ):
        mock_conn = MagicMock()
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn
        mock_create_engine.return_value = mock_engine

        result = run_migration_and_verify(
            database_url="postgresql+psycopg2://postgres:postgres@localhost:5432/testdb",
            script_location="alembic",
        )

        mock_heads.assert_called_once()
        assert "alembic" in mock_heads.call_args[0][0]
        mock_read_db.assert_called_once_with(mock_conn)
        mock_preflight.assert_called_once_with(source_heads=("003",), database_revision="002")
        mock_upgrade.assert_called_once()
        mock_postflight.assert_called_once_with(mock_conn, expected_head="003")
        assert result == mock_snapshot


def test_runner_fails_on_multiple_source_heads_at_preflight() -> None:
    """
    Given: Divergent source heads ('003a', '003b').
    When: run_migration_and_verify is executed.
    Then: Raises MigrationVerificationError and never calls command.upgrade.
    """
    with (
        patch("app.infrastructure.migrations.runner.read_source_heads", return_value=("003a", "003b")),
        patch("app.infrastructure.migrations.runner.read_database_revision", return_value="002"),
        patch("app.infrastructure.migrations.runner.create_engine") as mock_create_engine,
        patch("app.infrastructure.migrations.runner.command.upgrade") as mock_upgrade,
    ):
        mock_conn = MagicMock()
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn
        mock_create_engine.return_value = mock_engine

        with pytest.raises(MigrationVerificationError) as exc_info:
            run_migration_and_verify(
                database_url="postgresql+psycopg2://postgres:postgres@localhost:5432/testdb",
                script_location="alembic",
            )

        assert "multiple" in str(exc_info.value).lower() or "divergent" in str(exc_info.value).lower()
        mock_upgrade.assert_not_called()


def test_runner_fails_when_alembic_upgrade_fails() -> None:
    """
    Given: Alembic upgrade raises an error.
    When: run_migration_and_verify is executed.
    Then: Propagates error and never executes postflight.
    """
    with (
        patch("app.infrastructure.migrations.runner.read_source_heads", return_value=("003",)),
        patch("app.infrastructure.migrations.runner.read_database_revision", return_value="002"),
        patch("app.infrastructure.migrations.runner.create_engine") as mock_create_engine,
        patch("app.infrastructure.migrations.runner.verify_preflight"),
        patch("app.infrastructure.migrations.runner.command.upgrade", side_effect=RuntimeError("DDL syntax error")),
        patch("app.infrastructure.migrations.runner.verify_postflight") as mock_postflight,
    ):
        mock_conn = MagicMock()
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn
        mock_create_engine.return_value = mock_engine

        with pytest.raises(RuntimeError, match="DDL syntax error"):
            run_migration_and_verify(
                database_url="postgresql+psycopg2://postgres:postgres@localhost:5432/testdb",
                script_location="alembic",
            )

        mock_postflight.assert_not_called()


def test_runner_fails_when_postflight_detects_drift() -> None:
    """
    Given: Postflight detects schema drift.
    When: run_migration_and_verify is executed.
    Then: Raises MigrationVerificationError.
    """
    with (
        patch("app.infrastructure.migrations.runner.read_source_heads", return_value=("003",)),
        patch("app.infrastructure.migrations.runner.read_database_revision", return_value="002"),
        patch("app.infrastructure.migrations.runner.verify_preflight"),
        patch("app.infrastructure.migrations.runner.command.upgrade"),
        patch("app.infrastructure.migrations.runner.create_engine") as mock_create_engine,
        patch(
            "app.infrastructure.migrations.runner.verify_postflight",
            side_effect=MigrationVerificationError("Migration drift detected: expected revision '003', but database is at '002'"),
        ),
    ):
        mock_conn = MagicMock()
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn
        mock_create_engine.return_value = mock_engine

        with pytest.raises(MigrationVerificationError, match="Migration drift detected"):
            run_migration_and_verify(
                database_url="postgresql+psycopg2://postgres:postgres@localhost:5432/testdb",
                script_location="alembic",
            )


def test_cli_main_returns_0_on_success(capsys: pytest.CaptureFixture[str]) -> None:
    """CLI main returns 0 on success and prints confirmation."""
    mock_snapshot = MigrationRuntimeSnapshot(
        source_heads=("003",),
        database_revision="003",
        index_name="ix_chunks_embedding_cosine",
        index_definition="...",
    )
    with patch("app.infrastructure.migrations.runner.run_migration_and_verify", return_value=mock_snapshot):
        exit_code = main(["--script-location", "alembic"])
        assert exit_code == 0
        captured = capsys.readouterr()
        assert "verified successfully" in captured.out.lower()


def test_cli_main_returns_1_and_writes_stderr_on_verification_error(capsys: pytest.CaptureFixture[str]) -> None:
    """CLI main returns 1 and logs error to stderr upon verification error."""
    with patch(
        "app.infrastructure.migrations.runner.run_migration_and_verify",
        side_effect=MigrationVerificationError("Schema drift detected"),
    ):
        exit_code = main(["--script-location", "alembic"])
        assert exit_code == 1
        captured = capsys.readouterr()
        assert "schema drift detected" in captured.err.lower()
