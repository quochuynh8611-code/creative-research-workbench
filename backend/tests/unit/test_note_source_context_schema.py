"""
test_note_source_context_schema.py — Unit test suite cho Batch C7c-1: Schema source_context của ResearchNote.

Kiểm tra:
  - Bất biến ORM: Thuộc tính 'metadata' là tên dành riêng của SQLAlchemy Declarative (phát ra SAWarning
    và làm che khuất (shadow) MetaData instance, phá vỡ declarative reflection).
  - Pydantic schema validation cho 5 nguồn:
      1. triz_9_windows
      2. triz_matrix
      3. principle_suggestion
      4. evidence (cấm chunk_id, cấm score)
      5. candidate_solution
  - Validation rules:
      - schema_version bắt buộc là 1
      - Cấm trường lạ (extra="forbid")
      - Giới hạn range catalog: principle_id 1..40, params 1..39
      - Giới hạn độ dài chuỗi (max_length)
      - Phân biệt rõ ràng qua discriminated union
"""
from __future__ import annotations

import uuid
import pytest
from pydantic import ValidationError
from sqlalchemy.exc import SAWarning
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import Integer

from app.domain.models import Base


def test_sqlalchemy_metadata_attribute_name_is_strictly_reserved():
    """
    GIVEN: Model con kế thừa trực tiếp từ app.domain.models.Base trên SQLAlchemy 2.1.1
    WHEN: Khai báo một cột ORM mang tên 'metadata' (ví dụ kiểu JSONB)
    THEN: SQLAlchemy phát ra SAWarning:
            "Attribute name 'metadata' should be left reserved for the MetaData instance when using a Declarative class."
          đồng thời thuộc tính class bị che khuất (shadowing), không còn chứa collection 'tables' hay 'create_all',
          gây phá vỡ các công cụ ORM reflection.
          Sau khi kiểm tra, bảng tạm được dọn dẹp sạch sẽ khỏi Base.metadata.
          (Chứng minh quyết định bất biến: bắt buộc đặt tên 'source_context' thay vì 'metadata').
    """
    table_name = "temp_test_metadata_shadow_check"

    with pytest.warns(SAWarning, match="reserved for the MetaData instance"):
        class ModelWithMetadata(Base):
            __tablename__ = table_name
            id: Mapped[int] = mapped_column(Integer, primary_key=True)
            # Khai báo cột 'metadata'
            metadata: Mapped[dict] = mapped_column(JSONB, nullable=True)

    try:
        # 1. Thuộc tính metadata trên class bị shadow bởi InstrumentedAttribute, mất MetaData methods
        assert not hasattr(ModelWithMetadata.metadata, "tables"), (
            "ModelWithMetadata.metadata must shadow MetaData instance, losing 'tables' attribute"
        )
        assert not hasattr(ModelWithMetadata.metadata, "create_all"), (
            "ModelWithMetadata.metadata must lose 'create_all' method"
        )
    finally:
        # 2. Dọn dẹp bảng tạm khỏi Base.metadata để không làm bẩn schema chung
        if table_name in Base.metadata.tables:
            Base.metadata.remove(Base.metadata.tables[table_name])
        assert table_name not in Base.metadata.tables


def test_triz_9_windows_context_valid():
    """
    GIVEN: Payload hợp lệ của TRIZ 9-Windows
    WHEN: Khởi tạo Triz9WindowsContext
    THEN: Schema validate thành công với đúng các trường được chỉ định.
    """
    from app.schemas.note_context import Triz9WindowsContext

    ctx = Triz9WindowsContext(
        schema_version=1,
        source_type="triz_9_windows",
        lens="engineering",
        level="system",
        time="present",
        cell_label="Hệ thống kỹ thuật hiện tại",
    )
    assert ctx.schema_version == 1
    assert ctx.source_type == "triz_9_windows"
    assert ctx.lens == "engineering"
    assert ctx.level == "system"
    assert ctx.time == "present"
    assert ctx.cell_label == "Hệ thống kỹ thuật hiện tại"


def test_triz_matrix_context_valid():
    """
    GIVEN: Payload hợp lệ của Ma trận TRIZ
    WHEN: Khởi tạo TrizMatrixContext với principle_id và parameter_ids trong phạm vi catalog
    THEN: Schema validate thành công.
    """
    from app.schemas.note_context import TrizMatrixContext

    ctx = TrizMatrixContext(
        schema_version=1,
        source_type="triz_matrix",
        principle_id=10,
        improving_param_id=1,
        worsening_param_id=14,
        lens="business",
    )
    assert ctx.principle_id == 10
    assert ctx.improving_param_id == 1
    assert ctx.worsening_param_id == 14
    assert ctx.lens == "business"


def test_principle_suggestion_context_valid():
    """
    GIVEN: Payload hợp lệ của Gợi ý Nguyên tắc Sáng chế
    WHEN: Khởi tạo PrincipleSuggestionContext
    THEN: Schema validate thành công.
    """
    from app.schemas.note_context import PrincipleSuggestionContext

    ctx = PrincipleSuggestionContext(
        schema_version=1,
        source_type="principle_suggestion",
        principle_id=35,
        method_id="method-param-change-001",
    )
    assert ctx.principle_id == 35
    assert ctx.method_id == "method-param-change-001"


def test_evidence_context_valid():
    """
    GIVEN: Payload hợp lệ của Bằng chứng Tri thức (chỉ chứa source_ref, không lặp chunk_id, không lưu score)
    WHEN: Khởi tạo EvidenceContext
    THEN: Schema validate thành công.
    """
    from app.schemas.note_context import EvidenceContext

    ctx = EvidenceContext(
        schema_version=1,
        source_type="evidence",
        source_ref="Tài liệu Kỹ thuật TRIZ Tập 1 - Trang 42",
    )
    assert ctx.source_type == "evidence"
    assert ctx.source_ref == "Tài liệu Kỹ thuật TRIZ Tập 1 - Trang 42"


def test_evidence_context_forbids_chunk_id():
    """
    GIVEN: Payload evidence cố tình truyền chunk_id vào source_context
    WHEN: Khởi tạo EvidenceContext
    THEN: Ném ValidationError vì chunk_id đã được lưu ở cột riêng source_chunk_id (extra='forbid').
    """
    from app.schemas.note_context import EvidenceContext

    with pytest.raises(ValidationError) as exc_info:
        EvidenceContext(
            schema_version=1,
            source_type="evidence",
            source_ref="Tài liệu",
            chunk_id=str(uuid.uuid4()),
        )
    assert "extra" in str(exc_info.value).lower() or "chunk_id" in str(exc_info.value).lower()


def test_candidate_solution_context_valid():
    """
    GIVEN: Payload hợp lệ của Giải pháp Ứng viên
    WHEN: Khởi tạo CandidateSolutionContext
    THEN: Schema validate thành công.
    """
    from app.schemas.note_context import CandidateSolutionContext

    sol_id = uuid.uuid4()
    ctx = CandidateSolutionContext(
        schema_version=1,
        source_type="candidate_solution",
        solution_id=sol_id,
        principle_used=10,
        solution_status="accepted",
    )
    assert ctx.solution_id == sol_id
    assert ctx.principle_used == 10
    assert ctx.solution_status == "accepted"


def test_schema_rejects_unknown_source_type():
    """
    GIVEN: Payload với source_type lạ không nằm trong 5 nguồn được duyệt
    WHEN: Parse qua NoteSourceContext (Discriminated Union)
    THEN: Ném ValidationError.
    """
    from app.schemas.note_context import parse_note_source_context

    with pytest.raises(ValidationError):
        parse_note_source_context({
            "schema_version": 1,
            "source_type": "unknown_source",
            "foo": "bar",
        })


def test_schema_rejects_extra_fields():
    """
    GIVEN: Payload có trường lạ không được khai báo trong schema (chính sách extra='forbid')
    WHEN: Khởi tạo context model
    THEN: Ném ValidationError báo lỗi extra field.
    """
    from app.schemas.note_context import Triz9WindowsContext

    with pytest.raises(ValidationError) as exc_info:
        Triz9WindowsContext(
            schema_version=1,
            source_type="triz_9_windows",
            lens="engineering",
            level="system",
            time="present",
            cell_label="Hệ thống",
            extra_malicious_field="hack",
        )
    assert "extra" in str(exc_info.value).lower()


def test_schema_rejects_out_of_range_catalog_numbers():
    """
    GIVEN: Payload với principle_id ngoài 1..40 hoặc param_id ngoài 1..39
    WHEN: Khởi tạo TrizMatrixContext
    THEN: Ném ValidationError.
    """
    from app.schemas.note_context import TrizMatrixContext

    # principle_id = 0 (dưới range 1..40)
    with pytest.raises(ValidationError):
        TrizMatrixContext(
            schema_version=1,
            source_type="triz_matrix",
            principle_id=0,
            improving_param_id=1,
            worsening_param_id=1,
            lens="engineering",
        )

    # principle_id = 41 (vượt range 1..40)
    with pytest.raises(ValidationError):
        TrizMatrixContext(
            schema_version=1,
            source_type="triz_matrix",
            principle_id=41,
            improving_param_id=1,
            worsening_param_id=1,
            lens="engineering",
        )

    # improving_param_id = 40 (vượt range 1..39)
    with pytest.raises(ValidationError):
        TrizMatrixContext(
            schema_version=1,
            source_type="triz_matrix",
            principle_id=1,
            improving_param_id=40,
            worsening_param_id=1,
            lens="engineering",
        )


def test_schema_rejects_invalid_schema_version():
    """
    GIVEN: Payload có schema_version khác 1 (ví dụ 0 hoặc 2)
    WHEN: Khởi tạo context model
    THEN: Ném ValidationError.
    """
    from app.schemas.note_context import EvidenceContext

    with pytest.raises(ValidationError):
        EvidenceContext(
            schema_version=2,
            source_type="evidence",
            source_ref="Sách tham khảo",
        )


def test_schema_rejects_max_length_exceeded():
    """
    GIVEN: Payload có trường chuỗi vượt quá max_length quy định
    WHEN: Khởi tạo context model
    THEN: Ném ValidationError.
    """
    from app.schemas.note_context import EvidenceContext

    long_ref = "A" * 256  # max_length là 255
    with pytest.raises(ValidationError):
        EvidenceContext(
            schema_version=1,
            source_type="evidence",
            source_ref=long_ref,
        )


def test_schema_rejects_control_characters_in_all_free_text_fields():
    """
    GIVEN: Payload chứa ký tự điều khiển (newline, tab, CR, NUL) trong bất kỳ trường chuỗi tự do nào
    WHEN: Khởi tạo context models
    THEN: Ném ValidationError từ chối ký tự điều khiển.
    """
    from app.schemas.note_context import (
        Triz9WindowsContext,
        EvidenceContext,
        PrincipleSuggestionContext,
        CandidateSolutionContext,
    )

    control_chars = ["\n", "\r", "\t", "\0"]

    # 1. cell_label in Triz9WindowsContext
    for ch in control_chars:
        with pytest.raises(ValidationError):
            Triz9WindowsContext(
                schema_version=1,
                source_type="triz_9_windows",
                lens="engineering",
                level="system",
                time="present",
                cell_label=f"Hệ thống{ch}kỹ thuật",
            )

    # 2. source_ref in EvidenceContext
    for ch in control_chars:
        with pytest.raises(ValidationError):
            EvidenceContext(
                schema_version=1,
                source_type="evidence",
                source_ref=f"Tài liệu tham khảo{ch}trang 42",
            )

    # 3. method_id in PrincipleSuggestionContext
    for ch in control_chars:
        with pytest.raises(ValidationError):
            PrincipleSuggestionContext(
                schema_version=1,
                source_type="principle_suggestion",
                principle_id=1,
                method_id=f"method{ch}01",
            )

    # 4. principle_used (str) in CandidateSolutionContext
    for ch in control_chars:
        with pytest.raises(ValidationError):
            CandidateSolutionContext(
                schema_version=1,
                source_type="candidate_solution",
                solution_id=uuid.uuid4(),
                principle_used=f"Nguyên tắc{ch}1",
                solution_status="candidate",
            )


def test_schema_accepts_valid_vietnamese_unicode_in_free_text_fields():
    """
    GIVEN: Chuỗi Unicode tiếng Việt đầy đủ dấu và ký tự in ấn hợp lệ
    WHEN: Khởi tạo các context models
    THEN: Validate thành công mà không phát sinh lỗi.
    """
    from app.schemas.note_context import (
        Triz9WindowsContext,
        EvidenceContext,
        PrincipleSuggestionContext,
        CandidateSolutionContext,
    )

    ctx_9w = Triz9WindowsContext(
        schema_version=1,
        source_type="triz_9_windows",
        lens="business",
        level="system",
        time="present",
        cell_label="Hệ thống phân phối gạo đặc sản ĐBSCL & chuỗi cung ứng hữu cơ",
    )
    assert "ĐBSCL" in ctx_9w.cell_label

    ctx_ev = EvidenceContext(
        schema_version=1,
        source_type="evidence",
        source_ref="Tạp chí Khoa học Đất & Lúa Gạo Miền Tây — Số 42, Trang 108",
    )
    assert "Khoa học Đất" in ctx_ev.source_ref

    ctx_ps = PrincipleSuggestionContext(
        schema_version=1,
        source_type="principle_suggestion",
        principle_id=10,
        method_id="phuong-phap-dong-goi-hut-chan-khong-nang-cao",
    )
    assert ctx_ps.method_id == "phuong-phap-dong-goi-hut-chan-khong-nang-cao"

    ctx_cs = CandidateSolutionContext(
        schema_version=1,
        source_type="candidate_solution",
        solution_id=uuid.uuid4(),
        principle_used="Nguyên tắc 35: Chuyển đổi trạng thái lý - hóa",
        solution_status="accepted",
    )
    assert ctx_cs.principle_used == "Nguyên tắc 35: Chuyển đổi trạng thái lý - hóa"


# ──────────────────────────────────────────────
# Strict Schema Hardening Tests (Quy tắc a - e)
# ──────────────────────────────────────────────

def test_schema_rejects_booleans_in_all_integer_fields():
    """
    Quy tắc a: principle_id, improving_param_id, worsening_param_id và principle_used (int)
    từ chối tuyệt đối kiểu boolean (Python True/False và JSON true/false).
    """
    from app.schemas.note_context import (
        TrizMatrixContext,
        PrincipleSuggestionContext,
        CandidateSolutionContext,
    )

    # 1. TrizMatrixContext: principle_id
    with pytest.raises(ValidationError):
        TrizMatrixContext(
            schema_version=1,
            source_type="triz_matrix",
            lens="engineering",
            improving_param_id=1,
            worsening_param_id=2,
            principle_id=True,  # type: ignore[arg-type]
        )

    # 2. TrizMatrixContext: improving_param_id
    with pytest.raises(ValidationError):
        TrizMatrixContext(
            schema_version=1,
            source_type="triz_matrix",
            lens="engineering",
            improving_param_id=True,  # type: ignore[arg-type]
            worsening_param_id=2,
            principle_id=1,
        )

    # 3. TrizMatrixContext: worsening_param_id
    with pytest.raises(ValidationError):
        TrizMatrixContext(
            schema_version=1,
            source_type="triz_matrix",
            lens="engineering",
            improving_param_id=1,
            worsening_param_id=False,  # type: ignore[arg-type]
            principle_id=1,
        )

    # 4. PrincipleSuggestionContext: principle_id
    with pytest.raises(ValidationError):
        PrincipleSuggestionContext(
            schema_version=1,
            source_type="principle_suggestion",
            principle_id=True,  # type: ignore[arg-type]
            method_id="contradiction_matrix",
        )

    # 5. CandidateSolutionContext: principle_used as bool
    with pytest.raises(ValidationError):
        CandidateSolutionContext(
            schema_version=1,
            source_type="candidate_solution",
            solution_id=uuid.uuid4(),
            principle_used=True,  # type: ignore[arg-type]
            solution_status="candidate",
        )

    with pytest.raises(ValidationError):
        CandidateSolutionContext(
            schema_version=1,
            source_type="candidate_solution",
            solution_id=uuid.uuid4(),
            principle_used=False,  # type: ignore[arg-type]
            solution_status="candidate",
        )


def test_schema_rejects_numeric_strings_and_floats_in_id_fields():
    """
    Quy tắc a: Các trường số nguyên chặt từ chối chuỗi số và số thực (float).
    """
    from app.schemas.note_context import (
        TrizMatrixContext,
        PrincipleSuggestionContext,
    )

    # Chuỗi số "1"
    with pytest.raises(ValidationError):
        TrizMatrixContext(
            schema_version=1,
            source_type="triz_matrix",
            lens="engineering",
            improving_param_id="1",  # type: ignore[arg-type]
            worsening_param_id=2,
            principle_id=1,
        )

    with pytest.raises(ValidationError):
        PrincipleSuggestionContext(
            schema_version=1,
            source_type="principle_suggestion",
            principle_id="10",  # type: ignore[arg-type]
            method_id="method_01",
        )

    # Số thực float 1.0 hoặc 1.5
    with pytest.raises(ValidationError):
        TrizMatrixContext(
            schema_version=1,
            source_type="triz_matrix",
            lens="engineering",
            improving_param_id=1.0,  # type: ignore[arg-type]
            worsening_param_id=2,
            principle_id=1,
        )

    with pytest.raises(ValidationError):
        PrincipleSuggestionContext(
            schema_version=1,
            source_type="principle_suggestion",
            principle_id=5.5,  # type: ignore[arg-type]
            method_id="method_01",
        )


def test_schema_rejects_control_characters_at_edges_without_stripping():
    """
    Quy tắc b: Kiểm tra ký tự điều khiển trên chuỗi GỐC, không strip trước.
    Các chuỗi có '\\n', '\\t', '\\r' ở đầu hoặc cuối đều phải bị từ chối.
    """
    from app.schemas.note_context import (
        Triz9WindowsContext,
        EvidenceContext,
        PrincipleSuggestionContext,
        CandidateSolutionContext,
    )

    edge_cases = ["abc\n", "\tabc", "abc\r", "\0abc"]

    # 1. cell_label
    for text_val in edge_cases:
        with pytest.raises(ValidationError):
            Triz9WindowsContext(
                schema_version=1,
                source_type="triz_9_windows",
                lens="engineering",
                level="system",
                time="present",
                cell_label=text_val,
            )

    # 2. source_ref
    for text_val in edge_cases:
        with pytest.raises(ValidationError):
            EvidenceContext(
                schema_version=1,
                source_type="evidence",
                source_ref=text_val,
            )

    # 3. method_id
    for text_val in edge_cases:
        with pytest.raises(ValidationError):
            PrincipleSuggestionContext(
                schema_version=1,
                source_type="principle_suggestion",
                principle_id=1,
                method_id=text_val,
            )

    # 4. principle_used dạng chuỗi
    for text_val in edge_cases:
        with pytest.raises(ValidationError):
            CandidateSolutionContext(
                schema_version=1,
                source_type="candidate_solution",
                solution_id=uuid.uuid4(),
                principle_used=text_val,
                solution_status="candidate",
            )


def test_schema_rejects_u2028_and_u2029_in_all_free_text_fields():
    """
    Quy tắc c: Từ chối ký tự ngắt dòng Unicode U+2028 (LINE SEPARATOR) và U+2029 (PARAGRAPH SEPARATOR).
    """
    from app.schemas.note_context import (
        Triz9WindowsContext,
        EvidenceContext,
        PrincipleSuggestionContext,
        CandidateSolutionContext,
    )

    separators = ["\u2028", "\u2029"]

    for sep in separators:
        # 1. cell_label
        with pytest.raises(ValidationError):
            Triz9WindowsContext(
                schema_version=1,
                source_type="triz_9_windows",
                lens="engineering",
                level="system",
                time="present",
                cell_label=f"cell{sep}label",
            )

        # 2. source_ref
        with pytest.raises(ValidationError):
            EvidenceContext(
                schema_version=1,
                source_type="evidence",
                source_ref=f"ref{sep}doc",
            )

        # 3. method_id
        with pytest.raises(ValidationError):
            PrincipleSuggestionContext(
                schema_version=1,
                source_type="principle_suggestion",
                principle_id=1,
                method_id=f"method{sep}id",
            )

        # 4. principle_used (str)
        with pytest.raises(ValidationError):
            CandidateSolutionContext(
                schema_version=1,
                source_type="candidate_solution",
                solution_id=uuid.uuid4(),
                principle_used=f"used{sep}val",
                solution_status="candidate",
            )


def test_schema_rejects_whitespace_only_in_all_free_text_fields():
    """
    Quy tắc d: Từ chối chuỗi rỗng hoặc chỉ gồm khoảng trắng (sau khi strip).
    """
    from app.schemas.note_context import (
        Triz9WindowsContext,
        EvidenceContext,
        PrincipleSuggestionContext,
        CandidateSolutionContext,
    )

    blank_values = ["", "   ", " \t \n "]

    # 1. cell_label
    for blank in ["   ", "     "]:
        with pytest.raises(ValidationError):
            Triz9WindowsContext(
                schema_version=1,
                source_type="triz_9_windows",
                lens="engineering",
                level="system",
                time="present",
                cell_label=blank,
            )

    # 2. source_ref
    for blank in ["   ", "     "]:
        with pytest.raises(ValidationError):
            EvidenceContext(
                schema_version=1,
                source_type="evidence",
                source_ref=blank,
            )

    # 3. method_id
    for blank in ["   ", "     "]:
        with pytest.raises(ValidationError):
            PrincipleSuggestionContext(
                schema_version=1,
                source_type="principle_suggestion",
                principle_id=1,
                method_id=blank,
            )

    # 4. principle_used
    for blank in ["   ", "     "]:
        with pytest.raises(ValidationError):
            CandidateSolutionContext(
                schema_version=1,
                source_type="candidate_solution",
                solution_id=uuid.uuid4(),
                principle_used=blank,
                solution_status="candidate",
            )


def test_schema_preserves_leading_trailing_whitespace_without_mutating_data():
    """
    Quy tắc e: KHÔNG biến đổi dữ liệu, bỏ .strip() trong validator principle_used.
    Khoảng trắng đầu/cuối hợp lệ được bảo toàn nguyên vẹn.
    """
    from app.schemas.note_context import CandidateSolutionContext

    raw_val = "  Nguyên tắc 1: Phân nhỏ  "
    ctx = CandidateSolutionContext(
        schema_version=1,
        source_type="candidate_solution",
        solution_id=uuid.uuid4(),
        principle_used=raw_val,
        solution_status="candidate",
    )
    # Bất biến: Không được strip mất khoảng trắng đầu/cuối của người dùng
    assert ctx.principle_used == raw_val
