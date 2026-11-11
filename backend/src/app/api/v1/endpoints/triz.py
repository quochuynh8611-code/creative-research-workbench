"""
triz.py — Read-only REST API endpoints cho danh mục TRIZ và tra cứu Ma trận Mâu thuẫn 39x39.

Cung cấp:
  - GET /api/v1/triz/parameters : Danh mục 39 thông số kỹ thuật TRIZ song ngữ
  - GET /api/v1/triz/principles : Danh mục 40 nguyên tắc sáng tạo TRIZ
  - GET /api/v1/triz/lookup     : Tra cứu tất định ma trận Altshuller 1985 (39x39)
"""
from __future__ import annotations

from typing import Any, Literal
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from app.domain.models import ContradictionType
from app.services.problem_structuring_service import (
    _CONTRADICTION_MATRIX_39X39,
    _TRIZ_DATA,
    auto_map_parameters,
    get_separation_strategies_for_contradiction,
)
from app.services.everyday_triz_lens import get_everyday_triz_lens
from app.services.business_triz_lens import get_business_triz_lens
from app.services.triz_nine_windows_service import get_nine_windows

router = APIRouter()


class AutoMapRequest(BaseModel):
    text: str = Field(default="")
    top_k: int = Field(default=5, ge=1, le=39)
    lens: Literal["engineering", "business"] = Field(default="engineering")


# ──────────────────────────────────────────────
# Serialization Helpers
# ──────────────────────────────────────────────

def _format_parameter(param_id: int, data: dict[str, Any]) -> dict[str, Any]:
    """Chuẩn hóa dữ liệu một thông số kỹ thuật TRIZ (1..39)."""
    item = {
        "id": data.get("id", param_id),
        "code": data.get("code", f"param_{param_id}"),
        "name_vi": data.get("name_vi", ""),
        "name_en": data.get("name_en", ""),
        "description": data.get("description", ""),
    }
    lens = get_everyday_triz_lens().get_parameter_lens(param_id)
    if lens:
        item["everyday_label"] = lens.get("everyday_label", "")
    b_lens = get_business_triz_lens().get_parameter_lens(param_id)
    if b_lens:
        item["business_label"] = b_lens.get("business_label", "")
    return item


def _format_principle(principle_id: int, data: dict[str, Any]) -> dict[str, Any]:
    """Chuẩn hóa dữ liệu một nguyên tắc sáng tạo TRIZ (1..40)."""
    pid = data.get("id", principle_id)
    item = {
        "id": pid,
        "principle_id": data.get("principle_id", pid),
        "name_vi": data.get("name_vi", ""),
        "name_en": data.get("name_en", ""),
        "description": data.get("description", ""),
        "explanation": data.get("explanation", ""),
        "examples": data.get("examples", []),
    }
    lens = get_everyday_triz_lens().get_principle_lens(pid)
    if lens:
        item["everyday_title"] = lens.get("everyday_title", "")
        item["daily_application"] = lens.get("daily_application", "")
        item["daily_examples"] = lens.get("daily_examples", [])
        item["action_prompt"] = lens.get("action_prompt", "")
    b_lens = get_business_triz_lens().get_principle_lens(pid)
    if b_lens:
        item["business_title"] = b_lens.get("business_title", "")
        item["business_application"] = b_lens.get("business_application", "")
        item["business_examples"] = b_lens.get("business_examples", [])
        item["business_action_prompt"] = b_lens.get("business_action_prompt", "")
    return item


# ──────────────────────────────────────────────
# REST Endpoints
# ──────────────────────────────────────────────

@router.get("/parameters")
async def get_triz_parameters() -> dict[str, Any]:
    """
    Trả về danh mục đầy đủ 39 thông số kỹ thuật TRIZ (Classical Altshuller 1985).
    Hỗ trợ song ngữ Tiếng Việt & Tiếng Anh kèm mã định danh code.
    """
    raw_params = _TRIZ_DATA.get("parameters", {})
    items = [
        _format_parameter(i, raw_params.get(str(i), {}))
        for i in range(1, 40)
    ]

    return {
        "data": items,
        "meta": {
            "total": len(items),
        },
    }


@router.get("/principles")
async def get_triz_principles() -> dict[str, Any]:
    """
    Trả về danh mục đầy đủ 40 nguyên tắc sáng tạo TRIZ (Classical 40 Inventive Principles).
    Bao gồm mô tả, giải thích cơ chế và ví dụ thực tế.
    """
    raw_principles = _TRIZ_DATA.get("principles", {})
    items = [
        _format_principle(i, raw_principles.get(str(i), {}))
        for i in range(1, 41)
    ]

    return {
        "data": items,
        "meta": {
            "total": len(items),
        },
    }


@router.get("/lookup")
async def lookup_triz_matrix(
    improving: int = Query(..., ge=1, le=39, description="ID thông số cần cải thiện (1..39)"),
    worsening: int = Query(..., ge=1, le=39, description="ID thông số bị suy giảm (1..39)"),
) -> dict[str, Any]:
    """
    Tra cứu ma trận mâu thuẫn kỹ thuật Altshuller 1985 (39x39) một cách tất định.
    - Nếu improving == worsening (đường chéo chính): is_diagonal=True, principles=[] (mâu thuẫn vật lý).
    - Nếu khác nhau: trả về danh sách các nguyên tắc sáng tạo được Altshuller gợi ý.
    """
    raw_params = _TRIZ_DATA.get("parameters", {})
    raw_principles = _TRIZ_DATA.get("principles", {})

    improving_parameter = _format_parameter(improving, raw_params.get(str(improving), {}))
    worsening_parameter = _format_parameter(worsening, raw_params.get(str(worsening), {}))

    is_diagonal = (improving == worsening)

    if is_diagonal:
        matched_principles: list[dict[str, Any]] = []
    else:
        principle_ids = _CONTRADICTION_MATRIX_39X39.get((improving, worsening), [])
        matched_principles = [
            _format_principle(pid, raw_principles.get(str(pid), {}))
            for pid in principle_ids
        ]

    return {
        "improving_parameter": improving_parameter,
        "worsening_parameter": worsening_parameter,
        "is_diagonal": is_diagonal,
        "principles": matched_principles,
        "principles_count": len(matched_principles),
    }


@router.post("/auto-map", status_code=status.HTTP_200_OK)
async def auto_map_triz_parameters(body: AutoMapRequest) -> dict[str, Any]:
    """
    Tự động trích xuất và xếp hạng các thông số TRIZ 39 từ mô tả bài toán tự do (Phase 10.1).
    Hỗ trợ đối soát từ khóa song ngữ Việt - Anh và trả về danh sách candidates kèm điểm tương đồng.
    """
    try:
        matches = auto_map_parameters(text=body.text, top_k=body.top_k, lens=body.lens)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {
        "data": matches,
        "meta": {
            "total_candidates": len(matches),
            "query_text": body.text,
        },
    }


@router.get("/separation-principles", status_code=status.HTTP_200_OK)
async def get_triz_separation_principles() -> dict[str, Any]:
    """
    Danh mục 4 chiến lược phân tách kinh điển của TRIZ cho mâu thuẫn vật lý.
    """
    strategies = get_separation_strategies_for_contradiction(ContradictionType.physical) or []
    return {
        "data": strategies,
        "strategies": strategies,
        "total": len(strategies),
    }


@router.get("/nine-windows", status_code=status.HTTP_200_OK)
async def get_triz_nine_windows(
    lens: Literal["engineering", "business", "everyday"] = Query(
        default="engineering",
        description="Lăng kính tư duy TRIZ 9 cửa sổ (engineering, business, everyday)",
    ),
) -> dict[str, Any]:
    """
    Sơ đồ 9 Màn hình (9-Windows / System Operator / Multi-Screen Scheme) theo lăng kính.
    """
    return get_nine_windows(lens=lens)
