"""
test_multi_domain_sessions_api.py — Integration tests cho Backend 1A Multi-Domain Foundation.

Kiểm tra:
  - latest vs historical frame
  - tie-breaker (created_at DESC, id DESC) với positive/negative filter và list item check
  - fallback khi không có frame / frame rỗng (parameterized: None, "", "   ")
  - latest whitespace không quay lại frame lịch sử
  - latest domain personal
  - " business " -> "business" normalization
  - filter research gồm no-frame/null/empty/explicit research
  - filter domain kết hợp limit, total (kiểm tra chính xác meta.total, không dùng >=), q, status, archived
  - filter query domain="", domain="   " và domain=" business "
  - không duplicate khi session có nhiều frames
  - envelope (top-level, data, problem_frame, current_problem_frame) consistency
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import (
    ProblemFrame,
    ResearchSession,
    SessionStatus,
)
from app.main import app

# Import harness disposable db an toàn
from tests.integration.safe_disposable_db import (  # noqa: F401
    disposable_pg_container,
    disposable_engine,
    db_session,
    override_get_db,
)


@pytest.mark.asyncio
async def test_latest_culture_over_historical_technical(db_session: Session):
    """
    1. Historical frame có domain 'technical', latest frame có domain 'culture'.
    -> GET /sessions/{id} và GET /sessions phải trả 'culture'.
    Kiểm tra đủ 4 vị trí: top-level, data, problem_frame, current_problem_frame.
    """
    session = ResearchSession(title="S1 Culture Latest", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    # Frame 1: Cũ (created_at sớm)
    f1 = ProblemFrame(
        session_id=session.id,
        raw_statement="Raw 1",
        domain="technical",
        created_at=datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
    )
    # Frame 2: Mới (created_at muộn)
    f2 = ProblemFrame(
        session_id=session.id,
        raw_statement="Raw 2",
        domain="culture",
        created_at=datetime(2026, 1, 1, 11, 0, 0, tzinfo=timezone.utc),
    )
    db_session.add_all([f1, f2])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Detail check (4 locations)
        res_detail = await client.get(f"/api/v1/sessions/{session.id}")
        assert res_detail.status_code == 200
        detail_json = res_detail.json()
        assert detail_json["domain"] == "culture"
        assert detail_json["data"]["domain"] == "culture"
        assert detail_json["problem_frame"]["domain"] == "culture"
        assert detail_json["current_problem_frame"]["domain"] == "culture"

        # List check
        res_list = await client.get("/api/v1/sessions")
        assert res_list.status_code == 200
        items = res_list.json()["data"]
        match = next(it for it in items if it["id"] == str(session.id))
        assert match["domain"] == "culture"


@pytest.mark.asyncio
async def test_historical_culture_latest_business(db_session: Session):
    """
    2. Historical culture, latest business.
    -> API trả 'business' trên cả top-level/data và 2 frame payload.
    -> positive filter (domain=business) phải nhận, negative filter (domain=culture) phải loại.
    """
    session = ResearchSession(title="S Business Latest", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    f1 = ProblemFrame(
        session_id=session.id,
        raw_statement="Raw 1",
        domain="culture",
        created_at=datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
    )
    f2 = ProblemFrame(
        session_id=session.id,
        raw_statement="Raw 2",
        domain="business",
        created_at=datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
    )
    db_session.add_all([f1, f2])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Detail check (4 locations)
        res = await client.get(f"/api/v1/sessions/{session.id}")
        assert res.status_code == 200
        detail_json = res.json()
        assert detail_json["domain"] == "business"
        assert detail_json["data"]["domain"] == "business"
        assert detail_json["problem_frame"]["domain"] == "business"
        assert detail_json["current_problem_frame"]["domain"] == "business"

        # Positive filter: domain=business phải nhận
        res_bus = await client.get("/api/v1/sessions?domain=business")
        assert res_bus.status_code == 200
        assert res_bus.json()["meta"]["total"] == 1
        assert any(it["id"] == str(session.id) for it in res_bus.json()["data"])

        # Negative filter: domain=culture phải loại
        res_cul = await client.get("/api/v1/sessions?domain=culture")
        assert res_cul.status_code == 200
        assert res_cul.json()["meta"]["total"] == 0
        assert not any(it["id"] == str(session.id) for it in res_cul.json()["data"])


@pytest.mark.asyncio
async def test_tie_breaker_created_at_identical(db_session: Session):
    """
    3. Tie-breaker: created_at giống hệt nhau, phân định theo id DESC.
    Kiểm tra detail (4 locations), list item domain, positive và negative filter.
    """
    session = ResearchSession(title="Tie Breaker Session", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    ts = datetime(2026, 5, 1, 12, 0, 0, tzinfo=timezone.utc)
    id_low = uuid.UUID("00000000-0000-0000-0000-000000000001")
    id_high = uuid.UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")

    f_low = ProblemFrame(
        id=id_low,
        session_id=session.id,
        raw_statement="Low ID",
        domain="society",
        created_at=ts,
    )
    f_high = ProblemFrame(
        id=id_high,
        session_id=session.id,
        raw_statement="High ID",
        domain="culture",
        created_at=ts,
    )
    db_session.add_all([f_low, f_high])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Detail check: id_high có domain culture phải thắng
        res = await client.get(f"/api/v1/sessions/{session.id}")
        assert res.status_code == 200
        detail_json = res.json()
        assert detail_json["domain"] == "culture"
        assert detail_json["data"]["domain"] == "culture"
        assert detail_json["problem_frame"]["domain"] == "culture"
        assert detail_json["current_problem_frame"]["domain"] == "culture"

        # List item domain check
        res_all = await client.get("/api/v1/sessions")
        assert res_all.status_code == 200
        item = next(it for it in res_all.json()["data"] if it["id"] == str(session.id))
        assert item["domain"] == "culture"

        # Positive filter: domain=culture
        res_pos = await client.get("/api/v1/sessions?domain=culture")
        assert res_pos.status_code == 200
        assert res_pos.json()["meta"]["total"] == 1
        assert any(s["id"] == str(session.id) for s in res_pos.json()["data"])

        # Negative filter: domain=society
        res_neg = await client.get("/api/v1/sessions?domain=society")
        assert res_neg.status_code == 200
        assert res_neg.json()["meta"]["total"] == 0
        assert not any(s["id"] == str(session.id) for s in res_neg.json()["data"])


@pytest.mark.asyncio
async def test_fallback_no_frame(db_session: Session):
    """
    4. Session không có frame -> domain là 'research', frame payloads là null.
    """
    session = ResearchSession(title="No Frame Session", status=SessionStatus.active)
    db_session.add(session)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/sessions/{session.id}")
        assert res.status_code == 200
        data = res.json()
        assert data["domain"] == "research"
        assert data["data"]["domain"] == "research"
        assert data["problem_frame"] is None
        assert data["current_problem_frame"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize("empty_val", [None, "", "   "])
async def test_latest_empty_or_whitespace_does_not_fallback_to_historical(
    db_session: Session, empty_val: str | None
):
    """
    5. Parameterize: Frame cũ có domain 'personal', frame mới có domain là None, '' hoặc '   '.
    -> Phải trả 'research', tuyệt đối không fallback về 'personal'.
    Kiểm tra top-level/data và cả hai frame payload.
    """
    session = ResearchSession(title=f"Empty Latest Frame {empty_val!r}", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    f1 = ProblemFrame(
        session_id=session.id,
        raw_statement="F1",
        domain="personal",
        created_at=datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
    )
    f2 = ProblemFrame(
        session_id=session.id,
        raw_statement="F2",
        domain=empty_val,
        created_at=datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
    )
    db_session.add_all([f1, f2])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/sessions/{session.id}")
        assert res.status_code == 200
        data = res.json()
        assert data["domain"] == "research"
        assert data["data"]["domain"] == "research"
        assert data["problem_frame"]["domain"] == "research"
        assert data["current_problem_frame"]["domain"] == "research"


@pytest.mark.asyncio
async def test_latest_domain_personal(db_session: Session):
    """
    6. Thêm test cho domain 'personal':
    - detail: top-level, data, problem_frame, current_problem_frame đều là 'personal'
    - list: domain là 'personal'
    - positive filter (domain=personal) nhận, negative filter (domain=culture) loại.
    """
    session = ResearchSession(title="Personal Domain Session", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    f1 = ProblemFrame(
        session_id=session.id,
        raw_statement="Old frame",
        domain="research",
        created_at=datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
    )
    f2 = ProblemFrame(
        session_id=session.id,
        raw_statement="Latest frame",
        domain="personal",
        created_at=datetime(2026, 1, 1, 11, 0, 0, tzinfo=timezone.utc),
    )
    db_session.add_all([f1, f2])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Detail check (4 positions)
        res_detail = await client.get(f"/api/v1/sessions/{session.id}")
        assert res_detail.status_code == 200
        detail_json = res_detail.json()
        assert detail_json["domain"] == "personal"
        assert detail_json["data"]["domain"] == "personal"
        assert detail_json["problem_frame"]["domain"] == "personal"
        assert detail_json["current_problem_frame"]["domain"] == "personal"

        # List check
        res_list = await client.get("/api/v1/sessions")
        assert res_list.status_code == 200
        item = next(it for it in res_list.json()["data"] if it["id"] == str(session.id))
        assert item["domain"] == "personal"

        # Positive filter: domain=personal
        res_pos = await client.get("/api/v1/sessions?domain=personal")
        assert res_pos.status_code == 200
        assert res_pos.json()["meta"]["total"] == 1
        assert any(it["id"] == str(session.id) for it in res_pos.json()["data"])

        # Negative filter: domain=culture
        res_neg = await client.get("/api/v1/sessions?domain=culture")
        assert res_neg.status_code == 200
        assert res_neg.json()["meta"]["total"] == 0
        assert not any(it["id"] == str(session.id) for it in res_neg.json()["data"])


@pytest.mark.asyncio
async def test_normalization_space_trimmed(db_session: Session):
    """
    7. Normalization: ' business ' -> 'business'.
    Kiểm tra top-level/data, 2 frame payload và list filter.
    """
    session = ResearchSession(title="Trim Space Session", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    f = ProblemFrame(
        session_id=session.id,
        raw_statement="Statement",
        domain=" business ",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(f)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/sessions/{session.id}")
        assert res.status_code == 200
        detail_json = res.json()
        assert detail_json["domain"] == "business"
        assert detail_json["data"]["domain"] == "business"
        assert detail_json["problem_frame"]["domain"] == "business"
        assert detail_json["current_problem_frame"]["domain"] == "business"

        res_list = await client.get("/api/v1/sessions?domain=business")
        assert res_list.status_code == 200
        assert res_list.json()["meta"]["total"] == 1
        assert any(s["id"] == str(session.id) for s in res_list.json()["data"])


@pytest.mark.asyncio
async def test_legacy_domain_preserved_exact_casing(db_session: Session):
    """
    8. Legacy domain: không lowercase hay đổi tên (ví dụ: 'Mechanical_Engineering').
    """
    session = ResearchSession(title="Legacy Domain Session", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    f = ProblemFrame(
        session_id=session.id,
        raw_statement="Statement",
        domain="Mechanical_Engineering",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(f)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/sessions/{session.id}")
        assert res.status_code == 200
        detail_json = res.json()
        assert detail_json["domain"] == "Mechanical_Engineering"
        assert detail_json["data"]["domain"] == "Mechanical_Engineering"
        assert detail_json["problem_frame"]["domain"] == "Mechanical_Engineering"
        assert detail_json["current_problem_frame"]["domain"] == "Mechanical_Engineering"


@pytest.mark.asyncio
async def test_filter_research_comprehensive(db_session: Session):
    """
    9. Filter ?domain=research phải trả về đúng 4 trường hợp (meta.total == 4):
       - No frame
       - Frame domain None
       - Frame domain whitespace ('   ')
       - Frame domain explicit 'research'
    """
    # Case 1: No frame
    s_none = ResearchSession(title="Research No Frame", status=SessionStatus.active)
    # Case 2: Null domain
    s_null = ResearchSession(title="Research Null Domain", status=SessionStatus.active)
    # Case 3: Whitespace domain
    s_ws = ResearchSession(title="Research WS Domain", status=SessionStatus.active)
    # Case 4: Explicit research
    s_exp = ResearchSession(title="Research Explicit Domain", status=SessionStatus.active)
    # Negative Case: Other domain
    s_other = ResearchSession(title="Other Culture Domain", status=SessionStatus.active)

    db_session.add_all([s_none, s_null, s_ws, s_exp, s_other])
    db_session.flush()

    f_null = ProblemFrame(session_id=s_null.id, raw_statement="r", domain=None)
    f_ws = ProblemFrame(session_id=s_ws.id, raw_statement="r", domain="   ")
    f_exp = ProblemFrame(session_id=s_exp.id, raw_statement="r", domain="research")
    f_other = ProblemFrame(session_id=s_other.id, raw_statement="r", domain="culture")

    db_session.add_all([f_null, f_ws, f_exp, f_other])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/sessions?domain=research")
        assert res.status_code == 200
        assert res.json()["meta"]["total"] == 4
        matched_ids = {s["id"] for s in res.json()["data"]}
        assert str(s_none.id) in matched_ids
        assert str(s_null.id) in matched_ids
        assert str(s_ws.id) in matched_ids
        assert str(s_exp.id) in matched_ids
        assert str(s_other.id) not in matched_ids


@pytest.mark.asyncio
async def test_filter_domain_with_limit_and_total(db_session: Session):
    """
    10. Filter domain kết hợp total count và limit:
    meta.total phải bằng chính xác 5 (tổng fixture), không dùng >=.
    """
    sessions = []
    for i in range(5):
        s = ResearchSession(title=f"Culture {i}", status=SessionStatus.active)
        sessions.append(s)
    db_session.add_all(sessions)
    db_session.flush()

    for s in sessions:
        db_session.add(ProblemFrame(session_id=s.id, raw_statement="r", domain="culture"))
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/sessions?domain=culture&limit=2")
        assert res.status_code == 200
        data = res.json()
        assert len(data["data"]) == 2
        assert data["meta"]["total"] == 5
        assert all(it["domain"] == "culture" for it in data["data"])


@pytest.mark.asyncio
async def test_filter_q_status_archived_combined(db_session: Session):
    """
    11. Filter domain kết hợp q, status và loại trừ archived mặc định.
    """
    # Active & Match q
    s1 = ResearchSession(title="Finding Quantum Culture", status=SessionStatus.active)
    # Archived & Match q (bị loại do default ẩn archived)
    s2 = ResearchSession(title="Hidden Quantum Culture", status=SessionStatus.archived)
    # Active & No match q
    s3 = ResearchSession(title="Finding Nothing", status=SessionStatus.active)

    db_session.add_all([s1, s2, s3])
    db_session.flush()

    for s in [s1, s2, s3]:
        db_session.add(ProblemFrame(session_id=s.id, raw_statement="r", domain="culture"))
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Mặc định ẩn archived -> chỉ có s1 (meta.total == 1)
        res = await client.get("/api/v1/sessions?domain=culture&q=Quantum")
        assert res.status_code == 200
        assert res.json()["meta"]["total"] == 1
        ids = [it["id"] for it in res.json()["data"]]
        assert str(s1.id) in ids
        assert str(s2.id) not in ids
        assert str(s3.id) not in ids

        # Explicit status=archived -> chỉ có s2 (meta.total == 1)
        res_arch = await client.get("/api/v1/sessions?status=archived&domain=culture&q=Quantum")
        assert res_arch.status_code == 200
        assert res_arch.json()["meta"]["total"] == 1
        arch_ids = [it["id"] for it in res_arch.json()["data"]]
        assert str(s2.id) in arch_ids
        assert str(s1.id) not in arch_ids


@pytest.mark.asyncio
async def test_no_duplicate_sessions_with_multiple_frames(db_session: Session):
    """
    12. Session có nhiều ProblemFrames không bị nhân đôi trong danh sách list_sessions.
    meta.total phải bằng chính xác 1.
    """
    s = ResearchSession(title="Multi Frames Session", status=SessionStatus.active)
    db_session.add(s)
    db_session.flush()

    for i in range(4):
        db_session.add(ProblemFrame(
            session_id=s.id,
            raw_statement=f"Stmt {i}",
            domain="society",
            created_at=datetime(2026, 1, 1, 10 + i, 0, 0, tzinfo=timezone.utc),
        ))
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/sessions?domain=society")
        assert res.status_code == 200
        assert res.json()["meta"]["total"] == 1
        items = res.json()["data"]
        matching = [it for it in items if it["id"] == str(s.id)]
        assert len(matching) == 1


@pytest.mark.asyncio
async def test_filter_query_domain_whitespace_and_empty(db_session: Session):
    """
    13. Kiểm tra query filter:
    - ?domain= (domain="") -> bỏ qua filter, trả về tất cả session (meta.total == 2)
    - ?domain=%20%20%20 (chỉ whitespace) -> bỏ qua filter, trả về tất cả session (meta.total == 2)
    - ?domain=%20business%20 (domain=" business ") -> trim thành 'business', lọc đúng session (meta.total == 1)
    """
    s_bus = ResearchSession(title="Business Session", status=SessionStatus.active)
    s_cul = ResearchSession(title="Culture Session", status=SessionStatus.active)
    db_session.add_all([s_bus, s_cul])
    db_session.flush()

    db_session.add(ProblemFrame(session_id=s_bus.id, raw_statement="r", domain="business"))
    db_session.add(ProblemFrame(session_id=s_cul.id, raw_statement="r", domain="culture"))
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. query domain=""
        res_empty = await client.get("/api/v1/sessions?domain=")
        assert res_empty.status_code == 200
        assert res_empty.json()["meta"]["total"] == 2
        ids_empty = {it["id"] for it in res_empty.json()["data"]}
        assert str(s_bus.id) in ids_empty
        assert str(s_cul.id) in ids_empty

        # 2. query domain="   "
        res_ws = await client.get("/api/v1/sessions?domain=%20%20%20")
        assert res_ws.status_code == 200
        assert res_ws.json()["meta"]["total"] == 2
        ids_ws = {it["id"] for it in res_ws.json()["data"]}
        assert str(s_bus.id) in ids_ws
        assert str(s_cul.id) in ids_ws

        # 3. query domain=" business "
        res_bus_ws = await client.get("/api/v1/sessions?domain=%20business%20")
        assert res_bus_ws.status_code == 200
        assert res_bus_ws.json()["meta"]["total"] == 1
        assert res_bus_ws.json()["data"][0]["id"] == str(s_bus.id)
        assert res_bus_ws.json()["data"][0]["domain"] == "business"
