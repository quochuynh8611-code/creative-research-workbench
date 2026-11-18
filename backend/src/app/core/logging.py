"""
logging.py — Structured JSON Logging & Masking Subsystem (Batch C32).

Tính năng:
1. Quản trị Correlation ID thông qua contextvars.ContextVar (luôn an toàn trong async context).
2. StructuredJsonFormatter: Định dạng log record thành JSON với các trường chuẩn (timestamp UTC ISO, level, logger, message, correlation_id, module, function, line).
3. Masking: Bắt buộc che giấu các chuỗi nhạy cảm (sk-proj, Bearer, password, token, api_key).
4. Zero Leakage: Ngăn chặn rò rỉ secret trong exception logs.
"""
from __future__ import annotations

import contextvars
import datetime
import json
import logging
import re
import sys
from typing import Any, Optional

# ContextVar lưu trữ correlation_id cho từng async task
correlation_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "correlation_id", default="-"
)

# Regex patterns để phát hiện và mask các chuỗi nhạy cảm
_MASKING_PATTERNS = [
    (re.compile(r"sk-proj-[A-Za-z0-9_\-]+", re.IGNORECASE), "sk-proj-***[MASKED]***"),
    (re.compile(r"Bearer\s+[A-Za-z0-9_\-\.]+", re.IGNORECASE), "Bearer ***[MASKED]***"),
    (
        re.compile(r"""(password|token|api_key|secret)\s*[:=]\s*(?:['"][^'"]+['"]|[^\s,;]+)""", re.IGNORECASE),
        r'\1="***[MASKED]***"',
    ),
]


def mask_sensitive_data(text: str) -> str:
    """Che giấu các thông tin bảo mật nhạy cảm trong chuỗi văn bản."""
    if not isinstance(text, str) or not text:
        return text
    masked = text
    for pattern, replacement in _MASKING_PATTERNS:
        masked = pattern.sub(replacement, masked)
    return masked


class StructuredJsonFormatter(logging.Formatter):
    """
    Formatter định dạng log record thành JSON chuẩn.
    Tự động đính kèm Correlation ID từ contextvars và lọc sạch thông tin nhạy cảm.
    """

    def __init__(self, fmt: Optional[str] = None, datefmt: Optional[str] = None) -> None:
        super().__init__(fmt=fmt, datefmt=datefmt)

    def format(self, record: logging.LogRecord) -> str:
        # 1. Trích xuất message và format args nếu có
        try:
            msg = record.getMessage()
        except Exception:
            msg = str(record.msg)

        # 2. Áp dụng secret masking lên message
        clean_msg = mask_sensitive_data(msg)

        # 3. Lấy Correlation ID hiện hành
        corr_id = correlation_id_ctx.get()

        # 4. Tạo payload JSON có cấu trúc
        log_payload: dict[str, Any] = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": clean_msg,
            "correlation_id": corr_id,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # 5. Xử lý Exception info an toàn nếu có
        if record.exc_info:
            exc_type, exc_val, _ = record.exc_info
            if exc_val is not None:
                clean_exc = mask_sensitive_data(str(exc_val))
                log_payload["exception"] = {
                    "type": exc_type.__name__ if exc_type else "Exception",
                    "detail": clean_exc,
                }

        # 6. Serialized JSON
        return json.dumps(log_payload, ensure_ascii=False)


def setup_logging(log_level: str = "INFO", json_format: bool = True) -> None:
    """Khởi tạo cấu hình logging cho toàn bộ backend."""
    root_logger = logging.getLogger()
    level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger.setLevel(level)

    # Xóa các handler hiện có để tránh trùng lặp
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setLevel(level)

    if json_format:
        stream_handler.setFormatter(StructuredJsonFormatter())
    else:
        stream_handler.setFormatter(
            logging.Formatter("[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s")
        )

    root_logger.addHandler(stream_handler)
