"""
Unit regression test for Phase 1A: Data contract aliases for TRIZ parameters
used in canonical domain templates (engineering_composite_arm, business_delivery_speed_cost, software_latency_security).
"""

from __future__ import annotations

import pytest

from app.domain.models import ContradictionType, ProblemFrame
from app.services.domain_templates import get_template_by_id
from app.services.problem_structuring_service import (
    ProblemStructuringService,
    _PARAM_TO_ID_MAP,
)


@pytest.mark.parametrize(
    "template_id, expected_improving, expected_worsening",
    [
        ("engineering_composite_arm", "strength", "weight_moving"),
        ("business_delivery_speed_cost", "speed", "loss_of_money"),
        ("software_latency_security", "reliability", "duration_action"),
    ],
)
def test_canonical_templates_create_valid_contradiction_principles(
    template_id: str,
    expected_improving: str,
    expected_worsening: str,
):
    """
    Assert that the 3 canonical templates have valid parameter mappings in _PARAM_TO_ID_MAP
    and that ProblemStructuringService._create_contradiction generates a non-empty list of
    principles in 1..40 with no zeros.
    """
    tpl = get_template_by_id(template_id)
    assert tpl is not None, f"Template {template_id} must exist"

    pf = tpl.get("problem_frame", {})
    improving_param = pf.get("improving_parameter")
    worsening_param = pf.get("worsening_parameter")
    contra_type_str = pf.get("contradiction_type")

    assert improving_param == expected_improving
    assert worsening_param == expected_worsening
    assert contra_type_str == "technical"

    # Check mapping in _PARAM_TO_ID_MAP
    imp_id = _PARAM_TO_ID_MAP.get(improving_param)
    wors_id = _PARAM_TO_ID_MAP.get(worsening_param)

    assert imp_id is not None and imp_id > 0, f"{improving_param} must map to valid TRIZ param ID > 0"
    assert wors_id is not None and wors_id > 0, f"{worsening_param} must map to valid TRIZ param ID > 0"

    service = ProblemStructuringService()
    dummy_frame = ProblemFrame(
        raw_statement=pf.get("raw_statement", ""),
        normalized_statement=pf.get("normalized_statement"),
        contradiction_type=ContradictionType.technical,
        improving_parameter=improving_param,
        worsening_parameter=worsening_param,
    )

    contradiction = service._create_contradiction(
        frame=dummy_frame,
        contradiction_type=ContradictionType.technical,
        improving_param=improving_param,
        worsening_param=worsening_param,
    )

    # Required assertions:
    assert contradiction.type == ContradictionType.technical
    assert contradiction.suggested_principles is not None
    assert len(contradiction.suggested_principles) > 0, (
        f"Template {template_id} ({improving_param} vs {worsening_param} -> coords {imp_id}_{wors_id}) "
        f"must produce non-empty suggested_principles"
    )
    assert 0 not in contradiction.suggested_principles, "Principle ID 0 is invalid"
    assert all(
        1 <= pid <= 40 for pid in contradiction.suggested_principles
    ), "All principle IDs must be in 1..40"


def test_everyday_problem_meal_creates_valid_problem_frame():
    """
    Test case yêu cầu:
    everyday problem 'Muốn nấu ăn đủ dinh dưỡng nhưng tốn nhiều thời gian và chi phí'
    tạo ra ProblemFrame và trích xuất tham số/mâu thuẫn hợp lệ.
    """
    service = ProblemStructuringService()
    raw_statement = "Muốn nấu ăn đủ dinh dưỡng nhưng tốn nhiều thời gian và chi phí"

    contradiction_type, imp_param, wors_param = service._extract_parameters_and_type(raw_statement)
    normalized = service._normalize_statement(
        raw_statement=raw_statement,
        domain="personal",
        contradiction_type=contradiction_type,
        improving_param=imp_param,
        worsening_param=wors_param,
    )

    assert contradiction_type in (ContradictionType.technical, ContradictionType.physical, ContradictionType.none, ContradictionType.unknown)
    assert len(normalized) > 0

    frame = ProblemFrame(
        raw_statement=raw_statement,
        normalized_statement=normalized,
        domain="personal",
        contradiction_type=contradiction_type,
        improving_parameter=imp_param,
        worsening_parameter=wors_param,
    )
    assert frame.raw_statement == raw_statement
    assert frame.domain == "personal"
    assert frame.normalized_statement == normalized
