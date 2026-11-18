import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import correlation_id_ctx, setup_logging
from app.core.middleware import CorrelationIdMiddleware, MetricsMiddleware

# Thiết lập Structured Logging khi khởi động
setup_logging(log_level="DEBUG" if settings.DEBUG else "INFO", json_format=True)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Creative Research Workbench",
    description="Workflow-driven TRIZ research assistant",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Thêm Middlewares theo thứ tự (Onion Layering):
# 1. CorrelationIdMiddleware (Tầng ngoài cùng: nhận và gán ID đầu tiên, gắn headers cuối cùng)
# 2. MetricsMiddleware (Đo lường thời gian thực thi cho 4 endpoint ưu tiên)
# 3. CORSMiddleware (Quản lý CORS Origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(MetricsMiddleware)
app.add_middleware(CorrelationIdMiddleware)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    corr_id = getattr(request.state, "request_id", None) or correlation_id_ctx.get()
    error_headers = {}
    if corr_id and corr_id != "-":
        error_headers["X-Request-ID"] = corr_id
        error_headers["X-Correlation-ID"] = corr_id

    if isinstance(exc, StarletteHTTPException):
        headers = getattr(exc, "headers", None) or {}
        headers.update(error_headers)
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=headers,
        )

    error_id = uuid.uuid4().hex[:8]
    logger.error("Unhandled server exception [%s] (correlation_id=%s): %s", error_id, corr_id, exc, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error. Please try again later.",
            "error_id": error_id,
        },
        headers=error_headers or None,
    )


app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "creative-research-workbench"}
