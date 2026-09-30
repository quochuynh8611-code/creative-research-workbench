from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool, text

from app.core.config import settings
from app.domain.models import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    """
    Lấy Database URL theo thứ tự ưu tiên:
      1. Biến môi trường DATABASE_URL (nếu được thiết lập trong os.environ và không rỗng/whitespace).
      2. sqlalchemy.url trong Alembic Config (nếu được caller/test runner truyền rõ ràng và không rỗng).
      3. settings.DATABASE_URL (từ pydantic-settings / file .env).
    Chuẩn hóa driver sang psycopg2 đồng bộ cho Alembic engine.
    """
    env_url = os.environ.get("DATABASE_URL", "").strip()
    ini_url = (config.get_main_option("sqlalchemy.url") or "").strip()

    if env_url:
        url = env_url
    elif ini_url:
        url = ini_url
    elif getattr(settings, "DATABASE_URL", None) and str(settings.DATABASE_URL).strip():
        url = str(settings.DATABASE_URL).strip()
    else:
        raise RuntimeError("DATABASE_URL must be configured for Alembic migrations.")

    if "postgresql+asyncpg://" in url:
        url = url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    elif url.startswith("asyncpg://"):
        url = url.replace("asyncpg://", "postgresql+psycopg2://")

    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # 1. Nếu caller (ví dụ: test suite) đã cung cấp sẵn connection
    provided_connection = config.attributes.get("connection", None)
    if provided_connection is not None:
        context.configure(
            connection=provided_connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()
        return

    # 2. Ngược lại tạo engine từ cấu hình URL
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        connection.commit()

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
