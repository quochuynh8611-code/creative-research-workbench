"""
test_llm_clients.py — Unit tests cho LLMClient polymorphic factory, parser, validation, và fallback (Phase 6.2)
"""
from __future__ import annotations

import json
import pytest
from unittest.mock import MagicMock, patch

from app.core.config import settings
from app.services.llm_client import (
    LLMAnalysisOutput,
    LLMClient,
    MockLLMClient,
    OpenAILLMClient,
    GeminiLLMClient,
    get_llm_client,
    extract_json_block,
)
from app.services.ai_analysis_service import (
    AIAnalysisService,
    AIProblemAnalysisResult,
    PROMPT_VERSION,
)


def test_mock_llm_client_returns_structured_output():
    client = MockLLMClient()
    result = client.analyze(
        raw_statement="Tăng tốc độ làm tăng nhiệt độ của vòng bi",
        domain="mechanical",
    )
    assert isinstance(result, LLMAnalysisOutput)
    assert result.contradiction_type in {"technical", "physical", "none", "unknown"}
    assert result.improving_parameter == "speed"
    assert result.worsening_parameter == "temperature"
    assert len(result.suggested_keywords) > 0
    assert result.reasoning != ""


def test_extract_json_block_standard():
    raw = '{"normalized_statement": "abc", "contradiction_type": "technical"}'
    parsed = extract_json_block(raw)
    assert parsed["contradiction_type"] == "technical"
    assert parsed["normalized_statement"] == "abc"


def test_extract_json_block_with_markdown_fences():
    raw = '''Here is the analysis:
```json
{
  "normalized_statement": "Mâu thuẫn kỹ thuật: tốc độ vs nhiệt độ",
  "contradiction_type": "technical",
  "improving_parameter": "speed",
  "worsening_parameter": "temperature",
  "suggested_keywords": ["tốc độ", "nhiệt độ"],
  "reasoning": "Tăng tốc độ sinh nhiệt ma sát."
}
```
Hope this helps!'''
    parsed = extract_json_block(raw)
    assert parsed["contradiction_type"] == "technical"
    assert parsed["improving_parameter"] == "speed"
    assert parsed["worsening_parameter"] == "temperature"


def test_extract_json_block_malformed_raises_value_error():
    raw = "This is not a JSON document at all."
    with pytest.raises(ValueError, match="No valid JSON"):
        extract_json_block(raw)


@patch("app.services.llm_client.OpenAI")
def test_openai_llm_client_success(mock_openai_cls):
    mock_instance = MagicMock()
    mock_openai_cls.return_value = mock_instance

    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps({
        "normalized_statement": "Mâu thuẫn: Tốc độ vs Nhiệt độ",
        "domain": "mechanical",
        "contradiction_type": "technical",
        "improving_parameter": "speed",
        "worsening_parameter": "temperature",
        "suggested_keywords": ["động cơ", "vòng bi"],
        "reasoning": "Ma sát tăng theo vận tốc.",
    })
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]
    mock_instance.chat.completions.create.return_value = mock_completion

    client = OpenAILLMClient(api_key="test-key", model_name="gpt-4o-mini")
    res = client.analyze("Tăng tốc độ làm nóng máy", domain="mechanical")

    assert res.contradiction_type == "technical"
    assert res.improving_parameter == "speed"
    assert res.worsening_parameter == "temperature"
    assert "động cơ" in res.suggested_keywords


@patch("httpx.Client.post")
def test_gemini_llm_client_success(mock_post):
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "normalized_statement": "Mâu thuẫn: Tốc độ vs Nhiệt độ",
                                "domain": "mechanical",
                                "contradiction_type": "technical",
                                "improving_parameter": "speed",
                                "worsening_parameter": "temperature",
                                "suggested_keywords": ["tản nhiệt"],
                                "reasoning": "Phân tích từ Gemini.",
                            })
                        }
                    ]
                }
            }
        ]
    }
    mock_post.return_value = mock_resp

    client = GeminiLLMClient(api_key="test-key", model_name="gemini-1.5-flash")
    res = client.analyze("Tăng tốc độ làm nóng máy", domain="mechanical")

    assert res.contradiction_type == "technical"
    assert res.improving_parameter == "speed"
    assert res.suggested_keywords == ["tản nhiệt"]


def test_factory_get_llm_client_providers():
    assert isinstance(get_llm_client("mock"), MockLLMClient)
    assert isinstance(get_llm_client("openai", api_key="dummy"), OpenAILLMClient)
    assert isinstance(get_llm_client("gemini", api_key="dummy"), GeminiLLMClient)


def test_ai_analysis_service_invalid_parameter_sets_none():
    """Nếu LLM hallucinate một thông số không có trong 39 TRIZ parameters -> set None."""
    mock_client = MagicMock(spec=LLMClient)
    mock_client.provider_name = "mock"
    mock_client.model_name = "mock-model"
    mock_client.analyze.return_value = LLMAnalysisOutput(
        normalized_statement="Statement",
        domain="physics",
        contradiction_type="technical",
        improving_parameter="invented_magic_parameter",  # Invalid TRIZ parameter
        worsening_parameter="temperature",               # Valid TRIZ parameter
        suggested_keywords=["test"],
        reasoning="Test reasoning",
    )

    service = AIAnalysisService(llm_client=mock_client)
    result = service.analyze_problem(raw_statement="Test statement", domain="physics")

    assert result.provenance == "ai_hypothesis"
    assert result.improving_parameter is None  # Must be sanitized to None!
    assert result.worsening_parameter == "temperature"
    assert result.fallback_reason is None


def test_ai_analysis_service_fallback_on_exception():
    """Khi LLM client ném ngoại lệ -> Tự động fallback sang Rule-based analysis."""
    mock_client = MagicMock(spec=LLMClient)
    mock_client.provider_name = "openai"
    mock_client.model_name = "gpt-4o-mini"
    mock_client.analyze.side_effect = RuntimeError("OpenAI API rate limit 429")

    service = AIAnalysisService(llm_client=mock_client)
    result = service.analyze_problem(
        raw_statement="Tăng tốc độ làm giảm độ bền của kết cấu",
        domain="mechanical",
    )

    assert result.provenance == "rule_based_fallback"
    assert "OpenAI API rate limit 429" in (result.fallback_reason or "")
    assert result.contradiction_type == "technical"
    assert result.improving_parameter == "speed"
    assert result.worsening_parameter == "strength"
    assert result.prompt_version == PROMPT_VERSION


def test_ai_analysis_service_invalid_contradiction_type_sanitizes_to_unknown():
    mock_client = MagicMock(spec=LLMClient)
    mock_client.provider_name = "mock"
    mock_client.model_name = "mock-model"
    mock_client.analyze.return_value = LLMAnalysisOutput(
        normalized_statement="Statement",
        domain="physics",
        contradiction_type="invalid_type_enum",
        improving_parameter="speed",
        worsening_parameter="temperature",
        suggested_keywords=["test"],
        reasoning="Test reasoning",
    )

    service = AIAnalysisService(llm_client=mock_client)
    result = service.analyze_problem(raw_statement="Test statement", domain="physics")

    assert result.provenance == "ai_hypothesis"
    assert result.contradiction_type == "unknown"


@patch("app.services.llm_client.OpenAI")
def test_openai_llm_client_retry_exhaustion_raises(mock_openai_cls):
    mock_instance = MagicMock()
    mock_openai_cls.return_value = mock_instance
    mock_instance.chat.completions.create.side_effect = TimeoutError("Request timed out")

    client = OpenAILLMClient(api_key="test-key", max_retries=1)
    with patch("time.sleep"):  # Fast execution in test
        with pytest.raises(RuntimeError, match="exhausted 2 attempts"):
            client.analyze("Test statement")


@patch("httpx.Client.post")
def test_gemini_llm_client_retry_exhaustion_raises(mock_post):
    mock_post.side_effect = TimeoutError("Connection timed out")

    client = GeminiLLMClient(api_key="test-key", max_retries=1)
    with patch("time.sleep"):
        with pytest.raises(RuntimeError, match="exhausted 2 attempts"):
            client.analyze("Test statement")
