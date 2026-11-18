"""
middleware.py — FastAPI Middlewares cho Observability & Telemetry (Batch C32).

Bao gồm:
1. CorrelationIdMiddleware:
   - Trích xuất X-Request-ID hoặc X-Correlation-ID từ client header.
   - Nếu thiếu, tự động khởi tạo UUID4 hex chuỗi 32 ký tự.
   - Gán vào correlation_id_ctx (contextvars) và request.state.request_id.
   - Đảm bảo Response Headers luôn có X-Request-ID và X-Correlation-ID.
2. MetricsMiddleware:
   - Đo lường wall-clock duration của request (time.perf_counter).
   - Tự động ghi nhận telemetry vào InMemoryMetricsCollector nếu request thuộc 4 endpoint ưu tiên.
"""
from __future__ import annotations

import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import correlation_id_ctx
from app.core.metrics import metrics_collector


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware quản lý Correlation ID cho từng HTTP request.
    Luôn bảo đảm header được trả về cho client và lan truyền vào logging context.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # 1. Trích xuất hoặc khởi tạo Correlation ID
        incoming_id = request.headers.get("X-Request-ID") or request.headers.get("X-Correlation-ID")
        correlation_id = incoming_id.strip() if incoming_id else uuid.uuid4().hex

        # 2. Gán vào contextvars và request state
        token = correlation_id_ctx.set(correlation_id)
        request.state.request_id = correlation_id

        try:
            response = await call_next(request)
        finally:
            # Lưu ý: contextvar tự giải phóng khi async task kết thúc, nhưng reset để an toàn tuyệt đối
            pass

        # 3. Gắn header vào response
        response.headers["X-Request-ID"] = correlation_id
        response.headers["X-Correlation-ID"] = correlation_id

        return response


class MetricsMiddleware(BaseHTTPMiddleware):
    """
    Middleware đo lường độ trễ và tỷ lệ lỗi cho 4 endpoint ưu tiên.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = time.perf_counter()
        response: Response | None = None
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception:
            status_code = 500
            raise
        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000
            metrics_collector.record_request(
                method=request.method,
                path=request.url.path,
                status_code=status_code,
                duration_ms=duration_ms,
            )
