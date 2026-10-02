"""
test_triz_auto_map_api.py — Integration tests cho Phase 10.1: Full TRIZ 39 Parameters Auto-mapping.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_auto_map_triz_parameters_vietnamese_success():
    """
    Scenario 1.1: Auto-map parameters từ mô tả kỹ thuật tiếng Việt.
    GIVEN: Mô tả "Cánh tay robot cần tăng độ bền và chịu tải nhưng phải giảm khối lượng di động"
    WHEN: Gọi POST /api/v1/triz/auto-map
    THEN: Trả về HTTP 200 kèm danh sách matches chứa 'strength' (ID 14) và 'weight_moving' (ID 1).
    """
    payload = {
        "text": "Cánh tay robot cần tăng độ bền và chịu tải nhưng phải giảm khối lượng di động",
        "top_k": 5,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/triz/auto-map", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "meta" in data
    matches = data["data"]
    assert len(matches) > 0
    matched_codes = [m["code"] for m in matches]
    assert "strength" in matched_codes or "weight_moving" in matched_codes

    first = matches[0]
    assert "id" in first
    assert "code" in first
    assert "name_vi" in first
    assert "name_en" in first
    assert "score" in first
    assert "matched_keywords" in first
    assert isinstance(first["matched_keywords"], list)
    assert len(first["matched_keywords"]) > 0


@pytest.mark.asyncio
async def test_auto_map_triz_parameters_english_success():
    """
    Scenario 1.2: Auto-map parameters từ mô tả kỹ thuật tiếng Anh.
    GIVEN: Mô tả "Improve battery energy capacity while reducing temperature and heat degradation"
    WHEN: Gọi POST /api/v1/triz/auto-map
    THEN: Trả về HTTP 200 kèm danh sách matches chứa 'temperature' (ID 17).
    """
    payload = {
        "text": "Improve battery energy capacity while reducing temperature and heat degradation",
        "top_k": 5,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/triz/auto-map", json=payload)

    assert response.status_code == 200
    data = response.json()
    matches = data["data"]
    matched_codes = [m["code"] for m in matches]
    assert "temperature" in matched_codes


@pytest.mark.asyncio
async def test_auto_map_triz_parameters_empty_text_returns_400():
    """
    Scenario 1.3: Gửi text rỗng hoặc whitespace trả về HTTP 400 Bad Request.
    """
    payload = {"text": "   "}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/triz/auto-map", json=payload)

    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower() or "text" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_auto_map_triz_parameters_respects_top_k():
    """
    Scenario 1.4: top_k giới hạn số lượng kết quả trả về.
    """
    payload = {
        "text": "Hệ thống cần tăng tốc độ, công suất, độ tin cậy và tự động hóa trong khi giảm nhiệt độ, áp suất, độ phức tạp và chi phí tổn thất năng lượng",
        "top_k": 3,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/triz/auto-map", json=payload)

    assert response.status_code == 200
    matches = response.json()["data"]
    assert len(matches) <= 3
