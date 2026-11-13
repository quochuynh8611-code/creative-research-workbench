"""
test_migration_006_research_notes_source_context.py — Migration test suite cho Revision 006 (Add source_context to research_notes).

Kiểm tra:
  - Upgrade từ 005 -> 006: thêm cột source_context (JSONB, nullable=True) vào bảng research_notes.
  - Hàng dữ liệu hiện có có source_context = NULL (không backfill, không DB default).
  - Downgrade từ 006 -> 005: drop cột source_context an toàn, dữ liệu trong cột mới bị mất (hành vi dự kiến),
    nhưng toàn bộ dữ liệu cột cũ (content, note_type) được bảo toàn 100%.
  - Vòng upgrade -> downgrade -> upgrade đảm bảo tính lũy đẳng (idempotency).
  - Migration runner thật (run_migration_and_verify) và verify_postflight chấp nhận head 006 trên disposable DB.
"""
from __future__ import annotations

import pathlib
from typing import Any
import pytest
from sqlalchemy import Engine, create_engine, inspect, text
from alembic import command
from alembic.config import Config

from tests.integration.safe_disposable_db import disposable_pg_container_lifecycle
from app.infrastructure.migrations.runtime_verification import (
    read_source_heads,
    read_database_revision,
    verify_postflight,
)
from app.infrastructure.migrations.runner import run_migration_and_verify

REPO_ROOT = pathlib.Path(__file__).parent.parent.parent
ALEMBIC_INI_PATH = REPO_ROOT / "alembic.ini"


def get_alembic_config(engine: Engine) -> Config:
    """Tạo Alembic Config trỏ đúng alembic.ini và inject URL kết nối disposable container."""
    cfg = Config(str(ALEMBIC_INI_PATH))
    url_str = engine.url.render_as_string(hide_password=False).replace("%", "%%")
    cfg.set_main_option("sqlalchemy.url", url_str)
    cfg.set_main_option("script_location", str(REPO_ROOT / "alembic"))
    return cfg


def test_migration_006_source_heads_is_single_linear_006():
    """
    GIVEN: Thư mục migration Alembic
    WHEN: Đọc source heads
    THEN: Phải có đúng 1 head duy nhất là '006' (RED phase hiện tại đang là '005').
    """
    script_location = str(REPO_ROOT / "alembic")
    heads = read_source_heads(script_location)
    assert heads == ("006",), f"Expected single migration head ('006',), got: {heads}"


def test_migration_006_upgrade_and_downgrade():
    """
    GIVEN: Disposable PostgreSQL container được khởi tạo an toàn
    WHEN: Chạy Alembic upgrade lên 005, chèn ghi chú mẫu, rồi upgrade lên 006
    THEN:
      1. Cột research_notes.source_context được thêm dạng JSONB nullable=True,
         ghi chú cũ có source_context=NULL.
      2. Chèn ghi chú mới có source_context tại 006.
      3. Downgrade về 005: xóa cột source_context, bảo toàn content cũ,
         nhưng dữ liệu trong cột source_context bị mất hoàn toàn (hành vi thiết kế dự kiến).
      4. Re-upgrade lên 006: cột source_context được tạo lại thành công (idempotency).
    """
    for pg_info in disposable_pg_container_lifecycle():
        pg = pg_info["container"]
        raw_url = pg.get_connection_url()

        engine = create_engine(raw_url, echo=False, pool_pre_ping=True)
        try:
            cfg = get_alembic_config(engine)

            # 1. Upgrade lên 005
            command.upgrade(cfg, "005")

            with engine.connect() as conn:
                rev_005 = read_database_revision(conn)
                assert rev_005 == "005"

                # Chèn session và note mẫu tại revision 005
                session_id = "11111111-1111-1111-1111-111111111111"
                note_id = "22222222-2222-2222-2222-222222222222"
                conn.execute(
                    text(
                        "INSERT INTO research_sessions (id, title, status, workflow_state, domain) "
                        "VALUES (:id, 'Test 005 Session', 'active', 'intake', 'engineering')"
                    ),
                    {"id": session_id},
                )
                conn.execute(
                    text(
                        "INSERT INTO research_notes (id, session_id, content, note_type) "
                        "VALUES (:id, :session_id, 'Note at rev 005', 'insight')"
                    ),
                    {"id": note_id, "session_id": session_id},
                )
                conn.commit()

            # 2. Upgrade lên 006
            command.upgrade(cfg, "006")

            with engine.connect() as conn:
                rev_006 = read_database_revision(conn)
                assert rev_006 == "006"

                # Kiểm tra schema catalog của cột source_context
                inspector = inspect(conn)
                columns = {col["name"]: col for col in inspector.get_columns("research_notes")}
                assert "source_context" in columns, "Column 'source_context' must exist in research_notes"
                sc_col = columns["source_context"]
                assert sc_col["nullable"] is True, "Column 'source_context' must be nullable"
                type_str = str(sc_col["type"]).upper()
                assert "JSON" in type_str, f"Column 'source_context' must be JSON or JSONB, got: {type_str}"

                # Kiểm tra hàng dữ liệu cũ: source_context phải là NULL
                row = conn.execute(
                    text("SELECT source_context FROM research_notes WHERE id = :id"),
                    {"id": note_id},
                ).fetchone()
                assert row is not None
                assert row[0] is None, "Existing notes must have NULL source_context"

                # Chèn ghi chú mới có source_context JSONB
                new_note_id = "33333333-3333-3333-3333-333333333333"
                conn.execute(
                    text(
                        "INSERT INTO research_notes (id, session_id, content, note_type, source_context) "
                        "VALUES (:id, :session_id, 'Note at rev 006', 'insight', '{\"source_type\": \"evidence\"}'::jsonb)"
                    ),
                    {"id": new_note_id, "session_id": session_id},
                )
                conn.commit()

            # 3. Downgrade về 005
            command.downgrade(cfg, "005")

            with engine.connect() as conn:
                rev_after_down = read_database_revision(conn)
                assert rev_after_down == "005"

                inspector = inspect(conn)
                cols_down = {col["name"]: col for col in inspector.get_columns("research_notes")}
                assert "source_context" not in cols_down, "Column 'source_context' must be dropped on downgrade"

                # Bảo toàn nội dung ghi chú cũ
                old_row = conn.execute(
                    text("SELECT content FROM research_notes WHERE id = :id"),
                    {"id": note_id},
                ).fetchone()
                assert old_row is not None
                assert old_row[0] == "Note at rev 005"

            # 4. Re-upgrade lên 006 (Idempotency & Data Loss Verification)
            command.upgrade(cfg, "006")
            with engine.connect() as conn:
                rev_reup = read_database_revision(conn)
                assert rev_reup == "006"
                inspector = inspect(conn)
                cols_reup = {col["name"]: col for col in inspector.get_columns("research_notes")}
                assert "source_context" in cols_reup

                # XÁC NHẬN RỦI RO THIẾT KẾ: Dữ liệu source_context trong new_note_id đã bị mất khi downgrade,
                # sau khi upgrade lại sẽ là NULL (hành vi dự kiến đã ghi trong ADR-014)
                reup_row = conn.execute(
                    text("SELECT source_context FROM research_notes WHERE id = :id"),
                    {"id": new_note_id},
                ).fetchone()
                assert reup_row is not None
                assert reup_row[0] is None, "Data in dropped column is lost after downgrade/re-upgrade"

        finally:
            engine.dispose()


def test_migration_runner_and_postflight_accepts_head_006():
    """
    GIVEN: Disposable PostgreSQL container được khởi tạo an toàn
    WHEN: Gọi trực tiếp migration runner thật (run_migration_and_verify) không mock
    THEN: Runner nâng cấp DB lên 006, verify_postflight chấp nhận head 006 mà không báo lỗi drift.
    """
    for pg_info in disposable_pg_container_lifecycle():
        pg = pg_info["container"]
        raw_url = pg.get_connection_url()

        # Chạy runner thật
        snapshot = run_migration_and_verify(
            config_path=str(ALEMBIC_INI_PATH),
            script_location=str(REPO_ROOT / "alembic"),
            database_url=raw_url,
        )

        assert snapshot.database_revision == "006"
        assert snapshot.source_heads == ("006",)
        assert snapshot.index_name == "ix_chunks_embedding_cosine"
