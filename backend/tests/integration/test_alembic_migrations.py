"""
test_alembic_migrations.py — Integration test suite cho Two-Stage Alembic Migrations

Kiểm tra theo tiêu chuẩn Given/When/Then:
  1. test_two_stage_alembic_migrations: Chu trình DDL 001 -> 002 -> 001 -> base.
  2. test_alembic_version_tracked_accurately: alembic_version ghi nhận đúng '001' và '002'.
  3. test_data_level_cascade_and_set_null_integrity: Cascade delete session và SET NULL khi xóa chunk.
  4. test_migration_idempotency_rerun: Chạy lại migration ở cùng revision an toàn.
  5. test_env_py_url_override_precedence: alembic/env.py ưu tiên DATABASE_URL môi trường/settings.
  6. test_disposable_test_database_guard: Kiểm tra an toàn engine test là disposable database.
"""
from __future__ import annotations

import os
import pathlib
import uuid
import pytest
from sqlalchemy import Engine, inspect, text
from sqlalchemy.orm import Session
from alembic import command
from alembic.config import Config


REPO_ROOT = pathlib.Path(__file__).parent.parent.parent
ALEMBIC_INI_PATH = REPO_ROOT / "alembic.ini"


def get_alembic_config(engine: Engine) -> Config:
    """Tạo Alembic Config trỏ đúng alembic.ini và inject URL đầy đủ (kèm password)."""
    cfg = Config(str(ALEMBIC_INI_PATH))
    url_str = engine.url.render_as_string(hide_password=False).replace("%", "%%")
    cfg.set_main_option("sqlalchemy.url", url_str)
    cfg.set_main_option("script_location", str(REPO_ROOT / "alembic"))
    return cfg


def _clean_database(engine: Engine) -> None:
    """Hạ toàn bộ bảng và kiểu dữ liệu phục vụ test cô lập."""
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
def cleanup_after_migration_test(sync_engine: Engine):
    """Đảm bảo dọn dẹp bảng migration sau mỗi test để không ảnh hưởng test suite khác."""
    yield
    _clean_database(sync_engine)


def test_disposable_test_database_guard(sync_engine: Engine):
    """
    Given: sync_engine được cấp cho test runner.
    When: Kiểm tra chuỗi kết nối database.
    Then: Phải đảm bảo không trỏ vào database production tĩnh mà là disposable test container.
    """
    url_str = str(sync_engine.url)
    assert not ("localhost:5432/crw_prod" in url_str or "prod" in url_str.lower()), (
        f"Nguy cơ thao tác trên production database: {url_str}"
    )


def test_two_stage_alembic_migrations(sync_engine: Engine):
    """
    Given: Database trống có extension vector.
    When: Chạy lần lượt upgrade 001 -> head -> downgrade 001 -> downgrade base.
    Then: Schema DDL tại mỗi giai đoạn phải khớp 100% với đặc tả 5 bảng baseline và 2 bảng mới.
    """
    assert ALEMBIC_INI_PATH.exists(), f"alembic.ini không tồn tại tại {ALEMBIC_INI_PATH}"
    _clean_database(sync_engine)

    cfg = get_alembic_config(sync_engine)

    # 1. UPGRADE ĐẾN 001 (Baseline)
    command.upgrade(cfg, "001")

    inspector = inspect(sync_engine)
    tables_after_001 = set(inspector.get_table_names())
    expected_baseline_tables = {
        "documents",
        "chunks",
        "research_sessions",
        "problem_frames",
        "contradictions",
        "alembic_version",
    }
    assert expected_baseline_tables.issubset(tables_after_001), (
        f"001 baseline thiếu bảng: {expected_baseline_tables - tables_after_001}"
    )
    assert "research_notes" not in tables_after_001, "research_notes không được xuất hiện ở 001"
    assert "candidate_solutions" not in tables_after_001, "candidate_solutions không được xuất hiện ở 001"

    # 2. UPGRADE ĐẾN HEAD (Bao gồm 002)
    command.upgrade(cfg, "head")

    inspector = inspect(sync_engine)
    tables_after_head = set(inspector.get_table_names())
    expected_feature_tables = expected_baseline_tables.union({"research_notes", "candidate_solutions"})
    assert expected_feature_tables.issubset(tables_after_head), (
        f"upgrade head thiếu bảng: {expected_feature_tables - tables_after_head}"
    )

    notes_columns = {c["name"] for c in inspector.get_columns("research_notes")}
    assert {"id", "session_id", "content", "note_type", "created_at", "updated_at"}.issubset(notes_columns)

    fks = inspector.get_foreign_keys("research_notes")
    assert any(fk["referred_table"] == "research_sessions" for fk in fks), "Thiếu FK tới research_sessions"

    # 3. DOWNGRADE VỀ 001 (Rollback 002)
    command.downgrade(cfg, "001")

    inspector = inspect(sync_engine)
    tables_after_downgrade_001 = set(inspector.get_table_names())
    assert "research_notes" not in tables_after_downgrade_001, "research_notes phải bị gỡ khi rollback về 001"
    assert "candidate_solutions" not in tables_after_downgrade_001, "candidate_solutions phải bị gỡ khi rollback về 001"
    assert expected_baseline_tables.issubset(tables_after_downgrade_001), "5 bảng baseline phải còn nguyên vẹn"

    # 4. DOWNGRADE VỀ BASE (Rollback 001)
    command.downgrade(cfg, "base")

    inspector = inspect(sync_engine)
    tables_after_base = set(inspector.get_table_names()) - {"spatial_ref_sys"}
    assert len(tables_after_base) == 0 or tables_after_base == {"alembic_version"}, (
        f"Sau downgrade base vẫn còn bảng: {tables_after_base}"
    )


def test_alembic_version_tracked_accurately(sync_engine: Engine):
    """
    Given: Database trống.
    When: Nâng cấp lên từng revision cụ thể ('001' và 'head').
    Then: Bảng alembic_version phải lưu chính xác revision ID tương ứng.
    """
    _clean_database(sync_engine)
    cfg = get_alembic_config(sync_engine)

    command.upgrade(cfg, "001")
    with sync_engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert rev == "001", f"Expected revision 001, got {rev}"

    command.upgrade(cfg, "head")
    with sync_engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert rev == "002", f"Expected revision 002, got {rev}"


def test_data_level_cascade_and_set_null_integrity(sync_engine: Engine):
    """
    Given: Database ở revision head với đầy đủ dữ liệu mẫu (Session, Document, Chunk, Note, Solution).
    When: Xóa Chunk nguồn hoặc xóa Session chủ thể.
    Then:
      - Xóa Chunk -> ResearchNote vẫn tồn tại và source_chunk_id được chuyển thành NULL (SET NULL).
      - Xóa Session -> ProblemFrame, Contradiction, ResearchNotes, CandidateSolutions bị xóa CASCADE.
    """
    _clean_database(sync_engine)
    cfg = get_alembic_config(sync_engine)
    command.upgrade(cfg, "head")

    session_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    chunk_id = uuid.uuid4()
    frame_id = uuid.uuid4()
    contradiction_id = uuid.uuid4()
    note_id = uuid.uuid4()
    solution_id = uuid.uuid4()

    with sync_engine.begin() as conn:
        # Tạo Session
        conn.execute(
            text("INSERT INTO research_sessions (id, title, status) VALUES (:id, :title, 'active')"),
            {"id": session_id, "title": "Test Session"},
        )
        # Tạo Document & Chunk
        conn.execute(
            text("INSERT INTO documents (id, filename, filepath, content_hash) VALUES (:id, 'doc.md', '/path/doc.md', 'hash123')"),
            {"id": doc_id},
        )
        conn.execute(
            text("INSERT INTO chunks (id, document_id, content, chunk_index) VALUES (:id, :doc_id, 'Chunk text', 0)"),
            {"id": chunk_id, "doc_id": doc_id},
        )
        # Tạo ProblemFrame & Contradiction
        conn.execute(
            text("INSERT INTO problem_frames (id, session_id, raw_statement) VALUES (:id, :sess_id, 'Problem')"),
            {"id": frame_id, "sess_id": session_id},
        )
        conn.execute(
            text("INSERT INTO contradictions (id, problem_frame_id, type, statement) VALUES (:id, :frame_id, 'technical', 'Contradiction')"),
            {"id": contradiction_id, "frame_id": frame_id},
        )
        # Tạo ResearchNote liên kết với Chunk và Session
        conn.execute(
            text("INSERT INTO research_notes (id, session_id, content, source_chunk_id) VALUES (:id, :sess_id, 'Note', :chunk_id)"),
            {"id": note_id, "sess_id": session_id, "chunk_id": chunk_id},
        )
        # Tạo CandidateSolution liên kết với Session
        conn.execute(
            text("INSERT INTO candidate_solutions (id, session_id, title, mechanism) VALUES (:id, :sess_id, 'Solution', 'Mechanism')"),
            {"id": solution_id, "sess_id": session_id},
        )

    # Thao tác 1: Xóa Chunk -> Kiểm tra SET NULL ở research_notes
    with sync_engine.begin() as conn:
        conn.execute(text("DELETE FROM chunks WHERE id = :id"), {"id": chunk_id})

    with sync_engine.connect() as conn:
        note = conn.execute(text("SELECT id, source_chunk_id FROM research_notes WHERE id = :id"), {"id": note_id}).fetchone()
        assert note is not None, "ResearchNote không được bị xóa khi chunk bị xóa"
        assert note[1] is None, f"source_chunk_id phải được chuyển thành NULL, nhưng nhận được: {note[1]}"

    # Thao tác 2: Xóa Session -> Kiểm tra CASCADE delete trên toàn bộ bảng con
    with sync_engine.begin() as conn:
        conn.execute(text("DELETE FROM research_sessions WHERE id = :id"), {"id": session_id})

    with sync_engine.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM problem_frames WHERE id = :id"), {"id": frame_id}).scalar() == 0
        assert conn.execute(text("SELECT COUNT(*) FROM contradictions WHERE id = :id"), {"id": contradiction_id}).scalar() == 0
        assert conn.execute(text("SELECT COUNT(*) FROM research_notes WHERE id = :id"), {"id": note_id}).scalar() == 0
        assert conn.execute(text("SELECT COUNT(*) FROM candidate_solutions WHERE id = :id"), {"id": solution_id}).scalar() == 0


def test_migration_idempotency_rerun(sync_engine: Engine):
    """
    Given: Database đã ở revision head.
    When: Gọi lại command.upgrade(cfg, 'head') một lần nữa.
    Then: Quá trình nâng cấp phải thành công mà không gây lỗi hoặc đột biến schema.
    """
    _clean_database(sync_engine)
    cfg = get_alembic_config(sync_engine)

    command.upgrade(cfg, "head")
    # Rerun upgrade
    command.upgrade(cfg, "head")

    inspector = inspect(sync_engine)
    assert "candidate_solutions" in inspector.get_table_names()
    assert "research_notes" in inspector.get_table_names()


def test_env_py_url_override_precedence():
    """
    Given: Cấu hình alembic.ini và alembic/env.py.
    When: Biến môi trường DATABASE_URL được thiết lập URL tùy chỉnh.
    Then: get_url() trong alembic/env.py phải ưu tiên DATABASE_URL của môi trường/settings thay vì hardcode .ini.
    """
    import importlib
    from unittest.mock import patch
    import app.core.config
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from alembic.runtime.environment import EnvironmentContext
    from alembic import context

    custom_url = "postgresql+asyncpg://custom_user:custom_pass@custom_host:5432/custom_db"

    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("DATABASE_URL", custom_url)
        importlib.reload(app.core.config)

        cfg = Config(str(ALEMBIC_INI_PATH))
        cfg.set_main_option("script_location", str(REPO_ROOT / "alembic"))
        script = ScriptDirectory.from_config(cfg)

        captured_config_kwargs: dict = {}
        orig_configure = context.configure

        def mock_configure(**kwargs):
            nonlocal captured_config_kwargs
            captured_config_kwargs.update(kwargs)
            return orig_configure(**kwargs)

        with patch.object(context, "configure", side_effect=mock_configure):
            env = EnvironmentContext(cfg, script, fn=lambda rev, ctx: [], as_sql=True)
            with env:
                script.run_env()

        actual_url = captured_config_kwargs.get("url")
        assert actual_url and "custom_user:custom_pass@custom_host:5432/custom_db" in actual_url, (
            f"Alembic env.py không nhận override từ DATABASE_URL môi trường! URL cấu hình thực tế: {actual_url}"
        )
        assert "postgresql+psycopg2://" in actual_url, f"Driver asyncpg chưa được chuyển thành psycopg2: {actual_url}"


def test_empty_env_var_does_not_override_with_blank():
    """
    Given: Biến môi trường DATABASE_URL rỗng hoặc chỉ toàn whitespace nhưng settings có URL hợp lệ.
    When: Chạy get_url() qua env.py.
    Then: Phải fallback an toàn về settings.DATABASE_URL chứ không dùng chuỗi rỗng.
    """
    import importlib
    from unittest.mock import patch
    import app.core.config
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from alembic.runtime.environment import EnvironmentContext
    from alembic import context

    fallback_url = "postgresql+asyncpg://fallback_user:fallback_pass@localhost:5432/fallback_db"

    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("DATABASE_URL", "   ")
        importlib.reload(app.core.config)
        app.core.config.settings.DATABASE_URL = fallback_url

        cfg = Config(str(ALEMBIC_INI_PATH))
        cfg.set_main_option("script_location", str(REPO_ROOT / "alembic"))
        script = ScriptDirectory.from_config(cfg)

        captured_config_kwargs: dict = {}
        orig_configure = context.configure

        def mock_configure(**kwargs):
            nonlocal captured_config_kwargs
            captured_config_kwargs.update(kwargs)
            return orig_configure(**kwargs)

        with patch.object(context, "configure", side_effect=mock_configure):
            env = EnvironmentContext(cfg, script, fn=lambda rev, ctx: [], as_sql=True)
            with env:
                script.run_env()

        actual_url = captured_config_kwargs.get("url")
        assert actual_url and "fallback_user:fallback_pass@localhost:5432/fallback_db" in actual_url, (
            f"get_url() không fallback về settings.DATABASE_URL khi env var là whitespace: {actual_url}"
        )


def test_alembic_ini_contains_no_runtime_credentials():
    """
    Given: File alembic.ini.
    When: Đọc nội dung file cấu hình.
    Then: Không được chứa credential/mật khẩu runtime cứng (crw_password).
    """
    with open(ALEMBIC_INI_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert "crw_password" not in content, "alembic.ini không được chứa mật khẩu cứng"
    assert "localhost:5433" not in content, "alembic.ini không được chứa host/port cố định"


def test_fastapi_lifespan_does_not_call_create_all():
    """
    Given: File backend/src/app/main.py.
    When: Kiểm tra mã nguồn khởi động ứng dụng.
    Then: Không được chứa lệnh Base.metadata.create_all tự động bypass migration.
    """
    main_py_path = REPO_ROOT / "src" / "app" / "main.py"
    with open(main_py_path, "r", encoding="utf-8") as f:
        code = f.read()
    assert "create_all" not in code, "main.py không được chứa Base.metadata.create_all trong startup lifespan"
