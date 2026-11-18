"""
test_metrics_collector.py — Unit tests cho In-Memory Metrics Collector (Batch C32).

Kiểm tra:
1. Chỉ track 4 endpoint ưu tiên (/health, /api/v1/sessions, /api/v1/system/ai-status, /api/v1/sessions/{id}/coach/suggestions).
2. Không track các route khác.
3. Giới hạn rolling buffer 1000 samples/endpoint.
4. Tính toán quantiles (p50, p95, p99) và error rate chính xác.
5. Telemetry cho AI Coach (fallback rate, fallback reasons, latency).
6. Zero secret leakage và không lưu trữ body.
"""
from __future__ import annotations

from app.core.metrics import InMemoryMetricsCollector


def test_collector_only_tracks_priority_endpoints():
    collector = InMemoryMetricsCollector()

    # Track 4 priority endpoints
    collector.record_request("GET", "/health", 200, 5.0)
    collector.record_request("GET", "/api/v1/sessions", 200, 15.0)
    collector.record_request("GET", "/api/v1/system/ai-status", 200, 25.0)
    collector.record_request(
        "POST",
        "/api/v1/sessions/41dd5318-db46-420a-b8e2-d488df3d1f67/coach/suggestions",
        200,
        45.0,
    )

    # Track an unprioritized endpoint — should be ignored
    collector.record_request("GET", "/api/v1/random-untracked-route", 200, 10.0)
    collector.record_request("GET", "/docs", 200, 8.0)

    summary = collector.get_summary()
    tracked = summary["tracked_endpoints"]

    assert set(tracked.keys()) == {"health", "sessions", "ai_status", "coach_suggestions"}
    assert tracked["health"]["total_requests"] == 1
    assert tracked["sessions"]["total_requests"] == 1
    assert tracked["ai_status"]["total_requests"] == 1
    assert tracked["coach_suggestions"]["total_requests"] == 1


def test_collector_rolling_buffer_maxlen_1000():
    collector = InMemoryMetricsCollector()

    # Thêm 1050 samples vào /health
    for i in range(1050):
        collector.record_request("GET", "/health", 200, float(i))

    summary = collector.get_summary()
    health_metrics = summary["tracked_endpoints"]["health"]

    assert health_metrics["total_requests"] == 1050
    assert health_metrics["samples_in_buffer"] == 1000
    # Mẫu cũ nhất bị drop, min trong buffer là 50.0
    assert health_metrics["latency_ms"]["min"] == 50.0
    assert health_metrics["latency_ms"]["max"] == 1049.0


def test_collector_calculates_quantiles_and_error_rate():
    collector = InMemoryMetricsCollector()

    # 95 requests 200 (latency 10ms..104ms) và 5 requests 500 (latency 200ms)
    for i in range(95):
        collector.record_request("GET", "/health", 200, 10.0 + i)
    for _ in range(5):
        collector.record_request("GET", "/health", 500, 200.0)

    summary = collector.get_summary()
    health_metrics = summary["tracked_endpoints"]["health"]

    assert health_metrics["total_requests"] == 100
    assert health_metrics["status_counts"]["2xx"] == 95
    assert health_metrics["status_counts"]["5xx"] == 5
    assert health_metrics["error_rate_pct"] == 5.0
    assert health_metrics["latency_ms"]["p50"] > 0
    assert health_metrics["latency_ms"]["p95"] > health_metrics["latency_ms"]["p50"]
    assert health_metrics["latency_ms"]["p99"] >= health_metrics["latency_ms"]["p95"]


def test_collector_tracks_coach_fallback_and_reasons():
    collector = InMemoryMetricsCollector()

    collector.record_coach_call(provenance="ai_coach", latency_ms=30.0)
    collector.record_coach_call(provenance="ai_coach", latency_ms=40.0)
    collector.record_coach_call(
        provenance="rule_based_fallback",
        latency_ms=15.0,
        fallback_reason="LLMTimeout: Request timed out after 10s",
    )

    summary = collector.get_summary()
    coach_metrics = summary["ai_coach"]

    assert coach_metrics["total_calls"] == 3
    assert coach_metrics["fallback_calls"] == 1
    assert round(coach_metrics["fallback_rate_pct"], 2) == 33.33
    assert "LLMTimeout" in coach_metrics["fallback_reasons"]
    assert coach_metrics["latency_ms"]["p50"] > 0


def test_collector_summary_has_zero_secrets_and_no_body():
    collector = InMemoryMetricsCollector()
    collector.record_coach_call(
        provenance="rule_based_fallback",
        latency_ms=25.0,
        fallback_reason="Error with sk-proj-1234567890abcdef and password='secret_pwd'",
    )

    raw_text = str(collector.get_summary())
    assert "sk-proj-1234567890abcdef" not in raw_text
    assert "secret_pwd" not in raw_text
    assert "body" not in raw_text
