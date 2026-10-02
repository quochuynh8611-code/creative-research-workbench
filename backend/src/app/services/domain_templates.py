"""
domain_templates.py — Domain Templates Catalog for Phase 9.3.
Provides pre-structured research session templates for various domains.
"""

from __future__ import annotations

from typing import Any, Optional


DOMAIN_TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "engineering_composite_arm",
        "title": "Tối ưu hóa Trọng lượng & Độ bền Cơ học",
        "domain": "technical",
        "description": "Mẫu bài toán mâu thuẫn giữa độ cứng vững kết cấu và khối lượng cơ khí.",
        "tags": ["engineering", "triz", "mechanics"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Kết cấu cánh tay robot cần tăng khả năng chịu tải và độ cứng vững nhưng không được tăng khối lượng để đảm bảo quán tính thấp.",
            "normalized_statement": "Tăng độ bền và độ cứng vững trong khi giữ hoặc giảm khối lượng vật thể chuyển động",
            "contradiction_type": "technical",
            "improving_parameter": "strength",
            "worsening_parameter": "weight_moving",
            "domain": "technical",
        },
    },
    {
        "id": "business_delivery_speed_cost",
        "title": "Tối ưu Tốc độ Giao hàng & Chi phí Vận hành",
        "domain": "business",
        "description": "Mẫu giải quyết mâu thuẫn giữa chi phí logistics và thời gian giao hàng chặng cuối.",
        "tags": ["business", "logistics", "operations"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Doanh nghiệp muốn rút ngắn thời gian giao hàng tức thì nhưng chi phí kho bãi vệ tinh và nhân sự bị đội lên cao.",
            "normalized_statement": "Tăng tốc độ phục vụ giao vận mà không làm gia tăng tổn thất tài chính vận hành",
            "contradiction_type": "technical",
            "improving_parameter": "speed",
            "worsening_parameter": "loss_of_money",
            "domain": "business",
        },
    },
    {
        "id": "software_latency_security",
        "title": "Tăng cường Bảo mật Đa tầng & Giảm Độ trễ API",
        "domain": "software",
        "description": "Mẫu tối ưu hóa kiểm tra chữ ký số và mã hóa dữ liệu mà không làm suy giảm latency.",
        "tags": ["software", "security", "performance"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Hệ thống cần bổ sung các lớp mã hóa đa tầng và kiểm tra token liên tục nhưng không làm suy giảm thời gian phản hồi (latency) của API.",
            "normalized_statement": "Tăng độ tin cậy an ninh hệ thống trong khi duy trì thời gian thực thi tác vụ",
            "contradiction_type": "technical",
            "improving_parameter": "reliability",
            "worsening_parameter": "duration_action",
            "domain": "software",
        },
    },
]


def get_all_templates() -> list[dict[str, Any]]:
    """Trả về danh sách tất cả các domain templates định sẵn."""
    return DOMAIN_TEMPLATES


def get_template_by_id(template_id: str) -> Optional[dict[str, Any]]:
    """Tìm domain template theo ID."""
    clean_id = (template_id or "").strip()
    for tpl in DOMAIN_TEMPLATES:
        if tpl["id"] == clean_id:
            return tpl
    return None
