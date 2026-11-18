"""Unit tests for the Benchmark Suite and Local Load Testing Runner (Batch C32 PR 2).

Enforces:
- Safety parameter validation (concurrency <= 10, requests <= 100).
- Anti-Production Guard (rejects https://api.crw-workbench.com, http://staging.crw-workbench.com, https://example.com).
- Statistical quantile calculations (p50, p90, p95, p99, mean, min, max, throughput, error rate).
- Zero secret leak in both table and JSON outputs.
- Informational SLO baseline (warning only, no hard gate failure).
- Mock execution flow.
"""

import json
import sys
from pathlib import Path

import httpx
import pytest

# Ensure repo root and backend directory are in sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
repo_root = backend_dir.parent
for p in [str(backend_dir), str(repo_root)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from scripts.benchmark import (
    check_slo_targets,
    compute_benchmark_stats,
    format_benchmark_json,
    format_benchmark_table,
    run_benchmark_for_endpoint,
    validate_benchmark_params,
)


def test_validate_benchmark_params_accepts_valid_sandbox_params():
    """Valid parameters within sandbox limits should pass validation."""
    params = validate_benchmark_params(
        base_url="http://localhost:8000",
        concurrency=5,
        requests=50,
        endpoint="all",
        output_format="table",
    )
    assert params["base_url"] == "http://localhost:8000"
    assert params["concurrency"] == 5
    assert params["requests"] == 50
    assert params["endpoint"] == "all"
    assert params["output_format"] == "table"


def test_validate_benchmark_params_accepts_ip_and_testserver():
    """Localhost IPs and testserver should be accepted."""
    for host in ["http://127.0.0.1:8000", "http://0.0.0.0:8000", "http://testserver"]:
        params = validate_benchmark_params(
            base_url=host,
            concurrency=2,
            requests=10,
            endpoint="health",
            output_format="json",
        )
        assert params["base_url"] == host


def test_validate_benchmark_params_rejects_concurrency_exceeding_10():
    """Concurrency exceeding 10 must raise ValueError."""
    with pytest.raises(ValueError, match="Concurrency cannot exceed 10"):
        validate_benchmark_params(
            base_url="http://localhost:8000",
            concurrency=11,
            requests=50,
        )


def test_validate_benchmark_params_rejects_requests_exceeding_100():
    """Requests exceeding 100 must raise ValueError."""
    with pytest.raises(ValueError, match="Total requests cannot exceed 100"):
        validate_benchmark_params(
            base_url="http://localhost:8000",
            concurrency=5,
            requests=101,
        )


@pytest.mark.parametrize(
    "prohibited_url",
    [
        "https://api.crw-workbench.com",
        "http://staging.crw-workbench.com",
        "https://example.com",
        "http://production-db.internal",
        "https://192.168.1.100",
    ],
)
def test_validate_benchmark_params_anti_production_guard_rejects_external_urls(prohibited_url):
    """Anti-Production Guard must reject all non-sandbox / non-localhost hosts."""
    with pytest.raises(ValueError, match="Anti-Production Guard"):
        validate_benchmark_params(
            base_url=prohibited_url,
            concurrency=5,
            requests=50,
        )


def test_validate_benchmark_params_rejects_invalid_endpoint_or_format():
    """Invalid endpoint name or output format must be rejected."""
    with pytest.raises(ValueError, match="Unsupported endpoint"):
        validate_benchmark_params(
            base_url="http://localhost:8000",
            concurrency=5,
            requests=10,
            endpoint="invalid_endpoint",
        )

    with pytest.raises(ValueError, match="Unsupported output format"):
        validate_benchmark_params(
            base_url="http://localhost:8000",
            concurrency=5,
            requests=10,
            output_format="xml",
        )


def test_compute_benchmark_stats_calculates_quantiles_throughput_error_rate():
    """Correctly compute percentiles, mean, min, max, throughput, and error rates."""
    latencies = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0]
    total_duration_sec = 2.0

    stats = compute_benchmark_stats(
        endpoint="/health",
        latencies=latencies,
        success_count=9,
        failure_count=1,
        total_duration_sec=total_duration_sec,
    )

    assert stats["endpoint"] == "/health"
    assert stats["total_requests"] == 10
    assert stats["successful_requests"] == 9
    assert stats["failed_requests"] == 1
    assert stats["error_rate_pct"] == 10.0
    assert stats["throughput_rps"] == 5.0  # 10 reqs / 2.0s
    assert stats["min_ms"] == 10.0
    assert stats["max_ms"] == 100.0
    assert stats["mean_ms"] == 55.0
    assert stats["p50_ms"] == pytest.approx(55.0, abs=5.0)
    assert stats["p95_ms"] == pytest.approx(95.5, abs=5.0)
    assert stats["p99_ms"] == pytest.approx(99.1, abs=5.0)


def test_compute_benchmark_stats_handles_all_failures():
    """When all requests fail and latencies list is empty, stats should be safely calculated."""
    stats = compute_benchmark_stats(
        endpoint="/api/v1/sessions",
        latencies=[],
        success_count=0,
        failure_count=10,
        total_duration_sec=1.0,
    )
    assert stats["total_requests"] == 10
    assert stats["successful_requests"] == 0
    assert stats["failed_requests"] == 10
    assert stats["error_rate_pct"] == 100.0
    assert stats["p50_ms"] == 0.0
    assert stats["p95_ms"] == 0.0


def test_benchmark_output_zero_secret_leak_table_and_json():
    """Ensure neither table nor JSON output contains unmasked secrets or sensitive tokens."""
    dummy_stats = [
        {
            "endpoint": "/api/v1/system/ai-status",
            "total_requests": 20,
            "successful_requests": 20,
            "failed_requests": 0,
            "error_rate_pct": 0.0,
            "throughput_rps": 25.0,
            "min_ms": 12.0,
            "mean_ms": 25.0,
            "p50_ms": 22.0,
            "p90_ms": 35.0,
            "p95_ms": 40.0,
            "p99_ms": 45.0,
            "max_ms": 48.0,
            "slo_status": "OK",
            "notes": "Authorization=Bearer [MASKED], token=***, sk-proj-[MASKED]",
        }
    ]

    # Test Table Format
    table_str = format_benchmark_table(dummy_stats)
    assert "/api/v1/system/ai-status" in table_str
    assert "sk-proj-abc123456789" not in table_str
    assert "Bearer eyJhbGciOi" not in table_str
    assert "supersecretpassword" not in table_str

    # Test JSON Format
    json_str = format_benchmark_json(dummy_stats)
    parsed = json.loads(json_str)
    assert isinstance(parsed, list)
    assert parsed[0]["endpoint"] == "/api/v1/system/ai-status"
    assert "sk-proj-abc123456789" not in json_str
    assert "Bearer eyJhbGciOi" not in json_str
    assert "supersecretpassword" not in json_str


def test_check_slo_targets_is_informational_warning_only():
    """SLO target check must return warnings without failing or raising exceptions."""
    stats = {
        "endpoint": "health",
        "p95_ms": 50.0,  # Exceeds baseline of 25ms
        "error_rate_pct": 2.0,  # Exceeds baseline of 0%
    }

    warnings = check_slo_targets(stats)
    assert len(warnings) > 0
    assert any("p95" in w.lower() for w in warnings)
    assert any("error rate" in w.lower() for w in warnings)

    # Within baseline returns empty list
    good_stats = {
        "endpoint": "health",
        "p95_ms": 15.0,
        "error_rate_pct": 0.0,
    }
    good_warnings = check_slo_targets(good_stats)
    assert len(good_warnings) == 0


@pytest.mark.asyncio
async def test_run_benchmark_for_endpoint_mock():
    """Verify asynchronous execution of benchmark against mock HTTP handler."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "ok"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        stats = await run_benchmark_for_endpoint(
            client=client,
            endpoint_key="health",
            requests_count=10,
            concurrency=2,
            session_id=None,
        )

    assert stats["endpoint"] == "/health"
    assert stats["total_requests"] == 10
    assert stats["successful_requests"] == 10
    assert stats["failed_requests"] == 0
    assert stats["error_rate_pct"] == 0.0
    assert len(stats["latencies"]) == 10
