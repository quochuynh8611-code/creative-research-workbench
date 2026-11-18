"""
test_correlation_id_middleware.py — Integration tests cho Correlation ID Middleware (Batch C32).

Kiểm tra:
1. Trích xuất và bảo toàn X-Request-ID / X-Correlation-ID từ client.
2. Tự sinh UUID4 khi client không gửi header.
3. Luôn trả về header trong HTTP response kể cả khi gặp lỗi 500.
"""
from __future__ import annotations

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

from app.main import app

# Định nghĩa route giả lập lỗi 500 nếu chưa tồn tại
_test_crash_router = APIRouter()


@_test_crash_router.get("/crash-test-endpoint")
async def trigger_crash_endpoint():
    raise RuntimeError("Simulated internal server crash with sensitive token_abc123")


app.include_router(_test_crash_router, prefix="/api/v1/test-middleware")


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


def test_middleware_propagates_incoming_request_id(client):
    custom_id = "custom-req-trace-abc-123"
    response = client.get("/health", headers={"X-Request-ID": custom_id})

    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == custom_id
    assert response.headers.get("X-Correlation-ID") == custom_id


def test_middleware_generates_uuid4_when_missing(client):
    response = client.get("/health")

    assert response.status_code == 200
    req_id = response.headers.get("X-Request-ID")
    assert req_id is not None
    assert len(req_id) >= 16
    assert response.headers.get("X-Correlation-ID") == req_id


def test_correlation_id_present_in_error_responses(client):
    custom_id = "error-trace-xyz-789"
    response = client.get(
        "/api/v1/test-middleware/crash-test-endpoint",
        headers={"X-Request-ID": custom_id},
    )

    assert response.status_code == 500
    assert response.headers.get("X-Request-ID") == custom_id
    assert response.headers.get("X-Correlation-ID") == custom_id

    # Đảm bảo response an toàn không lộ stack trace
    payload = response.json()
    assert payload["detail"] == "Internal server error. Please try again later."
    assert "error_id" in payload
