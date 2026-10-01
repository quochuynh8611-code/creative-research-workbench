"""
embedding_client.py — Real Embedding Engine & Polymorphic Factory (Phase 6.1).

Cung cấp các client tạo vector nhúng ngữ nghĩa (embeddings) phục vụ Ingestion và Hybrid Search:
  - MockEmbeddingClient: Zero-vectors phục vụ testing và offline dev.
  - OpenAIEmbeddingClient: text-embedding-3-small (1536 dimensions).
  - GeminiEmbeddingClient: text-embedding-004 (1536 dimensions / standardized).
  - get_embedding_client: Factory khởi tạo theo provider được cấu hình.

Ref: docs/PROFESSIONAL_UPGRADE_ROADMAP.md (Phase 6.1), docs/PHASE_6_7_EXECUTION_SPEC.md
"""
from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Kích thước vector chuẩn toàn hệ thống
EMBEDDING_DIM: int = 1536


# ──────────────────────────────────────────────
# Base Interface
# ──────────────────────────────────────────────

class EmbeddingClient(ABC):
    """Interface cơ sở cho tất cả embedding clients."""

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        """
        Nhận danh sách chuỗi văn bản, trả về danh sách vector float có độ dài EMBEDDING_DIM.
        Đảm bảo thứ tự 1:1 với input.
        """
        ...


# ──────────────────────────────────────────────
# Mock Client
# ──────────────────────────────────────────────

class MockEmbeddingClient(EmbeddingClient):
    """
    Mock Embedding Client trả về zero-vectors 1536 chiều.
    Dùng cho unit/integration testing và fallback khi không có API credentials.
    """

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return [[0.0] * EMBEDDING_DIM for _ in texts]


# ──────────────────────────────────────────────
# OpenAI Embedding Client
# ──────────────────────────────────────────────

class OpenAIEmbeddingClient(EmbeddingClient):
    """
    OpenAI Embedding Client sử dụng model text-embedding-3-small (hoặc model tùy chỉnh).
    Hỗ trợ retry có exponential backoff và graceful degradation về Mock khi gặp lỗi.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        dimensions: int = EMBEDDING_DIM,
        max_retries: int = 2,
        retry_delay: float = 0.5,
        fallback_on_error: bool = True,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.OPENAI_API_KEY
        self.model = model or settings.EMBEDDING_MODEL_NAME or "text-embedding-3-small"
        self.dimensions = dimensions
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.fallback_on_error = fallback_on_error
        self._mock_fallback = MockEmbeddingClient()

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        if not self.api_key or not self.api_key.strip():
            logger.warning(
                "OpenAI API key missing or empty. Gracefully falling back to MockEmbeddingClient."
            )
            return self._mock_fallback.embed(texts)

        try:
            import openai
        except ImportError:
            logger.error("openai package is not installed. Falling back to MockEmbeddingClient.")
            return self._mock_fallback.embed(texts)

        client = openai.OpenAI(api_key=self.api_key)

        attempts = 0
        while True:
            try:
                # OpenAI API cho phép truyền parameters dimensions cho text-embedding-3
                response = client.embeddings.create(
                    input=texts,
                    model=self.model,
                    dimensions=self.dimensions,
                )
                vectors = [item.embedding for item in response.data]
                # Kiểm tra và chuẩn hóa kích thước vector nếu cần
                return [self._standardize_dim(v) for v in vectors]

            except Exception as exc:  # noqa: BLE001
                attempts += 1
                if attempts <= self.max_retries:
                    sleep_time = self.retry_delay * (2 ** (attempts - 1))
                    logger.warning(
                        "OpenAI embedding request failed (attempt %d/%d): %s. Retrying in %.2fs...",
                        attempts,
                        self.max_retries,
                        exc,
                        sleep_time,
                    )
                    time.sleep(sleep_time)
                else:
                    logger.error(
                        "OpenAI embedding request failed after %d retries: %s. Falling back to MockEmbeddingClient (fallback_on_error=%s).",
                        self.max_retries,
                        exc,
                        self.fallback_on_error,
                    )
                    if self.fallback_on_error:
                        return self._mock_fallback.embed(texts)
                    raise

    @staticmethod
    def _standardize_dim(vector: list[float]) -> list[float]:
        if len(vector) == EMBEDDING_DIM:
            return [float(x) for x in vector]
        if len(vector) < EMBEDDING_DIM:
            return [float(x) for x in vector] + [0.0] * (EMBEDDING_DIM - len(vector))
        return [float(x) for x in vector[:EMBEDDING_DIM]]


# ──────────────────────────────────────────────
# Gemini Embedding Client
# ──────────────────────────────────────────────

class GeminiEmbeddingClient(EmbeddingClient):
    """
    Gemini Embedding Client sử dụng API Google Generative Language v1beta (text-embedding-004).
    Tự động chuẩn hóa kích thước 1536 chiều đảm bảo 100% tương thích với PostgreSQL pgvector.
    Hỗ trợ retry và graceful degradation về Mock.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_retries: int = 2,
        retry_delay: float = 0.5,
        fallback_on_error: bool = True,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.model = model or settings.EMBEDDING_MODEL_NAME or "text-embedding-004"
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.fallback_on_error = fallback_on_error
        self._mock_fallback = MockEmbeddingClient()

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        if not self.api_key or not self.api_key.strip():
            logger.warning(
                "Gemini API key missing or empty. Gracefully falling back to MockEmbeddingClient."
            )
            return self._mock_fallback.embed(texts)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:batchEmbedContents?key={self.api_key}"
        requests_payload = [
            {
                "model": f"models/{self.model}",
                "content": {"parts": [{"text": t}]},
                "outputDimensionality": EMBEDDING_DIM,
            }
            for t in texts
        ]
        body = {"requests": requests_payload}

        attempts = 0
        with httpx.Client(timeout=15.0) as http_client:
            while True:
                try:
                    resp = http_client.post(url, json=body)
                    if resp.status_code != 200:
                        raise RuntimeError(
                            f"Gemini API returned status {resp.status_code}: {resp.text}"
                        )
                    data = resp.json()
                    embeddings_raw = data.get("embeddings", [])
                    if len(embeddings_raw) != len(texts):
                        raise RuntimeError(
                            f"Gemini returned {len(embeddings_raw)} embeddings for {len(texts)} inputs"
                        )

                    vectors = [item.get("values", []) for item in embeddings_raw]
                    return [self._standardize_dim(v) for v in vectors]

                except Exception as exc:  # noqa: BLE001
                    attempts += 1
                    if attempts <= self.max_retries:
                        sleep_time = self.retry_delay * (2 ** (attempts - 1))
                        logger.warning(
                            "Gemini embedding request failed (attempt %d/%d): %s. Retrying in %.2fs...",
                            attempts,
                            self.max_retries,
                            exc,
                            sleep_time,
                        )
                        time.sleep(sleep_time)
                    else:
                        logger.error(
                            "Gemini embedding request failed after %d retries: %s. Falling back to MockEmbeddingClient (fallback_on_error=%s).",
                            self.max_retries,
                            exc,
                            self.fallback_on_error,
                        )
                        if self.fallback_on_error:
                            return self._mock_fallback.embed(texts)
                        raise

    @staticmethod
    def _standardize_dim(vector: list[float]) -> list[float]:
        if len(vector) == EMBEDDING_DIM:
            return [float(x) for x in vector]
        if len(vector) < EMBEDDING_DIM:
            # Pad thêm zero nếu provider trả ít chiều hơn (e.g. 768)
            return [float(x) for x in vector] + [0.0] * (EMBEDDING_DIM - len(vector))
        # Cắt nếu provider trả nhiều hơn
        return [float(x) for x in vector[:EMBEDDING_DIM]]


# ──────────────────────────────────────────────
# Factory
# ──────────────────────────────────────────────

def get_embedding_client(provider: Optional[str] = None) -> EmbeddingClient:
    """
    Factory tạo EmbeddingClient dựa trên cấu hình provider.
    Mặc định: settings.EMBEDDING_PROVIDER ('mock' | 'openai' | 'gemini').
    """
    target_provider = (
        provider if provider is not None else settings.EMBEDDING_PROVIDER
    )
    clean_provider = (target_provider or "mock").strip().lower()

    if clean_provider == "mock":
        return MockEmbeddingClient()
    elif clean_provider == "openai":
        return OpenAIEmbeddingClient()
    elif clean_provider == "gemini":
        return GeminiEmbeddingClient()
    else:
        logger.warning(
            "Unknown EMBEDDING_PROVIDER '%s'. Falling back to MockEmbeddingClient.",
            target_provider,
        )
        return MockEmbeddingClient()
