from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/crw_db"

    # OpenAI / LLM
    OPENAI_API_KEY: str = ""
    LLM_PROVIDER: str = "openai"  # "openai" | "ollama"
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
