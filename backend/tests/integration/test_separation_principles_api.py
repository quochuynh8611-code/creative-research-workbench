"""
test_separation_principles_api.py — Integration tests cho API Separation Principles (Batch A: RED Phase)

Ref: docs/SEPARATION_PRINCIPLES_SPEC.md
Tuân thủ:
1. Endpoint POST /api/v1/sessions/{session_id}/problem-frame giữ nguyên chính xác 9 field cũ:
   id, session_id, raw_statement, normalized_statement, contradiction_type,
   improving_parameter, worsening_parameter, domain, created_at.
2. Bổ sung trường additive 'separation_strategies' khi mâu thuẫn là physical (optional-safe, non-breaking).
3. Không trả về separation_strategies đối với technical/none/unknown.
4. Endpoint tra cứu danh mục GET /api/v1/triz/separation-principles trả về 4 strategies chuẩn.
"""
from __future__ import annotations

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.api.v1.endpoints.sessions import get_problem_structuring_service
from app.services.problem_structuring_service import ProblemStructuringService
from app.domain.models import ResearchSession
from app.main import app


_LEGACY_KEYS = {
    "id",
    "session_id",
    "raw_statement",
    "normalized_statement",
    "contradiction_type",
    "improving_parameter",
    "worsening_parameter",
    "domain",
    "created_at",
}


@pytest.fixture()
def override_problem_structuring_service(db_session: Session):
    service = ProblemStructuringService(bind=db_session)
    app.dependency_overrides[get_problem_structuring_service] = lambda: service
    yield
    app.dependency_overrides.pop(get_problem_structuring_service, None)


@pytest.mark.asyncio
async def test_post_problem_frame_preserves_all_legacy_fields(
    override_problem_structuring_service,
    sample_session: ResearchSession,
):
    """
    GIVEN: Session tồn tại trong hệ thống
    WHEN: Gọi POST /api/v1/sessions/{session_id}/problem-frame với technical contradiction
    THEN: Response trả về 201 Created và chứa đầy đủ 9 trường dữ liệu cốt lõi (backward compatibility).
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/sessions/{sample_session.id}/problem-frame",
            json={
                "raw_statement": "Tăng tốc độ di chuyển nhưng làm tăng khối lượng tổng thể của hệ thống.",
                "domain": "mechanical",
            },
        )

    assert response.status_code == 201
    data = response.json()
    for key in _LEGACY_KEYS:
        assert key in data, f"Trường bắt buộc '{key}' bị thiếu trong response payload"
    assert data["contradiction_type"] == "technical"


@pytest.mark.asyncio
async def test_post_problem_frame_physical_includes_separation_strategies_enrichment(
    override_problem_structuring_service,
    sample_session: ResearchSession,
):
    """
    GIVEN: Session tồn tại trong hệ thống
    WHEN: Gọi POST /api/v1/sessions/{session_id}/problem-frame với physical contradiction
    THEN: Response trả về 201 Created, contradiction_type == 'physical'
    AND: Chứa trường additive 'separation_strategies' với 4 chiến lược phân tách (RED trong Batch A).
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/sessions/{sample_session.id}/problem-frame",
            json={
                "raw_statement": "Bánh răng cần vừa cứng để chịu lực va đập vừa mềm để giảm chấn và triệt tiêu tiếng ồn.",
                "domain": "mechanical",
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["contradiction_type"] == "physical"
    # Kỳ vọng RED trong Batch A: endpoint hiện hữu chưa enrich separation_strategies
    assert "separation_strategies" in data, "Thiếu trường additive 'separation_strategies' cho mâu thuẫn vật lý"
    strategies = data["separation_strategies"]
    assert isinstance(strategies, list)
    assert len(strategies) == 4
    strategy_ids = {s.get("id") for s in strategies}
    assert strategy_ids == {"space", "time", "condition", "system_level"}


@pytest.mark.asyncio
async def test_post_problem_frame_technical_does_not_include_separation_strategies(
    override_problem_structuring_service,
    sample_session: ResearchSession,
):
    """
    GIVEN: Session tồn tại trong hệ thống
    WHEN: Gọi POST /api/v1/sessions/{session_id}/problem-frame với technical contradiction
    THEN: Không trả về separation_strategies (hoặc là None), tránh ảnh hưởng technical flow.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/sessions/{sample_session.id}/problem-frame",
            json={
                "raw_statement": "Cải thiện công suất động cơ làm tăng nhiệt độ tỏa ra.",
                "domain": "energy",
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["contradiction_type"] == "technical"
    assert data.get("separation_strategies") is None


@pytest.mark.asyncio
async def test_get_separation_principles_catalog_endpoint():
    """
    WHEN: Gọi GET /api/v1/triz/separation-principles
    THEN: Trả về HTTP 200 kèm danh mục 4 chiến lược phân tách (RED trong Batch A vì endpoint chưa có).
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/separation-principles")

    # Kỳ vọng RED trong Batch A: endpoint chưa được định tuyến -> 404
    assert response.status_code == 200
    data = response.json()
    assert "data" in data or "strategies" in data
