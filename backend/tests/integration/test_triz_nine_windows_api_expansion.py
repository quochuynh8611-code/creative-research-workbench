"""
test_triz_nine_windows_api_expansion.py — Integration test suite cho API 9-Windows mở rộng và Workflow Profiles (Batch C35).
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

_EXPECTED_GRID_ORDER = [
    ("supersystem", "past"),
    ("supersystem", "present"),
    ("supersystem", "future"),
    ("system", "past"),
    ("system", "present"),
    ("system", "future"),
    ("subsystem", "past"),
    ("subsystem", "present"),
    ("subsystem", "future"),
]


@pytest.mark.asyncio
async def test_get_nine_windows_systems_thinking_lens() -> None:
    """Gọi GET /api/v1/triz/nine-windows?lens=systems_thinking trả về 200, 9 ô đúng thứ tự chuẩn."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/nine-windows?lens=systems_thinking")

    assert response.status_code == 200
    data = response.json()
    assert data["lens"] == "systems_thinking"
    assert "Tư duy Hệ thống" in data["lens_title"]
    assert len(data["grid"]) == 9
    grid_coords = [(cell["level"], cell["time"]) for cell in data["grid"]]
    assert grid_coords == _EXPECTED_GRID_ORDER


@pytest.mark.asyncio
async def test_get_nine_windows_design_thinking_lens() -> None:
    """Gọi GET /api/v1/triz/nine-windows?lens=design_thinking trả về 200, 9 ô đúng thứ tự chuẩn."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/nine-windows?lens=design_thinking")

    assert response.status_code == 200
    data = response.json()
    assert data["lens"] == "design_thinking"
    assert "Tư duy Thiết kế" in data["lens_title"]
    assert len(data["grid"]) == 9
    grid_coords = [(cell["level"], cell["time"]) for cell in data["grid"]]
    assert grid_coords == _EXPECTED_GRID_ORDER


@pytest.mark.asyncio
async def test_get_nine_windows_lean_startup_lens() -> None:
    """Gọi GET /api/v1/triz/nine-windows?lens=lean_startup trả về 200, 9 ô đúng thứ tự chuẩn."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/nine-windows?lens=lean_startup")

    assert response.status_code == 200
    data = response.json()
    assert data["lens"] == "lean_startup"
    assert "Khởi nghiệp Tinh gọn" in data["lens_title"]
    assert len(data["grid"]) == 9
    grid_coords = [(cell["level"], cell["time"]) for cell in data["grid"]]
    assert grid_coords == _EXPECTED_GRID_ORDER


@pytest.mark.asyncio
async def test_get_nine_windows_unsupported_lens_returns_422() -> None:
    """Truyền lens không nằm trong 6 lens hợp lệ phải trả về 422 Unprocessable Entity."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/nine-windows?lens=quantum_mechanics")

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_workflow_profiles_catalog() -> None:
    """Gọi GET /api/v1/sessions/workflow-profiles trả về 200, đủ đúng 3 profiles: standard_triz, rapid_prototyping, stakeholder_alignment."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/sessions/workflow-profiles")

    assert response.status_code == 200
    payload = response.json()
    assert "data" in payload
    profiles = payload["data"]
    assert len(profiles) == 3, f"Số workflow profiles phải là đúng 3, thực tế: {len(profiles)}"

    profile_ids = [p["id"] for p in profiles]
    assert profile_ids == ["standard_triz", "rapid_prototyping", "stakeholder_alignment"]

    for profile in profiles:
        assert len(profile.get("name_vi", "").strip()) > 0
        assert len(profile.get("description_vi", "").strip()) > 0
        assert isinstance(profile.get("recommended_lenses"), list)
        assert len(profile.get("recommended_lenses")) >= 1
        assert isinstance(profile.get("stages_guidance"), dict)
