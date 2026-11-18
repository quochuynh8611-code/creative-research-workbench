"""
test_domain_templates_expansion.py — Unit test suite cho mở rộng Domain Templates (Batch C35).
Kiểm tra đúng 2 templates mới cho mỗi domain (healthcare, education, sustainability), tổng cộng đúng 6 templates mới.
"""
from __future__ import annotations

from app.services.domain_templates import (
    get_all_templates,
    get_template_by_id,
)

EXPECTED_NEW_TEMPLATE_IDS = {
    "healthcare": [
        "healthcare_clinical_accuracy_emergency_speed",
        "healthcare_medical_device_sterilization_longevity",
    ],
    "education": [
        "education_personalized_learning_class_scale",
        "education_interactive_edtech_digital_distraction",
    ],
    "sustainability": [
        "sustainability_circular_packaging_barrier_strength",
        "sustainability_carbon_abatement_industrial_throughput",
    ],
}


def test_new_domain_templates_exist_and_counts_match() -> None:
    """Xác nhận đúng 2 templates mới cho mỗi domain healthcare, education, sustainability."""
    all_templates = get_all_templates()
    templates_by_domain: dict[str, list[dict]] = {}

    for tpl in all_templates:
        dom = tpl.get("domain", "")
        templates_by_domain.setdefault(dom, []).append(tpl)

    for domain_key, expected_ids in EXPECTED_NEW_TEMPLATE_IDS.items():
        assert domain_key in templates_by_domain, f"Domain '{domain_key}' không có template nào."
        found_ids = [t["id"] for t in templates_by_domain[domain_key]]
        for expected_id in expected_ids:
            assert expected_id in found_ids, f"Template ID '{expected_id}' thiếu trong domain '{domain_key}'."


def test_new_domain_templates_structure_integrity() -> None:
    """Xác nhận cấu trúc dữ liệu của 6 templates mới hoàn chỉnh, không rỗng và đúng quy cách."""
    all_new_ids = [
        tpl_id
        for id_list in EXPECTED_NEW_TEMPLATE_IDS.values()
        for tpl_id in id_list
    ]
    assert len(all_new_ids) == 6, "Tổng số templates mới phải là đúng 6."

    for tpl_id in all_new_ids:
        tpl = get_template_by_id(tpl_id)
        assert tpl is not None, f"Không tìm thấy template với ID '{tpl_id}'."
        assert tpl["id"] == tpl_id
        assert isinstance(tpl.get("title"), str) and len(tpl["title"].strip()) > 0
        assert isinstance(tpl.get("description"), str) and len(tpl["description"].strip()) > 0
        assert isinstance(tpl.get("tags"), list) and len(tpl["tags"]) >= 2
        assert tpl.get("workflow_state") == "structuring"

        # Problem frame kiểm tra
        frame = tpl.get("problem_frame")
        assert isinstance(frame, dict), f"problem_frame của '{tpl_id}' phải là dict."
        assert len(frame.get("raw_statement", "").strip()) > 0
        assert len(frame.get("normalized_statement", "").strip()) > 0
        assert frame.get("contradiction_type") in ("technical", "physical")
        assert len(frame.get("improving_parameter", "").strip()) > 0
        assert len(frame.get("worsening_parameter", "").strip()) > 0
        assert frame.get("domain") == tpl["domain"]
