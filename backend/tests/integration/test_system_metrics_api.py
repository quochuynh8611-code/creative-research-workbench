"""
test_system_metrics_api.py — Integration tests cho Internal Telemetry API (Batch C32).

Kiểm tra:
1. GET /api/v1/system/metrics trả về 200 OK với schema chuẩn.
2. Chỉ chứa 4 endpoint ưu tiên.
3. Cập nhật số liệu sau khi gọi các endpoint ưu tiên.
4. Bảo mật: Zero Secret Leakage và không chứa request/response body.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.metrics import metrics_collector
from app.main import app


@pytest.fixture
def client():
    # Reset metrics collector trước mỗi test
    metrics_collector.reset()
    return TestClient(app, raise_server_exceptions=False)


def test_get_system_metrics_returns_200_and_expected_structure(client):
    response = client.get("/api/v1/system/metrics")
    assert response.status_code == 200

    payload = response.json()
    assert "data" in payload
    data = payload["data"]

    assert "uptime_seconds" in data
    assert "tracked_endpoints" in data
    assert "ai_coach" in data

    tracked = data["tracked_endpoints"]
    assert set(tracked.keys()) == {"health", "sessions", "ai_status", "coach_suggestions"}


def test_get_system_metrics_updates_after_priority_requests(client):
    # Gọi /health 3 lần
    client.get("/health")
    client.get("/health")
    client.get("/health")

    # Gọi /api/v1/system/ai-status 2 lần
    client.get("/api/v1/system/ai-status")
    client.get("/api/v1/system/ai-status")

    response = client.get("/api/v1/system/metrics")
    assert response.status_code == 200

    data = response.json()["data"]
    health_metrics = data["tracked_endpoints"]["health"]
    ai_status_metrics = data["tracked_endpoints"]["ai_status"]

    assert health_metrics["total_requests"] == 3
    assert health_metrics["status_counts"]["2xx"] == 3

    assert ai_status_metrics["total_requests"] == 2
    assert ai_status_metrics["status_counts"]["2xx"] == 2


def test_get_system_metrics_zero_secret_leak(client):
    # Gọi AI Coach hoặc simulate fallback
    metrics_collector.record_coach_call(
        provenance="rule_based_fallback",
        latency_ms=45.0,
        fallback_reason="Invalid key sk-proj-supersecret1234567890",
    )

    response = client.get("/api/v1/system/metrics")
    raw_text = response.text

    assert "sk-proj-supersecret1234567890" not in raw_text
    assert "Bearer" not in raw_text
    assert "password" not in raw_text
