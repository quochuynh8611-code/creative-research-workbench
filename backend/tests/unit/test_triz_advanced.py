"""
test_triz_advanced.py — Unit tests cho Advanced TRIZ Toolkit (Batch C34 PR 1: ARIZ, Evolution Trends & Resource Taxonomy).

Tuân thủ:
  - TDD Test-First
  - Kiểm tra đúng 6 bước ARIZ rút gọn
  - Kiểm tra đúng 8 quy luật tiến hóa Altshuller
  - Kiểm tra đúng 5 nhóm tài nguyên TRIZ
  - Kiểm tra Pydantic NoteSourceContextUnion mở rộng cho 3 context mới
  - Kiểm tra bảo mật Zero Secret Leakage
"""
from __future__ import annotations

import re

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.main import app
from app.schemas.note_context import (
    TrizArizContext,
    TrizEvolutionContext,
    TrizResourceContext,
    parse_note_source_context,
)

_SECRET_PATTERN = re.compile(r"sk-proj-[A-Za-z0-9_-]+|bearer\s+[A-Za-z0-9_.-]+|password=|secret=", re.IGNORECASE)


@pytest.mark.asyncio
async def test_get_ariz_steps_returns_exactly_6_stages():
    """GET /api/v1/triz/ariz-steps phải trả về đúng 6 bước ARIZ rút gọn chuẩn hóa."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/triz/ariz-steps")

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body.get("total_steps") == 6
    steps = body["data"]
    assert len(steps) == 6

    for idx, step in enumerate(steps, start=1):
        assert step["step_number"] == idx
        assert step["code"] == f"ariz_step_{idx}"
        assert len(step["name_vi"].strip()) > 0
        assert len(step["name_en"].strip()) > 0
        assert len(step["description"].strip()) > 0
        assert isinstance(step["trigger_questions"], list)
        assert len(step["trigger_questions"]) >= 1
        assert isinstance(step["recommended_actions"], list)
        assert len(step["recommended_actions"]) >= 1

    # Kiểm tra bước 1 là Mini-Problem, bước 3 là IFR / Physical Contradiction
    assert "Mini-Problem" in steps[0]["name_en"] or "Problem Model" in steps[0]["name_en"]
    assert "Ideal Final Result" in steps[2]["name_en"] or "IFR" in steps[2]["name_en"]


@pytest.mark.asyncio
async def test_get_evolution_trends_returns_exactly_8_patterns():
    """GET /api/v1/triz/evolution-trends phải trả về đúng 8 quy luật tiến hóa Altshuller kinh điển."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/triz/evolution-trends")

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body.get("total_trends") == 8
    trends = body["data"]
    assert len(trends) == 8

    trend_ids = [t["trend_id"] for t in trends]
    assert len(set(trend_ids)) == 8  # Các trend_id không được trùng lặp

    for trend in trends:
        assert trend["trend_id"].startswith("trend_")
        assert len(trend["name_vi"].strip()) > 0
        assert len(trend["name_en"].strip()) > 0
        assert len(trend["description"].strip()) > 0
        assert isinstance(trend["evolution_stages"], list)
        assert len(trend["evolution_stages"]) >= 3
        assert isinstance(trend["domain_examples"], dict)
        assert "engineering" in trend["domain_examples"]


@pytest.mark.asyncio
async def test_get_resource_taxonomy_returns_exactly_5_categories():
    """GET /api/v1/triz/resource-taxonomy phải trả về đúng 5 nhóm tài nguyên TRIZ cốt lõi."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/triz/resource-taxonomy")

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body.get("total_categories") == 5
    categories = body["data"]
    assert len(categories) == 5

    category_keys = [c["category"] for c in categories]
    expected_keys = ["substance", "field", "time", "space", "information"]
    assert category_keys == expected_keys

    for cat in categories:
        assert len(cat["name_vi"].strip()) > 0
        assert len(cat["name_en"].strip()) > 0
        assert isinstance(cat["subtypes"], list)
        assert len(cat["subtypes"]) >= 2
        assert isinstance(cat["checklist_questions"], list)
        assert len(cat["checklist_questions"]) >= 2


def test_note_context_triz_ariz_validation():
    """Schema TrizArizContext kiểm soát nghiêm ngặt step_number 1..6 và ký tự điều khiển."""
    # Hợp lệ
    ctx = TrizArizContext(
        schema_version=1,
        source_type="triz_ariz",
        step_number=3,
        step_name="Ideal Final Result (IFR)",
    )
    assert ctx.step_number == 3
    assert ctx.step_name == "Ideal Final Result (IFR)"

    # Parse qua Discriminated Union
    parsed = parse_note_source_context({
        "schema_version": 1,
        "source_type": "triz_ariz",
        "step_number": 1,
        "step_name": "Mini-Problem Modeling",
    })
    assert isinstance(parsed, TrizArizContext)
    assert parsed.step_number == 1

    # Không hợp lệ: step_number < 1
    with pytest.raises(ValidationError):
        TrizArizContext(
            schema_version=1,
            source_type="triz_ariz",
            step_number=0,
            step_name="Invalid Step",
        )

    # Không hợp lệ: step_number > 6
    with pytest.raises(ValidationError):
        TrizArizContext(
            schema_version=1,
            source_type="triz_ariz",
            step_number=7,
            step_name="Invalid Step",
        )

    # Không hợp lệ: step_name chứa ký tự điều khiển
    with pytest.raises(ValidationError):
        TrizArizContext(
            schema_version=1,
            source_type="triz_ariz",
            step_number=2,
            step_name="Line 1\nLine 2",
        )


def test_note_context_triz_evolution_validation():
    """Schema TrizEvolutionContext kiểm soát trend_id và trend_name."""
    ctx = TrizEvolutionContext(
        schema_version=1,
        source_type="triz_evolution",
        trend_id="trend_dynamism",
        trend_name="Increasing Dynamism",
    )
    assert ctx.trend_id == "trend_dynamism"

    parsed = parse_note_source_context({
        "schema_version": 1,
        "source_type": "triz_evolution",
        "trend_id": "trend_ideality",
        "trend_name": "Increasing Ideality",
    })
    assert isinstance(parsed, TrizEvolutionContext)
    assert parsed.trend_id == "trend_ideality"

    # Không hợp lệ: chuỗi rỗng / whitespace-only
    with pytest.raises(ValidationError):
        TrizEvolutionContext(
            schema_version=1,
            source_type="triz_evolution",
            trend_id="trend_dynamism",
            trend_name="   ",
        )


def test_note_context_triz_resource_validation():
    """Schema TrizResourceContext kiểm soát 5 loại tài nguyên nghiêm ngặt."""
    ctx = TrizResourceContext(
        schema_version=1,
        source_type="triz_resource",
        resource_type="substance",
        resource_name="Vật liệu thừa trong xưởng",
    )
    assert ctx.resource_type == "substance"

    parsed = parse_note_source_context({
        "schema_version": 1,
        "source_type": "triz_resource",
        "resource_type": "field",
        "resource_name": "Nhiệt lượng tỏa ra từ động cơ",
    })
    assert isinstance(parsed, TrizResourceContext)
    assert parsed.resource_type == "field"

    # Không hợp lệ: resource_type ngoài danh mục 5 nhóm
    with pytest.raises(ValidationError):
        TrizResourceContext(
            schema_version=1,
            source_type="triz_resource",
            resource_type="magic",  # type: ignore[arg-type]
            resource_name="Năng lượng huyền bí",
        )


@pytest.mark.asyncio
async def test_triz_advanced_zero_secret_leak():
    """Tất cả 3 endpoints không được để lộ secret, token hay credential."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        for url in ["/api/v1/triz/ariz-steps", "/api/v1/triz/evolution-trends", "/api/v1/triz/resource-taxonomy"]:
            resp = await client.get(url)
            assert resp.status_code == 200
            content = resp.text
            assert not _SECRET_PATTERN.search(content), f"Secret pattern matched in {url}"
