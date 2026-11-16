from __future__ import annotations

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
    EMBEDDING_PROVIDER: str = "mock"  # "mock" | "openai" | "gemini" | "ollama"
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    EMBEDDING_MODEL_NAME: str | None = None
    OLLAMA_EMBEDDING_MODEL: str = "nomic-embed-text"

    # OpenAI / Gemini / LLM (Phase 6.2)
    LLM_PROVIDER: str = "mock"  # "mock" | "openai" | "gemini"
    LLM_MODEL_NAME: str | None = None
    LLM_TIMEOUT_SECONDS: float = 10.0
    LLM_MAX_RETRIES: int = 2
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
