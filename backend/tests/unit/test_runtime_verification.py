"""
test_runtime_verification.py — RED Unit-Test Contract for Runtime Migration Verification

Contract & Design Note:
  - This is a RED unit-test specification locking the interface and contracts for
    `app.infrastructure.migrations.runtime_verification` before its production implementation.
  - Tests use mock SQLAlchemy connections and file fixtures; no real database connection,
    Docker container, or network call is required.

Given/When/Then Test Contracts:
  1. test_read_source_heads_returns_expected_single_head_tuple:
     Given a valid Alembic script location,
     When reading source heads,
     Then returns a tuple containing exactly ('003',).

  2. test_read_database_revision_when_table_exists:
     Given a mock database connection where alembic_version contains '003',
     When reading database revision,
     Then returns '003'.

  3. test_read_database_revision_when_table_missing:
     Given a mock database connection where alembic_version table does not exist,
     When reading database revision,
     Then returns None.

  4. test_verify_preflight_succeeds_for_consistent_state:
     Given source_heads=('003',) and database_revision='003',
     When running verify_preflight,
     Then completes successfully without error.

  5. test_verify_preflight_raises_on_multiple_heads:
     Given divergent source_heads=('003a', '003b'),
     When running verify_preflight,
     Then raises MigrationVerificationError detailing multiple heads.

  6. test_verify_preflight_raises_on_empty_heads:
     Given empty source_heads=(),
     When running verify_preflight,
     Then raises MigrationVerificationError detailing missing head.

  7. test_verify_postflight_success_returns_valid_snapshot:
     Given a mock connection with revision '003' and valid ivfflat cosine index,
     When running verify_postflight with expected_head='003',
     Then returns a MigrationRuntimeSnapshot with matching metadata.

  8. test_verify_postflight_raises_on_revision_mismatch:
     Given a mock connection with revision '002' when '003' is expected,
     When running verify_postflight,
     Then raises MigrationVerificationError containing expected and actual revisions.

  9. test_verify_postflight_raises_on_missing_cosine_index:
     Given a mock connection with revision '003' but missing ix_chunks_embedding_cosine index,
     When running verify_postflight,
     Then raises MigrationVerificationError indicating index is missing.

  10. test_verify_postflight_raises_on_invalid_index_operator_class:
      Given an index created without vector_cosine_ops or ivfflat,
      When running verify_postflight,
      Then raises MigrationVerificationError detailing operator class mismatch.
"""
from __future__ import annotations

import pathlib
from unittest.mock import MagicMock

import pytest

# Target module contract (RED: module not yet implemented in Phase 12.1B.3a)
from app.infrastructure.migrations.runtime_verification import (
    MigrationRuntimeSnapshot,
    MigrationVerificationError,
    read_database_revision,
    read_source_heads,
    verify_postflight,
    verify_preflight,
)

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
ALEMBIC_DIR = str(REPO_ROOT / "alembic")


def test_read_source_heads_returns_expected_single_head_tuple() -> None:
    """
    Given: Thư mục script Alembic của repository backend/alembic.
    When: Gọi hàm read_source_heads(script_location).
    Then: Trả về tuple chứa đúng 1 head duy nhất là ('004',).
    """
    heads = read_source_heads(ALEMBIC_DIR)
    assert isinstance(heads, tuple)
    assert heads == ("004",)


def test_read_database_revision_when_table_exists() -> None:
    """
    Given: Mock database connection có bảng alembic_version lưu version '003'.
    When: Gọi read_database_revision(mock_conn).
    Then: Trả về chuỗi '003'.
    """
    mock_conn = MagicMock()
    # Mock EXISTS query -> True, mock SELECT version -> '003'
    mock_conn.execute.return_value.scalar.side_effect = [True, "003"]

    revision = read_database_revision(mock_conn)
    assert revision == "003"


def test_read_database_revision_when_table_missing() -> None:
    """
    Given: Mock database connection chưa có bảng alembic_version (database mới tinh).
    When: Gọi read_database_revision(mock_conn).
    Then: Trả về None.
    """
    mock_conn = MagicMock()
    # Mock EXISTS query -> False
    mock_conn.execute.return_value.scalar.return_value = False

    revision = read_database_revision(mock_conn)
    assert revision is None


def test_verify_preflight_succeeds_for_consistent_state() -> None:
    """
    Given: source_heads = ('003',) và database_revision = '003'.
    When: Gọi verify_preflight(source_heads=..., database_revision=...).
    Then: Thực thi thành công mà không ném exception.
    """
    verify_preflight(source_heads=("003",), database_revision="003")


def test_verify_preflight_raises_on_multiple_heads() -> None:
    """
    Given: source_heads có nhiều hơn 1 head (phân nhánh migration: '003a', '003b').
    When: Gọi verify_preflight.
    Then: Ném MigrationVerificationError với thông điệp rõ ràng về multiple heads.
    """
    with pytest.raises(MigrationVerificationError) as exc_info:
        verify_preflight(source_heads=("003a", "003b"), database_revision="002")

    msg = str(exc_info.value)
    assert "multiple" in msg.lower() or "divergent" in msg.lower() or "heads" in msg.lower()


def test_verify_preflight_raises_on_empty_heads() -> None:
    """
    Given: source_heads rỗng (không tìm thấy migration nào).
    When: Gọi verify_preflight.
    Then: Ném MigrationVerificationError về missing head.
    """
    with pytest.raises(MigrationVerificationError) as exc_info:
        verify_preflight(source_heads=(), database_revision="002")

    msg = str(exc_info.value)
    assert "no head" in msg.lower() or "missing" in msg.lower() or "empty" in msg.lower()


def test_verify_postflight_success_returns_valid_snapshot() -> None:
    """
    Given: Mock connection trả về revision '003' và index ix_chunks_embedding_cosine chuẩn IVFFlat.
    When: Gọi verify_postflight(mock_conn, expected_head='003').
    Then: Trả về MigrationRuntimeSnapshot hợp lệ với đầy đủ metadata.
    """
    mock_conn = MagicMock()
    # 1. read_database_revision: table_exists -> True, version -> '003'
    # 2. pg_indexes query -> [('ix_chunks_embedding_cosine', "CREATE INDEX ix_chunks_embedding_cosine ON public.chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists='10')")]
    mock_conn.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=True)),
        MagicMock(scalar=MagicMock(return_value="003")),
        MagicMock(
            fetchall=MagicMock(
                return_value=[
                    (
                        "ix_chunks_embedding_cosine",
                        "CREATE INDEX ix_chunks_embedding_cosine ON public.chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists='10')",
                    )
                ]
            )
        ),
    ]

    snapshot = verify_postflight(mock_conn, expected_head="003")

    assert isinstance(snapshot, MigrationRuntimeSnapshot)
    assert snapshot.database_revision == "003"
    assert snapshot.index_name == "ix_chunks_embedding_cosine"
    assert "ivfflat" in snapshot.index_definition.lower()
    assert "vector_cosine_ops" in snapshot.index_definition.lower()


def test_verify_postflight_raises_on_revision_mismatch() -> None:
    """
    Given: Mock connection trả về revision '002' khi mong đợi '003' (migration drift).
    When: Gọi verify_postflight(mock_conn, expected_head='003').
    Then: Ném MigrationVerificationError chứa cả expected '003' và actual '002'.
    """
    mock_conn = MagicMock()
    mock_conn.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=True)),
        MagicMock(scalar=MagicMock(return_value="002")),
    ]

    with pytest.raises(MigrationVerificationError) as exc_info:
        verify_postflight(mock_conn, expected_head="003")

    msg = str(exc_info.value)
    assert "003" in msg, f"Expected '003' in error message, got: {msg}"
    assert "002" in msg, f"Expected '002' in error message, got: {msg}"


def test_verify_postflight_raises_on_missing_cosine_index() -> None:
    """
    Given: Database ở revision '003' nhưng thiếu index ix_chunks_embedding_cosine trên bảng chunks.
    When: Gọi verify_postflight(mock_conn, expected_head='003').
    Then: Ném MigrationVerificationError chỉ rõ thiếu index.
    """
    mock_conn = MagicMock()
    mock_conn.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=True)),
        MagicMock(scalar=MagicMock(return_value="003")),
        MagicMock(fetchall=MagicMock(return_value=[])),
    ]

    with pytest.raises(MigrationVerificationError) as exc_info:
        verify_postflight(mock_conn, expected_head="003")

    msg = str(exc_info.value)
    assert "ix_chunks_embedding_cosine" in msg or "index" in msg.lower()


def test_verify_postflight_raises_on_invalid_index_operator_class() -> None:
    """
    Given: Index ix_chunks_embedding_cosine tồn tại nhưng dùng btree thay vì ivfflat vector_cosine_ops.
    When: Gọi verify_postflight(mock_conn, expected_head='003').
    Then: Ném MigrationVerificationError chỉ rõ access method hoặc operator class sai.
    """
    mock_conn = MagicMock()
    mock_conn.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=True)),
        MagicMock(scalar=MagicMock(return_value="003")),
        MagicMock(
            fetchall=MagicMock(
                return_value=[
                    (
                        "ix_chunks_embedding_cosine",
                        "CREATE INDEX ix_chunks_embedding_cosine ON public.chunks USING btree (embedding)",
                    )
                ]
            )
        ),
    ]

    with pytest.raises(MigrationVerificationError) as exc_info:
        verify_postflight(mock_conn, expected_head="003")

    msg = str(exc_info.value)
    assert "vector_cosine_ops" in msg or "ivfflat" in msg or "operator" in msg.lower()
