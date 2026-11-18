"""
metrics.py — In-Memory Metrics Collector Subsystem (Batch C32).

Đặc tả vận hành & Giới hạn bắt buộc:
1. Chỉ track chính xác 4 endpoint ưu tiên:
   - health: /health
   - sessions: /api/v1/sessions
   - ai_status: /api/v1/system/ai-status
   - coach_suggestions: /api/v1/sessions/{id}/coach/suggestions
2. Tuyệt đối KHÔNG track các route khác.
3. Mỗi endpoint chỉ duy trì rolling buffer tối đa 1000 samples độ trễ (collections.deque(maxlen=1000)).
4. KHÔNG lưu trữ request body hoặc response body.
5. In-Memory Reset là chấp nhận có chủ đích khi container restart (ADR-013).
6. Hỗ trợ AI Coach telemetry: tổng số lượt gọi, lượt fallback, tỷ lệ fallback %, phân vị độ trễ (p50, p95, p99), và lý do fallback đã được mask secret.
"""
from __future__ import annotations

import collections
import re
import threading
import time
from typing import Any, Optional

from app.core.logging import mask_sensitive_data

# Danh mục 4 endpoint ưu tiên được track
PRIORITY_ENDPOINTS: dict[str, str] = {
    "health": "/health",
    "sessions": "/api/v1/sessions",
    "ai_status": "/api/v1/system/ai-status",
    "coach_suggestions": "/api/v1/sessions/{id}/coach/suggestions",
}

# Regex nhận diện endpoint coach suggestions
_COACH_ROUTE_REGEX = re.compile(r"^/api/v1/sessions/[^/]+/coach/suggestions/?$")


def match_priority_endpoint(path: str) -> Optional[str]:
    """Ánh xạ URL path tới key của 4 endpoint ưu tiên (hoặc None nếu không thuộc danh mục)."""
    clean_path = path.rstrip("/") or "/"
    if clean_path == "/health":
        return "health"
    if clean_path == "/api/v1/sessions":
        return "sessions"
    if clean_path == "/api/v1/system/ai-status":
        return "ai_status"
    if _COACH_ROUTE_REGEX.match(clean_path):
        return "coach_suggestions"
    return None


def calculate_quantiles(samples: list[float]) -> dict[str, float]:
    """Tính toán các phân vị độ trễ (p50, p90, p95, p99, mean, min, max) từ danh sách mẫu."""
    if not samples:
        return {
            "p50": 0.0,
            "p90": 0.0,
            "p95": 0.0,
            "p99": 0.0,
            "mean": 0.0,
            "min": 0.0,
            "max": 0.0,
        }

    sorted_samples = sorted(samples)
    n = len(sorted_samples)

    def _percentile(p: float) -> float:
        idx = int(p * (n - 1))
        return round(sorted_samples[idx], 2)

    return {
        "p50": _percentile(0.50),
        "p90": _percentile(0.90),
        "p95": _percentile(0.95),
        "p99": _percentile(0.99),
        "mean": round(sum(sorted_samples) / n, 2),
        "min": round(sorted_samples[0], 2),
        "max": round(sorted_samples[-1], 2),
    }


class EndpointStats:
    """Số liệu thống kê cục bộ cho một endpoint ưu tiên."""

    def __init__(self, maxlen: int = 1000) -> None:
        self.total_requests: int = 0
        self.status_counts: dict[str, int] = {
            "2xx": 0,
            "3xx": 0,
            "4xx": 0,
            "5xx": 0,
        }
        self.latencies: collections.deque[float] = collections.deque(maxlen=maxlen)

    def record(self, status_code: int, duration_ms: float) -> None:
        self.total_requests += 1
        family = f"{status_code // 100}xx"
        if family in self.status_counts:
            self.status_counts[family] += 1
        else:
            self.status_counts[family] = 1
        self.latencies.append(round(duration_ms, 2))

    def get_summary(self) -> dict[str, Any]:
        samples = list(self.latencies)
        err_count = self.status_counts.get("4xx", 0) + self.status_counts.get("5xx", 0)
        err_rate = (
            round((err_count / self.total_requests) * 100, 2)
            if self.total_requests > 0
            else 0.0
        )
        return {
            "total_requests": self.total_requests,
            "samples_in_buffer": len(samples),
            "status_counts": dict(self.status_counts),
            "error_rate_pct": err_rate,
            "latency_ms": calculate_quantiles(samples),
        }


class InMemoryMetricsCollector:
    """
    Bộ thu thập Telemetry In-Memory siêu nhẹ, bảo vệ bằng thread lock.
    Chỉ track 4 endpoint ưu tiên; rolling buffer 1000 mẫu; zero disk IO.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.reset()

    def reset(self) -> None:
        """Khởi tạo lại trạng thái rỗng (sử dụng trong tests và khi restart)."""
        with self._lock:
            self.start_time: float = time.time()
            self.endpoints: dict[str, EndpointStats] = {
                key: EndpointStats(maxlen=1000) for key in PRIORITY_ENDPOINTS
            }
            self.coach_total_calls: int = 0
            self.coach_fallback_calls: int = 0
            self.coach_latencies: collections.deque[float] = collections.deque(maxlen=1000)
            self.coach_fallback_reasons: dict[str, int] = {}

    def record_request(
        self, method: str, path: str, status_code: int, duration_ms: float
    ) -> None:
        """Ghi nhận request nếu thuộc 4 endpoint ưu tiên."""
        ep_key = match_priority_endpoint(path)
        if ep_key is None:
            return  # Bỏ qua mọi route không thuộc danh mục ưu tiên

        with self._lock:
            self.endpoints[ep_key].record(status_code, duration_ms)

    def record_coach_call(
        self,
        provenance: str,
        latency_ms: float,
        fallback_reason: Optional[str] = None,
    ) -> None:
        """Ghi nhận telemetry chuyên biệt cho AI Solution Coach."""
        with self._lock:
            self.coach_total_calls += 1
            self.coach_latencies.append(round(latency_ms, 2))

            if provenance == "rule_based_fallback":
                self.coach_fallback_calls += 1
                if fallback_reason:
                    clean_reason = mask_sensitive_data(fallback_reason)
                    # Chuẩn hóa tên lý do thành category ngắn gọn
                    short_reason = (
                        "LLMTimeout"
                        if "timeout" in clean_reason.lower()
                        else "HTTP429"
                        if "429" in clean_reason
                        else "NoGroundedSuggestions"
                        if "grounded" in clean_reason.lower()
                        else clean_reason[:40]
                    )
                    self.coach_fallback_reasons[short_reason] = (
                        self.coach_fallback_reasons.get(short_reason, 0) + 1
                    )

    def get_summary(self) -> dict[str, Any]:
        """Tổng hợp toàn bộ chỉ số vận hành hiện hành."""
        with self._lock:
            uptime = round(time.time() - self.start_time, 2)
            tracked = {key: stats.get_summary() for key, stats in self.endpoints.items()}

            coach_samples = list(self.coach_latencies)
            fallback_rate = (
                round((self.coach_fallback_calls / self.coach_total_calls) * 100, 2)
                if self.coach_total_calls > 0
                else 0.0
            )

            return {
                "uptime_seconds": uptime,
                "tracked_endpoints": tracked,
                "ai_coach": {
                    "total_calls": self.coach_total_calls,
                    "fallback_calls": self.coach_fallback_calls,
                    "fallback_rate_pct": fallback_rate,
                    "latency_ms": calculate_quantiles(coach_samples),
                    "fallback_reasons": dict(self.coach_fallback_reasons),
                },
            }


# Singleton toàn cục sử dụng trong toàn bộ runtime backend
metrics_collector: InMemoryMetricsCollector = InMemoryMetricsCollector()
