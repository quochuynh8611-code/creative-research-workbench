"""
test_session_domain_persistence.py — Integration test suite cho Backend 1B (Persist Initial Session Domain).

Bao gồm 13 kịch bản:
  1. POST domain="life" -> DB "life", POST response "life", GET detail "life".
  2. POST không gửi domain -> DB NULL, POST response "research", GET detail "research".
  3. POST domain="   " (chỉ whitespace) -> DB NULL, POST response "research".
  4. POST domain="Culture" -> DB giữ "Culture" (không lowercase), response "Culture".
  5. create_session_from_template với domain="business" -> DB "business", response "business".
  6. create_session_from_template template không domain -> DB NULL, response "research".
  7. import_session với domain="culture" -> DB "culture", response "culture".
  8. import_session không domain -> DB NULL, response "research".
  9. persisted life + latest frame business -> list/detail/filter effective business.
  10. persisted life + latest frame rỗng -> effective life (không fallback frame cũ).
  11. persisted NULL + latest frame culture -> effective culture.
  12. persisted NULL + no frame -> effective research.
  13. Filter ?domain=life -> chỉ nhận effective life, filter trước count/limit, không duplicate.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain.models import ProblemFrame, ResearchSession, SessionStatus
from app.api.v1.endpoints.sessions import get_db
from app.main import app

# Sử dụng fixtures an toàn từ safe_disposable_db
from tests.integration.safe_disposable_db import (
    disposable_engine,
    disposable_pg_container,
    db_session,
)


@pytest.fixture(autouse=True)
def override_api_get_db(db_session: Session):
    """Override get_db của FastAPI để trỏ đúng transaction của db_session test."""
    def _override():
        yield db_session

    app.dependency_overrides[get_db] = _override
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_case_1_post_with_domain_life(db_session: Session):
    """1. POST domain='life': DB lưu 'life', POST response 'life', GET detail 'life'."""
    payload = {"title": "Session Life Study", "domain": "life"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/sessions", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["domain"] == "life"
        assert data["data"]["domain"] == "life"
        session_id = data["id"]

        # Kiểm tra DB thật sự lưu "life" vào cột domain của ResearchSession
        record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
        assert record is not None
        assert record.domain == "life"

        # Kiểm tra GET detail
        detail_res = await client.get(f"/api/v1/sessions/{session_id}")
        assert detail_res.status_code == 200
        detail_data = detail_res.json()
        assert detail_data["domain"] == "life"
        assert detail_data["data"]["domain"] == "life"


@pytest.mark.asyncio
async def test_case_2_post_without_domain(db_session: Session):
    """2. POST không gửi domain: DB NULL, POST response 'research', GET detail 'research'."""
    payload = {"title": "Session Without Domain"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/sessions", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["domain"] == "research"
        assert data["data"]["domain"] == "research"
        session_id = data["id"]

        record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
        assert record is not None
        assert record.domain is None

        detail_res = await client.get(f"/api/v1/sessions/{session_id}")
        assert detail_res.status_code == 200
        detail_data = detail_res.json()
        assert detail_data["domain"] == "research"


@pytest.mark.asyncio
async def test_case_3_post_domain_whitespace(db_session: Session):
    """3. POST domain='   ': DB NULL, POST response 'research'."""
    payload = {"title": "Session Whitespace Domain", "domain": "   "}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/sessions", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["domain"] == "research"
        session_id = data["id"]

        record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
        assert record is not None
        assert record.domain is None


@pytest.mark.asyncio
async def test_case_4_post_domain_preserves_casing(db_session: Session):
    """4. POST domain='Culture': DB giữ 'Culture', response 'Culture'."""
    payload = {"title": "Session Exact Casing", "domain": "Culture"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/sessions", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["domain"] == "Culture"
        session_id = data["id"]

        record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
        assert record is not None
        assert record.domain == "Culture"


@pytest.mark.asyncio
async def test_case_5_create_session_from_template_with_domain(db_session: Session):
    """5. create_session_from_template có domain='business': DB 'business', response 'business'."""
    payload = {
        "template_id": "business_delivery_speed_cost",
        "custom_title": "Logistics cost optimization",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/sessions/from-template", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["data"]["domain"] == "business"
        session_id = data["data"]["id"]

        record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
        assert record is not None
        assert record.domain == "business"


@pytest.mark.asyncio
async def test_case_6_create_session_from_template_without_domain(db_session: Session):
    """6. create_session_from_template không domain: DB NULL, response 'research'."""
    from unittest.mock import patch

    mock_template = {
        "id": "mock_no_domain",
        "title": "Mẫu không có lĩnh vực",
        "description": "Template description",
        "domain": None,
        "workflow_state": "structuring",
        "tags": ["test"],
        "problem_frame": None,
    }
    with patch("app.api.v1.endpoints.sessions.get_template_by_id", return_value=mock_template):
        payload = {
            "template_id": "mock_no_domain",
            "custom_title": "Template without domain custom",
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/sessions/from-template", json=payload)
            assert res.status_code == 201
            data = res.json()
            assert data["data"]["domain"] == "research"
            session_id = data["data"]["id"]

            record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
            assert record is not None
            assert record.domain is None


@pytest.mark.asyncio
async def test_case_7_import_session_with_domain(db_session: Session):
    """7. import_session với domain='culture': DB 'culture', response 'culture'."""
    snapshot = {
        "session": {
            "title": "Imported Culture Session",
            "domain": "culture",
            "status": "active",
            "workflow_state": "idle",
        }
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/sessions/import", json=snapshot)
        assert res.status_code == 201
        data = res.json()
        session_id = data["data"]["id"]

        record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
        assert record is not None
        assert record.domain == "culture"
        assert data["data"]["domain"] == "culture"


@pytest.mark.asyncio
async def test_case_8_import_session_without_domain(db_session: Session):
    """8. import_session không domain: DB NULL, response 'research'."""
    snapshot = {
        "session": {
            "title": "Imported Raw Session",
            "domain": None,
            "status": "active",
            "workflow_state": "idle",
        }
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/sessions/import", json=snapshot)
        assert res.status_code == 201
        data = res.json()
        session_id = data["data"]["id"]

        record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
        assert record is not None
        assert record.domain is None
        assert data["data"]["domain"] == "research"

        record = db_session.query(ResearchSession).filter_by(id=uuid.UUID(session_id)).first()
        assert record is not None
        assert record.domain is None
        assert data["data"]["domain"] == "research"


@pytest.mark.asyncio
async def test_case_9_persisted_life_and_latest_frame_business(db_session: Session):
    """9. persisted life + latest frame business => list/detail/filter effective business."""
    session = ResearchSession(title="Hybrid Session 9", domain="life", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Business problem",
        domain="business",
    )
    db_session.add(frame)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        detail_res = await client.get(f"/api/v1/sessions/{session.id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["domain"] == "business"

        list_res = await client.get("/api/v1/sessions?domain=business")
        assert list_res.status_code == 200
        items = list_res.json()["data"]
        matching = [s for s in items if s["id"] == str(session.id)]
        assert len(matching) == 1
        assert matching[0]["domain"] == "business"

        # Lọc domain=life không được chứa session này
        list_life = await client.get("/api/v1/sessions?domain=life")
        assert list_life.status_code == 200
        assert not any(s["id"] == str(session.id) for s in list_life.json()["data"])


@pytest.mark.asyncio
async def test_case_10_persisted_life_and_latest_frame_empty_no_fallback_to_old(db_session: Session):
    """10. persisted life + old frame culture + latest frame empty => effective life (không fallback về old culture)."""
    t0 = datetime.now(timezone.utc) - timedelta(minutes=10)
    t1 = datetime.now(timezone.utc) - timedelta(minutes=5)

    session = ResearchSession(title="Hybrid Session 10", domain="life", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    # Frame cũ: domain="culture"
    f1 = ProblemFrame(session_id=session.id, raw_statement="Old frame", domain="culture", created_at=t0)
    # Frame mới nhất: domain="" (rỗng sau trim)
    f2 = ProblemFrame(session_id=session.id, raw_statement="New frame empty", domain="   ", created_at=t1)
    db_session.add_all([f1, f2])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        detail_res = await client.get(f"/api/v1/sessions/{session.id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["domain"] == "life"

        list_res = await client.get("/api/v1/sessions?domain=life")
        assert list_res.status_code == 200
        matching = [s for s in list_res.json()["data"] if s["id"] == str(session.id)]
        assert len(matching) == 1


@pytest.mark.asyncio
async def test_case_11_persisted_null_and_latest_frame_culture(db_session: Session):
    """11. persisted NULL + latest frame culture => effective culture."""
    session = ResearchSession(title="Hybrid Session 11", domain=None, status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    f = ProblemFrame(session_id=session.id, raw_statement="Culture problem", domain="culture")
    db_session.add(f)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        detail_res = await client.get(f"/api/v1/sessions/{session.id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["domain"] == "culture"


@pytest.mark.asyncio
async def test_case_12_persisted_null_and_no_frame(db_session: Session):
    """12. persisted NULL + no frame => effective research."""
    session = ResearchSession(title="Hybrid Session 12", domain=None, status=SessionStatus.active)
    db_session.add(session)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        detail_res = await client.get(f"/api/v1/sessions/{session.id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["domain"] == "research"


@pytest.mark.asyncio
async def test_case_13_filter_domain_life_and_pagination(db_session: Session):
    """13. Filter ?domain=life chỉ nhận effective life, filter trước count/limit, không duplicate."""
    s_life = ResearchSession(title="Filter Life Session", domain="life", status=SessionStatus.active)
    s_other = ResearchSession(title="Filter Other Session", domain="business", status=SessionStatus.active)
    db_session.add_all([s_life, s_other])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/sessions?domain=life&limit=10")
        assert res.status_code == 200
        body = res.json()
        items = body["data"]
        matching = [s for s in items if s["id"] == str(s_life.id)]
        assert len(matching) == 1
        assert not any(s["id"] == str(s_other.id) for s in items)
