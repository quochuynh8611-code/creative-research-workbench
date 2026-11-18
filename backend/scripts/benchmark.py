#!/usr/bin/env python3
"""Local Benchmark Suite & Load Testing Runner for Creative Research Workbench (Batch C32).

This script provides sandboxed, low-impact benchmarking for 4 priority endpoints:
1. GET /health
2. GET /api/v1/sessions
3. GET /api/v1/system/ai-status
4. POST /api/v1/sessions/{id}/coach/suggestions

Strict safety constraints:
- Concurrency <= 10.
- Total requests <= 100.
- Anti-Production Guard: only runs against localhost / 127.0.0.1 / 0.0.0.0 / testserver.
- Zero secret leak in outputs (table and JSON).
- Informational SLO baselines (warnings only, no hard gate failure).
"""

import argparse
import asyncio
import json
import math
import re
import sys
import time
from typing import Any
from urllib.parse import urlparse

import httpx

ALLOWED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "testserver"}
MAX_CONCURRENCY = 10
MAX_REQUESTS = 100
VALID_ENDPOINTS = {"all", "health", "sessions", "ai_status", "coach"}
VALID_OUTPUT_FORMATS = {"table", "json"}

SLO_INFORMATIONAL_BASELINES = {
    "health": {"p95_ms": 25.0, "error_rate_pct": 0.0, "path": "/health"},
    "sessions": {"p95_ms": 100.0, "error_rate_pct": 0.0, "path": "/api/v1/sessions"},
    "ai_status": {"p95_ms": 50.0, "error_rate_pct": 0.0, "path": "/api/v1/system/ai-status"},
    "coach": {"p95_ms": 200.0, "error_rate_pct": 0.0, "path": "/api/v1/sessions/{id}/coach/suggestions"},
}

# Secret masking patterns
SECRET_PATTERNS = [
    re.compile(r"sk-[a-zA-Z0-9_\-]{20,}", re.IGNORECASE),
    re.compile(r"Bearer\s+([a-zA-Z0-9_\-\.]+)", re.IGNORECASE),
    re.compile(r"(password|token|api_key|secret)\s*[:=]\s*(?:['\"][^'\"]+['\"]|[^\s,;]+)", re.IGNORECASE),
]


def mask_secrets_in_text(text: str) -> str:
    """Mask any sensitive tokens or secrets in text output."""
    masked = text
    # Mask OpenAI / API keys
    masked = re.sub(r"sk-[a-zA-Z0-9_\-]{10,}", "sk-proj-***[MASKED]***", masked)
    # Mask Bearer tokens
    masked = re.sub(r"(Bearer\s+)[a-zA-Z0-9_\-\.]+", r"\1***[MASKED]***", masked)
    # Mask password/token fields
    masked = re.sub(
        r"((?:password|token|api_key|secret)\s*[:=]\s*)(?:['\"][^'\"]+['\"]|[^\s,;]+)",
        r"\1***[MASKED]***",
        masked,
        flags=re.IGNORECASE,
    )
    return masked


def validate_benchmark_params(
    base_url: str,
    concurrency: int,
    requests: int,
    endpoint: str = "all",
    output_format: str = "table",
) -> dict[str, Any]:
    """Validate input parameters and enforce Anti-Production and safety limits."""
    # 1. Validate Concurrency
    if concurrency < 1:
        raise ValueError("Concurrency must be at least 1")
    if concurrency > MAX_CONCURRENCY:
        raise ValueError(
            f"Concurrency cannot exceed {MAX_CONCURRENCY} (got {concurrency}). "
            "This benchmark is strictly for local sandbox profiling."
        )

    # 2. Validate Requests count
    if requests < 1:
        raise ValueError("Total requests must be at least 1")
    if requests > MAX_REQUESTS:
        raise ValueError(
            f"Total requests cannot exceed {MAX_REQUESTS} (got {requests}). "
            "This benchmark is strictly for local sandbox profiling."
        )

    # 3. Validate Endpoint
    if endpoint not in VALID_ENDPOINTS:
        raise ValueError(f"Unsupported endpoint '{endpoint}'. Must be one of {sorted(VALID_ENDPOINTS)}")

    # 4. Validate Output format
    if output_format not in VALID_OUTPUT_FORMATS:
        raise ValueError(f"Unsupported output format '{output_format}'. Must be one of {sorted(VALID_OUTPUT_FORMATS)}")

    # 5. Anti-Production Guard
    parsed = urlparse(base_url)
    hostname = parsed.hostname or ""

    # Check if host is allowed
    if hostname.lower() not in ALLOWED_HOSTS:
        raise ValueError(
            f"Anti-Production Guard: Host '{hostname}' is not permitted. "
            f"Benchmark only allowed against localhost/sandbox environments ({sorted(ALLOWED_HOSTS)})."
        )

    return {
        "base_url": base_url.rstrip("/"),
        "concurrency": concurrency,
        "requests": requests,
        "endpoint": endpoint,
        "output_format": output_format,
    }


def compute_benchmark_stats(
    endpoint: str,
    latencies: list[float],
    success_count: int,
    failure_count: int,
    total_duration_sec: float,
) -> dict[str, Any]:
    """Calculate statistical quantiles (p50, p90, p95, p99), mean, min, max, throughput, and error rate."""
    total_requests = success_count + failure_count
    error_rate = (failure_count / total_requests * 100.0) if total_requests > 0 else 0.0
    throughput = (total_requests / total_duration_sec) if total_duration_sec > 0 else 0.0

    if not latencies:
        return {
            "endpoint": endpoint,
            "total_requests": total_requests,
            "successful_requests": success_count,
            "failed_requests": failure_count,
            "error_rate_pct": round(error_rate, 2),
            "throughput_rps": round(throughput, 2),
            "min_ms": 0.0,
            "mean_ms": 0.0,
            "p50_ms": 0.0,
            "p90_ms": 0.0,
            "p95_ms": 0.0,
            "p99_ms": 0.0,
            "max_ms": 0.0,
            "latencies": [],
        }

    sorted_lats = sorted(latencies)
    n = len(sorted_lats)

    def percentile(p: float) -> float:
        if n == 1:
            return sorted_lats[0]
        rank = (p / 100.0) * (n - 1)
        low = math.floor(rank)
        high = math.ceil(rank)
        if low == high:
            return sorted_lats[int(low)]
        weight = rank - low
        return sorted_lats[low] * (1.0 - weight) + sorted_lats[high] * weight

    return {
        "endpoint": endpoint,
        "total_requests": total_requests,
        "successful_requests": success_count,
        "failed_requests": failure_count,
        "error_rate_pct": round(error_rate, 2),
        "throughput_rps": round(throughput, 2),
        "min_ms": round(min(sorted_lats), 2),
        "mean_ms": round(sum(sorted_lats) / n, 2),
        "p50_ms": round(percentile(50.0), 2),
        "p90_ms": round(percentile(90.0), 2),
        "p95_ms": round(percentile(95.0), 2),
        "p99_ms": round(percentile(99.0), 2),
        "max_ms": round(max(sorted_lats), 2),
        "latencies": sorted_lats,
    }


def check_slo_targets(stats: dict[str, Any]) -> list[str]:
    """Check informational SLO baselines and return warning messages if exceeded.

    Does not fail or raise exceptions, keeping benchmark results purely informational.
    """
    endpoint_key = stats.get("endpoint", "")
    # Normalize endpoint key
    normalized_key = endpoint_key
    for key, baseline in SLO_INFORMATIONAL_BASELINES.items():
        if baseline["path"] == endpoint_key or key == endpoint_key:
            normalized_key = key
            break

    baseline = SLO_INFORMATIONAL_BASELINES.get(normalized_key)
    if not baseline:
        return []

    warnings = []
    p95 = stats.get("p95_ms", 0.0)
    error_rate = stats.get("error_rate_pct", 0.0)

    if p95 > baseline["p95_ms"]:
        warnings.append(
            f"Latency p95 ({p95}ms) exceeded informational baseline ({baseline['p95_ms']}ms)"
        )
    if error_rate > baseline["error_rate_pct"]:
        warnings.append(
            f"Error rate ({error_rate}%) exceeded informational baseline ({baseline['error_rate_pct']}%)"
        )

    return warnings


def format_benchmark_table(results: list[dict[str, Any]]) -> str:
    """Format benchmark results into a clean ASCII table with masked secrets."""
    headers = [
        "Endpoint",
        "Reqs",
        "Success",
        "Fail",
        "Err%",
        "RPS",
        "min",
        "p50",
        "p90",
        "p95",
        "p99",
        "max",
        "SLO Status",
    ]
    rows = []
    for r in results:
        warnings = check_slo_targets(r)
        slo_status = "WARN: " + "; ".join(warnings) if warnings else "PASS (within baseline)"
        rows.append([
            str(r.get("endpoint", "")),
            str(r.get("total_requests", 0)),
            str(r.get("successful_requests", 0)),
            str(r.get("failed_requests", 0)),
            f"{r.get('error_rate_pct', 0.0):.1f}%",
            f"{r.get('throughput_rps', 0.0):.1f}",
            f"{r.get('min_ms', 0.0):.1f}ms",
            f"{r.get('p50_ms', 0.0):.1f}ms",
            f"{r.get('p90_ms', 0.0):.1f}ms",
            f"{r.get('p95_ms', 0.0):.1f}ms",
            f"{r.get('p99_ms', 0.0):.1f}ms",
            f"{r.get('max_ms', 0.0):.1f}ms",
            slo_status,
        ])

    # Calculate column widths
    col_widths = [len(h) for h in headers]
    for row in rows:
        for idx, val in enumerate(row):
            col_widths[idx] = max(col_widths[idx], len(val))

    def make_row(items: list[str]) -> str:
        padded = [item.ljust(col_widths[i]) for i, item in enumerate(items)]
        return "| " + " | ".join(padded) + " |"

    separator = "+-" + "-+-".join(["-" * w for w in col_widths]) + "-+"

    lines = [
        separator,
        make_row(headers),
        separator,
    ]
    for row in rows:
        lines.append(make_row(row))
    lines.append(separator)

    raw_table = "\n".join(lines)
    return mask_secrets_in_text(raw_table)


def format_benchmark_json(results: list[dict[str, Any]]) -> str:
    """Format benchmark results into clean, masked JSON string."""
    clean_results = []
    for r in results:
        warnings = check_slo_targets(r)
        copy_r = {k: v for k, v in r.items() if k != "latencies"}
        copy_r["slo_warnings"] = warnings
        copy_r["slo_status"] = "WARN" if warnings else "PASS"
        clean_results.append(copy_r)

    raw_json = json.dumps(clean_results, indent=2)
    return mask_secrets_in_text(raw_json)


async def run_single_request(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    semaphore: asyncio.Semaphore,
    json_body: dict[str, Any] | None = None,
) -> tuple[bool, float]:
    """Execute a single HTTP request under concurrency semaphore and measure duration in ms."""
    async with semaphore:
        start = time.perf_counter()
        try:
            if method.upper() == "POST":
                resp = await client.post(path, json=json_body or {})
            else:
                resp = await client.get(path)
            duration_ms = (time.perf_counter() - start) * 1000.0
            is_success = resp.status_code < 400
            return is_success, duration_ms
        except Exception:  # noqa: BLE001
            duration_ms = (time.perf_counter() - start) * 1000.0
            return False, duration_ms


async def fetch_available_session_id(client: httpx.AsyncClient) -> str | None:
    """Fetch an existing session ID from GET /api/v1/sessions to safely benchmark Coach."""
    try:
        resp = await client.get("/api/v1/sessions")
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("items") or data.get("data") or data
            if isinstance(items, list) and len(items) > 0:
                first_item = items[0]
                return first_item.get("id") or first_item.get("session_id")
    except Exception:  # noqa: BLE001, S110
        pass
    return None


async def run_benchmark_for_endpoint(
    client: httpx.AsyncClient,
    endpoint_key: str,
    requests_count: int,
    concurrency: int,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Execute benchmark against a specific endpoint key."""
    semaphore = asyncio.Semaphore(concurrency)

    # Resolve path, method, and body
    if endpoint_key == "health":
        method = "GET"
        path = "/health"
        body = None
    elif endpoint_key == "sessions":
        method = "GET"
        path = "/api/v1/sessions"
        body = None
    elif endpoint_key == "ai_status":
        method = "GET"
        path = "/api/v1/system/ai-status"
        body = None
    elif endpoint_key == "coach":
        if not session_id:
            # Skip if no session is available
            return {
                "endpoint": "/api/v1/sessions/{id}/coach/suggestions",
                "total_requests": 0,
                "successful_requests": 0,
                "failed_requests": 0,
                "error_rate_pct": 0.0,
                "throughput_rps": 0.0,
                "min_ms": 0.0,
                "mean_ms": 0.0,
                "p50_ms": 0.0,
                "p90_ms": 0.0,
                "p95_ms": 0.0,
                "p99_ms": 0.0,
                "max_ms": 0.0,
                "latencies": [],
                "notes": "SKIPPED: Không có session_id nào khả dụng trong sandbox để test Coach.",
            }
        method = "POST"
        path = f"/api/v1/sessions/{session_id}/coach/suggestions"
        body = {"grounding_note_ids": []}
    else:
        raise ValueError(f"Unknown endpoint key '{endpoint_key}'")

    overall_start = time.perf_counter()
    tasks = [
        run_single_request(client, method, path, semaphore, body)
        for _ in range(requests_count)
    ]
    results = await asyncio.gather(*tasks)
    overall_duration = time.perf_counter() - overall_start

    latencies: list[float] = []
    successes = 0
    failures = 0

    for is_success, dur_ms in results:
        latencies.append(dur_ms)
        if is_success:
            successes += 1
        else:
            failures += 1

    return compute_benchmark_stats(
        endpoint=path,
        latencies=latencies,
        success_count=successes,
        failure_count=failures,
        total_duration_sec=overall_duration,
    )


async def main_async(args: argparse.Namespace) -> int:
    """Async main runner."""
    params = validate_benchmark_params(
        base_url=args.base_url,
        concurrency=args.concurrency,
        requests=args.requests,
        endpoint=args.endpoint,
        output_format=args.output,
    )

    base_url = params["base_url"]
    concurrency = params["concurrency"]
    requests_count = params["requests"]
    target_endpoint = params["endpoint"]
    output_fmt = params["output_format"]

    endpoints_to_run = (
        ["health", "sessions", "ai_status", "coach"]
        if target_endpoint == "all"
        else [target_endpoint]
    )

    print(
        f"\n[BENCHMARK] Starting local load testing suite...\n"
        f"  Target:      {base_url}\n"
        f"  Concurrency: {concurrency} workers (max: {MAX_CONCURRENCY})\n"
        f"  Requests:    {requests_count} per endpoint (max: {MAX_REQUESTS})\n"
        f"  Endpoints:   {endpoints_to_run}\n"
        f"  Format:      {output_fmt}\n"
    )

    results: list[dict[str, Any]] = []

    limits = httpx.Limits(max_connections=concurrency + 5, max_keepalive_connections=concurrency)
    timeout = httpx.Timeout(timeout=15.0)

    async with httpx.AsyncClient(base_url=base_url, limits=limits, timeout=timeout) as client:
        # Check if coach endpoint is needed, if so find an available session
        session_id = None
        if "coach" in endpoints_to_run:
            session_id = await fetch_available_session_id(client)
            if not session_id:
                print(
                    "[INFO] Không tìm thấy session nào để benchmark coach endpoint. "
                    "Vui lòng tạo session trước nếu muốn đo endpoint này."
                )

        for ep_key in endpoints_to_run:
            stats = await run_benchmark_for_endpoint(
                client=client,
                endpoint_key=ep_key,
                requests_count=requests_count,
                concurrency=concurrency,
                session_id=session_id,
            )
            results.append(stats)

    # Format output
    if output_fmt == "json":
        print(format_benchmark_json(results))
    else:
        print(format_benchmark_table(results))

    print("\n[NOTE] SLO baselines are informational only and do not fail the runner.\n")
    return 0


def main() -> None:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(
        description="Local Benchmark Suite for Creative Research Workbench (Batch C32)"
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="Base URL of local/sandbox backend (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=5,
        help="Number of concurrent workers (default: 5, max: 10)",
    )
    parser.add_argument(
        "--requests",
        type=int,
        default=50,
        help="Total requests per endpoint (default: 50, max: 100)",
    )
    parser.add_argument(
        "--endpoint",
        choices=["all", "health", "sessions", "ai_status", "coach"],
        default="all",
        help="Target endpoint to benchmark (default: all)",
    )
    parser.add_argument(
        "--output",
        choices=["table", "json"],
        default="table",
        help="Output format (default: table)",
    )

    args = parser.parse_args()
    try:
        exit_code = asyncio.run(main_async(args))
        sys.exit(exit_code)
    except ValueError as val_err:
        print(f"\n[ERROR] Validation failed: {val_err}\n", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001
        print(f"\n[ERROR] Unexpected error: {exc}\n", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
