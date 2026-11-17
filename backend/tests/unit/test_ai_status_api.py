"""
test_ai_status_api.py — Unit tests cho GET /api/v1/system/ai-status (Batch C30)

Kiểm tra:
1. Trả về cấu trúc JSON an toàn: status, status_label, llm, embedding, fallback_active.
2. Phân loại trạng thái chuẩn: ready, mock, degraded, unavailable.
3. Tuyệt đối không rò rỉ secret (OPENAI_API_KEY, GEMINI_API_KEY, password, connection string).
4. Không gọi LLM sinh nội dung, không tiêu thụ token khi kiểm tra status.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_ai_status_returns_200_and_expected_structure(client):
    """Kiểm tra endpoint trả về HTTP 200 và cấu trúc envelope data chuẩn."""
    response = client.get("/api/v1/system/ai-status")
    assert response.status_code == 200
    payload = response.json()
    assert "data" in payload

    data = payload["data"]
    assert "status" in data
    assert data["status"] in {"ready", "mock", "degraded", "unavailable"}
    assert "status_label" in data
    assert isinstance(data["status_label"], str)

    assert "llm" in data
    assert "provider" in data["llm"]
    assert "model" in data["llm"]
    assert "is_real" in data["llm"]
    assert "healthy" in data["llm"]

    assert "embedding" in data
    assert "provider" in data["embedding"]
    assert "model" in data["embedding"]
    assert "is_real" in data["embedding"]
    assert "healthy" in data["embedding"]

    assert "fallback_active" in data
    assert isinstance(data["fallback_active"], bool)


def test_ai_status_mock_mode_when_keys_missing(client):
    """Khi cấu hình mock hoặc không có API key, trả về status=mock và status_label='Mock mode'."""
    with patch.object(settings, "LLM_PROVIDER", "mock"), \
         patch.object(settings, "EMBEDDING_PROVIDER", "mock"), \
         patch.object(settings, "OPENAI_API_KEY", ""):
        response = client.get("/api/v1/system/ai-status")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["status"] == "mock"
        assert data["status_label"] == "Mock mode"
        assert data["llm"]["is_real"] is False
        assert data["embedding"]["is_real"] is False


def test_ai_status_ready_when_openai_configured_and_healthy(client):
    """Khi OpenAI được cấu hình và kiểm tra kết nối thành công, trả về ready."""
    with patch.object(settings, "LLM_PROVIDER", "openai"), \
         patch.object(settings, "EMBEDDING_PROVIDER", "openai"), \
         patch.object(settings, "OPENAI_API_KEY", "sk-proj-test1234567890"), \
         patch("app.api.v1.endpoints.system.check_openai_health", return_value=True):
        response = client.get("/api/v1/system/ai-status")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["status"] == "ready"
        assert data["status_label"] == "AI thực tế"
        assert data["llm"]["is_real"] is True
        assert data["llm"]["healthy"] is True
        assert data["embedding"]["is_real"] is True
        assert data["embedding"]["healthy"] is True
        assert data["fallback_active"] is False


def test_ai_status_degraded_when_openai_unhealthy(client):
    """Khi OpenAI được cấu hình nhưng ping thất bại (timeout/error), trả về degraded/mock fallback."""
    with patch.object(settings, "LLM_PROVIDER", "openai"), \
         patch.object(settings, "EMBEDDING_PROVIDER", "openai"), \
         patch.object(settings, "OPENAI_API_KEY", "sk-proj-test1234567890"), \
         patch("app.api.v1.endpoints.system.check_openai_health", return_value=False):
        response = client.get("/api/v1/system/ai-status")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["status"] in {"degraded", "unavailable"}
        assert data["fallback_active"] is True
        assert data["llm"]["healthy"] is False


def test_ai_status_ready_when_ollama_configured_and_healthy(client):
    """Khi Ollama được cấu hình và daemon đang chạy, trả về ready."""
    with patch.object(settings, "LLM_PROVIDER", "ollama"), \
         patch.object(settings, "EMBEDDING_PROVIDER", "ollama"), \
         patch.object(settings, "OLLAMA_BASE_URL", "http://localhost:11434"), \
         patch("app.api.v1.endpoints.system.check_ollama_health", return_value=True):
        response = client.get("/api/v1/system/ai-status")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["status"] == "ready"
        assert data["status_label"] == "AI thực tế"
        assert data["llm"]["provider"] == "ollama"
        assert data["llm"]["is_real"] is True
        assert data["llm"]["healthy"] is True
        assert data["embedding"]["provider"] == "ollama"
        assert data["fallback_active"] is False


def test_ai_status_zero_secret_leak(client):
    """
    KIỂM THỬ AN TOÀN TUYỆT ĐỐI (ZERO-SECRET LEAK):
    Đảm bảo không bao giờ rò rỉ API key, password, URL nhạy cảm trong response.
    """
    secret_openai_key = "sk-super-secret-openai-key-do-not-leak-998877"
    secret_gemini_key = "AIzaSyDummyGeminiSecretKeyDoNotLeak"
    secret_db_pass = "super_secret_db_password_xyz"

    with patch.object(settings, "OPENAI_API_KEY", secret_openai_key), \
         patch.object(settings, "GEMINI_API_KEY", secret_gemini_key), \
         patch.object(settings, "DATABASE_URL", f"postgresql://usr:{secret_db_pass}@localhost:5432/db"), \
         patch("app.api.v1.endpoints.system.check_openai_health", return_value=True):

        response = client.get("/api/v1/system/ai-status")
        raw_text = response.text

        # Khẳng định các secrets không bao giờ xuất hiện trong response
        assert secret_openai_key not in raw_text
        assert secret_gemini_key not in raw_text
        assert secret_db_pass not in raw_text
        assert "password" not in raw_text.lower()
        assert "authorization" not in raw_text.lower()
        assert "bearer" not in raw_text.lower()


def test_ai_status_zero_llm_token_generation(client):
    """
    KIỂM THỬ KHÔNG TIÊU TỐN TOKEN / CHI PHÍ:
    Endpoint /ai-status tuyệt đối không được gọi OpenAI chat completions hay LLM analyze.
    """
    with patch.object(settings, "LLM_PROVIDER", "openai"), \
         patch.object(settings, "OPENAI_API_KEY", "sk-proj-test1234567890"), \
         patch("app.api.v1.endpoints.system.check_openai_health", return_value=True), \
         patch("app.services.llm_client.OpenAILLMClient.analyze") as mock_analyze:

        response = client.get("/api/v1/system/ai-status")
        assert response.status_code == 200
        # Khẳng định không có bất kỳ cuộc gọi analyze nào được thực hiện
        mock_analyze.assert_not_called()
