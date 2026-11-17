"""
cache.py — In-Process Thread-Safe LRU + TTL Cache Subsystem (Phase 12.3)

Specifications:
  - Feature: Pure Standard Library Caching Layer (Zero External Dependencies)
  - Ground Truth: docs/PHASE_12_3_CACHING_LAYER_SPEC.md & docs/ADR-010-caching-layer.md
  - Discipline: Fail-Safe & Graceful Degradation
"""
from __future__ import annotations

import logging
import threading
import time
from collections import OrderedDict
from typing import Any

logger = logging.getLogger(__name__)


class InMemoryTTLCache:
    """
    In-Process Thread-Safe Cache với cơ chế LRU eviction và TTL (Time-To-Live).
    100% Python Standard Library (collections.OrderedDict, threading.RLock, time.monotonic).
    """

    def __init__(self, maxsize: int = 1024, default_ttl: int = 300) -> None:
        self.maxsize = maxsize
        self.default_ttl = default_ttl
        self._lock = threading.RLock()
        # Lưu trữ: key -> (value, expires_at: float)
        self._data: OrderedDict[str, tuple[Any, float]] = OrderedDict()

    def get(self, key: str) -> Any | None:
        """
        Lấy giá trị từ cache.
        Nếu key hết hạn, tự động xóa và trả về None.
        Nếu key còn hạn, đưa key lên đầu (recently used) và trả về value.
        """
        with self._lock:
            if key not in self._data:
                return None

            value, expires_at = self._data[key]
            if time.monotonic() > expires_at:
                del self._data[key]
                return None

            # Đánh dấu recently used
            self._data.move_to_end(key)
            return value

    def safe_get(self, key: str) -> Any | None:
        """
        Bản bọc an toàn của get(), tự động bắt giữ mọi ngoại lệ và fallback về None.
        """
        try:
            return self.get(key)
        except Exception as exc:
            logger.warning("Cache safe_get encountered exception for key %s: %s", key, exc)
            return None

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """
        Lưu giá trị vào cache kèm thời gian hết hạn TTL.
        Nếu số lượng phần tử vượt quá maxsize, loại bỏ phần tử cũ nhất (LRU eviction).
        """
        effective_ttl = ttl if ttl is not None else self.default_ttl
        expires_at = time.monotonic() + effective_ttl

        with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
            self._data[key] = (value, expires_at)

            # Kiểm tra và thực hiện LRU eviction nếu vượt quá dung lượng
            while len(self._data) > self.maxsize:
                # popitem(last=False) xóa phần tử đầu tiên (oldest/least recently used)
                self._data.popitem(last=False)

    def safe_set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """
        Bản bọc an toàn của set(), tự động bắt giữ mọi ngoại lệ.
        """
        try:
            self.set(key, value, ttl)
        except Exception as exc:
            logger.warning("Cache safe_set encountered exception for key %s: %s", key, exc)

    def invalidate_namespace(self, namespace: str) -> int:
        """
        Xóa tất cả các keys bắt đầu bằng namespace (ví dụ: 'search:' hoặc 'analytics:').
        Trả về số lượng keys đã xóa.
        """
        prefix = f"{namespace}:" if not namespace.endswith(":") else namespace
        removed_count = 0

        with self._lock:
            keys_to_delete = [k for k in self._data if k.startswith(prefix)]
            for k in keys_to_delete:
                del self._data[k]
                removed_count += 1

        if removed_count > 0:
            logger.info("Invalidated %d cache keys in namespace '%s'", removed_count, namespace)
        return removed_count

    def clear(self) -> None:
        """Xóa sạch toàn bộ cache."""
        with self._lock:
            self._data.clear()


# Singleton instance toàn cục của cache
_global_cache: InMemoryTTLCache | None = None
_cache_lock = threading.Lock()


def get_cache() -> InMemoryTTLCache:
    """Trả về singleton cache instance toàn cục."""
    global _global_cache
    if _global_cache is None:
        with _cache_lock:
            if _global_cache is None:
                _global_cache = InMemoryTTLCache()
    return _global_cache
