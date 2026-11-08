"""
test_multi_domain_templates.py — Integration and Catalog tests for Multi-Domain Templates (life, business, culture, society).

Test coverage:
Catalog contract:
  1. test_all_target_domains_represented_in_catalog
  2. test_template_ids_are_strictly_unique
  3. test_expected_template_ids_are_present
  4. test_new_templates_data_contract_and_triz_matrix

Integration API (with disposable PostgreSQL):
  5. test_create_session_from_life_template
  6. test_create_session_from_culture_template
  7. test_create_session_from_society_template
  8. test_create_session_from_business_template
  9. test_template_without_domain_persists_null_returns_research
  10. test_list_sessions_filter_by_each_template_created_session
"""
from __future__ import annotations

import uuid
from unittest.mock import patch
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import Contradiction, ProblemFrame, ResearchSession, SessionStatus
from app.services.domain_templates import get_all_templates, get_template_by_id
from app.services.problem_structuring_service import (
    _CONTRADICTION_MATRIX_39X39,
    _PARAM_TO_ID_MAP,
)
from app.api.v1.endpoints.sessions import get_db
from app.main import app

from tests.integration.safe_disposable_db import (
    disposable_engine,
    disposable_pg_container,
    db_session,
)


EXPECTED_12_TEMPLATE_IDS = [
    # 3 canonical templates
    "engineering_composite_arm",
    "business_delivery_speed_cost",
    "software_latency_security",
    # 6 Phase 2B everyday templates
    "personal_morning_routine_energy",
    "personal_healthy_meal_time_cost",
    "personal_small_space_organization",
    "education_child_screen_autonomy",
    "business_packaging_protection_cost",
    "research_knowledge_overload",
    # 3 Multi-domain templates
    "life_daily_habit_energy_management",
    "culture_heritage_preservation_tourism",
    "society_community_waste_sorting_compliance",
]


@pytest.fixture(autouse=True)
def override_api_get_db(db_session: Session):
    """Override get_db của FastAPI để trỏ đúng transaction của db_session test."""
    def _override():
        yield db_session

    app.dependency_overrides[get_db] = _override
    yield
    app.dependency_overrides.pop(get_db, None)


# ── Catalog Contract Tests ───────────────────────────────────────────────────

def test_all_target_domains_represented_in_catalog():
    """1. Catalog phải có ít nhất 1 template cho từng domain: life, business, culture, society."""
    templates = get_all_templates()
    domains = {t.get("domain") for t in templates if t.get("domain")}

    target_domains = ["life", "business", "culture", "society"]
    for td in target_domains:
        assert td in domains, f"Domain '{td}' must have at least 1 template in DOMAIN_TEMPLATES. Current domains: {domains}"


def test_template_ids_are_strictly_unique():
    """2. 12 ID phải hoàn toàn unique và catalog chứa đúng 12 templates."""
    templates = get_all_templates()
    assert len(templates) == 12, f"Expected exactly 12 templates in catalog, got {len(templates)}"

    ids = [t["id"] for t in templates]
    assert len(ids) == len(set(ids)), f"Duplicate template IDs detected: {ids}"


def test_expected_template_ids_are_present():
    """3. Danh sách 12 ID tường minh (9 hiện có + 3 mới) phải có mặt đầy đủ trong catalog."""
    templates = get_all_templates()
    present_ids = {t["id"] for t in templates}

    for exp_id in EXPECTED_12_TEMPLATE_IDS:
        assert exp_id in present_ids, f"Expected template ID '{exp_id}' not found in catalog."


def test_new_templates_data_contract_and_triz_matrix():
    """4. Kiểm tra data contract và khả năng giải mâu thuẫn TRIZ của 3 templates mới."""
    new_template_specs = [
        {
            "id": "life_daily_habit_energy_management",
            "expected_domain": "life",
            "expected_imp": "productivity",
            "expected_wors": "loss_of_energy",
        },
        {
            "id": "culture_heritage_preservation_tourism",
            "expected_domain": "culture",
            "expected_imp": "stability",
            "expected_wors": "ease_of_operation",
        },
        {
            "id": "society_community_waste_sorting_compliance",
            "expected_domain": "society",
            "expected_imp": "reliability",
            "expected_wors": "loss_of_time",
        },
    ]

    for spec in new_template_specs:
        tpl_id = spec["id"]
        tpl = get_template_by_id(tpl_id)
        assert tpl is not None, f"Template '{tpl_id}' must exist in catalog."

        assert tpl.get("domain") == spec["expected_domain"], f"Template '{tpl_id}' domain mismatch."
        assert tpl.get("title") and len(tpl["title"].strip()) > 0
        assert tpl.get("description") and len(tpl["description"].strip()) > 0
        assert isinstance(tpl.get("tags"), list) and len(tpl["tags"]) >= 1
        assert tpl.get("workflow_state") == "structuring"

        pf = tpl.get("problem_frame")
        assert isinstance(pf, dict), f"Template '{tpl_id}' must contain a problem_frame object."
        assert pf.get("raw_statement") and len(pf["raw_statement"].strip()) > 0
        assert pf.get("normalized_statement") and len(pf["normalized_statement"].strip()) > 0
        assert pf.get("contradiction_type") == "technical"
        assert pf.get("domain") == spec["expected_domain"]

        imp = pf.get("improving_parameter")
        wors = pf.get("worsening_parameter")
        assert imp == spec["expected_imp"], f"Template '{tpl_id}' improving_param mismatch."
        assert wors == spec["expected_wors"], f"Template '{tpl_id}' worsening_param mismatch."

        assert imp in _PARAM_TO_ID_MAP, f"Improving parameter '{imp}' not in _PARAM_TO_ID_MAP."
        assert wors in _PARAM_TO_ID_MAP, f"Worsening parameter '{wors}' not in _PARAM_TO_ID_MAP."

        imp_id = _PARAM_TO_ID_MAP[imp]
        wors_id = _PARAM_TO_ID_MAP[wors]
        principles = _CONTRADICTION_MATRIX_39X39.get((imp_id, wors_id), [])
        assert len(principles) > 0, f"Template '{tpl_id}' produced empty principles for coordinates ({imp_id}, {wors_id})."
        assert all(1 <= p <= 40 for p in principles), f"Principles out of range 1..40 for template '{tpl_id}': {principles}"


# ── Integration API Tests ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_session_from_life_template(db_session: Session):
    """5. Tạo session từ template life -> HTTP 201, domain 'life', DB lưu 'life', frame 'life'."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/sessions/from-template",
            json={"template_id": "life_daily_habit_energy_management"},
        )
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["domain"] == "life"
        session_id = data["id"]

        # Kiểm tra DB ResearchSession
        record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
        assert record is not None
        assert record.domain == "life"

        # Kiểm tra ProblemFrame & Contradiction trong DB
        frame = db_session.query(ProblemFrame).filter_by(session_id=record.id).first()
        assert frame is not None
        assert frame.domain == "life"
        contra = db_session.query(Contradiction).filter_by(problem_frame_id=frame.id).first()
        assert contra is not None
        assert len(contra.suggested_principles) > 0

        # Kiểm tra GET detail
        detail_res = await client.get(f"/api/v1/sessions/{session_id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["domain"] == "life"


@pytest.mark.asyncio
async def test_create_session_from_culture_template(db_session: Session):
    """6. Tạo session từ template culture -> HTTP 201, domain 'culture', DB lưu 'culture', frame 'culture'."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/sessions/from-template",
            json={"template_id": "culture_heritage_preservation_tourism"},
        )
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["domain"] == "culture"
        session_id = data["id"]

        record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
        assert record is not None
        assert record.domain == "culture"

        frame = db_session.query(ProblemFrame).filter_by(session_id=record.id).first()
        assert frame is not None
        assert frame.domain == "culture"

        detail_res = await client.get(f"/api/v1/sessions/{session_id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["domain"] == "culture"


@pytest.mark.asyncio
async def test_create_session_from_society_template(db_session: Session):
    """7. Tạo session từ template society -> HTTP 201, domain 'society', DB lưu 'society', frame 'society'."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/sessions/from-template",
            json={"template_id": "society_community_waste_sorting_compliance"},
        )
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["domain"] == "society"
        session_id = data["id"]

        record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
        assert record is not None
        assert record.domain == "society"

        frame = db_session.query(ProblemFrame).filter_by(session_id=record.id).first()
        assert frame is not None
        assert frame.domain == "society"

        detail_res = await client.get(f"/api/v1/sessions/{session_id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["domain"] == "society"


@pytest.mark.asyncio
async def test_create_session_from_business_template(db_session: Session):
    """8. Tạo session từ template business -> HTTP 201, domain 'business', DB lưu 'business'."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/sessions/from-template",
            json={"template_id": "business_delivery_speed_cost"},
        )
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["domain"] == "business"
        session_id = data["id"]

        record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
        assert record is not None
        assert record.domain == "business"

        frame = db_session.query(ProblemFrame).filter_by(session_id=record.id).first()
        assert frame is not None
        assert frame.domain == "business"

        detail_res = await client.get(f"/api/v1/sessions/{session_id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["domain"] == "business"


@pytest.mark.asyncio
async def test_template_without_domain_persists_null_returns_research(db_session: Session):
    """9. Mock template không có domain -> DB lưu NULL, response effective 'research'."""
    mock_domainless_tpl = {
        "id": "mock_domainless_test_tpl",
        "title": "Mẫu Không Có Lĩnh Vực",
        "description": "Template dùng cho test kiểm tra fallback",
        "domain": None,
        "workflow_state": "structuring",
        "tags": ["test"],
        "problem_frame": None,
    }

    with patch("app.api.v1.endpoints.sessions.get_template_by_id", return_value=mock_domainless_tpl):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/api/v1/sessions/from-template",
                json={"template_id": "mock_domainless_test_tpl"},
            )
            assert res.status_code == 201
            data = res.json()["data"]
            assert data["domain"] == "research"
            session_id = data["id"]

            record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
            assert record is not None
            assert record.domain is None


@pytest.mark.asyncio
async def test_list_sessions_filter_by_each_template_created_session(db_session: Session):
    """10. Tạo session từ 4 templates mục tiêu và lọc ?domain= trả về chính xác session tương ứng."""
    target_tpl_ids = [
        ("life_daily_habit_energy_management", "life"),
        ("culture_heritage_preservation_tourism", "culture"),
        ("society_community_waste_sorting_compliance", "society"),
        ("business_delivery_speed_cost", "business"),
    ]

    created_map: dict[str, str] = {}  # domain -> session_id

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for tpl_id, expected_domain in target_tpl_ids:
            res = await client.post(
                "/api/v1/sessions/from-template",
                json={"template_id": tpl_id},
            )
            assert res.status_code == 201
            created_map[expected_domain] = res.json()["data"]["id"]

        for domain, session_id in created_map.items():
            filter_res = await client.get(f"/api/v1/sessions?domain={domain}")
            assert filter_res.status_code == 200
            items = filter_res.json()["data"]
            matching = [s for s in items if s["id"] == session_id]
            assert len(matching) == 1
            assert matching[0]["domain"] == domain
