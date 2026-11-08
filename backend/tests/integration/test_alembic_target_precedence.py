"""
test_alembic_target_precedence.py — Integration test chứng minh lỗi Target Precedence trong Alembic migrations.

Hợp đồng mục tiêu (Target Contract):
  1. Khi caller truyền explicit `sqlalchemy.url` vào Alembic Config (không rỗng),
     nó BẮT BUỘC phải ghi đè biến môi trường ambient `DATABASE_URL`.
  2. Khi `sqlalchemy.url` trong Config rỗng/chưa được thiết lập,
     Alembic fallback về biến môi trường ambient `DATABASE_URL`.
  3. Preflight, upgrade và postflight phải chạy nhất quán trên cùng một target database.

Bảo đảm an toàn DB (Disposable DB Guard):
  - Khởi tạo 2 containers riêng biệt A và B từ image `ankane/pgvector:latest`.
  - Assert URL A != URL B.
  - Assert không trỏ vào database phát triển (`crw_dev`), production (`crw_prod`), hoặc port tĩnh 5432/5433.
  - Mask password trong mọi output/log.
"""
from __future__ import annotations

import pathlib
from typing import Any
import pytest
from sqlalchemy import Engine, create_engine, inspect, text
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from testcontainers.postgres import PostgresContainer


REPO_ROOT = pathlib.Path(__file__).parent.parent.parent
ALEMBIC_INI_PATH = REPO_ROOT / "alembic.ini"
ALEMBIC_DIR = REPO_ROOT / "alembic"

APPLICATION_TABLES = {
    "documents",
    "chunks",
    "research_sessions",
    "problem_frames",
    "contradictions",
    "research_notes",
    "candidate_solutions",
    "background_jobs",
}


def _assert_disposable_target(engine: Engine, label: str) -> None:
    """Xác minh an toàn engine là disposable target và không trỏ nhầm database dev/prod."""
    url_str = engine.url.render_as_string(hide_password=False)
    masked_url = engine.url.render_as_string(hide_password=True)

    # In masked URL phục vụ audit
    print(f"\n[Disposable DB Guard] {label}: {masked_url}")

    assert "crw_dev" not in url_str, f"{label} tuyệt đối không được trỏ vào crw_dev"
    assert "crw_prod" not in url_str, f"{label} tuyệt đối không được trỏ vào crw_prod"

    host = engine.url.host or ""
    port = engine.url.port
    if host in ("localhost", "127.0.0.1", "0.0.0.0"):
        assert port not in (5432, 5433), (
            f"{label} không được trỏ vào cổng PostgreSQL phát triển mặc định ({port}): {masked_url}"
        )


def _clean_database(engine: Engine) -> None:
    """Dọn dẹp sạch toàn bộ bảng và enum types trên target database."""
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS background_jobs CASCADE"))
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


def _get_db_snapshot(engine: Engine) -> dict[str, Any]:
    """
    Thu thập snapshot không cache của database:
    - Danh sách bảng hiện tại (dùng Inspector mới).
    - Revision hiện tại từ alembic_version (nếu bảng tồn tại).
    """
    # Tạo fresh Inspector để không bị stale cache từ lần gọi trước
    fresh_inspector = inspect(engine)
    fresh_inspector.clear_cache()
    table_names = sorted(fresh_inspector.get_table_names())

    current_revision = None
    if "alembic_version" in table_names:
        with engine.connect() as conn:
            current_revision = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()

    return {
        "url_masked": engine.url.render_as_string(hide_password=True),
        "tables": table_names,
        "revision": current_revision,
    }


@pytest.fixture(scope="module")
def disposable_targets():
    """Khởi tạo 2 PostgreSQL testcontainers disposable độc lập A và B."""
    with PostgresContainer(image="ankane/pgvector:latest") as pg_a, \
         PostgresContainer(image="ankane/pgvector:latest") as pg_b:

        engine_a = create_engine(pg_a.get_connection_url(), echo=False, pool_pre_ping=True)
        engine_b = create_engine(pg_b.get_connection_url(), echo=False, pool_pre_ping=True)

        # Kiểm tra an toàn trước khi chạy bất kỳ thao tác nào
        _assert_disposable_target(engine_a, "Target A (Ambient DB)")
        _assert_disposable_target(engine_b, "Target B (Explicit Config DB)")

        url_a_str = engine_a.url.render_as_string(hide_password=True)
        url_b_str = engine_b.url.render_as_string(hide_password=True)
        assert url_a_str != url_b_str, "Hai disposable target A và B phải có URL khác nhau!"

        with engine_a.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
        with engine_b.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()

        yield engine_a, engine_b

        engine_a.dispose()
        engine_b.dispose()


@pytest.fixture(autouse=True)
def clean_targets_lifecycle(disposable_targets):
    """Bảo đảm cô lập hoàn toàn giữa các test cases."""
    engine_a, engine_b = disposable_targets
    _clean_database(engine_a)
    _clean_database(engine_b)
    yield
    _clean_database(engine_a)
    _clean_database(engine_b)


def test_explicit_config_url_overrides_ambient_database_url(disposable_targets, monkeypatch):
    """
    RED TEST: Chứng minh lỗi Alembic target precedence.

    Given:
      - Biến môi trường ambient DATABASE_URL trỏ vào Target A (disposable container 1).
      - Caller tạo Alembic Config và thiết lập explicit sqlalchemy.url trỏ vào Target B (disposable container 2).
    When:
      - Caller gọi command.upgrade(cfg, "head").
    Then:
      - Migration BẮT BUỘC phải thực thi trên Target B (bảng alembic_version tồn tại với revision head,
        các bảng ứng dụng được khởi tạo).
      - Target A BẮT BUỘC KHÔNG bị ghi đè DDL (không có alembic_version, danh sách bảng giữ nguyên baseline).
    """
    engine_a, engine_b = disposable_targets

    # Thu thập snapshot ban đầu trước khi migration chạy
    snapshot_a_before = _get_db_snapshot(engine_a)
    snapshot_b_before = _get_db_snapshot(engine_b)

    # Giả lập môi trường CI/production có ambient DATABASE_URL trỏ vào Target A
    ambient_url_a = engine_a.url.render_as_string(hide_password=False)
    monkeypatch.setenv("DATABASE_URL", ambient_url_a)

    # Caller cấu hình Alembic Config chỉ định rõ ràng Target B
    cfg = Config(str(ALEMBIC_INI_PATH))
    cfg.set_main_option("script_location", str(ALEMBIC_DIR))
    explicit_url_b = engine_b.url.render_as_string(hide_password=False).replace("%", "%%")
    cfg.set_main_option("sqlalchemy.url", explicit_url_b)

    # Xác định head revision từ migration script graph
    script = ScriptDirectory.from_config(cfg)
    heads = script.get_heads()
    assert heads, "Phải tìm thấy ít nhất 1 head revision trong alembic/versions"
    expected_head_rev = heads[0]

    # Thực thi upgrade lên head
    command.upgrade(cfg, "head")

    # Thu thập snapshot sau migration bằng fresh inspector không cache
    snapshot_a_after = _get_db_snapshot(engine_a)
    snapshot_b_after = _get_db_snapshot(engine_b)

    print(f"\n[Snapshot After Migration - Target A]: {snapshot_a_after}")
    print(f"[Snapshot After Migration - Target B]: {snapshot_b_after}")

    # Assertions cho Target B: Phải là nơi nhận migration
    assert "alembic_version" in snapshot_b_after["tables"], (
        f"LỖI PRECEDENCE: alembic_version không tồn tại trên Target B (Explicit Target)! "
        f"Snapshot B: {snapshot_b_after}"
    )
    assert snapshot_b_after["revision"] == expected_head_rev, (
        f"Revision trên Target B ({snapshot_b_after['revision']}) không khớp expected head ({expected_head_rev})"
    )

    for tbl in APPLICATION_TABLES:
        assert tbl in snapshot_b_after["tables"], (
            f"Bảng nghiệp vụ '{tbl}' không tồn tại trên Target B sau khi upgrade! Bảng hiện có: {snapshot_b_after['tables']}"
        )

    # Assertions cho Target A: Tuyệt đối không được bị ghi đè DDL
    assert "alembic_version" not in snapshot_a_after["tables"], (
        f"LỖI PRECEDENCE: Target A (Ambient DB) đã bị ghi đè bởi Alembic upgrade! "
        f"Bảng alembic_version xuất hiện bất hợp pháp trên Target A. Snapshot A: {snapshot_a_after}"
    )
    assert snapshot_a_after["tables"] == snapshot_a_before["tables"], (
        f"Target A (Ambient DB) bị thay đổi bảng! Trước: {snapshot_a_before['tables']}, Sau: {snapshot_a_after['tables']}"
    )
    assert snapshot_a_after["revision"] is None, (
        f"Target A không được có revision migration, nhận được: {snapshot_a_after['revision']}"
    )


def test_empty_config_url_falls_back_to_ambient_database_url(disposable_targets, monkeypatch):
    """
    KỊCH BẢN ĐỐI CHỨNG (FALLBACK GUARD):

    Given:
      - Biến môi trường ambient DATABASE_URL trỏ vào Target A.
      - Caller truyền Alembic Config với sqlalchemy.url rỗng.
    When:
      - Caller gọi command.upgrade(cfg, "001").
    Then:
      - Alembic fallback an toàn về ambient DATABASE_URL (Target A nhận migration 001).
      - Target B hoàn toàn không bị ảnh hưởng.
    """
    engine_a, engine_b = disposable_targets

    snapshot_a_before = _get_db_snapshot(engine_a)
    snapshot_b_before = _get_db_snapshot(engine_b)

    ambient_url_a = engine_a.url.render_as_string(hide_password=False)
    monkeypatch.setenv("DATABASE_URL", ambient_url_a)

    cfg = Config(str(ALEMBIC_INI_PATH))
    cfg.set_main_option("script_location", str(ALEMBIC_DIR))
    cfg.set_main_option("sqlalchemy.url", "")  # Rỗng

    # Chạy upgrade lên revision 001
    command.upgrade(cfg, "001")

    # Thu thập snapshot sau migration
    snapshot_a_after = _get_db_snapshot(engine_a)
    snapshot_b_after = _get_db_snapshot(engine_b)

    print(f"\n[Fallback Snapshot After Migration - Target A]: {snapshot_a_after}")
    print(f"[Fallback Snapshot After Migration - Target B]: {snapshot_b_after}")

    # Target A phải nhận migration 001
    assert "alembic_version" in snapshot_a_after["tables"], (
        "Khi Config URL rỗng, Alembic phải fallback về DATABASE_URL môi trường để migrate Target A!"
    )
    assert snapshot_a_after["revision"] == "001", (
        f"Revision trên Target A phải là '001', nhận được: {snapshot_a_after['revision']}"
    )
    assert "documents" in snapshot_a_after["tables"], (
        "Bảng documents phải có trên Target A sau revision 001"
    )

    # Target B không bị ảnh hưởng
    assert "alembic_version" not in snapshot_b_after["tables"], "Target B không được có alembic_version"
    assert snapshot_b_after["tables"] == snapshot_b_before["tables"], "Target B không được có thay đổi"
    assert snapshot_b_after["revision"] is None, "Target B không được có revision"
