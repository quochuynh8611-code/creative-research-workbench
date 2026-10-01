"""
problem_structuring_service.py — Core Domain Service cho Phase 3 & 6.3: TRIZ Problem Structuring & 39x39 Matrix

Nhiệm vụ:
  1. Nhận raw problem statement từ người dùng.
  2. Validate tính hợp lệ của statement (chặn chuỗi rỗng / whitespace).
  3. Chuẩn hóa câu phát biểu thành normalized statement theo TRIZ framing.
  4. Phân loại mâu thuẫn (Technical vs Physical vs None/Unknown).
  5. Trích xuất improving_parameter và worsening_parameter (Full 39 TRIZ parameters).
  6. Gợi ý các nguyên tắc sáng tạo TRIZ (40 Inventive Principles) từ ma trận Altshuller 39x39 đầy đủ.
  7. Persist ProblemFrame và Contradiction vào database liên kết với ResearchSession.

Ref: docs/DOMAIN_SCHEMA.md, docs/API_CONTRACTS.md, docs/PHASE_6_7_EXECUTION_SPEC.md
"""
from __future__ import annotations

import json
import logging
import pathlib
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
# Tải Dữ liệu Chuẩn TRIZ 39×39 Altshuller Matrix
# ──────────────────────────────────────────────

_DATA_DIR = pathlib.Path(__file__).parent.parent / "data"
_MATRIX_JSON_PATH = _DATA_DIR / "triz_matrix_39x39.json"

_TRIZ_DATA: dict[str, Any] = {}
_CONTRADICTION_MATRIX_39X39: dict[tuple[int, int], list[int]] = {}
_PARAM_CODE_TO_ID: dict[str, int] = {}


def validate_triz_matrix_data(data: dict[str, Any]) -> None:
    """
    Xác thực tính toàn vẹn fail-closed của dữ liệu ma trận TRIZ 39x39.
    Raise RuntimeError nếu dữ liệu thiếu, sai format hoặc principle ID ngoài [1..40].
    """
    if not isinstance(data, dict):
        raise RuntimeError("Dữ liệu TRIZ matrix phải là một dictionary JSON hợp lệ.")

    params = data.get("parameters")
    if not isinstance(params, dict) or len(params) != 39:
        raise RuntimeError(
            f"Dữ liệu 'parameters' không hợp lệ hoặc không đủ 39 thông số "
            f"(tìm thấy: {len(params) if isinstance(params, dict) else 0})."
        )

    principles = data.get("principles")
    if not isinstance(principles, dict) or len(principles) != 40:
        raise RuntimeError(
            f"Dữ liệu 'principles' không hợp lệ hoặc không đủ 40 nguyên tắc "
            f"(tìm thấy: {len(principles) if isinstance(principles, dict) else 0})."
        )

    matrix = data.get("matrix")
    if not isinstance(matrix, dict) or len(matrix) != 1521:
        raise RuntimeError(
            f"Dữ liệu 'matrix' không đủ 1521 tọa độ "
            f"(tìm thấy: {len(matrix) if isinstance(matrix, dict) else 0})."
        )

    for i in range(1, 40):
        for j in range(1, 40):
            coord = f"{i}_{j}"
            if coord not in matrix:
                raise RuntimeError(f"Ma trận thiếu tọa độ bắt buộc: {coord}")
            cell_principles = matrix[coord]
            if not isinstance(cell_principles, list):
                raise RuntimeError(f"Tọa độ {coord} có giá trị không phải list.")
            for pid in cell_principles:
                if not isinstance(pid, int) or pid < 1 or pid > 40:
                    raise RuntimeError(f"Principle ID {pid} out of bounds (1..40) at coordinate {coord}.")


def _load_triz_matrix() -> None:
    global _TRIZ_DATA, _CONTRADICTION_MATRIX_39X39, _PARAM_CODE_TO_ID
    if not _MATRIX_JSON_PATH.exists():
        raise RuntimeError(f"TRIZ matrix file not found at {_MATRIX_JSON_PATH}")
    try:
        with open(_MATRIX_JSON_PATH, "r", encoding="utf-8") as _f:
            data = json.load(_f)
    except Exception as _e:
        raise RuntimeError(f"Failed to parse TRIZ matrix JSON at {_MATRIX_JSON_PATH}: {_e}") from _e

    validate_triz_matrix_data(data)

    _TRIZ_DATA = data
    _raw_matrix = _TRIZ_DATA.get("matrix", {})
    for _k, _v in _raw_matrix.items():
        _parts = _k.split("_")
        if len(_parts) == 2 and _parts[0].isdigit() and _parts[1].isdigit():
            _CONTRADICTION_MATRIX_39X39[(int(_parts[0]), int(_parts[1]))] = _v
    _raw_params = _TRIZ_DATA.get("parameters", {})
    for _p_id_str, _p_val in _raw_params.items():
        _p_id = int(_p_id_str)
        _code = _p_val.get("code")
        if _code:
            _PARAM_CODE_TO_ID[_code] = _p_id


_load_triz_matrix()


# ──────────────────────────────────────────────
# 39 Parameters Bilingual Keyword Map
# ──────────────────────────────────────────────

_PARAMETER_KEYWORDS: dict[str, list[str]] = {
    # 1. Trọng lượng vật thể di động
    "weight_moving": ["trọng lượng di động", "khối lượng di động", "nặng di chuyển", "weight of moving object", "moving weight"],
    # 2. Trọng lượng vật thể tĩnh
    "weight_stationary": ["trọng lượng tĩnh", "khối lượng tĩnh", "trọng lượng kết cấu", "weight of stationary object", "weight", "trọng lượng", "khối lượng", "nặng", "nhẹ"],
    # 3. Chiều dài vật thể di động
    "length_moving": ["chiều dài di động", "kích thước dài di động", "length of moving object"],
    # 4. Chiều dài vật thể tĩnh
    "length_stationary": ["chiều dài", "độ dài", "kích thước dài", "chiều cao", "length", "height", "length of stationary object"],
    # 5. Diện tích vật thể di động
    "area_moving": ["diện tích di động", "diện tích tiếp xúc di chuyển", "area of moving object"],
    # 6. Diện tích vật thể tĩnh
    "area_stationary": ["diện tích", "bề mặt", "diện tích bề mặt", "area", "surface area", "area of stationary object"],
    # 7. Thể tích vật thể di động
    "volume_moving": ["thể tích di động", "dung tích di chuyển", "volume of moving object"],
    # 8. Thể tích vật thể tĩnh
    "volume_stationary": ["thể tích", "dung tích", "không gian chiếm chỗ", "volume", "volume of stationary object"],
    # 9. Tốc độ
    "speed": ["tốc độ", "vận tốc", "speed", "velocity", "nhanh", "thời gian xử lý", "tần số quét"],
    # 10. Lực / Mô-men
    "force": ["lực", "mô-men", "lực kéo", "lực ép", "lực nén", "force", "torque"],
    # 11. Ứng suất / Áp suất
    "stress_pressure": ["ứng suất", "áp suất", "áp lực", "stress", "pressure"],
    # 12. Hình dạng
    "shape": ["hình dạng", "biên dạng", "hình dáng", "hình học", "cấu hình", "shape", "profile", "geometry"],
    # 13. Độ ổn định cấu trúc
    "stability": ["độ ổn định", "tính ổn định", "ổn định cấu trúc", "stability", "stability of composition"],
    # 14. Độ bền / Độ cứng
    "strength": ["độ bền", "độ cứng", "cứng", "bền", "chịu lực", "chịu tải", "chịu tải trọng", "strength", "hardness", "durability", "toughness"],
    # 15. Thời gian hoạt động vật thể di động
    "duration_moving": ["thời gian hoạt động di động", "thời gian bay", "thời gian chạy", "duration of moving"],
    # 16. Thời gian hoạt động vật thể tĩnh
    "duration_stationary": ["tuổi thọ", "thời gian phục vụ", "độ bền sử dụng", "duration of stationary", "service life"],
    # 17. Nhiệt độ
    "temperature": ["nhiệt độ", "nhiệt", "nhiệt năng", "quá nhiệt", "nóng", "lạnh", "temperature", "heat", "thermal"],
    # 18. Độ sáng / Cường độ chiếu sáng
    "illumination": ["độ sáng", "chiếu sáng", "cường độ sáng", "quang thông", "illumination", "brightness"],
    # 19. Năng lượng tiêu hao vật thể di động
    "energy_moving": ["tiêu hao năng lượng di chuyển", "tiêu thụ nhiên liệu", "nhiên liệu", "energy of moving object"],
    # 20. Năng lượng tiêu hao vật thể tĩnh
    "energy_stationary": ["tiêu hao năng lượng tĩnh", "tiêu thụ điện tĩnh", "energy of stationary object"],
    # 21. Công suất
    "power": ["công suất", "công suất động cơ", "power", "wattage"],
    # 22. Tổn hao năng lượng
    "energy_consumption": ["tổn hao năng lượng", "tiêu tốn", "tiêu thụ điện", "năng lượng", "energy consumption", "loss of energy", "energy loss", "waste of energy"],
    # 23. Tổn hao vật chất / Hao mòn
    "loss_of_substance": ["hao mòn", "mài mòn", "ăn mòn", "rò rỉ", "tổn thất vật chất", "loss of substance", "wear", "abrasion"],
    # 24. Tổn thất thông tin
    "loss_of_information": ["mất thông tin", "mất dữ liệu", "nhiễu tín hiệu", "sai lệch tín hiệu", "loss of information"],
    # 25. Lãng phí thời gian
    "loss_of_time": ["lãng phí thời gian", "thời gian chết", "chậm trễ", "độ trễ", "loss of time", "delay"],
    # 26. Lượng chất / Vật liệu
    "quantity_of_substance": ["lượng chất", "lượng vật liệu", "số lượng linh kiện", "quantity of substance", "material amount"],
    # 27. Độ tin cậy
    "reliability": ["độ tin cậy", "tin cậy", "an toàn", "ít hỏng hóc", "reliability", "dependability"],
    # 28. Độ chính xác đo lường
    "measurement_accuracy": ["độ chính xác đo", "sai số đo lường", "đo lường chính xác", "measurement accuracy"],
    # 29. Độ chính xác chế tạo
    "accuracy": ["độ chính xác", "chính xác", "sai số", "dung sai", "accuracy", "precision", "manufacturing precision"],
    # 30. Tác hại bên ngoài ảnh hưởng
    "external_harm": ["tác hại bên ngoài", "xâm thực môi trường", "bụi bẩn", "độ ẩm bên ngoài", "external harm"],
    # 31. Tác hại do vật thể sinh ra
    "object_harm": ["tác hại sinh ra", "khí thải", "tiếng ồn", "ô nhiễm", "object generated harm"],
    # 32. Tính dễ chế tạo
    "ease_of_manufacture": ["dễ chế tạo", "dễ gia công", "tính công nghệ", "khả năng sản xuất", "ease of manufacture"],
    # 33. Tính dễ vận hành / Sử dụng
    "ease_of_operation": ["dễ sử dụng", "dễ vận hành", "thân thiện", "tiện lợi", "ease of operation", "usability"],
    # 34. Tính dễ sửa chữa / Bảo dưỡng
    "ease_of_repair": ["dễ sửa chữa", "dễ bảo dưỡng", "dễ thay thế", "bảo trì", "ease of repair", "maintainability"],
    # 35. Tính linh hoạt / Thích nghi
    "flexibility": ["dẻo", "mềm", "linh hoạt", "thích nghi", "giảm rung", "triệt tiêu rung", "flexibility", "adaptability", "damping"],
    # 36. Độ phức tạp thiết bị
    "complexity": ["độ phức tạp", "phức tạp", "cồng kềnh", "nhiều chi tiết", "complexity", "device complexity"],
    # 37. Độ khó kiểm soát / Đo lường
    "difficulty_detecting": ["khó kiểm soát", "khó đo lường", "khó nhận biết", "difficulty of detecting"],
    # 38. Mức độ tự động hóa
    "automation_level": ["tự động hóa", "mức độ tự động", "tự động", "automation", "extent of automation"],
    # 39. Năng suất / Hiệu suất
    "productivity": ["năng suất", "hiệu suất", "sản lượng", "tốc độ sản xuất", "productivity", "throughput"],
}

# Alias map để chuyển parameter code sang ID số (1-39)
_PARAM_TO_ID_MAP: dict[str, int] = {
    "weight_moving": 1,
    "weight": 2,
    "weight_stationary": 2,
    "length_moving": 3,
    "length": 4,
    "length_stationary": 4,
    "area_moving": 5,
    "area": 6,
    "area_stationary": 6,
    "volume_moving": 7,
    "volume": 8,
    "volume_stationary": 8,
    "speed": 9,
    "force": 10,
    "stress_pressure": 11,
    "shape": 12,
    "stability": 13,
    "strength": 14,
    "durability": 14,
    "duration_moving": 15,
    "duration_stationary": 16,
    "temperature": 17,
    "illumination": 18,
    "energy_moving": 19,
    "energy_stationary": 20,
    "power": 21,
    "energy_consumption": 22,
    "loss_of_energy": 22,
    "loss_of_substance": 23,
    "loss_of_information": 24,
    "loss_of_time": 25,
    "quantity_of_substance": 26,
    "reliability": 27,
    "measurement_accuracy": 28,
    "accuracy": 29,
    "manufacturing_precision": 29,
    "external_harm": 30,
    "object_harm": 31,
    "ease_of_manufacture": 32,
    "ease_of_operation": 33,
    "ease_of_repair": 34,
    "flexibility": 35,
    "adaptability": 35,
    "complexity": 36,
    "difficulty_detecting": 37,
    "automation_level": 38,
    "productivity": 39,
}

_DEFAULT_TECHNICAL_PRINCIPLES: list[int] = [1, 10, 28, 35]
_PHYSICAL_PRINCIPLES: list[int] = [1, 2, 3, 4]  # Phân tách trong không gian, thời gian, điều kiện, hệ thống


class ProblemStructuringService:
    """
    Service định khung bài toán và trích xuất mâu thuẫn TRIZ hỗ trợ Full 39x39 Altshuller Matrix.

    Hỗ trợ nhận Engine hoặc Session thông qua tham số đa hình `bind`.
    """

    def __init__(self, bind: Engine | Session | None = None) -> None:
        if isinstance(bind, Session):
            self._session: Session | None = bind
            self._engine: Engine | None = None
        elif isinstance(bind, Engine):
            self._session = None
            self._engine = bind
        else:
            self._session = None
            self._engine = None

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
        """Phân tích văn bản để tìm kiếm mâu thuẫn kỹ thuật hoặc vật lý trong 39 thông số."""
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
        raw_matches: list[tuple[str, int, int]] = []
        for param_name, keywords in _PARAMETER_KEYWORDS.items():
            for kw in keywords:
                start = 0
                while True:
                    pos = lower_text.find(kw, start)
                    if pos == -1:
                        break
                    raw_matches.append((param_name, pos, len(kw)))
                    start = pos + len(kw)

        # Loại bỏ các match bị bao phủ hoàn toàn bởi match dài hơn
        raw_matches.sort(key=lambda x: x[2], reverse=True)
        selected_spans: list[tuple[str, int, int]] = []
        for p_name, pos, length in raw_matches:
            span_start = pos
            span_end = pos + length
            overlap = False
            for _, s_pos, s_len in selected_spans:
                sel_start = s_pos
                sel_end = s_pos + s_len
                if not (span_end <= sel_start or span_start >= sel_end):
                    overlap = True
                    break
            if not overlap:
                selected_spans.append((p_name, pos, length))

        # Sắp xếp theo vị trí xuất hiện trong câu
        selected_spans.sort(key=lambda x: x[1])
        found_params: list[tuple[str, int]] = [(p_name, pos) for p_name, pos, _ in selected_spans]

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
        """Tạo Contradiction record với danh sách nguyên tắc gợi ý từ Ma trận 39x39 Altshuller."""
        if contradiction_type == ContradictionType.technical:
            improving_id = _PARAM_TO_ID_MAP.get(improving_param or "", 0)
            worsening_id = _PARAM_TO_ID_MAP.get(worsening_param or "", 0)

            principles = _CONTRADICTION_MATRIX_39X39.get((improving_id, worsening_id), [])
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
