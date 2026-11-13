"""
note_context.py — Pydantic Schemas cho source_context của ResearchNote (Batch C7c-1).

Tuân thủ:
  - Discriminated Union theo 'source_type'
  - schema_version bắt buộc = 1
  - Cấm trường lạ (extra="forbid")
  - Giới hạn catalog số nguyên chặt (StrictInt):
      - principle_id 1..40
      - improving_param_id / worsening_param_id 1..39
      - Từ chối tuyệt đối bool, chuỗi số, float trong các trường ID
  - Chuỗi tự do (cell_label, source_ref, method_id, principle_used dạng chuỗi):
      - Kiểm tra ký tự điều khiển trên chuỗi GỐC (không strip trước, cấm \\n, \\r, \\t, \\0 ở mọi vị trí kể cả rìa)
      - Cấm ký tự ngắt dòng Unicode U+2028 (LINE SEPARATOR) và U+2029 (PARAGRAPH SEPARATOR)
      - Từ chối chuỗi rỗng hoặc chỉ toàn khoảng trắng
      - Không biến đổi/strip dữ liệu, bảo toàn khoảng trắng đầu/cuối của người dùng
  - Giới hạn độ dài chuỗi (max_length)
  - Serialize UUID thành chuỗi khi lưu JSON
"""
from __future__ import annotations

import re
import uuid
from typing import Annotated, Any, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, StrictInt, TypeAdapter, field_validator

# Disallow ASCII control characters 0x00-0x1F and 0x7F-0x9F (including \n, \r, \t, \0)
# AND Unicode line/paragraph separators U+2028 (LINE SEPARATOR) and U+2029 (PARAGRAPH SEPARATOR)
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x1f\x7f-\x9f\u2028\u2029]")


def _validate_free_text_field(v: str, field_name: str, max_len: Optional[int] = None) -> str:
    """
    Validate các trường chuỗi tự do (cell_label, source_ref, method_id, principle_used dạng chuỗi):
      - Quy tắc b: Kiểm tra ký tự điều khiển trên chuỗi GỐC, KHÔNG strip trước (cấm \\n, \\r, \\t, \\0 ở mọi vị trí).
      - Quy tắc c: Cấm ký tự ngắt dòng Unicode U+2028 và U+2029.
      - Quy tắc d: Từ chối chuỗi rỗng hoặc chỉ gồm khoảng trắng (sau khi strip).
      - Quy tắc e: Không biến đổi/strip dữ liệu, giữ nguyên chuỗi ban đầu.
    """
    if not isinstance(v, str):
        return v
    # 1. Kiểm tra ký tự điều khiển và U+2028, U+2029 trên chuỗi GỐC trước (không strip)
    if _CONTROL_CHAR_RE.search(v):
        raise ValueError(
            f"{field_name} must not contain control characters (newline, tab, CR, NUL) "
            f"or line/paragraph separators (U+2028, U+2029)"
        )
    # 2. Kiểm tra chuỗi rỗng hoặc chỉ gồm khoảng trắng
    if not v.strip():
        raise ValueError(f"{field_name} must not be empty or whitespace only")
    # 3. Kiểm tra độ dài tối đa
    if max_len is not None and len(v) > max_len:
        raise ValueError(f"{field_name} length must not exceed {max_len} characters")
    return v


class BaseNoteContext(BaseModel):
    """Cấu hình cơ sở cho tất cả schema source_context."""
    model_config = ConfigDict(extra="forbid")


class Triz9WindowsContext(BaseNoteContext):
    """Nguồn 1: Lưới 9 Màn Hình TRIZ."""
    schema_version: Literal[1] = 1
    source_type: Literal["triz_9_windows"] = "triz_9_windows"
    lens: Literal["engineering", "business", "everyday"]
    level: Literal["supersystem", "system", "subsystem"]
    time: Literal["past", "present", "future"]
    cell_label: str = Field(..., min_length=1, max_length=100)

    @field_validator("cell_label")
    @classmethod
    def validate_cell_label(cls, v: str) -> str:
        return _validate_free_text_field(v, "cell_label", max_len=100)


class TrizMatrixContext(BaseNoteContext):
    """Nguồn 2: Tra cứu Ma trận TRIZ 39x39."""
    schema_version: Literal[1] = 1
    source_type: Literal["triz_matrix"] = "triz_matrix"
    principle_id: StrictInt = Field(..., ge=1, le=40)
    improving_param_id: StrictInt = Field(..., ge=1, le=39)
    worsening_param_id: StrictInt = Field(..., ge=1, le=39)
    lens: Literal["engineering", "business", "everyday"]


class PrincipleSuggestionContext(BaseNoteContext):
    """Nguồn 3: Gợi ý Nguyên tắc Sáng chế."""
    schema_version: Literal[1] = 1
    source_type: Literal["principle_suggestion"] = "principle_suggestion"
    principle_id: StrictInt = Field(..., ge=1, le=40)
    method_id: str = Field(..., min_length=1, max_length=100)

    @field_validator("method_id")
    @classmethod
    def validate_method_id(cls, v: str) -> str:
        return _validate_free_text_field(v, "method_id", max_len=100)


class EvidenceContext(BaseNoteContext):
    """Nguồn 4: Bằng chứng Tri thức (chỉ chứa source_ref)."""
    schema_version: Literal[1] = 1
    source_type: Literal["evidence"] = "evidence"
    source_ref: str = Field(..., min_length=1, max_length=255)

    @field_validator("source_ref")
    @classmethod
    def validate_source_ref(cls, v: str) -> str:
        return _validate_free_text_field(v, "source_ref", max_len=255)


class CandidateSolutionContext(BaseNoteContext):
    """Nguồn 5: Giải pháp Sáng tạo Ứng viên."""
    schema_version: Literal[1] = 1
    source_type: Literal["candidate_solution"] = "candidate_solution"
    solution_id: uuid.UUID
    principle_used: Optional[Union[StrictInt, str]] = None
    solution_status: Literal["candidate", "accepted", "rejected"]

    @field_validator("principle_used", mode="before")
    @classmethod
    def validate_principle_used(cls, v: Any) -> Optional[Union[int, str]]:
        if v is None:
            return None
        # Quy tắc a: Từ chối boolean, float
        if isinstance(v, bool):
            raise ValueError("principle_used must not be a boolean")
        if isinstance(v, float):
            raise ValueError("principle_used must not be a float")
        if isinstance(v, int):
            if v < 1 or v > 40:
                raise ValueError("principle_used integer must be in range 1..40")
            return v
        if isinstance(v, str):
            # Quy tắc b, c, d, e: kiểm tra trên chuỗi gốc, cấm U+2028/U+2029, cấm whitespace-only, không strip
            _validate_free_text_field(v, "principle_used", max_len=100)
            return v
        raise ValueError("principle_used must be an integer, string, or None")


NoteSourceContextUnion = Annotated[
    Union[
        Triz9WindowsContext,
        TrizMatrixContext,
        PrincipleSuggestionContext,
        EvidenceContext,
        CandidateSolutionContext,
    ],
    Field(discriminator="source_type"),
]

_note_context_adapter: TypeAdapter[NoteSourceContextUnion] = TypeAdapter(NoteSourceContextUnion)


def parse_note_source_context(data: Any) -> NoteSourceContextUnion:
    """Validate và parse dữ liệu source_context thành một instance thuộc NoteSourceContextUnion."""
    return _note_context_adapter.validate_python(data)
