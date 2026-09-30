"""
test_triz_catalog_api.py — Contract-First Integration Tests cho TRIZ Catalog & Deterministic Lookup API

Giai đoạn: Track 1.1 — Phase RED (Failing contract-first tests)

Tài liệu tham chiếu:
  - docs/PHASE_6_7_EXECUTION_SPEC.md
  - docs/ADR/ADR-002-phase-6-7-foundation-and-canvas.md
  - docs/TRIZ_CANONICAL_IMPORT_VALIDATION.md

Mục tiêu kiểm thử:
  1. GET /api/v1/triz/parameters: Trả về danh mục 39 thông số kỹ thuật TRIZ song ngữ (status 200, total 39).
  2. GET /api/v1/triz/principles: Trả về danh mục 40 nguyên tắc sáng tạo TRIZ kèm metadata (status 200, total 40).
  3. GET /api/v1/triz/lookup?improving={id}&worsening={id}: Tra cứu ma trận Altshuller 39x39 tất định (status 200).
  4. GET /api/v1/triz/lookup?improving={id}&worsening={id} (diagonal): Ô đường chéo i=j trả về is_diagonal=True và principles=[].
  5. GET /api/v1/triz/lookup: Tham số ngoài dải [1..39] bị chặn fail-fast với status 422.
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_get_triz_parameters_returns_39_items():
    """
    GIVEN: Ứng dụng FastAPI đang chạy với triz catalog service
    WHEN: Client gửi request GET /api/v1/triz/parameters
    THEN: Server trả về 200 OK, danh sách chứa đủ 39 parameters và item có đủ metadata
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/parameters")

    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    body = response.json()
    assert "data" in body, "Response thiếu khóa 'data'"
    assert "meta" in body, "Response thiếu khóa 'meta'"
    assert isinstance(body["data"], list), "'data' phải là danh sách"
    assert body["meta"].get("total") == 39, f"Cần đúng 39 thông số, nhận được: {body['meta'].get('total')}"
    assert len(body["data"]) == 39, f"Chiều dài data phải là 39, nhận được: {len(body['data'])}"

    first_item = body["data"][0]
    for required_field in ("id", "code", "name_vi", "name_en"):
        assert required_field in first_item, f"Thông số thiếu trường bắt buộc: '{required_field}'"


@pytest.mark.asyncio
async def test_get_triz_principles_returns_40_items():
    """
    GIVEN: Ứng dụng FastAPI đang chạy với triz catalog service
    WHEN: Client gửi request GET /api/v1/triz/principles
    THEN: Server trả về 200 OK, danh sách chứa đủ 40 principles và item có đầy đủ explanation/examples
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/principles")

    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    body = response.json()
    assert "data" in body, "Response thiếu khóa 'data'"
    assert "meta" in body, "Response thiếu khóa 'meta'"
    assert isinstance(body["data"], list), "'data' phải là danh sách"
    assert body["meta"].get("total") == 40, f"Cần đúng 40 nguyên tắc, nhận được: {body['meta'].get('total')}"
    assert len(body["data"]) == 40, f"Chiều dài data phải là 40, nhận được: {len(body['data'])}"

    first_item = body["data"][0]
    for required_field in ("id", "principle_id", "name_vi", "name_en", "description", "explanation", "examples"):
        assert required_field in first_item, f"Nguyên tắc thiếu trường bắt buộc: '{required_field}'"
    assert isinstance(first_item["examples"], list), "'examples' phải là danh sách"


@pytest.mark.asyncio
async def test_lookup_triz_matrix_canonical_coordinates():
    """
    GIVEN: Tọa độ ngoài đường chéo (17: Temperature, 14: Strength)
    WHEN: Client gửi request GET /api/v1/triz/lookup?improving=17&worsening=14
    THEN: Server trả về 200 OK, is_diagonal=False, đúng thông tin improving/worsening và danh sách nguyên tắc Altshuller
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/lookup", params={"improving": 17, "worsening": 14})

    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    body = response.json()
    for required_key in ("improving_parameter", "worsening_parameter", "is_diagonal", "principles", "principles_count"):
        assert required_key in body, f"Lookup response thiếu khóa '{required_key}'"

    assert body["is_diagonal"] is False
    assert body["improving_parameter"]["id"] == 17
    assert body["worsening_parameter"]["id"] == 14
    assert isinstance(body["principles"], list)
    assert body["principles_count"] == len(body["principles"])
    assert body["principles_count"] > 0, "Tọa độ (17, 14) phải có nguyên tắc gợi ý theo Altshuller 1985"


@pytest.mark.asyncio
async def test_lookup_triz_matrix_diagonal_returns_empty():
    """
    GIVEN: Tọa độ trên đường chéo (5: Area moving, 5: Area moving)
    WHEN: Client gửi request GET /api/v1/triz/lookup?improving=5&worsening=5
    THEN: Server trả về 200 OK, is_diagonal=True và principles=[] (mâu thuẫn vật lý không có giải pháp kỹ thuật 39x39)
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/lookup", params={"improving": 5, "worsening": 5})

    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    body = response.json()
    assert body.get("is_diagonal") is True
    assert body.get("principles") == []
    assert body.get("principles_count") == 0


@pytest.mark.asyncio
async def test_lookup_triz_matrix_out_of_bounds_returns_422():
    """
    GIVEN: Tham số thông số kỹ thuật ngoài dải hợp lệ [1..39]
    WHEN: Client gửi request GET /api/v1/triz/lookup?improving=0&worsening=45
    THEN: Server fail-fast với mã lỗi 422 Unprocessable Entity
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/triz/lookup", params={"improving": 0, "worsening": 45})

    assert response.status_code == 422, f"Expected 422 Unprocessable Entity, got {response.status_code}"
