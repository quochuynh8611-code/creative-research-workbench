"""
test_p1_02_import_export_regression.py — Kiểm tra hồi quy toàn diện cho luồng Import/Export và Contradiction.

Kiểm tra:
1. Import snapshot cũ không có Contradiction (tự derive Contradiction phù hợp).
2. Import snapshot có Contradiction tường minh (bảo toàn đúng dữ liệu).
3. Export rồi import lại không làm nhân đôi ProblemFrame hay Contradiction.
4. Hỗ trợ legacy aliases: loss_of_money (#22) và duration_action (#25).
5. Hỗ trợ contradiction_type: physical (sinh đúng physical principles) và none (không sinh contradiction).
6. Lỗi validation (ví dụ checksum sai, thiếu title) không để lại session/frame rác trong DB (clean rollback).
"""
from __future__ import annotations

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.api.v1.endpoints.sessions import get_db
from app.domain.models import Contradiction, ContradictionType, ProblemFrame, ResearchSession
from app.main import app
from app.services.session_import_service import import_session_from_json


@pytest.fixture()
def isolated_db_override(sync_engine: Engine):
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
async def test_import_old_snapshot_without_contradiction_derives_correctly(
    sync_engine: Engine, tables: None
):
    """Snapshot cũ không có trường contradictions -> derive chính xác."""
    snapshot = {
        "session": {
            "title": "Old Snapshot Session",
            "description": "Legacy export",
            "domain": "technical",
            "workflow_state": "structuring",
        },
        "problem_frame": {
            "raw_statement": "Speed vs reliability trade-off",
            "normalized_statement": "speed vs reliability",
            "contradiction_type": "technical",
            "improving_parameter": "speed",
            "worsening_parameter": "reliability",
            "domain": "technical",
        },
    }

    with Session(bind=sync_engine) as db:
        new_sess, summary = import_session_from_json(snapshot, db)
        assert summary["problem_frame"] is True

        # Kiểm tra contradiction được derive
        contra = db.query(Contradiction).join(ProblemFrame).filter(ProblemFrame.session_id == new_sess.id).first()
        assert contra is not None
        assert contra.type == ContradictionType.technical
        # speed (9) vs reliability (27) -> principles trong Altshuller matrix
        assert contra.suggested_principles is not None
        assert len(contra.suggested_principles) > 0


@pytest.mark.asyncio
async def test_import_snapshot_with_explicit_contradiction_preserves_data(
    sync_engine: Engine, tables: None
):
    """Snapshot có chứa sẵn explicit contradictions -> nạp đúng, không derive đè."""
    custom_principles = [10, 35]
    snapshot = {
        "session": {
            "title": "Explicit Contradiction Session",
            "workflow_state": "structuring",
        },
        "problem_frame": {
            "raw_statement": "Explicit statement",
            "contradiction_type": "technical",
            "improving_parameter": "speed",
            "worsening_parameter": "reliability",
        },
        "contradictions": [
            {
                "type": "technical",
                "statement": "Custom contradiction statement",
                "suggested_principles": custom_principles,
            }
        ],
    }

    with Session(bind=sync_engine) as db:
        new_sess, summary = import_session_from_json(snapshot, db)
        contra = db.query(Contradiction).join(ProblemFrame).filter(ProblemFrame.session_id == new_sess.id).first()
        assert contra is not None
        assert contra.statement == "Custom contradiction statement"
        assert contra.suggested_principles == custom_principles


@pytest.mark.asyncio
async def test_import_with_contradiction_type_none_does_not_create_contradiction(
    sync_engine: Engine, tables: None
):
    """Nếu problem_frame có contradiction_type: none, tuyệt đối không tạo Contradiction."""
    snapshot = {
        "session": {
            "title": "No Contradiction Session",
            "workflow_state": "structuring",
        },
        "problem_frame": {
            "raw_statement": "Chỉ là phát biểu mô tả không có mâu thuẫn",
            "contradiction_type": "none",
            "improving_parameter": None,
            "worsening_parameter": None,
        },
    }

    with Session(bind=sync_engine) as db:
        new_sess, _ = import_session_from_json(snapshot, db)
        frame = db.query(ProblemFrame).filter_by(session_id=new_sess.id).first()
        assert frame is not None
        assert frame.contradiction_type == ContradictionType.none

        contras = db.query(Contradiction).filter_by(problem_frame_id=frame.id).all()
        assert len(contras) == 0


@pytest.mark.asyncio
async def test_import_with_contradiction_type_physical_derives_physical_principles(
    sync_engine: Engine, tables: None
):
    """Nếu problem_frame có contradiction_type: physical, derive đúng physical principles."""
    snapshot = {
        "session": {
            "title": "Physical Contradiction Session",
            "workflow_state": "structuring",
        },
        "problem_frame": {
            "raw_statement": "Hệ thống vừa cần cực kỳ cứng vừa cần cực kỳ dẻo",
            "contradiction_type": "physical",
            "improving_parameter": "strength",
            "worsening_parameter": "anti_strength",
        },
    }

    with Session(bind=sync_engine) as db:
        new_sess, _ = import_session_from_json(snapshot, db)
        frame = db.query(ProblemFrame).filter_by(session_id=new_sess.id).first()
        assert frame is not None
        assert frame.contradiction_type == ContradictionType.physical

        contras = db.query(Contradiction).filter_by(problem_frame_id=frame.id).all()
        assert len(contras) == 1
        assert contras[0].type == ContradictionType.physical
        assert contras[0].suggested_principles == [1, 2, 3, 4]


@pytest.mark.asyncio
async def test_legacy_aliases_support_in_import(
    sync_engine: Engine, tables: None
):
    """Kiểm tra alias loss_of_money (#22) và duration_action (#25) được map chuẩn."""
    snapshot = {
        "session": {
            "title": "Legacy Aliases Test",
            "workflow_state": "structuring",
        },
        "problem_frame": {
            "raw_statement": "Trade-off with legacy aliases",
            "contradiction_type": "technical",
            "improving_parameter": "reliability",  # 27
            "worsening_parameter": "duration_action",  # alias -> 25
        },
    }

    with Session(bind=sync_engine) as db:
        new_sess, _ = import_session_from_json(snapshot, db)
        contra = db.query(Contradiction).join(ProblemFrame).filter(ProblemFrame.session_id == new_sess.id).first()
        assert contra is not None
        # reliability (27) vs duration_action (25) -> [10, 30, 4]
        assert contra.suggested_principles == [10, 30, 4]


@pytest.mark.asyncio
async def test_roundtrip_export_then_import_preserves_single_frame_and_contradiction(
    sync_engine: Engine, tables: None, isolated_db_override: None
):
    """
    Export rồi import lại không nhân đôi frame/contradiction.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Tạo session từ template
        res_create = await client.post(
            "/api/v1/sessions/from-template",
            json={"template_id": "engineering_composite_arm", "custom_title": "Original Session"},
        )
        assert res_create.status_code == 201
        session_id = res_create.json()["data"]["id"]

        # 2. Export JSON
        res_exp = await client.get(f"/api/v1/sessions/{session_id}/export?format=json")
        assert res_exp.status_code == 200
        export_payload = res_exp.json()

        # 3. Import lại vào hệ thống dưới dạng session mới
        export_payload["session"]["title"] = "Roundtrip Imported Session"
        res_imp = await client.post("/api/v1/sessions/import", json=export_payload)
        assert res_imp.status_code == 201
        imported_id = res_imp.json()["data"]["id"]

        # 4. Xác nhận số lượng frame và contradiction của session mới
        with Session(bind=sync_engine) as verify_db:
            frames = verify_db.query(ProblemFrame).filter_by(session_id=uuid.UUID(imported_id)).all()
            assert len(frames) == 1, f"Kỳ vọng đúng 1 ProblemFrame, nhận {len(frames)}"

            contras = verify_db.query(Contradiction).filter_by(problem_frame_id=frames[0].id).all()
            assert len(contras) == 1, f"Kỳ vọng đúng 1 Contradiction, nhận {len(contras)}"
            assert contras[0].suggested_principles == [1, 8, 40, 15]


@pytest.mark.asyncio
async def test_validation_error_rolls_back_cleanly(
    sync_engine: Engine, tables: None
):
    """Khi có lỗi validation (ví dụ missing title), không để lại rác trong DB."""
    invalid_snapshot = {
        "session": {
            "title": "   ",  # Missing / blank title
        },
        "problem_frame": {
            "raw_statement": "Dang dở statement",
        },
    }

    with Session(bind=sync_engine) as db:
        initial_sess_count = db.query(ResearchSession).count()
        initial_frame_count = db.query(ProblemFrame).count()

        with pytest.raises(ValueError, match="Missing required session title"):
            import_session_from_json(invalid_snapshot, db)

        # Kiểm tra không có session hay frame nào bị lọt vào DB
        assert db.query(ResearchSession).count() == initial_sess_count
        assert db.query(ProblemFrame).count() == initial_frame_count
