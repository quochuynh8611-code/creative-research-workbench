from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text

from app.api.v1.router import api_router
from app.core.config import settings
from app.domain.models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tự động khởi tạo schema database nếu database đã sẵn sàng
    try:
        db_url = settings.DATABASE_URL
        if "asyncpg" in db_url:
            db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
        engine = create_engine(db_url)
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    yield


app = FastAPI(
    title="Creative Research Workbench",
    description="Workflow-driven TRIZ research assistant",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "creative-research-workbench"}
