"""
test_migration_005_session_domain.py — Migration test suite cho Revision 005 (Persist Session Domain).

Kiểm tra:
  - Upgrade từ 004 -> 005: thêm cột domain (VARCHAR(256), nullable=True) vào research_sessions.
  - Downgrade từ 005 -> 004: drop cột domain.
  - Không backfill, không DB default, bảo toàn dữ liệu hàng hiện có.
  - Chạy trên disposable PostgreSQL container với safety gate xác minh trước DDL.
"""
from __future__ import annotations

import pathlib
from typing import Any
import pytest
from sqlalchemy import Engine, create_engine, inspect, text
from alembic import command
from alembic.config import Config

from tests.integration.safe_disposable_db import disposable_pg_container_lifecycle

REPO_ROOT = pathlib.Path(__file__).parent.parent.parent
ALEMBIC_INI_PATH = REPO_ROOT / "alembic.ini"


def get_alembic_config(engine: Engine) -> Config:
    """Tạo Alembic Config trỏ đúng alembic.ini và inject URL kết nối disposable container."""
    cfg = Config(str(ALEMBIC_INI_PATH))
    url_str = engine.url.render_as_string(hide_password=False).replace("%", "%%")
    cfg.set_main_option("sqlalchemy.url", url_str)
    cfg.set_main_option("script_location", str(REPO_ROOT / "alembic"))
    return cfg


def test_migration_005_upgrade_and_downgrade():
    """
    Given: Disposable PostgreSQL container được khởi tạo và xác minh an toàn.
    When: Chạy Alembic upgrade lên 004, chèn dữ liệu mẫu, rồi upgrade lên 005.
    Then: Cột research_sessions.domain được thêm với kiểu VARCHAR(256), nullable=True,
          dữ liệu cũ có domain=NULL; sau đó downgrade về 004 xóa cột domain an toàn.
    """
    for pg_info in disposable_pg_container_lifecycle():
        container_id = pg_info["container_id"]
        mapped_port = pg_info["port"]
        host = pg_info["host"]
        dbname = pg_info["dbname"]
        pg = pg_info["container"]
        raw_url = pg.get_connection_url()

        engine = create_engine(raw_url, echo=False, pool_pre_ping=True)
        try:
            # 1. Safety Gate Verification trước mọi DDL
            url_obj = engine.url
            assert url_obj.host == host, f"Host mismatch: {url_obj.host} != {host}"
            assert url_obj.port == mapped_port, f"Port mismatch: {url_obj.port} != {mapped_port}"
            assert url_obj.database == dbname, f"DB name mismatch: {url_obj.database} != {dbname}"

            with engine.connect() as conn:
                res = conn.execute(text("SELECT current_database(), inet_server_port()")).fetchone()
                assert res is not None
                curr_db, server_port = res
                assert curr_db == dbname, f"DB mismatch: {curr_db} != {dbname}"
                assert server_port == 5432, f"Server internal port mismatch: {server_port} != 5432"
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                conn.commit()

            masked_url = f"{url_obj.drivername}://***:***@{url_obj.host}:{url_obj.port}/{url_obj.database}"
            print(f"\n[Safety Gate Verified] Container ID: {container_id[:12]}, Port: {mapped_port}, Target: {masked_url}")

            cfg = get_alembic_config(engine)

            # 2. Upgrade đến 004 (Baseline + feature tables hiện tại)
            command.upgrade(cfg, "004")

            inspector = inspect(engine)
            cols_004 = {c["name"]: c for c in inspector.get_columns("research_sessions")}
            assert "domain" not in cols_004, "Cột 'domain' không được tồn tại ở revision 004"

            # Chèn 1 session ở revision 004 để kiểm tra tính bảo toàn dữ liệu
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "INSERT INTO research_sessions (id, title, status, workflow_state) "
                        "VALUES (gen_random_uuid(), 'Legacy Session 004', 'active', 'idle')"
                    )
                )

            # 3. Upgrade lên 005 (Mục tiêu của batch Backend 1B)
            command.upgrade(cfg, "005")

            inspector_005 = inspect(engine)
            cols_005 = {c["name"]: c for c in inspector_005.get_columns("research_sessions")}
            assert "domain" in cols_005, "Cột 'domain' phải tồn tại sau khi upgrade lên revision 005"
            domain_col = cols_005["domain"]
            assert domain_col["nullable"] is True, "Cột 'domain' phải là nullable=True"
            assert domain_col["default"] is None, "Cột 'domain' không được có default cứng tại DB"
            col_type_str = str(domain_col["type"]).upper()
            assert "VARCHAR" in col_type_str or "STRING" in col_type_str
            assert domain_col["type"].length == 256, f"Độ dài cột domain phải là 256, nhận: {domain_col['type'].length}"

            # Kiểm tra dữ liệu legacy: domain phải là NULL
            with engine.connect() as conn:
                val = conn.execute(
                    text("SELECT domain FROM research_sessions WHERE title = 'Legacy Session 004'")
                ).scalar()
                assert val is None, "Session cũ phải có domain là NULL (không backfill)"

            # Kiểm tra có thể chèn session mới với domain='life'
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "INSERT INTO research_sessions (id, title, domain, status, workflow_state) "
                        "VALUES (gen_random_uuid(), 'New Session 005', 'life', 'active', 'idle')"
                    )
                )

            with engine.connect() as conn:
                val = conn.execute(
                    text("SELECT domain FROM research_sessions WHERE title = 'New Session 005'")
                ).scalar()
                assert val == "life"

            # 4. Downgrade về 004
            command.downgrade(cfg, "004")

            inspector_down = inspect(engine)
            cols_down = {c["name"] for c in inspector_down.get_columns("research_sessions")}
            assert "domain" not in cols_down, "Cột 'domain' phải bị xóa sau khi downgrade về 004"

            # Dữ liệu legacy session vẫn còn
            with engine.connect() as conn:
                legacy_count = conn.execute(
                    text("SELECT count(*) FROM research_sessions WHERE title = 'Legacy Session 004'")
                ).scalar()
                assert legacy_count == 1, "Dữ liệu session cũ phải còn nguyên sau downgrade"

        finally:
            engine.dispose()
