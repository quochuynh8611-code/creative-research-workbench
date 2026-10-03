"""
Integration tests for Phase 9.3: Session Import & Domain Templates.
"""

from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session

from app.main import app
from app.domain.models import (
    ResearchSession,
    SessionStatus,
    ProblemFrame,
    ResearchNote,
    CandidateSolution,
)


@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    """Dependency override cho get_db và db session."""
    try:
        from app.api.v1.endpoints.sessions import get_db
        app.dependency_overrides[get_db] = lambda: db_session
        yield
        app.dependency_overrides.pop(get_db, None)
    except ImportError:
        yield


@pytest.mark.asyncio
async def test_import_session_json_snapshot_success(db_session: Session):
    """
    Scenario 1.1: Import session từ JSON export snapshot thành công
    GIVEN: Một snapshot JSON có session, problem_frame, 2 research_notes và 1 candidate_solution
    WHEN: Gọi POST /api/v1/sessions/import
    THEN: Trả về HTTP 201 Created với ID phiên mới, ProblemFrame, Notes và Solutions được tạo đầy đủ.
    """
    snapshot_payload = {
        "session": {
            "title": "Tối ưu hóa độ bền động cơ điện",
            "description": "Nghiên cứu vật liệu tản nhiệt thế hệ mới",
            "status": "active",
            "workflow_state": "ideation",
            "tags": ["motor", "ev", "triz"],
        },
        "problem_frame": {
            "raw_statement": "Động cơ cần tăng công suất nhưng không được tăng nhiệt độ",
            "normalized_statement": "Tăng công suất trong khi giữ nhiệt độ an toàn",
            "contradiction_type": "technical",
            "improving_parameter": "power",
            "worsening_parameter": "temperature",
            "domain": "technical",
        },
        "research_notes": [
            {
                "content": "Phát hiện màng gốm tản nhiệt dẫn nhiệt gấp 3 lần",
                "note_type": "insight",
            },
            {
                "content": "Cần kiểm tra tương thích với dầu làm mát",
                "note_type": "question",
            },
        ],
        "candidate_solutions": [
            {
                "title": "Rotor lõi rỗng có cánh tản nhiệt tích hợp",
                "mechanism": "Lưu thông khí đối lưu tự nhiên khi quay",
                "status": "candidate",
                "novelty_score": 0.85,
                "feasibility_score": 0.8,
                "risk_notes": "Cần cân bằng động ở vòng tua cao",
            },
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json=snapshot_payload)

    assert response.status_code == 201
    res_data = response.json()
    assert "data" in res_data
    new_session_id = res_data["data"]["id"]
    assert new_session_id is not None
    assert res_data["data"]["title"] == "Tối ưu hóa độ bền động cơ điện"
    assert res_data["imported_elements"]["problem_frame"] is True
    assert res_data["imported_elements"]["notes_count"] == 2
    assert res_data["imported_elements"]["solutions_count"] == 1

    # Kiểm tra DB records
    sess_uuid = uuid.UUID(new_session_id)
    imported_sess = db_session.query(ResearchSession).filter_by(id=sess_uuid).first()
    assert imported_sess is not None
    assert imported_sess.title == "Tối ưu hóa độ bền động cơ điện"

    imported_frame = db_session.query(ProblemFrame).filter_by(session_id=sess_uuid).first()
    assert imported_frame is not None
    assert imported_frame.improving_parameter == "power"
    assert imported_frame.worsening_parameter == "temperature"

    imported_notes = db_session.query(ResearchNote).filter_by(session_id=sess_uuid).all()
    assert len(imported_notes) == 2

    imported_solutions = db_session.query(CandidateSolution).filter_by(session_id=sess_uuid).all()
    assert len(imported_solutions) == 1
    assert imported_solutions[0].title == "Rotor lõi rỗng có cánh tản nhiệt tích hợp"


@pytest.mark.asyncio
async def test_import_session_missing_title_returns_400(db_session: Session):
    """
    Scenario 1.2: Import snapshot thiếu tiêu đề trả về 400 Bad Request
    """
    invalid_snapshot = {
        "session": {
            "title": "   ",
            "description": "Không có tiêu đề",
        }
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json=invalid_snapshot)

    assert response.status_code == 400
    assert "missing required session title" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_import_session_malformed_returns_400(db_session: Session):
    """
    Scenario 1.3: Import payload không hợp lệ trả về 400 Bad Request
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json={"random_field": 123})

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_domain_templates():
    """
    Scenario 2.1: Lấy danh sách Domain Templates
    WHEN: Gọi GET /api/v1/sessions/templates
    THEN: Trả về HTTP 200 kèm danh sách ít nhất 3 templates
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/sessions/templates")

    assert response.status_code == 200
    data = response.json().get("data", [])
    assert len(data) >= 3
    template_ids = [t["id"] for t in data]
    assert "engineering_composite_arm" in template_ids
    assert "business_delivery_speed_cost" in template_ids
    assert "software_latency_security" in template_ids


@pytest.mark.asyncio
async def test_create_session_from_template_success(db_session: Session):
    """
    Scenario 2.2: Tạo session mới từ Domain Template thành công
    WHEN: Gọi POST /api/v1/sessions/from-template với template_id hợp lệ
    THEN: Tạo ResearchSession mới kèm ProblemFrame cấu hình sẵn theo template
    """
    body = {
        "template_id": "engineering_composite_arm",
        "custom_title": "Nghiên cứu Cánh tay Robot Thế hệ Mới",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/from-template", json=body)

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["title"] == "Nghiên cứu Cánh tay Robot Thế hệ Mới"
    assert data["domain"] == "technical"
    assert data["workflow_state"] == "structuring"

    sess_uuid = uuid.UUID(data["id"])
    frame = db_session.query(ProblemFrame).filter_by(session_id=sess_uuid).first()
    assert frame is not None
    assert frame.improving_parameter == "strength"
    assert frame.worsening_parameter == "weight_moving"


@pytest.mark.asyncio
async def test_create_session_from_non_existent_template_returns_404():
    """
    Scenario 2.3: Tạo session từ template_id không tồn tại trả về 404
    """
    body = {
        "template_id": "invalid_template_id_12345",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/from-template", json=body)

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_import_session_deep_relation_recreation(db_session: Session):
    """
    Scenario 1.4: Deep relation recreation khi import snapshot phức tạp
    GIVEN: Snapshot có session, problem_frame (physical contradiction),
           5 research_notes với các note_type khác nhau và source_chunk_id (hợp lệ trong DB),
           3 candidate_solutions với đầy đủ score, status, risk_notes.
    WHEN: Gọi POST /api/v1/sessions/import
    THEN: Trả về HTTP 201 Created, khôi phục đúng số lượng và toàn vẹn dữ liệu quan hệ sâu.
    """
    from app.domain.models import Document, Chunk
    doc = Document(
        filename="graphene_research.md",
        filepath="/docs/graphene_research.md",
        title="Nghiên cứu Graphene",
        content_hash="test_hash_graphene_001",
    )
    db_session.add(doc)
    db_session.flush()

    chunk = Chunk(
        document_id=doc.id,
        chunk_index=0,
        content="Graphene oxit khử cải thiện dẫn điện",
        token_count=10,
        embedding=[0.0] * 1536,
    )
    db_session.add(chunk)
    db_session.commit()
    sample_chunk_id = chunk.id
    snapshot_payload = {
        "session": {
            "title": "Nghiên cứu Siêu tụ điện Graphene Hybrid",
            "description": "Tích hợp pin Li-ion và siêu tụ điện",
            "status": "active",
            "workflow_state": "evaluation",
            "tags": ["energy", "graphene", "supercapacitor"],
        },
        "problem_frame": {
            "raw_statement": "Siêu tụ cần phóng điện cực nhanh nhưng phải giữ mật độ năng lượng cao",
            "normalized_statement": "Tối ưu hóa tốc độ phóng xả trong khi duy trì mật độ năng lượng thể tích",
            "contradiction_type": "physical",
            "improving_parameter": "power",
            "worsening_parameter": "energy_stationary",
            "domain": "energy",
        },
        "research_notes": [
            {"content": "Graphene oxit khử cải thiện dẫn điện", "note_type": "insight", "source_chunk_id": str(sample_chunk_id)},
            {"content": "Giả thuyết điện giải ion lỏng chịu áp cao", "note_type": "hypothesis"},
            {"content": "Quyết định chọn màng ngăn xốp Nano", "note_type": "decision"},
            {"content": "Liệu có hiện tượng tự phóng điện?", "note_type": "question"},
            {"content": "Thử nghiệm chu kỳ nạp xả 10000 lần", "note_type": "action"},
        ],
        "candidate_solutions": [
            {
                "title": "Cấu trúc điện cực 3D Graphene-CNT",
                "mechanism": "Tạo kênh dẫn ion 3 chiều siêu tốc",
                "status": "accepted",
                "novelty_score": 0.95,
                "feasibility_score": 0.85,
                "risk_notes": "Giá thành sản xuất CNT cao",
            },
            {
                "title": "Chất điện phân gel Polymer dẫn điện",
                "mechanism": "Giảm rò rỉ dung môi và tăng an toàn",
                "status": "candidate",
                "novelty_score": 0.80,
                "feasibility_score": 0.75,
                "risk_notes": "Độ dẫn ion thấp ở nhiệt độ âm",
            },
            {
                "title": "Bọc điện cực bằng màng kim loại kiềm",
                "mechanism": "Tăng dung lượng lưu trữ",
                "status": "rejected",
                "novelty_score": 0.50,
                "feasibility_score": 0.30,
                "risk_notes": "Rủi ro phản ứng tỏa nhiệt mãnh liệt",
            },
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json=snapshot_payload)

    assert response.status_code == 201
    res_data = response.json()
    new_session_id = res_data["data"]["id"]
    sess_uuid = uuid.UUID(new_session_id)

    # 1. Verify Session & Workflow State
    imported_sess = db_session.query(ResearchSession).filter_by(id=sess_uuid).first()
    assert imported_sess is not None
    assert imported_sess.workflow_state == "evaluation"

    # 2. Verify Problem Frame & Contradiction Type
    imported_frame = db_session.query(ProblemFrame).filter_by(session_id=sess_uuid).first()
    assert imported_frame is not None
    from app.domain.models import ContradictionType
    assert imported_frame.contradiction_type == ContradictionType.physical
    assert imported_frame.domain == "energy"

    # 3. Verify All 5 Notes & preserved chunk UUID
    imported_notes = db_session.query(ResearchNote).filter_by(session_id=sess_uuid).all()
    assert len(imported_notes) == 5
    note_types = {n.note_type for n in imported_notes}
    assert note_types == {"insight", "hypothesis", "decision", "question", "action"}
    note_with_chunk = next(n for n in imported_notes if n.note_type == "insight")
    assert note_with_chunk.source_chunk_id == sample_chunk_id

    # 4. Verify All 3 Solutions & Attributes
    imported_solutions = db_session.query(CandidateSolution).filter_by(session_id=sess_uuid).all()
    assert len(imported_solutions) == 3
    sol_by_title = {s.title: s for s in imported_solutions}
    assert "Cấu trúc điện cực 3D Graphene-CNT" in sol_by_title
    assert sol_by_title["Cấu trúc điện cực 3D Graphene-CNT"].status == "accepted"
    assert sol_by_title["Cấu trúc điện cực 3D Graphene-CNT"].novelty_score == 0.95
    assert sol_by_title["Cấu trúc điện cực 3D Graphene-CNT"].risk_notes == "Giá thành sản xuất CNT cao"
    assert sol_by_title["Bọc điện cực bằng màng kim loại kiềm"].status == "rejected"


@pytest.mark.asyncio
async def test_import_session_fail_closed_non_list_research_notes(db_session: Session):
    """
    Scenario 1.5: Fail-closed khi research_notes không phải dạng list
    GIVEN: Snapshot có research_notes là một dict thay vì list
    WHEN: Gọi POST /api/v1/sessions/import
    THEN: Trả về HTTP 400 Bad Request và không tạo session partial trong DB.
    """
    initial_count = db_session.query(ResearchSession).count()
    malformed_snapshot = {
        "session": {"title": "Test Malformed Notes"},
        "research_notes": {"invalid_key": "not_a_list"},
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json=malformed_snapshot)

    assert response.status_code == 400
    assert "research_notes must be a list" in response.json()["detail"].lower()
    assert db_session.query(ResearchSession).count() == initial_count


@pytest.mark.asyncio
async def test_import_session_fail_closed_non_list_candidate_solutions(db_session: Session):
    """
    Scenario 1.6: Fail-closed khi candidate_solutions không phải dạng list
    GIVEN: Snapshot có candidate_solutions là string
    WHEN: Gọi POST /api/v1/sessions/import
    THEN: Trả về HTTP 400 Bad Request và không tạo session partial trong DB.
    """
    initial_count = db_session.query(ResearchSession).count()
    malformed_snapshot = {
        "session": {"title": "Test Malformed Solutions"},
        "candidate_solutions": "invalid_solutions_string",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json=malformed_snapshot)

    assert response.status_code == 400
    assert "candidate_solutions must be a list" in response.json()["detail"].lower()
    assert db_session.query(ResearchSession).count() == initial_count


@pytest.mark.asyncio
async def test_import_session_fail_closed_non_dict_problem_frame(db_session: Session):
    """
    Scenario 1.7: Fail-closed khi problem_frame không phải dạng dict
    GIVEN: Snapshot có problem_frame là string hoặc list
    WHEN: Gọi POST /api/v1/sessions/import
    THEN: Trả về HTTP 400 Bad Request và không tạo session partial trong DB.
    """
    initial_count = db_session.query(ResearchSession).count()
    malformed_snapshot = {
        "session": {"title": "Test Malformed Frame"},
        "problem_frame": ["invalid_frame_list"],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json=malformed_snapshot)

    assert response.status_code == 400
    assert "problem_frame must be an object" in response.json()["detail"].lower()
    assert db_session.query(ResearchSession).count() == initial_count


@pytest.mark.asyncio
async def test_import_session_ignores_derived_recommended_methods(db_session: Session):
    """
    Scenario 1.8: recommended_methods trong snapshot là derived data, không được lưu như persisted truth
    GIVEN: Snapshot có trường recommended_methods chứa dữ liệu giả mạo
    WHEN: Gọi POST /api/v1/sessions/import
    THEN: Import thành công, không tạo bảng hay state giả từ recommended_methods,
          và MethodRecommender tính toán độc lập dựa trên ProblemFrame thực tế.
    """
    fake_methods = [
        {"principle_id": 999, "title": "Injected Fake Principle", "rationale": "Injected"}
    ]
    snapshot_payload = {
        "session": {
            "title": "Session với Derived Methods",
            "workflow_state": "structuring",
        },
        "problem_frame": {
            "raw_statement": "Tăng công suất nhưng không tăng khối lượng",
            "contradiction_type": "technical",
            "improving_parameter": "power",
            "worsening_parameter": "weight_moving",
            "domain": "technical",
        },
        "recommended_methods": fake_methods,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json=snapshot_payload)

    assert response.status_code == 201
    new_session_id = response.json()["data"]["id"]
    sess_uuid = uuid.UUID(new_session_id)

    # Recompute via canonical MethodRecommender
    from app.services.method_recommender import MethodRecommender
    recommender = MethodRecommender(bind=db_session)
    recalculated = recommender.recommend_methods(sess_uuid)

    # Recalculated results should be valid TRIZ recommendations (or empty if no matrix match),
    # but must NOT contain the injected fake principle ID 999
    principle_ids = [m.get("principle_id") or m.get("id") for m in recalculated]
    assert 999 not in principle_ids


@pytest.mark.asyncio
async def test_domain_templates_catalog_stability_and_immutability():
    """
    Scenario 2.4: Domain templates catalog có cấu trúc cố định và bất biến
    WHEN: Gọi GET /api/v1/sessions/templates
    THEN: Luôn trả về 3 canonical templates với đầy đủ trường bắt buộc và domain chính xác.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/sessions/templates")

    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 3

    domains = {t["domain"] for t in data}
    assert domains == {"technical", "business", "software"}

    for tpl in data:
        assert "id" in tpl and tpl["id"]
        assert "title" in tpl and tpl["title"]
        assert "tags" in tpl and isinstance(tpl["tags"], list)
        assert "workflow_state" in tpl and tpl["workflow_state"] == "structuring"
        assert "problem_frame" in tpl and isinstance(tpl["problem_frame"], dict)
        pf = tpl["problem_frame"]
        assert "raw_statement" in pf and pf["raw_statement"]
        assert "contradiction_type" in pf
        assert "improving_parameter" in pf
        assert "worsening_parameter" in pf
