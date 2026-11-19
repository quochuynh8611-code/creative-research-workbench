"""
test_c35_e2e_workflow_integration.py — End-to-end integration test suite for Batch C35:
Domain Templates, Multi-Lens 9-Windows, and Workflow Profiles.

Architecture invariant:
  - Zero Testcontainers: Sử dụng test double & dependency override, không phụ thuộc Docker daemon.
  - Test & documentation only: Không thay đổi runtime behavior của production.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.api.v1.endpoints.sessions import get_db
from app.main import app
from app.services.domain_templates import get_template_by_id
from app.services.triz_nine_windows_service import _VALID_LENSES
from app.services.workflow_profiles import WORKFLOW_PROFILES, get_workflow_profiles


@pytest.mark.asyncio
async def test_workflow_profiles_schema_contract() -> None:
    """1. Kiểm tra GET /api/v1/sessions/workflow-profiles trả về đầy đủ 3 profiles với schema contract hợp lệ."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/sessions/workflow-profiles")

    assert response.status_code == 200
    payload = response.json()
    assert "data" in payload
    assert "meta" in payload
    assert payload["meta"]["total"] == 3
    profiles = payload["data"]
    assert len(profiles) == 3

    expected_ids = {"standard_triz", "rapid_prototyping", "stakeholder_alignment"}
    received_ids = {p["id"] for p in profiles}
    assert received_ids == expected_ids

    for p in profiles:
        assert p["name_vi"] and isinstance(p["name_vi"], str)
        assert p["name_en"] and isinstance(p["name_en"], str)
        assert p["description_vi"] and isinstance(p["description_vi"], str)
        assert p["description_en"] and isinstance(p["description_en"], str)
        assert isinstance(p["recommended_lenses"], list)
        assert len(p["recommended_lenses"]) > 0
        for lens in p["recommended_lenses"]:
            assert lens in _VALID_LENSES
        assert isinstance(p["stages_guidance"], dict)
        for stage in ("intake", "structuring", "ideation"):
            assert stage in p["stages_guidance"]
            assert len(p["stages_guidance"][stage]) > 0


@pytest.mark.asyncio
async def test_workflow_profiles_method_not_allowed() -> None:
    """2. Kiểm tra POST lên endpoint read-only /api/v1/sessions/workflow-profiles trả về 405 Method Not Allowed."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/workflow-profiles", json={"name": "custom"})

    assert response.status_code == 405


@pytest.mark.asyncio
async def test_all_six_lenses_nine_windows_api() -> None:
    """3. Kiểm tra duyệt đủ 6 lăng kính qua GET /api/v1/triz/nine-windows, mỗi lăng kính đủ 9 ô tọa độ."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for lens in _VALID_LENSES:
            res = await client.get(f"/api/v1/triz/nine-windows?lens={lens}")
            assert res.status_code == 200, f"Lens {lens} returned {res.status_code}"
            data = res.json()
            assert data["lens"] == lens
            assert len(data["grid"]) == 9
            coords = {(c["level"], c["time"]) for c in data["grid"]}
            assert len(coords) == 9
            for cell in data["grid"]:
                assert cell["label_vi"] and isinstance(cell["label_vi"], str)
                assert cell["prompt_vi"] and isinstance(cell["prompt_vi"], str)
                assert cell["description_vi"] and isinstance(cell["description_vi"], str)


@pytest.mark.asyncio
async def test_nine_windows_invalid_lens_returns_422() -> None:
    """4. Kiểm tra truyền lens không hợp lệ trả về 422 Unprocessable Entity."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/triz/nine-windows?lens=invalid_quantum_lens")

    assert res.status_code == 422


@pytest.mark.asyncio
async def test_e2e_session_creation_from_expansion_templates() -> None:
    """5. Kiểm tra tạo phiên nghiên cứu từ templates của 3 domain mới (Zero Testcontainers, in-memory double)."""
    templates_to_test = [
        ("healthcare_clinical_accuracy_emergency_speed", "healthcare"),
        ("education_personalized_learning_class_scale", "education"),
        ("sustainability_circular_packaging_barrier_strength", "sustainability"),
    ]

    # Verify template catalog contract directly
    for tpl_id, expected_domain in templates_to_test:
        tpl = get_template_by_id(tpl_id)
        assert tpl is not None, f"Template {tpl_id} must exist in catalog"
        assert tpl["domain"] == expected_domain
        assert "problem_frame" in tpl
        frame = tpl["problem_frame"]
        assert frame["improving_parameter"] is not None
        assert frame["worsening_parameter"] is not None
        assert len(frame["raw_statement"]) > 0

    # Verify API endpoint with test double (avoiding Testcontainers Docker dependency)
    mock_db = MagicMock(spec=Session)
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            for tpl_id, expected_domain in templates_to_test:
                fake_session = MagicMock()
                fake_session.id = uuid.uuid4()
                fake_session.title = "Test Session"
                fake_session.description = "Test Description"
                fake_session.domain = expected_domain
                fake_session.status = "active"
                fake_session.workflow_state = "intake"
                fake_session.problem_frames = []
                fake_session.created_at = datetime.now(timezone.utc)
                fake_session.updated_at = datetime.now(timezone.utc)

                with patch("app.api.v1.endpoints.sessions.import_session_from_json", return_value=(fake_session, {})):
                    res = await client.post(
                        "/api/v1/sessions/from-template",
                        json={"template_id": tpl_id},
                    )
                    assert res.status_code == 201, f"Failed for template {tpl_id}: {res.text}"
                    session_data = res.json()["data"]
                    assert session_data["domain"] == expected_domain
                    assert session_data["workflow_state"] == "intake"
    finally:
        app.dependency_overrides.pop(get_db, None)
