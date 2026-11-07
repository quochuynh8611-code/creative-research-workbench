"""
test_triz_everyday_api.py — Integration tests cho TRIZ API endpoints với metadata đời sống (Phase 2A)

Endpoints:
- GET /api/v1/triz/principles
- GET /api/v1/triz/parameters
- GET /api/v1/triz/lookup
"""
from fastapi.testclient import TestClient
import pytest

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_get_triz_principles_everyday_metadata(client):
    """GET /api/v1/triz/principles trả về metadata đời sống cho toàn bộ 40 principles."""
    res = client.get("/api/v1/triz/principles")
    assert res.status_code == 200
    data = res.json()
    assert "data" in data
    principles = data["data"]
    assert len(principles) == 40

    for p in principles:
        # Canonical fields
        assert "id" in p
        assert "name_vi" in p
        assert "name_en" in p
        assert "description" in p
        assert "explanation" in p
        assert "examples" in p

        # Everyday fields
        assert "everyday_title" in p
        assert "daily_application" in p
        assert "daily_examples" in p
        assert isinstance(p["daily_examples"], list)
        assert len(p["daily_examples"]) >= 2
        assert "action_prompt" in p


def test_get_triz_parameters_everyday_metadata(client):
    """GET /api/v1/triz/parameters trả về metadata đời sống cho 39 parameters."""
    res = client.get("/api/v1/triz/parameters")
    assert res.status_code == 200
    data = res.json()
    assert "data" in data
    parameters = data["data"]
    assert len(parameters) == 39

    for param in parameters:
        # Canonical fields
        assert "id" in param
        assert "code" in param
        assert "name_vi" in param
        assert "name_en" in param
        assert "description" in param

        # Everyday fields
        assert "everyday_label" in param
        assert isinstance(param["everyday_label"], str)
        assert len(param["everyday_label"].strip()) > 0


def test_lookup_triz_matrix_everyday_metadata(client):
    """GET /api/v1/triz/lookup trả về everyday metadata cho parameters và principles."""
    res = client.get("/api/v1/triz/lookup?improving=17&worsening=14")
    assert res.status_code == 200
    data = res.json()

    assert "improving_parameter" in data
    assert "worsening_parameter" in data
    assert "everyday_label" in data["improving_parameter"]
    assert "everyday_label" in data["worsening_parameter"]

    assert "principles" in data
    assert len(data["principles"]) > 0
    for p in data["principles"]:
        assert "everyday_title" in p
        assert "daily_application" in p
        assert "daily_examples" in p
        assert "action_prompt" in p
