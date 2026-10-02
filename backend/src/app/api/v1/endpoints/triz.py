"""
triz.py — Read-only REST API endpoints cho danh mục TRIZ và tra cứu Ma trận Mâu thuẫn 39x39.

Cung cấp:
  - GET /api/v1/triz/parameters : Danh mục 39 thông số kỹ thuật TRIZ song ngữ
  - GET /api/v1/triz/principles : Danh mục 40 nguyên tắc sáng tạo TRIZ
  - GET /api/v1/triz/lookup     : Tra cứu tất định ma trận Altshuller 1985 (39x39)
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from app.services.problem_structuring_service import (
    _CONTRADICTION_MATRIX_39X39,
    _TRIZ_DATA,
    auto_map_parameters,
)

router = APIRouter()


class AutoMapRequest(BaseModel):
    text: str = Field(default="")
    top_k: int = Field(default=5, ge=1, le=39)


# ──────────────────────────────────────────────
# Serialization Helpers
# ──────────────────────────────────────────────

def _format_parameter(param_id: int, data: dict[str, Any]) -> dict[str, Any]:
    """Chuẩn hóa dữ liệu một thông số kỹ thuật TRIZ (1..39)."""
    return {
        "id": data.get("id", param_id),
        "code": data.get("code", f"param_{param_id}"),
        "name_vi": data.get("name_vi", ""),
        "name_en": data.get("name_en", ""),
        "description": data.get("description", ""),
    }


def _format_principle(principle_id: int, data: dict[str, Any]) -> dict[str, Any]:
    """Chuẩn hóa dữ liệu một nguyên tắc sáng tạo TRIZ (1..40)."""
    pid = data.get("id", principle_id)
    return {
        "id": pid,
        "principle_id": data.get("principle_id", pid),
        "name_vi": data.get("name_vi", ""),
        "name_en": data.get("name_en", ""),
        "description": data.get("description", ""),
        "explanation": data.get("explanation", ""),
        "examples": data.get("examples", []),
    }


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
        matches = auto_map_parameters(text=body.text, top_k=body.top_k)
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
