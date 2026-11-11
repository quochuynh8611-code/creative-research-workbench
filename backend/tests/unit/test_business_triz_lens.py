"""
test_business_triz_lens.py — Unit & Contract tests cho Business-TRIZ Lens (Batch B1: RED Phase)

Ref: docs/BUSINESS_TRIZ_LENS_SPEC.md
Tuân thủ:
1. Fail-closed validation cho file JSON dữ liệu business lens (đúng 39 parameters, 40 principles, keys hợp lệ, non-empty fields).
2. Loader:
   - File không tồn tại / JSON parse error: log và graceful.
   - Validation error từ validate_business_triz_lens_data: BẮT BUỘC LAN TRUYỀN (fail-closed).
3. API contracts:
   - GET /api/v1/triz/parameters có additive 'business_label'.
   - GET /api/v1/triz/principles có additive 'business_title', 'business_application', 'business_examples', 'business_action_prompt'.
   - GET /api/v1/triz/lookup làm giàu các trường trên cho parameter và principle.
4. Regression:
   - Các trường kỹ thuật gốc và trường everyday_* hiện có phải được bảo toàn nguyên vẹn.
"""
from __future__ import annotations

import json
import pathlib
from typing import Any
import pytest
from fastapi.testclient import TestClient

from app.main import app

_DATA_DIR = pathlib.Path(__file__).parent.parent.parent / "src" / "app" / "data"
_BUSINESS_JSON_PATH = _DATA_DIR / "business_triz_lens.json"


@pytest.fixture
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# 1. Dữ liệu File JSON
# ---------------------------------------------------------------------------

def test_business_triz_lens_json_file_presence() -> None:
    """File business_triz_lens.json phải tồn tại trong backend/src/app/data."""
    assert _BUSINESS_JSON_PATH.exists(), (
        f"File canonical {_BUSINESS_JSON_PATH} chưa tồn tại (kỳ vọng RED trong Batch B1)."
    )


# ---------------------------------------------------------------------------
# 2. Validator Fail-Closed Tests
# ---------------------------------------------------------------------------

def test_validate_business_triz_lens_missing_top_level_keys() -> None:
    """Validator phải kích hoạt ValueError nếu thiếu 'parameters' hoặc 'principles'."""
    from app.services.business_triz_lens import validate_business_triz_lens_data

    with pytest.raises(ValueError, match="parameters"):
        validate_business_triz_lens_data({"principles": {}})

    with pytest.raises(ValueError, match="principles"):
        validate_business_triz_lens_data({"parameters": {}})


def test_validate_business_triz_lens_incomplete_count() -> None:
    """Validator phải kích hoạt ValueError nếu số lượng parameters != 39 hoặc principles != 40."""
    from app.services.business_triz_lens import validate_business_triz_lens_data

    # Chỉ có 38 parameters
    params_38 = {str(i): {"business_label": f"Label {i}"} for i in range(1, 39)}
    principles_40 = {
        str(i): {
            "business_title": f"Title {i}",
            "business_application": f"App {i}",
            "business_examples": ["Ex 1"],
            "business_action_prompt": f"Prompt {i}",
        }
        for i in range(1, 41)
    }
    with pytest.raises(ValueError, match="39 parameters"):
        validate_business_triz_lens_data({"parameters": params_38, "principles": principles_40})

    # Chỉ có 39 principles
    params_39 = {str(i): {"business_label": f"Label {i}"} for i in range(1, 40)}
    principles_39 = {
        str(i): {
            "business_title": f"Title {i}",
            "business_application": f"App {i}",
            "business_examples": ["Ex 1"],
            "business_action_prompt": f"Prompt {i}",
        }
        for i in range(1, 40)
    }
    with pytest.raises(ValueError, match="40 principles"):
        validate_business_triz_lens_data({"parameters": params_39, "principles": principles_39})


def test_validate_business_triz_lens_invalid_keys() -> None:
    """Validator phải kích hoạt ValueError nếu keys không thuộc 1..39 hoặc 1..40."""
    from app.services.business_triz_lens import validate_business_triz_lens_data

    params = {str(i): {"business_label": f"Label {i}"} for i in range(1, 39)}
    params["40"] = {"business_label": "Invalid key for param"}  # param ID ngoài 1..39

    principles = {
        str(i): {
            "business_title": f"Title {i}",
            "business_application": f"App {i}",
            "business_examples": ["Ex 1"],
            "business_action_prompt": f"Prompt {i}",
        }
        for i in range(1, 41)
    }

    with pytest.raises(ValueError, match="Key parameter không hợp lệ"):
        validate_business_triz_lens_data({"parameters": params, "principles": principles})


def test_validate_business_triz_lens_empty_fields() -> None:
    """Validator phải kích hoạt ValueError nếu bất kỳ trường text bắt buộc nào bị rỗng."""
    from app.services.business_triz_lens import validate_business_triz_lens_data

    params = {str(i): {"business_label": f"Label {i}"} for i in range(1, 40)}
    params["1"]["business_label"] = "   "  # rỗng

    principles = {
        str(i): {
            "business_title": f"Title {i}",
            "business_application": f"App {i}",
            "business_examples": ["Ex 1"],
            "business_action_prompt": f"Prompt {i}",
        }
        for i in range(1, 41)
    }

    with pytest.raises(ValueError, match="business_label"):
        validate_business_triz_lens_data({"parameters": params, "principles": principles})


def test_validate_business_triz_lens_invalid_examples() -> None:
    """Validator phải kích hoạt ValueError nếu business_examples rỗng hoặc chứa phần tử rỗng."""
    from app.services.business_triz_lens import validate_business_triz_lens_data

    params = {str(i): {"business_label": f"Label {i}"} for i in range(1, 40)}
    principles = {
        str(i): {
            "business_title": f"Title {i}",
            "business_application": f"App {i}",
            "business_examples": ["Ex 1"],
            "business_action_prompt": f"Prompt {i}",
        }
        for i in range(1, 41)
    }
    principles["5"]["business_examples"] = []  # rỗng

    with pytest.raises(ValueError, match="business_examples"):
        validate_business_triz_lens_data({"parameters": params, "principles": principles})


# ---------------------------------------------------------------------------
# 3. Loader Fail-Closed Tests
# ---------------------------------------------------------------------------

def test_business_triz_lens_loader_io_error_is_graceful(tmp_path: pathlib.Path) -> None:
    """Loader phải graceful khi file không tồn tại: không crash, service trả dict rỗng."""
    from app.services.business_triz_lens import BusinessTrizLens

    fake_path = tmp_path / "nonexistent_business_lens.json"
    lens = BusinessTrizLens(json_path=fake_path)
    assert lens.get_parameter_lens(1) == {}
    assert lens.get_principle_lens(1) == {}


def test_business_triz_lens_loader_validation_error_propagates(tmp_path: pathlib.Path) -> None:
    """JSON parse được nhưng validation fail phải raise ValueError (fail-closed)."""
    from app.services.business_triz_lens import BusinessTrizLens

    bad_json = tmp_path / "bad_business_lens.json"
    # Thiếu principles
    bad_json.write_text(json.dumps({"parameters": {}}), encoding="utf-8")

    with pytest.raises(ValueError):
        BusinessTrizLens(json_path=bad_json)


# ---------------------------------------------------------------------------
# 4. API Additive & Regression Tests
# ---------------------------------------------------------------------------

def test_get_triz_parameters_includes_business_label(client: TestClient) -> None:
    """GET /api/v1/triz/parameters phải trả về trường business_label cho từng parameter."""
    res = client.get("/api/v1/triz/parameters")
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) == 39
    for item in data:
        assert "business_label" in item
        assert isinstance(item["business_label"], str)


def test_get_triz_principles_includes_business_fields(client: TestClient) -> None:
    """GET /api/v1/triz/principles phải trả về các trường business_* cho từng principle."""
    res = client.get("/api/v1/triz/principles")
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) == 40
    for item in data:
        assert "business_title" in item
        assert "business_application" in item
        assert "business_examples" in item
        assert "business_action_prompt" in item
        assert isinstance(item["business_examples"], list)


def test_lookup_triz_matrix_includes_business_fields(client: TestClient) -> None:
    """GET /api/v1/triz/lookup phải làm giàu business_* cho improving/worsening và principles."""
    res = client.get("/api/v1/triz/lookup?improving=1&worsening=2")
    assert res.status_code == 200
    body = res.json()
    assert "business_label" in body["improving_parameter"]
    assert "business_label" in body["worsening_parameter"]
    for p in body["principles"]:
        assert "business_title" in p
        assert "business_application" in p
        assert "business_examples" in p
        assert "business_action_prompt" in p


def test_business_lens_regression_engineering_and_everyday_preserved(client: TestClient) -> None:
    """Bổ sung business lens không được làm mất các trường kỹ thuật gốc và everyday_*."""
    res = client.get("/api/v1/triz/principles")
    assert res.status_code == 200
    data = res.json()["data"]
    p1 = data[0]
    # Gốc Altshuller
    assert p1["name_vi"] == "Nguyên tắc Phân đoạn (Segmentation)"
    assert p1["name_en"] == "Segmentation"
    assert "description" in p1
    assert "explanation" in p1
    assert "examples" in p1
    # Everyday lens
    assert p1["everyday_title"] == "Chia nhỏ việc lớn (Phân đoạn)"
    assert "daily_application" in p1
    assert "daily_examples" in p1
    assert "action_prompt" in p1


# ---------------------------------------------------------------------------
# 5. Validator Tests cho auto_map_keywords (Batch B2)
# ---------------------------------------------------------------------------

def test_validate_business_triz_lens_auto_map_keywords_valid() -> None:
    """Validator phải pass khi auto_map_keywords là danh sách hợp lệ."""
    from app.services.business_triz_lens import validate_business_triz_lens_data

    params = {str(i): {"business_label": f"Label {i}"} for i in range(1, 40)}
    principles = {
        str(i): {
            "business_title": f"Title {i}",
            "business_application": f"App {i}",
            "business_examples": ["Ex 1"],
            "business_action_prompt": f"Prompt {i}",
        }
        for i in range(1, 41)
    }
    kws = [
        {"phrase": "tốc độ ra mắt thị trường", "parameter_id": 9},
        {"phrase": "tỷ lệ giữ chân nhân sự", "parameter_id": 13},
    ]
    validate_business_triz_lens_data(
        {"parameters": params, "principles": principles, "auto_map_keywords": kws}
    )


def test_validate_business_triz_lens_auto_map_keywords_invalid_structure() -> None:
    """Validator phải kích hoạt ValueError nếu auto_map_keywords không phải là list."""
    from app.services.business_triz_lens import validate_business_triz_lens_data

    params = {str(i): {"business_label": f"Label {i}"} for i in range(1, 40)}
    principles = {
        str(i): {
            "business_title": f"Title {i}",
            "business_application": f"App {i}",
            "business_examples": ["Ex 1"],
            "business_action_prompt": f"Prompt {i}",
        }
        for i in range(1, 41)
    }

    with pytest.raises(ValueError, match="auto_map_keywords"):
        validate_business_triz_lens_data(
            {"parameters": params, "principles": principles, "auto_map_keywords": "invalid_type"}
        )

    with pytest.raises(ValueError, match="dictionary"):
        validate_business_triz_lens_data(
            {"parameters": params, "principles": principles, "auto_map_keywords": ["not_a_dict"]}
        )


def test_validate_business_triz_lens_auto_map_keywords_empty_phrase_or_invalid_id() -> None:
    """Validator phải kích hoạt ValueError nếu phrase rỗng hoặc parameter_id không thuộc 1..39."""
    from app.services.business_triz_lens import validate_business_triz_lens_data

    params = {str(i): {"business_label": f"Label {i}"} for i in range(1, 40)}
    principles = {
        str(i): {
            "business_title": f"Title {i}",
            "business_application": f"App {i}",
            "business_examples": ["Ex 1"],
            "business_action_prompt": f"Prompt {i}",
        }
        for i in range(1, 41)
    }

    with pytest.raises(ValueError, match="thiếu 'phrase'"):
        validate_business_triz_lens_data(
            {
                "parameters": params,
                "principles": principles,
                "auto_map_keywords": [{"phrase": "   ", "parameter_id": 9}],
            }
        )

    with pytest.raises(ValueError, match="parameter_id"):
        validate_business_triz_lens_data(
            {
                "parameters": params,
                "principles": principles,
                "auto_map_keywords": [{"phrase": "cụm hợp lệ", "parameter_id": 99}],
            }
        )


def test_validate_business_triz_lens_auto_map_keywords_duplicate_phrase() -> None:
    """Validator phải kích hoạt ValueError nếu có cụm từ trùng lặp (case-insensitive)."""
    from app.services.business_triz_lens import validate_business_triz_lens_data

    params = {str(i): {"business_label": f"Label {i}"} for i in range(1, 40)}
    principles = {
        str(i): {
            "business_title": f"Title {i}",
            "business_application": f"App {i}",
            "business_examples": ["Ex 1"],
            "business_action_prompt": f"Prompt {i}",
        }
        for i in range(1, 41)
    }
    kws = [
        {"phrase": "tốc độ ra mắt thị trường", "parameter_id": 9},
        {"phrase": "Tốc Độ Ra Mắt Thị Trường", "parameter_id": 9},
    ]

    with pytest.raises(ValueError, match="trùng lặp"):
        validate_business_triz_lens_data(
            {"parameters": params, "principles": principles, "auto_map_keywords": kws}
        )
