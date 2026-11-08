"""
safe_disposable_db.py — Dedicated safety harness for disposable PostgreSQL container testing.

Contract:
  - Spawns a dedicated testcontainers[postgres] instance for the test process.
  - Verifies engine target matches container ID, host, mapped port and database name.
  - Fails closed if verification fails.
  - Redacts sensitive credentials.
  - Ensures clean engine disposal and container stop/removal under try/finally.
  - No silent cleanup: teardown failures are signaled; if a prior error occurred,
    the cleanup error is chained without masking the primary failure.
  - Does NOT read ambient TEST_DATABASE_URL or .env.
"""
from __future__ import annotations

import logging
from collections.abc import Generator
from typing import Any
import docker
import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker
from testcontainers.postgres import PostgresContainer

from app.domain.models import Base
from app.api.v1.endpoints.sessions import get_db
from app.main import app

logger = logging.getLogger(__name__)

_OVERRIDE_SENTINEL = object()


def disposable_pg_container_lifecycle(
    pg_factory: Any = PostgresContainer,
    docker_client_factory: Any = docker.from_env,
) -> Generator[dict[str, Any], None, None]:
    """
    Quản lý vòng đời disposable Postgres container.
    - Không nuốt lỗi (không silent pass).
    - Teardown lỗi khi không có lỗi trước đó -> raise lỗi teardown.
    - Đã có lỗi setup/test -> log lỗi teardown và raise stop_err from primary_err.
    - Không log credentials hay connection URL.
    - Chỉ stop chính xác container được tạo.
    """
    pg = pg_factory(image="ankane/pgvector:latest")
    pg_started = False
    container_id = "unknown"
    try:
        pg.start()
        pg_started = True
        # 1. Thu thập thông tin container từ docker daemon
        container_id = str(pg.get_wrapped_container().id)
        mapped_port = int(pg.get_exposed_port(5432))
        host = pg.get_container_host_ip()
        dbname = pg.dbname

        # 2. Xác minh trực tiếp với Docker Daemon và đóng client sau khi kiểm tra
        docker_client = docker_client_factory()
        try:
            raw_container = docker_client.containers.get(container_id)
            assert raw_container.status == "running", f"Container {container_id[:12]} is not running!"
            port_bindings = raw_container.ports.get("5432/tcp")
            assert port_bindings is not None, "Port 5432 is not bound!"
            bound_host_port = int(port_bindings[0]["HostPort"])
            assert bound_host_port == mapped_port, (
                f"Port mismatch! Expected {mapped_port}, found {bound_host_port}"
            )
        finally:
            docker_client.close()

        yield {
            "container": pg,
            "container_id": container_id,
            "host": host,
            "port": mapped_port,
            "dbname": dbname,
        }
    except BaseException as primary_err:
        if pg_started:
            try:
                pg.stop()
            except Exception as stop_err:
                logger.error(
                    "Teardown failure on container %s: %s",
                    container_id[:12],
                    stop_err,
                )
                raise stop_err from primary_err
        raise
    else:
        if pg_started:
            pg.stop()


@pytest.fixture(scope="session")
def disposable_pg_container():
    """Tạo mới 1 disposable Postgres container riêng biệt cho lần chạy test."""
    yield from disposable_pg_container_lifecycle()


@pytest.fixture(scope="session")
def disposable_engine(disposable_pg_container):
    """Tạo engine và xác minh khớp container identity trước khi create_all."""
    pg_info = disposable_pg_container
    pg: PostgresContainer = pg_info["container"]
    raw_url = pg.get_connection_url()

    engine = create_engine(raw_url, echo=False, pool_pre_ping=True)
    safety_gate_passed = False
    try:
        url_obj = engine.url
        assert url_obj.host == pg_info["host"], f"Engine host mismatch: {url_obj.host} != {pg_info['host']}"
        assert url_obj.port == pg_info["port"], f"Engine port mismatch: {url_obj.port} != {pg_info['port']}"
        assert url_obj.database == pg_info["dbname"], f"Engine db mismatch: {url_obj.database} != {pg_info['dbname']}"

        # Verify connection, database name và cổng server nội bộ 5432
        with engine.connect() as conn:
            res = conn.execute(text("SELECT current_database(), inet_server_port()")).fetchone()
            assert res is not None
            curr_db, server_port = res
            assert curr_db == pg_info["dbname"]
            assert server_port == 5432, f"Server internal port mismatch: {server_port} != 5432"
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()

        safety_gate_passed = True
        Base.metadata.create_all(engine)

        masked_url = f"{url_obj.drivername}://***:***@{url_obj.host}:{url_obj.port}/{url_obj.database}"
        print(f"\n[Safety Gate Passed] Connected to disposable container {pg_info['container_id'][:12]} at {masked_url}")

        yield engine
    finally:
        try:
            if safety_gate_passed:
                Base.metadata.drop_all(engine)
        finally:
            engine.dispose()


@pytest.fixture()
def db_session(disposable_engine) -> Generator[Session, None, None]:
    """1 session mới trên connection với transaction rollback mỗi test."""
    connection = disposable_engine.connect()
    transaction = connection.begin()

    session_factory = sessionmaker(bind=connection)
    session = session_factory()

    nested = connection.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(session: Session, transaction: Any) -> None:
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    try:
        yield session
    finally:
        try:
            session.close()
        finally:
            try:
                transaction.rollback()
            finally:
                connection.close()


@pytest.fixture(autouse=True)
def override_get_db(db_session: Session):
    """Tự động ghi đè get_db sang db_session của disposable container với sentinel bảo vệ."""
    previous_override = app.dependency_overrides.get(get_db, _OVERRIDE_SENTINEL)
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield
    finally:
        if previous_override is _OVERRIDE_SENTINEL:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override
