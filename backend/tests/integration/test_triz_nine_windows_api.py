"""
test_triz_nine_windows_api.py — Integration test suite cho TRIZ 9-Windows API (Batch C1 — RED Phase).

Khóa contract:
  1. GET /api/v1/triz/nine-windows (mặc định lens=engineering): HTTP 200, 9 ô đúng thứ tự chuẩn.
  2. GET /api/v1/triz/nine-windows?lens=business: HTTP 200, 9 ô với nội dung kinh doanh.
  3. GET /api/v1/triz/nine-windows?lens=everyday: HTTP 200, 9 ô với nội dung đời sống.
  4. GET /api/v1/triz/nine-windows?lens=invalid: HTTP 422 Unprocessable Entity.
  5. Đảm bảo tính bất biến: Không thay đổi ProblemFrame hay workflow state.
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.domain.models import ContradictionType
from app.main import app
from app.services.problem_structuring_service import ProblemStructuringService
from app.services.workflow_engine import (
    WorkflowState,
    _NEXT_STATE_MAP,
    _VALID_TRANSITIONS,
)


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
async def test_get_nine_windows_default_engineering():
    """
    Test 1: Gọi GET /api/v1/triz/nine-windows không truyền tham số lens.
    Mặc định trả về lăng kính engineering, mã 200, 9 ô đúng thứ tự chuẩn.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/nine-windows")

    assert response.status_code == 200
    data = response.json()

    assert data["lens"] == "engineering"
    assert "lens_title" in data
    assert len(data["grid"]) == 9
    assert data["meta"]["total_windows"] == 9

    grid_coords = [(cell["level"], cell["time"]) for cell in data["grid"]]
    assert grid_coords == _EXPECTED_GRID_ORDER

    for cell in data["grid"]:
        assert cell["label_vi"].strip() != ""
        assert cell["prompt_vi"].strip() != ""
        assert cell["description_vi"].strip() != ""


@pytest.mark.asyncio
async def test_get_nine_windows_business_lens():
    """
    Test 2: Gọi GET /api/v1/triz/nine-windows?lens=business.
    Trả về lăng kính business, mã 200, 9 ô đúng thứ tự chuẩn.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/nine-windows", params={"lens": "business"})

    assert response.status_code == 200
    data = response.json()

    assert data["lens"] == "business"
    assert "lens_title" in data
    assert len(data["grid"]) == 9
    assert data["meta"]["total_windows"] == 9

    grid_coords = [(cell["level"], cell["time"]) for cell in data["grid"]]
    assert grid_coords == _EXPECTED_GRID_ORDER


@pytest.mark.asyncio
async def test_get_nine_windows_everyday_lens():
    """
    Test 3: Gọi GET /api/v1/triz/nine-windows?lens=everyday.
    Trả về lăng kính everyday, mã 200, 9 ô đúng thứ tự chuẩn.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/nine-windows", params={"lens": "everyday"})

    assert response.status_code == 200
    data = response.json()

    assert data["lens"] == "everyday"
    assert "lens_title" in data
    assert len(data["grid"]) == 9
    assert data["meta"]["total_windows"] == 9

    grid_coords = [(cell["level"], cell["time"]) for cell in data["grid"]]
    assert grid_coords == _EXPECTED_GRID_ORDER


@pytest.mark.asyncio
async def test_get_nine_windows_invalid_lens_returns_422():
    """
    Test 4: Gọi GET /api/v1/triz/nine-windows?lens=invalid_domain.
    Bị từ chối bằng HTTP 422 Unprocessable Entity bởi FastAPI Pydantic validator.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/nine-windows", params={"lens": "invalid_domain"})

    assert response.status_code == 422


def test_nine_windows_does_not_affect_problem_frame_or_workflow_state():
    """
    Test 5: Khẳng định bất biến:
    ProblemStructuringService và WorkflowEngine hoàn toàn không bị ảnh hưởng bởi 9-windows.
    """
    service = ProblemStructuringService()
    c_type, imp, wors = service._extract_parameters_and_type(
        "Cần tăng độ bền kết cấu nhưng trọng lượng lại quá nặng"
    )
    assert c_type == ContradictionType.technical
    assert imp == "strength"
    assert wors == "weight_stationary"

    assert WorkflowState.IDLE.value == "idle"
    assert _VALID_TRANSITIONS[WorkflowState.IDLE] == [WorkflowState.STRUCTURING]
    assert _NEXT_STATE_MAP[WorkflowState.IDLE] == WorkflowState.STRUCTURING
