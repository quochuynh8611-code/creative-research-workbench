"""
system.py — REST API endpoint cho System Metadata & AI Status (Batch C30)

Cung cấp:
- GET /api/v1/system/ai-status:
  Trạng thái an toàn của AI Provider (LLM & Embedding), không rò rỉ secret,
  không gọi sinh văn bản (zero token cost), timeout tối đa 1.5s.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.core.metrics import metrics_collector

logger = logging.getLogger(__name__)

router = APIRouter()


class AIProviderInfo(BaseModel):
    provider: str
    model: str
    is_real: bool
    healthy: bool


class AIStatusData(BaseModel):
    status: str  # "ready" | "mock" | "degraded" | "unavailable"
    status_label: str  # "AI thực tế" | "Mock mode" | "Chế độ suy giảm" | "AI tạm thời không khả dụng"
    llm: AIProviderInfo
    embedding: AIProviderInfo
    fallback_active: bool


class AIStatusResponse(BaseModel):
    data: AIStatusData


def check_openai_health(api_key: str, timeout: float = 1.5) -> bool:
    """
    Lightweight capability check cho OpenAI API (GET /v1/models).
    Tuyệt đối không sinh văn bản, không tiêu tốn token, timeout ≤ 1.5s.
    """
    if not api_key:
        return False
    try:
        url = "https://api.openai.com/v1/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(url, headers=headers)
            return resp.status_code == 200
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"OpenAI health check ping failed: {exc}")
        return False


def check_ollama_health(base_url: str, timeout: float = 1.5) -> bool:
    """
    Lightweight health check cho Ollama daemon cục bộ (GET /api/version hoặc /api/tags).
    Timeout ≤ 1.5s.
    """
    if not base_url:
        return False
    try:
        url = f"{base_url.rstrip('/')}/api/version"
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(url)
            return resp.status_code == 200
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Ollama health check ping failed: {exc}")
        return False


@router.get("/ai-status", response_model=AIStatusResponse)
def get_ai_status() -> AIStatusResponse:
    """
    Truy vấn trạng thái AI hiện tại của Workbench một cách an toàn.
    """
    llm_provider = (settings.LLM_PROVIDER or "mock").strip().lower()
    emb_provider = (settings.EMBEDDING_PROVIDER or "mock").strip().lower()

    # 1. Đánh giá LLM Provider
    llm_model = settings.LLM_MODEL_NAME or (
        "gpt-4o-mini"
        if llm_provider == "openai"
        else ("llama3.2" if llm_provider == "ollama" else "mock-model")
    )
    llm_is_real = False
    llm_healthy = True

    if llm_provider == "openai":
        if bool(settings.OPENAI_API_KEY):
            llm_is_real = True
            llm_healthy = check_openai_health(settings.OPENAI_API_KEY)
        else:
            llm_is_real = False
            llm_healthy = True
    elif llm_provider == "ollama":
        llm_is_real = True
        llm_healthy = check_ollama_health(settings.OLLAMA_BASE_URL)
    elif llm_provider == "gemini":
        if bool(settings.GEMINI_API_KEY):
            llm_is_real = True
            llm_healthy = True  # Giữ nguyên Gemini hiện có
        else:
            llm_is_real = False
            llm_healthy = True
    else:  # mock
        llm_is_real = False
        llm_healthy = True

    # 2. Đánh giá Embedding Provider
    emb_model = (
        settings.EMBEDDING_MODEL_NAME
        or (
            "text-embedding-3-small"
            if emb_provider == "openai"
            else (
                getattr(settings, "OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
                if emb_provider == "ollama"
                else "mock-embedding"
            )
        )
    )
    emb_is_real = False
    emb_healthy = True

    if emb_provider == "openai":
        if bool(settings.OPENAI_API_KEY):
            emb_is_real = True
            # Sử dụng lại kết quả kiểm tra nếu LLM cũng là openai
            emb_healthy = (
                llm_healthy
                if llm_provider == "openai"
                else check_openai_health(settings.OPENAI_API_KEY)
            )
        else:
            emb_is_real = False
            emb_healthy = True
    elif emb_provider == "ollama":
        emb_is_real = True
        emb_healthy = (
            llm_healthy
            if llm_provider == "ollama"
            else check_ollama_health(settings.OLLAMA_BASE_URL)
        )
    elif emb_provider == "gemini":
        if bool(settings.GEMINI_API_KEY):
            emb_is_real = True
            emb_healthy = True
        else:
            emb_is_real = False
            emb_healthy = True
    else:  # mock
        emb_is_real = False
        emb_healthy = True

    # 3. Tổng hợp trạng thái tổng thể (status, status_label, fallback_active)
    real_count = int(llm_is_real) + int(emb_is_real)
    healthy_real_count = int(llm_is_real and llm_healthy) + int(emb_is_real and emb_healthy)

    if real_count == 0:
        overall_status = "mock"
        status_label = "Mock mode"
        fallback_active = False
    elif real_count > 0 and healthy_real_count == real_count:
        overall_status = "ready"
        status_label = "AI thực tế"
        fallback_active = False
    elif real_count > 0 and healthy_real_count == 0:
        overall_status = "degraded"
        status_label = "AI tạm thời không khả dụng"
        fallback_active = True
    else:
        overall_status = "degraded"
        status_label = "Chế độ suy giảm"
        fallback_active = True

    return AIStatusResponse(
        data=AIStatusData(
            status=overall_status,
            status_label=status_label,
            llm=AIProviderInfo(
                provider=llm_provider,
                model=llm_model,
                is_real=llm_is_real,
                healthy=llm_healthy,
            ),
            embedding=AIProviderInfo(
                provider=emb_provider,
                model=emb_model,
                is_real=emb_is_real,
                healthy=emb_healthy,
            ),
            fallback_active=fallback_active,
        )
    )


@router.get("/metrics")
def get_system_metrics() -> dict[str, Any]:
    """
    Truy vấn chỉ số vận hành (Internal Telemetry) của Workbench (Batch C32).
    Chỉ track 4 endpoint ưu tiên, rolling buffer 1000 samples, zero secret leak.
    """
    return {"data": metrics_collector.get_summary()}

