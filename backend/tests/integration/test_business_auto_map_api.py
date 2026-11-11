"""
test_business_auto_map_api.py — Integration test suite cho Batch B2: Business-aware TRIZ auto-map.
Khóa contract:
  1. Default request giữ nguyên kết quả legacy (không tự kích hoạt business phrases).
  2. Explicit lens="engineering" giữ nguyên kết quả legacy.
  3. Explicit lens="business" nhận diện đủ 6 cụm từ kinh doanh đã duyệt.
  4. Deduplication: Gộp kỹ thuật + kinh doanh cùng 1 parameter thành 1 candidate.
  5. No-match non-empty trả về HTTP 200 kèm data [].
  6. Empty / whitespace trả về HTTP 400.
  7. Invalid lens trả về HTTP 422.
  8. False-positive defense: Các từ như "vốn dĩ", "cố vấn", "thị trường", "khách hàng" không tự match.
  9. Determinism: Top_k và tie-breaking tất định theo ID.
  10. ProblemFrame extraction không bị ảnh hưởng.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.domain.models import ContradictionType
from app.main import app
from app.services.problem_structuring_service import ProblemStructuringService


@pytest.mark.asyncio
async def test_auto_map_default_lens_is_engineering_legacy():
    """
    Test 1: Request không truyền trường 'lens' mặc định là 'engineering'.
    Các cụm từ kinh doanh thuần túy (không chứa từ khóa kỹ thuật) không được nhận diện.
    """
    payload = {
        "text": "Doanh nghiệp cần cải thiện tỷ lệ giữ chân nhân sự trong quý 4",
        "top_k": 5,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/triz/auto-map", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["data"] == [], "Default lens phải giữ nguyên legacy behavior, không match cụm kinh doanh"
    assert data["meta"]["total_candidates"] == 0


@pytest.mark.asyncio
async def test_auto_map_explicit_engineering_lens_legacy():
    """
    Test 2: Request truyền tường minh lens='engineering'.
    Hành vi hoàn toàn giống legacy: 5 cụm kinh doanh không có từ khóa kỹ thuật trả về empty.
    """
    phrases = [
        "tỷ lệ giữ chân nhân sự",
        "vòng đời khách hàng",
        "hao hụt hàng tồn kho",
        "thời gian chờ phê duyệt",
        "trải nghiệm người dùng",
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for phrase in phrases:
            response = await client.post(
                "/api/v1/triz/auto-map",
                json={"text": phrase, "top_k": 5, "lens": "engineering"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["data"] == [], f"lens='engineering' không được match cụm '{phrase}'"


@pytest.mark.asyncio
async def test_auto_map_business_lens_recognizes_all_6_approved_phrases():
    """
    Test 3: Request truyền lens='business' nhận diện chính xác 6 cụm từ kinh doanh được phê duyệt:
      1. 'tốc độ ra mắt thị trường' -> param 9 (speed)
      2. 'tỷ lệ giữ chân nhân sự' -> param 13 (stability)
      3. 'vòng đời khách hàng' -> param 16 (duration_stationary)
      4. 'hao hụt hàng tồn kho' -> param 23 (loss_of_substance)
      5. 'thời gian chờ phê duyệt' -> param 25 (loss_of_time)
      6. 'trải nghiệm người dùng' -> param 33 (ease_of_operation)
    """
    expected_mappings = [
        ("Cần đẩy nhanh tốc độ ra mắt thị trường", 9, "speed", "tốc độ ra mắt thị trường"),
        ("Tối ưu hóa tỷ lệ giữ chân nhân sự nòng cốt", 13, "stability", "tỷ lệ giữ chân nhân sự"),
        ("Kéo dài vòng đời khách hàng trung thành", 16, "duration_stationary", "vòng đời khách hàng"),
        ("Giảm thiểu hao hụt hàng tồn kho trong chuỗi cung ứng", 23, "loss_of_substance", "hao hụt hàng tồn kho"),
        ("Rút ngắn thời gian chờ phê duyệt hợp đồng", 25, "loss_of_time", "thời gian chờ phê duyệt"),
        ("Nâng cao trải nghiệm người dùng trên ứng dụng", 33, "ease_of_operation", "trải nghiệm người dùng"),
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for text, expected_id, expected_code, expected_kw in expected_mappings:
            response = await client.post(
                "/api/v1/triz/auto-map",
                json={"text": text, "top_k": 5, "lens": "business"},
            )
            assert response.status_code == 200
            data = response.json()
            matches = data["data"]
            assert len(matches) > 0, f"lens='business' phải tìm thấy candidate cho '{text}'"

            matched_ids = [m["id"] for m in matches]
            matched_codes = [m["code"] for m in matches]
            assert expected_id in matched_ids, f"Expected param ID {expected_id} in {matched_ids} for '{text}'"
            assert expected_code in matched_codes, f"Expected param code {expected_code} in {matched_codes} for '{text}'"

            # Tìm item tương ứng và kiểm tra matched_keywords
            target = next(m for m in matches if m["id"] == expected_id)
            assert any(expected_kw.lower() in kw.lower() for kw in target["matched_keywords"]), (
                f"Expected keyword '{expected_kw}' in matched_keywords: {target['matched_keywords']}"
            )


@pytest.mark.asyncio
async def test_auto_map_business_lens_deduplicates_same_parameter():
    """
    Test 4: Khi câu chứa cả từ khóa kỹ thuật và cụm từ kinh doanh cùng trỏ về 1 parameter,
    kết quả phải deduplicate (chỉ xuất hiện 1 candidate cho parameter đó).
    Ví dụ: 'tốc độ' (kỹ thuật #9) và 'tốc độ ra mắt thị trường' (kinh doanh #9).
    """
    text = "Hệ thống cần tăng tốc độ xử lý và cải thiện tốc độ ra mắt thị trường"
    payload = {
        "text": text,
        "top_k": 5,
        "lens": "business",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/triz/auto-map", json=payload)

    assert response.status_code == 200
    data = response.json()
    matches = data["data"]

    # Parameter 9 chỉ được xuất hiện duy nhất 1 lần
    param_9_matches = [m for m in matches if m["id"] == 9]
    assert len(param_9_matches) == 1, f"Parameter 9 phải được gộp (dedup), tìm thấy {len(param_9_matches)}"

    matched_kws = param_9_matches[0]["matched_keywords"]
    assert len(matched_kws) >= 2, f"Phải chứa cả keyword kỹ thuật và kinh doanh, có: {matched_kws}"


@pytest.mark.asyncio
async def test_auto_map_non_empty_no_match_returns_200_empty_list():
    """
    Test 5: Chuỗi non-empty không chứa từ khóa nào (dù ở lens business)
    phải trả về HTTP 200 với data=[] và total_candidates=0, KHÔNG ĐƯỢC trả về 400.
    """
    payload = {
        "text": "Chuỗi văn bản hoàn toàn không liên quan 1234567890 xyz abc",
        "lens": "business",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/triz/auto-map", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["data"] == []
    assert data["meta"]["total_candidates"] == 0


@pytest.mark.asyncio
async def test_auto_map_empty_and_whitespace_returns_400():
    """
    Test 6: Chuỗi rỗng hoặc chỉ whitespace ở mọi lens phải trả về HTTP 400 Bad Request.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res1 = await client.post("/api/v1/triz/auto-map", json={"text": "", "lens": "business"})
        assert res1.status_code == 400

        res2 = await client.post("/api/v1/triz/auto-map", json={"text": "   \n\t  ", "lens": "business"})
        assert res2.status_code == 400


@pytest.mark.asyncio
async def test_auto_map_invalid_lens_returns_422():
    """
    Test 7: Giá trị lens không nằm trong enum ('engineering', 'business')
    phải bị Pydantic chặn và trả về HTTP 422 Unprocessable Content.
    """
    payload = {
        "text": "Tăng tốc độ sản xuất",
        "lens": "invalid_lens_name",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/triz/auto-map", json=payload)

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_auto_map_business_lens_false_positive_defense():
    """
    Test 8: Phòng ngừa false-positive:
    Các từ như 'vốn dĩ', 'cố vấn', hoặc từ đơn lẻ như 'thị trường', 'khách hàng'
    không được tự tiện match thành tham số kinh doanh.
    """
    false_positive_texts = [
        "Vấn đề này vốn dĩ là như vậy từ trước tới nay",
        "Chúng tôi cần gặp chuyên gia cố vấn để xin ý kiến",
        "Nghiên cứu thị trường và tìm kiếm khách hàng mới",
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for text in false_positive_texts:
            response = await client.post(
                "/api/v1/triz/auto-map",
                json={"text": text, "lens": "business"},
            )
            assert response.status_code == 200
            data = response.json()
            matched_codes = [m["code"] for m in data["data"]]
            assert "weight_moving" not in matched_codes, f"'vốn dĩ'/'cố vấn' không được match weight_moving trong '{text}'"
            assert "weight_stationary" not in matched_codes, f"'vốn dĩ'/'cố vấn' không được match weight_stationary trong '{text}'"


@pytest.mark.asyncio
async def test_auto_map_determinism_top_k_and_tie_breaking():
    """
    Test 9: Tính tất định của top_k và tie-breaking:
    Sắp xếp theo score giảm dần, nếu bằng điểm thì ID nhỏ hơn đứng trước.
    """
    # Câu chứa 2 cụm từ cùng độ dài và số lượng match
    text = "Cải thiện tỷ lệ giữ chân nhân sự và kéo dài vòng đời khách hàng"
    payload = {
        "text": text,
        "top_k": 2,
        "lens": "business",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/triz/auto-map", json=payload)

    assert response.status_code == 200
    data = response.json()
    matches = data["data"]
    assert len(matches) <= 2
    if len(matches) == 2:
        # Nếu score bằng nhau, ID 13 (stability) phải đứng trước ID 16 (duration_stationary)
        if matches[0]["score"] == matches[1]["score"]:
            assert matches[0]["id"] < matches[1]["id"]


def test_problem_framing_extraction_unaffected_by_business_phrases():
    """
    Test 10: Khẳng định bất biến:
    Hàm _extract_parameters_and_type trong ProblemStructuringService KHÔNG bị ảnh hưởng
    bởi các cụm từ kinh doanh, đảm bảo luồng problem framing thuần kỹ thuật không thay đổi.
    """
    service = ProblemStructuringService()
    statement = "Cần tăng tỷ lệ giữ chân nhân sự nhưng lại vướng thời gian chờ phê duyệt"

    # Vì không sửa _PARAMETER_KEYWORDS kỹ thuật, câu này phải trả về ContradictionType.none
    c_type, imp, wors = service._extract_parameters_and_type(statement)
    assert c_type == ContradictionType.none
    assert imp is None
    assert wors is None
