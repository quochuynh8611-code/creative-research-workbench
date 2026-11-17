"""
test_ollama_llm_client.py — Unit tests cho OllamaLLMClient (Batch C30)

Kiểm tra:
1. Khởi tạo client với cấu hình URL và model name hợp lệ.
2. Phân tích bài toán thành công qua mock REST response của Ollama.
3. Fallback an toàn về MockLLMClient khi Ollama daemon không khả dụng.
4. get_llm_client factory trả về OllamaLLMClient khi provider='ollama'.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services.llm_client import (
    LLMAnalysisOutput,
    OllamaLLMClient,
    get_llm_client,
)


def test_ollama_llm_client_initialization():
    client = OllamaLLMClient(
        base_url="http://localhost:11434",
        model_name="llama3.2",
        timeout=5.0,
        max_retries=1,
    )
    assert client.provider_name == "ollama"
    assert client.model_name == "llama3.2"
    assert client.base_url == "http://localhost:11434"
    assert client.timeout == 5.0
    assert client.max_retries == 1


@patch("httpx.Client.post")
def test_ollama_llm_client_analyze_success(mock_post):
    mock_response_payload = {
        "response": json.dumps({
            "normalized_statement": "Mâu thuẫn: Tốc độ xử lý vs Độ chính xác",
            "domain": "software",
            "contradiction_type": "technical",
            "improving_parameter": "speed",
            "worsening_parameter": "accuracy",
            "suggested_keywords": ["latency", "cache", "batching"],
            "reasoning": "Tối ưu hóa thời gian thực làm giảm độ chính xác tính toán sâu.",
        })
    }
    mock_post.return_value = MagicMock(
        status_code=200,
        json=MagicMock(return_value=mock_response_payload),
        raise_for_status=MagicMock(),
    )

    client = OllamaLLMClient(base_url="http://localhost:11434", model_name="llama3.2")
    result = client.analyze(
        raw_statement="Muốn tăng tốc độ phản hồi nhưng sợ giảm độ chính xác",
        domain="software",
    )

    assert isinstance(result, LLMAnalysisOutput)
    assert result.contradiction_type == "technical"
    assert result.improving_parameter == "speed"
    assert result.worsening_parameter == "accuracy"
    assert "cache" in result.suggested_keywords
    assert mock_post.called


@patch("httpx.Client.post")
def test_ollama_llm_client_fallback_to_mock_on_connection_error(mock_post):
    mock_post.side_effect = httpx.ConnectError("Connection refused to Ollama daemon on port 11434")

    client = OllamaLLMClient(
        base_url="http://localhost:11434",
        model_name="llama3.2",
        max_retries=1,
        fallback_on_error=True,
    )

    # Khi daemon chết, không sập mà trả về kết quả từ MockLLMClient
    result = client.analyze(
        raw_statement="Tăng tốc độ làm nóng máy",
        domain="mechanical",
    )

    assert isinstance(result, LLMAnalysisOutput)
    assert result.improving_parameter == "speed"
    assert result.worsening_parameter == "temperature"


@patch("httpx.Client.post")
def test_ollama_llm_client_raises_when_fallback_disabled(mock_post):
    mock_post.side_effect = httpx.ConnectError("Connection refused")

    client = OllamaLLMClient(
        base_url="http://localhost:11434",
        model_name="llama3.2",
        max_retries=0,
        fallback_on_error=False,
    )

    with pytest.raises(RuntimeError, match="exhausted"):
        client.analyze("Bài toán thử nghiệm", domain="general")


def test_get_llm_client_factory_returns_ollama():
    client = get_llm_client(
        provider="ollama",
        model_name="qwen2.5",
    )
    assert isinstance(client, OllamaLLMClient)
    assert client.provider_name == "ollama"
    assert client.model_name == "qwen2.5"
