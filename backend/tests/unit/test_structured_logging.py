"""
test_structured_logging.py — Unit tests cho Structured JSON Logging & Masking (Batch C32).

Kiểm tra:
1. Định dạng JSON chuẩn kèm timestamp UTC ISO, correlation_id từ ContextVar.
2. Masking chặt chẽ mọi bí mật: sk-proj, Bearer, password, token, api_key.
3. Không làm lộ stack trace không an toàn hoặc chuỗi nhạy cảm khi có exception.
"""
from __future__ import annotations

import json
import logging

from app.core.logging import (
    StructuredJsonFormatter,
    correlation_id_ctx,
    mask_sensitive_data,
)


def test_mask_sensitive_data_masks_api_keys_and_tokens():
    text = (
        "Calling OpenAI with key sk-proj-1234567890abcdefABCDEF12345 "
        "and header Bearer my-secret-jwt-token-123. "
        "Config contains password='supersecretpass123' and api_key=\"topsecretkey456\"."
    )
    masked = mask_sensitive_data(text)

    assert "sk-proj-1234567890abcdefABCDEF12345" not in masked
    assert "sk-proj-***[MASKED]***" in masked

    assert "my-secret-jwt-token-123" not in masked
    assert "Bearer ***[MASKED]***" in masked

    assert "supersecretpass123" not in masked
    assert "topsecretkey456" not in masked


def test_structured_json_formatter_formats_required_fields():
    formatter = StructuredJsonFormatter()
    token = correlation_id_ctx.set("test-corr-id-999")

    try:
        record = logging.LogRecord(
            name="app.services.ai_coach_service",
            level=logging.INFO,
            pathname="/app/src/app/services/ai_coach_service.py",
            lineno=42,
            msg="AI Coach generated suggestions successfully with token=secret123",
            args=(),
            exc_info=None,
            func="generate_coach_suggestions",
        )
        formatted = formatter.format(record)
        payload = json.loads(formatted)

        assert payload["level"] == "INFO"
        assert payload["logger"] == "app.services.ai_coach_service"
        assert payload["function"] == "generate_coach_suggestions"
        assert payload["correlation_id"] == "test-corr-id-999"
        assert "timestamp" in payload
        assert "secret123" not in payload["message"]
        assert "***[MASKED]***" in payload["message"]
    finally:
        correlation_id_ctx.reset(token)


def test_structured_json_formatter_masks_exception_info():
    formatter = StructuredJsonFormatter()

    try:
        raise ValueError("Database connection failed for user=admin password='db_secret_pwd'")
    except ValueError as exc:
        record = logging.LogRecord(
            name="app.main",
            level=logging.ERROR,
            pathname="/app/src/app/main.py",
            lineno=99,
            msg="Exception caught in handler",
            args=(),
            exc_info=(type(exc), exc, exc.__traceback__),
            func="global_exception_handler",
        )
        formatted = formatter.format(record)
        payload = json.loads(formatted)

        assert payload["level"] == "ERROR"
        assert "db_secret_pwd" not in formatted
        assert "***[MASKED]***" in formatted
