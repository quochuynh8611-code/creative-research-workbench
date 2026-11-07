"""
test_everyday_templates.py — Integration tests cho 9 Domain Templates (Phase 2B)

Kiểm tra:
1. GET /api/v1/sessions/templates phải trả về chính xác 9 templates.
2. Toàn bộ 9 templates đều có problem_frame hợp lệ với improving/worsening param trong _PARAM_TO_ID_MAP.
3. POST /api/v1/sessions/from-template hoạt động thành công cho từng template mới.
4. Mỗi template tạo ra Contradiction có suggested_principles hợp lệ (không rỗng, ID trong 1..40).
"""
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.main import app
from app.services.domain_templates import get_all_templates, get_template_by_id
from app.services.problem_structuring_service import _PARAM_TO_ID_MAP, _CONTRADICTION_MATRIX_39X39
from app.api.v1.endpoints.sessions import get_db


EXPECTED_TEMPLATE_IDS = [
    # 3 Canonical templates
    "engineering_composite_arm",
    "business_delivery_speed_cost",
    "software_latency_security",
    # 6 New everyday templates
    "personal_morning_routine_energy",
    "personal_healthy_meal_time_cost",
    "personal_small_space_organization",
    "education_child_screen_autonomy",
    "business_packaging_protection_cost",
    "research_knowledge_overload",
]


@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_get_templates_returns_9_templates():
    """GET /api/v1/sessions/templates phải trả về chính xác 9 templates."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/sessions/templates")
    assert res.status_code == 200
    data = res.json()
    assert "data" in data
    templates = data["data"]
    assert len(templates) == 9, f"Kỳ vọng 9 templates, nhận được {len(templates)}"

    returned_ids = [t["id"] for t in templates]
    for expected_id in EXPECTED_TEMPLATE_IDS:
        assert expected_id in returned_ids, f"Thiếu template: {expected_id}"


def test_all_templates_have_valid_data_contracts():
    """Tất cả 9 templates phải tuân thủ đúng data contract và tham số có trong _PARAM_TO_ID_MAP."""
    templates = get_all_templates()
    assert len(templates) == 9

    for tpl in templates:
        assert tpl["id"] in EXPECTED_TEMPLATE_IDS
        assert "title" in tpl and len(tpl["title"]) > 0
        assert "domain" in tpl and len(tpl["domain"]) > 0
        assert "description" in tpl and len(tpl["description"]) > 0
        assert "tags" in tpl and isinstance(tpl["tags"], list) and len(tpl["tags"]) > 0
        assert tpl.get("workflow_state") == "structuring"

        pf = tpl.get("problem_frame")
        assert pf is not None, f"Template {tpl['id']} thiếu problem_frame"
        assert "raw_statement" in pf and len(pf["raw_statement"]) > 0
        assert "normalized_statement" in pf and len(pf["normalized_statement"]) > 0
        assert pf.get("contradiction_type") == "technical"

        imp = pf.get("improving_parameter")
        wors = pf.get("worsening_parameter")
        assert imp in _PARAM_TO_ID_MAP, f"Template {tpl['id']} dùng improving_param không hợp lệ: {imp}"
        assert wors in _PARAM_TO_ID_MAP, f"Template {tpl['id']} dùng worsening_param không hợp lệ: {wors}"

        # Kiểm tra ma trận TRIZ giải ra nguyên tắc hợp lệ
        imp_id = _PARAM_TO_ID_MAP[imp]
        wors_id = _PARAM_TO_ID_MAP[wors]
        principles = _CONTRADICTION_MATRIX_39X39.get((imp_id, wors_id), [])
        assert len(principles) > 0, f"Template {tpl['id']} ({imp_id}, {wors_id}) có suggested_principles rỗng"
        assert all(1 <= p <= 40 for p in principles), f"Template {tpl['id']} có principle id vượt ngoài 1..40"


@pytest.mark.asyncio
@pytest.mark.parametrize("template_id", [
    "personal_morning_routine_energy",
    "personal_healthy_meal_time_cost",
    "personal_small_space_organization",
    "education_child_screen_autonomy",
    "business_packaging_protection_cost",
    "research_knowledge_overload",
])
async def test_create_session_from_each_new_template(template_id: str):
    """Tạo session từ từng template mới thành công qua endpoint POST /api/v1/sessions/from-template."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/sessions/from-template", json={"template_id": template_id})
        assert res.status_code == 201, f"Tạo session từ template {template_id} thất bại: {res.text}"
        data = res.json()
        assert "data" in data
        session_data = data["data"]
        assert session_data["workflow_state"] == "structuring"
        session_id = session_data["id"]

        # Kiểm tra chi tiết session qua GET /sessions/{id}
        get_res = await ac.get(f"/api/v1/sessions/{session_id}")
        assert get_res.status_code == 200
        full_session = get_res.json()["data"]
        assert full_session.get("problem_frame") is not None
        pf = full_session["problem_frame"]
        assert pf.get("improving_parameter") is not None
        assert pf.get("worsening_parameter") is not None
        assert pf.get("contradiction_type") == "technical"
