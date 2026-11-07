"""
test_p1_02_template_contradiction.py — Test failing chứng minh lỗi P1-02 (Session tạo từ template thiếu Contradiction)

Kịch bản:
- Given một template technical có cặp tham số hợp lệ
- When POST /sessions/from-template hoàn tất
- Then session và ProblemFrame được persist
- And Contradiction liên kết đúng ProblemFrame được persist
- And suggested_principles khớp kết quả ma trận Altshuller 39x39
- And GET /sessions/{id}/recommendations trả đúng nguyên tắc
- And workflow_state không đổi chỉ vì đọc recommendations
- And không tạo Contradiction trùng lặp (chỉ đúng 1 bản ghi)
- Kiểm tra cả 9 template theo bảng expected thực tế.
"""
from __future__ import annotations

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.api.v1.endpoints.sessions import get_db
from app.domain.models import Contradiction, ProblemFrame, ResearchSession
from app.main import app

EXPECTED_TEMPLATE_PRINCIPLES: dict[str, list[int]] = {
    "engineering_composite_arm": [1, 8, 40, 15],
    "business_delivery_speed_cost": [14, 20, 19, 35],
    "software_latency_security": [10, 30, 4],
    "personal_morning_routine_energy": [28, 10, 29, 35],
    "personal_healthy_meal_time_cost": [4, 28, 10, 34],
    "personal_small_space_organization": [1, 31],
    "education_child_screen_autonomy": [13, 35],
    "business_packaging_protection_cost": [35],
    "research_knowledge_overload": [13, 15, 23],
}


@pytest.fixture()
def isolated_db_override(sync_engine: Engine):
    """
    Override get_db để mỗi HTTP request nhận một Session độc lập thật sự từ sync_engine.
    """
    def _get_isolated_db():
        session = Session(bind=sync_engine)
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _get_isolated_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
@pytest.mark.parametrize("template_id,expected_principles", list(EXPECTED_TEMPLATE_PRINCIPLES.items()))
async def test_session_from_template_persists_contradiction_and_recommends_principles(
    template_id: str,
    expected_principles: list[int],
    sync_engine: Engine,
    tables: None,
    isolated_db_override: None,
):
    """
    RED TEST cho P1-02:
    Tạo session từ template phải tạo bản ghi Contradiction với suggested_principles
    và GET /recommendations phải trả về đúng các nguyên tắc đó.
    """
    custom_title = f"Test Session Template {template_id} - {uuid.uuid4().hex[:6]}"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Tạo session từ template
        res_create = await client.post(
            "/api/v1/sessions/from-template",
            json={"template_id": template_id, "custom_title": custom_title},
        )
        assert res_create.status_code == 201, res_create.text
        data_create = res_create.json().get("data", res_create.json())
        session_id_str = data_create["id"]
        session_id = uuid.UUID(session_id_str)

        # 2. Kiểm tra trực tiếp qua DB Session độc lập
        with Session(bind=sync_engine) as verify_db:
            # Kiểm tra session
            sess = verify_db.query(ResearchSession).filter_by(id=session_id).first()
            assert sess is not None
            assert sess.title == custom_title

            # Kiểm tra ProblemFrame
            frame = verify_db.query(ProblemFrame).filter_by(session_id=session_id).first()
            assert frame is not None, f"ProblemFrame chưa được lưu cho template {template_id}"

            # Kiểm tra Contradiction (Điểm failing của P1-02)
            contradictions = verify_db.query(Contradiction).filter_by(problem_frame_id=frame.id).all()
            assert len(contradictions) == 1, (
                f"Kỳ vọng đúng 1 Contradiction cho frame {frame.id} của template {template_id}, "
                f"nhưng tìm thấy {len(contradictions)} bản ghi. Lỗi: template import thiếu Contradiction!"
            )
            contra = contradictions[0]
            assert contra.suggested_principles == expected_principles, (
                f"suggested_principles của template {template_id} không khớp: "
                f"kỳ vọng {expected_principles}, nhận {contra.suggested_principles}"
            )

        # 3. GET /sessions/{id}/recommendations qua HTTP request độc lập
        res_recs = await client.get(f"/api/v1/sessions/{session_id}/recommendations")
        assert res_recs.status_code == 200
        recs_data = res_recs.json().get("data", [])
        assert len(recs_data) == len(expected_principles), (
            f"Kỳ vọng {len(expected_principles)} nguyên tắc gợi ý cho template {template_id}, "
            f"nhưng nhận {len(recs_data)}: {recs_data}"
        )
        returned_p_ids = [r["id"] for r in recs_data]
        assert returned_p_ids == expected_principles, (
            f"Thứ tự/danh sách ID nguyên tắc không khớp: kỳ vọng {expected_principles}, nhận {returned_p_ids}"
        )

        # 4. Xác minh workflow_state không đổi sau khi gọi recommendations
        res_get_sess = await client.get(f"/api/v1/sessions/{session_id}")
        assert res_get_sess.status_code == 200
        sess_state = res_get_sess.json().get("data", res_get_sess.json())["workflow_state"]
        assert sess_state == "structuring"
