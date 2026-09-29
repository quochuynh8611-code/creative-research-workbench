"""
problem_structuring_service.py — Core Domain Service cho Phase 3: Problem Structuring & Contradiction Extraction

Nhiệm vụ:
  1. Nhận raw problem statement từ người dùng.
  2. Validate tính hợp lệ của statement (chặn chuỗi rỗng / whitespace).
  3. Chuẩn hóa câu phát biểu thành normalized statement theo TRIZ framing.
  4. Phân loại mâu thuẫn (Technical vs Physical vs None/Unknown).
  5. Trích xuất improving_parameter và worsening_parameter.
  6. Gợi ý các nguyên tắc sáng tạo TRIZ (40 Inventive Principles) phù hợp.
  7. Persist ProblemFrame và Contradiction vào database liên kết với ResearchSession.

Ref: docs/DOMAIN_SCHEMA.md, docs/API_CONTRACTS.md, docs/GHERKIN_SCENARIOS.md
"""
from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.domain.models import (
    Contradiction,
    ContradictionType,
    ProblemFrame,
    ResearchSession,
)

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# TRIZ Parameters & Principles Knowledge Base
# ──────────────────────────────────────────────

# Từ khóa thông số TRIZ phổ biến trong tiếng Việt và tiếng Anh
_PARAMETER_KEYWORDS: dict[str, list[str]] = {
    "speed": ["tốc độ", "vận tốc", "speed", "velocity", "nhanh", "thời gian xử lý"],
    "reliability": ["độ tin cậy", "tin cậy", "reliability", "ổn định", "stability"],
    "strength": ["độ cứng", "độ bền", "cứng", "chịu lực", "strength", "hardness", "durability"],
    "flexibility": ["dẻo", "mềm", "linh hoạt", "giảm rung", "triệt tiêu rung", "flexibility", "damping"],
    "energy_consumption": ["năng lượng", "tiêu tốn", "tiêu thụ điện", "công suất", "energy", "power"],
    "weight": ["trọng lượng", "khối lượng", "nặng", "nhẹ", "weight", "mass"],
    "accuracy": ["độ chính xác", "chính xác", "sai số", "accuracy", "precision"],
    "cost": ["chi phí", "giá thành", "đắt", "rẻ", "cost", "expense"],
}

# Ma trận gợi ý nguyên tắc TRIZ cơ bản cho các cặp mâu thuẫn kỹ thuật
_CONTRADICTION_MATRIX: dict[tuple[str, str], list[int]] = {
    ("speed", "reliability"): [10, 35, 1, 28],
    ("reliability", "speed"): [10, 28, 35, 1],
    ("strength", "flexibility"): [1, 14, 15, 35],
    ("flexibility", "strength"): [15, 10, 14, 35],
    ("speed", "energy_consumption"): [19, 35, 38, 2],
    ("energy_consumption", "speed"): [19, 35, 2, 13],
    ("weight", "strength"): [1, 8, 40, 15],
    ("strength", "weight"): [40, 29, 35, 8],
    ("accuracy", "speed"): [28, 32, 10, 1],
    ("speed", "accuracy"): [10, 28, 1, 35],
}

_DEFAULT_TECHNICAL_PRINCIPLES: list[int] = [1, 10, 28, 35]
_PHYSICAL_PRINCIPLES: list[int] = [1, 2, 3, 4]  # Phân tách trong không gian, thời gian, điều kiện, hệ thống


class ProblemStructuringService:
    """
    Service định khung bài toán và trích xuất mâu thuẫn TRIZ.

    Hỗ trợ nhận Engine hoặc Session thông qua tham số đa hình `bind`.
    """

    def __init__(self, bind: Engine | Session) -> None:
        if isinstance(bind, Session):
            self._session: Session | None = bind
            self._engine: Engine | None = None
        else:
            self._session = None
            self._engine = bind

    @property
    def engine(self) -> Engine | None:
        return self._engine

    # ──────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────

    def structure_problem(
        self,
        session_id: uuid.UUID | str,
        raw_statement: str,
        domain: str | None = None,
    ) -> ProblemFrame:
        """
        Chuẩn hóa bài toán, nhận diện mâu thuẫn và persist vào database.

        Args:
            session_id:    UUID của ResearchSession tương ứng.
            raw_statement: Mô tả vấn đề thô từ người dùng.
            domain:        Lĩnh vực kỹ thuật/nghiên cứu (tùy chọn).

        Returns:
            ProblemFrame đã được lưu vào database kèm Contradictions.
        """
        if not raw_statement or not raw_statement.strip():
            raise ValueError("raw_statement must not be empty or whitespace.")

        clean_raw = raw_statement.strip()
        session_uuid = uuid.UUID(str(session_id)) if not isinstance(session_id, uuid.UUID) else session_id

        # 1. Trích xuất thông số và loại mâu thuẫn
        contradiction_type, improving_param, worsening_param = self._extract_parameters_and_type(clean_raw)

        # 2. Chuẩn hóa câu phát biểu (Normalized statement)
        normalized_statement = self._normalize_statement(
            raw_statement=clean_raw,
            domain=domain,
            contradiction_type=contradiction_type,
            improving_param=improving_param,
            worsening_param=worsening_param,
        )

        # 3. Tạo ProblemFrame model
        frame = ProblemFrame(
            session_id=session_uuid,
            raw_statement=clean_raw,
            normalized_statement=normalized_statement,
            domain=domain,
            contradiction_type=contradiction_type,
            improving_parameter=improving_param,
            worsening_parameter=worsening_param,
        )

        # 4. Tạo Contradiction models nếu phát hiện mâu thuẫn
        if contradiction_type in (ContradictionType.technical, ContradictionType.physical):
            contradiction = self._create_contradiction(
                frame=frame,
                contradiction_type=contradiction_type,
                improving_param=improving_param,
                worsening_param=worsening_param,
            )
            frame.contradictions.append(contradiction)

        # 5. Lưu vào Database
        if self._session is not None:
            self._save_frame(self._session, frame)
        else:
            with Session(self._engine) as session:
                self._save_frame(session, frame)
                session.commit()
                session.refresh(frame)

        return frame

    # ──────────────────────────────────────────
    # Internal Logic
    # ──────────────────────────────────────────

    def _extract_parameters_and_type(
        self, text_input: str
    ) -> tuple[ContradictionType, str | None, str | None]:
        """Phân tích văn bản để tìm kiếm mâu thuẫn kỹ thuật hoặc vật lý."""
        lower_text = text_input.lower()

        # Kiểm tra mâu thuẫn vật lý (cùng 1 tham số có 2 yêu cầu đối nghịch)
        is_physical = (
            ("vừa" in lower_text and "vừa" in lower_text[lower_text.find("vừa") + 1:])
            or "cùng một lúc" in lower_text
            or "đối nghịch" in lower_text
            or ("cần cứng" in lower_text and "cần dẻo" in lower_text)
            or ("cứng" in lower_text and "mềm" in lower_text)
        )

        # Tìm các parameters xuất hiện trong text
        found_params: list[tuple[str, int]] = []
        for param_name, keywords in _PARAMETER_KEYWORDS.items():
            for kw in keywords:
                pos = lower_text.find(kw)
                if pos != -1:
                    found_params.append((param_name, pos))
                    break

        # Sắp xếp theo vị trí xuất hiện trong câu
        found_params.sort(key=lambda x: x[1])

        # Phân loại
        if len(found_params) >= 2 and found_params[0][0] != found_params[1][0]:
            improving = found_params[0][0]
            worsening = found_params[1][0]
            return ContradictionType.technical, improving, worsening

        if is_physical and len(found_params) >= 1:
            param = found_params[0][0]
            return ContradictionType.physical, param, f"anti_{param}"

        if is_physical:
            return ContradictionType.physical, "state_a", "state_b"

        if len(found_params) == 1:
            return ContradictionType.technical, found_params[0][0], None

        return ContradictionType.none, None, None

    def _normalize_statement(
        self,
        raw_statement: str,
        domain: str | None,
        contradiction_type: ContradictionType,
        improving_param: str | None,
        worsening_param: str | None,
    ) -> str:
        """Tạo câu phát biểu chuẩn hóa theo mẫu TRIZ."""
        domain_prefix = f"[{domain.upper()}] " if domain else ""
        if contradiction_type == ContradictionType.technical and improving_param and worsening_param:
            return (
                f"{domain_prefix}Mâu thuẫn kỹ thuật: Cải thiện '{improving_param}' "
                f"dẫn đến suy giảm '{worsening_param}'. Bài toán gốc: {raw_statement}"
            )
        if contradiction_type == ContradictionType.physical:
            return (
                f"{domain_prefix}Mâu thuẫn vật lý: Đối tượng đồng thời đòi hỏi hai trạng thái đối nghịch. "
                f"Bài toán gốc: {raw_statement}"
            )
        return f"{domain_prefix}Bài toán: {raw_statement}"

    def _create_contradiction(
        self,
        frame: ProblemFrame,
        contradiction_type: ContradictionType,
        improving_param: str | None,
        worsening_param: str | None,
    ) -> Contradiction:
        """Tạo Contradiction record với danh sách nguyên tắc gợi ý từ TRIZ matrix."""
        if contradiction_type == ContradictionType.technical:
            pair = (improving_param or "", worsening_param or "")
            principles = _CONTRADICTION_MATRIX.get(pair, _DEFAULT_TECHNICAL_PRINCIPLES)
            statement = f"Cải thiện '{improving_param}' làm suy giảm '{worsening_param}'."
        else:
            principles = _PHYSICAL_PRINCIPLES
            statement = f"Mâu thuẫn vật lý giữa các trạng thái đối nghịch trong hệ thống."

        return Contradiction(
            type=contradiction_type,
            statement=statement,
            suggested_principles=principles,
        )

    def _save_frame(self, session: Session, frame: ProblemFrame) -> None:
        """Thêm ProblemFrame vào session và flush để gán ID và liên kết."""
        session.add(frame)
        session.flush()
