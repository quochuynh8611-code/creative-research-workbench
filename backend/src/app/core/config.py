from __future__ import annotations

from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    # App
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/crw_db"

    # Embedding / AI Providers (Phase 6.1)
    EMBEDDING_PROVIDER: str = "mock"  # "mock" | "openai" | "gemini"
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    EMBEDDING_MODEL_NAME: Optional[str] = None

    # OpenAI / Gemini / LLM (Phase 6.2)
    LLM_PROVIDER: str = "mock"  # "mock" | "openai" | "gemini"
    LLM_MODEL_NAME: Optional[str] = None
    LLM_TIMEOUT_SECONDS: float = 10.0
    LLM_MAX_RETRIES: int = 2
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
