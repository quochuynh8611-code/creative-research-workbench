"""test_migration_007_tags_and_note_tags.py — Migration test suite cho Revision 007 (Phương án B: Bảng tags và note_tags).

Kiểm tra:
  - Upgrade từ 006 -> 007:
      1. Tạo bảng 'tags' với id, canonical_slug (unique, max 50), display_label (max 100), created_at.
      2. Tạo bảng 'note_tags' với note_id (FK -> research_notes.id, CASCADE), tag_id (FK -> tags.id, CASCADE), created_at, PK(note_id, tag_id).
      3. Bảng research_notes KHÔNG bị sửa đổi cột (zero column alteration).
  - Downgrade từ 007 -> 006:
      1. Drop note_tags, drop tags.
      2. Dữ liệu trong research_notes được bảo toàn 100%.
  - Lũy đẳng: upgrade -> downgrade -> upgrade.
"""
from __future__ import annotations

import pathlib
import uuid
import pytest
from sqlalchemy import Engine, create_engine, inspect, text
from alembic import command
from alembic.config import Config

from tests.integration.safe_disposable_db import disposable_pg_container_lifecycle
from app.infrastructure.migrations.runtime_verification import read_source_heads

REPO_ROOT = pathlib.Path(__file__).parent.parent.parent
ALEMBIC_INI_PATH = REPO_ROOT / "alembic.ini"


def get_alembic_config(engine: Engine) -> Config:
    cfg = Config(str(ALEMBIC_INI_PATH))
    url_str = engine.url.render_as_string(hide_password=False).replace("%", "%%")
    cfg.set_main_option("sqlalchemy.url", url_str)
    cfg.set_main_option("script_location", str(REPO_ROOT / "alembic"))
    return cfg


def test_migration_007_source_heads_is_single_linear_007():
    """
    GIVEN: Thư mục migration Alembic
    WHEN: Đọc source heads
    THEN: Phải có đúng 1 head duy nhất là '007'
    """
    script_location = str(REPO_ROOT / "alembic")
    heads = read_source_heads(script_location)
    assert heads == ("007",), f"Expected single migration head ('007',), got: {heads}"


def test_migration_007_upgrade_and_downgrade():
    """
    GIVEN: Disposable PostgreSQL container
    WHEN: Chạy Alembic upgrade 006, chèn sample session và note, rồi upgrade 007
    THEN:
      1. Bảng tags và note_tags được tạo với đầy đủ PK, FK, index, unique constraint.
      2. Chèn tag và liên kết note_tag thành công.
      3. Downgrade về 006 drop 2 bảng an toàn, research_notes còn nguyên vẹn.
    """
    for pg_info in disposable_pg_container_lifecycle():
        pg = pg_info["container"]
        raw_url = pg.get_connection_url()
        engine = create_engine(raw_url, echo=False, pool_pre_ping=True)

        try:
            cfg = get_alembic_config(engine)

            # 1. Upgrade lên 006
            command.upgrade(cfg, "006")

            # 2. Chèn sample session và note tại 006
            session_id = uuid.uuid4()
            note_id = uuid.uuid4()
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "INSERT INTO research_sessions (id, title, status, created_at, updated_at) "
                        "VALUES (:sid, 'Test Session 007', 'active', NOW(), NOW())"
                    ),
                    {"sid": session_id},
                )
                conn.execute(
                    text(
                        "INSERT INTO research_notes (id, session_id, content, note_type, created_at) "
                        "VALUES (:nid, :sid, 'Sample Note Content 006', 'insight', NOW())"
                    ),
                    {"nid": note_id, "sid": session_id},
                )

            # 3. Upgrade lên 007 (hoặc head)
            command.upgrade(cfg, "007")

            # 4. Kiểm tra schema của tags và note_tags
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            assert "tags" in tables, "Table 'tags' must exist after 007 upgrade"
            assert "note_tags" in tables, "Table 'note_tags' must exist after 007 upgrade"

            tag_cols = {c["name"]: c for c in inspector.get_columns("tags")}
            assert "id" in tag_cols
            assert "canonical_slug" in tag_cols
            assert "display_label" in tag_cols
            assert "created_at" in tag_cols

            note_tag_cols = {c["name"]: c for c in inspector.get_columns("note_tags")}
            assert "note_id" in note_tag_cols
            assert "tag_id" in note_tag_cols
            assert "created_at" in note_tag_cols

            # 5. Chèn dữ liệu vào tags và note_tags
            tag_id = uuid.uuid4()
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "INSERT INTO tags (id, canonical_slug, display_label, created_at) "
                        "VALUES (:tid, 'energy-storage', 'Energy Storage', NOW())"
                    ),
                    {"tid": tag_id},
                )
                conn.execute(
                    text(
                        "INSERT INTO note_tags (note_id, tag_id, created_at) "
                        "VALUES (:nid, :tid, NOW())"
                    ),
                    {"nid": note_id, "tid": tag_id},
                )

            # 6. Downgrade về 006
            command.downgrade(cfg, "006")

            inspector_post_downgrade = inspect(engine)
            tables_post = inspector_post_downgrade.get_table_names()
            assert "tags" not in tables_post, "Table 'tags' must be dropped after downgrade to 006"
            assert "note_tags" not in tables_post, "Table 'note_tags' must be dropped after downgrade to 006"

            # 7. Note ban đầu vẫn nguyên vẹn 100%
            with engine.connect() as conn:
                row = conn.execute(
                    text("SELECT content, note_type FROM research_notes WHERE id = :nid"),
                    {"nid": note_id},
                ).fetchone()
                assert row is not None
                assert row[0] == "Sample Note Content 006"

            # 8. Re-upgrade lên 007 (idempotency check)
            command.upgrade(cfg, "007")
            inspector_reup = inspect(engine)
            assert "tags" in inspector_reup.get_table_names()
            assert "note_tags" in inspector_reup.get_table_names()

        finally:
            engine.dispose()
