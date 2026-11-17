"""
test_caching_layer.py — Unit tests cho Phase 12.3: In-Process LRU + TTL Cache

Specifications:
  - Feature: In-Process Thread-Safe LRU + TTL Cache Subsystem
  - Ground Truth: docs/PHASE_12_3_CACHING_LAYER_SPEC.md & docs/ADR-010-caching-layer.md
  - Discipline: Test-First (RED Phase)
"""
from __future__ import annotations

import time
from unittest.mock import patch
import pytest

from app.core.cache import InMemoryTTLCache, get_cache


def test_cache_get_set_miss():
    """
    Scenario: Tra cứu key chưa tồn tại trả về None (Cache Miss)
    và lưu giá trị thành công (Cache Set/Hit).
    """
    cache = InMemoryTTLCache(maxsize=10, default_ttl=60)
    assert cache.get("non_existent_key") is None

    cache.set("key_1", {"data": "value_1"}, ttl=30)
    assert cache.get("key_1") == {"data": "value_1"}


def test_cache_ttl_expiration():
    """
    Scenario: Giá trị tự động hết hạn sau khoảng thời gian TTL.
    """
    cache = InMemoryTTLCache(maxsize=10, default_ttl=1)
    cache.set("short_lived_key", "active", ttl=1)

    assert cache.get("short_lived_key") == "active"

    # Giả lập thời gian trôi qua 2 giây
    with patch("time.monotonic", return_value=time.monotonic() + 2):
        assert cache.get("short_lived_key") is None


def test_cache_lru_eviction():
    """
    Scenario: Khi số lượng phần tử vượt quá maxsize, phần tử ít được sử dụng nhất (LRU) bị loại bỏ.
    """
    cache = InMemoryTTLCache(maxsize=3, default_ttl=60)
    cache.set("k1", "v1")
    cache.set("k2", "v2")
    cache.set("k3", "v3")

    # Truy cập k1 để k1 thành recently used -> thứ tự LRU: k2 (oldest), k3, k1 (newest)
    assert cache.get("k1") == "v1"

    # Thêm k4 -> k2 phải bị evict
    cache.set("k4", "v4")

    assert cache.get("k2") is None, "k2 phải bị loại bỏ do là phần tử ít được sử dụng nhất"
    assert cache.get("k1") == "v1"
    assert cache.get("k3") == "v3"
    assert cache.get("k4") == "v4"


def test_cache_invalidate_namespace():
    """
    Scenario: Vô hiệu hóa chọn lọc theo namespace/prefix mà không ảnh hưởng namespace khác.
    """
    cache = InMemoryTTLCache(maxsize=10, default_ttl=60)
    cache.set("search:hash_1", "search_result_1")
    cache.set("search:hash_2", "search_result_2")
    cache.set("analytics:overview", "analytics_result")

    cache.invalidate_namespace("search")

    assert cache.get("search:hash_1") is None
    assert cache.get("search:hash_2") is None
    assert cache.get("analytics:overview") == "analytics_result"


def test_cache_clear_all():
    """
    Scenario: Xóa sạch toàn bộ cache.
    """
    cache = InMemoryTTLCache(maxsize=10, default_ttl=60)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.clear()

    assert cache.get("a") is None
    assert cache.get("b") is None


def test_cache_fail_safe_graceful_degradation():
    """
    Scenario: Khi cache engine gặp ngoại lệ, cơ chế fail-safe tự động bỏ qua lỗi và trả về None.
    """
    cache = InMemoryTTLCache(maxsize=10, default_ttl=60)

    # Giả lập lỗi khi đọc cache
    with patch.object(cache, "_data", side_effect=RuntimeError("Corrupted memory")):
        # get() không được raise exception mà phải graceful fallback về None
        val = cache.safe_get("any_key")
        assert val is None
