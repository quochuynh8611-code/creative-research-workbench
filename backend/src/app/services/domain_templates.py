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
    {
        "id": "personal_morning_routine_energy",
        "title": "Cân bằng Thói quen Sáng sớm & Năng lượng Làm việc",
        "domain": "personal",
        "description": "Cân bằng giữa mong muốn dậy sớm rèn luyện và năng lượng tỉnh táo suốt ngày dài.",
        "tags": ["personal", "habits", "energy", "lifestyle"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Muốn dậy sớm lúc 5h sáng để tập thể dục và đọc sách nhưng sợ thiếu ngủ, mệt mỏi và kiệt sức vào buổi chiều.",
            "normalized_statement": "Tăng năng suất và thói quen tích cực buổi sáng trong khi duy trì mức năng lượng và giảm hao tổn sức lực",
            "contradiction_type": "technical",
            "improving_parameter": "productivity",
            "worsening_parameter": "loss_of_energy",
            "domain": "personal",
        },
    },
    {
        "id": "personal_healthy_meal_time_cost",
        "title": "Bữa ăn Gia đình Đủ Dinh dưỡng & Thời gian Tiết kiệm",
        "domain": "personal",
        "description": "Nấu ăn tại nhà sạch và đủ chất với quỹ thời gian sơ chế và ngân sách chi tiêu hạn chế.",
        "tags": ["personal", "family", "nutrition", "health"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Muốn nấu ăn tại nhà sạch, đủ dinh dưỡng nhưng đi làm về muộn, ít thời gian sơ chế và sợ phát sinh chi phí.",
            "normalized_statement": "Nâng cao chất lượng bữa ăn gia đình và độ tiện lợi trong chế biến trong khi hạn chế lãng phí thời gian và ngân sách",
            "contradiction_type": "technical",
            "improving_parameter": "ease_of_operation",
            "worsening_parameter": "loss_of_time",
            "domain": "personal",
        },
    },
    {
        "id": "personal_small_space_organization",
        "title": "Tối ưu Góc Làm việc & Không gian Sống Nhỏ",
        "domain": "personal",
        "description": "Tối ưu hóa khả năng lưu trữ, tiện ích góc làm việc nhưng phòng nhỏ vẫn thoáng đãng, gọn gàng.",
        "tags": ["personal", "organization", "minimalism", "workspace"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Muốn góc làm việc đầy đủ sách vở, màn hình và thiết bị nhưng phòng ngủ nhỏ cần phải gọn gàng, thoáng đãng và không bừa bộn.",
            "normalized_statement": "Mở rộng khả năng chứa và tiện ích góc làm việc mà không làm gia tăng độ phức tạp và cảm giác chật chội của không gian sống",
            "contradiction_type": "technical",
            "improving_parameter": "volume_stationary",
            "worsening_parameter": "complexity",
            "domain": "personal",
        },
    },
    {
        "id": "education_child_screen_autonomy",
        "title": "Giúp Trẻ Tự giác Học tập & Giảm Thời gian Màn hình",
        "domain": "education",
        "description": "Nuôi dưỡng tinh thần chủ động học tập của trẻ và giảm thời gian thiết bị mà không áp đặt cấm đoán.",
        "tags": ["education", "parenting", "autonomy", "habits"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Muốn con giảm thời gian màn hình và chủ động học nhưng không muốn cấm đoán gây căng thẳng, xung đột trong gia đình.",
            "normalized_statement": "Tăng tính tự chủ, tự giác trong học tập của trẻ trong khi giảm áp lực tâm lý và xung đột căng thẳng gia đình",
            "contradiction_type": "technical",
            "improving_parameter": "automation_level",
            "worsening_parameter": "stress_pressure",
            "domain": "education",
        },
    },
    {
        "id": "business_packaging_protection_cost",
        "title": "Đóng gói Sản phẩm Chống sốc, Thẩm mỹ & Tối ưu Chi phí",
        "domain": "business",
        "description": "Bao bì đẹp mắt, bảo vệ an toàn hàng hóa chống vỡ hỏng nhưng không làm tăng chi phí và thời gian đóng hàng.",
        "tags": ["business", "packaging", "operations", "cost"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Muốn bao bì đẹp, bảo vệ hàng tốt nhưng không tăng chi phí và thời gian gói hàng.",
            "normalized_statement": "Nâng cao độ bền bảo vệ và tính an toàn của bao bì hàng hóa mà không làm gia tăng chi phí vật tư và thời gian thao tác",
            "contradiction_type": "technical",
            "improving_parameter": "strength",
            "worsening_parameter": "loss_of_money",
            "domain": "business",
        },
    },
    {
        "id": "research_knowledge_overload",
        "title": "Quản trị Tri thức Cá nhân & Nghiên cứu Chuyên sâu",
        "domain": "research",
        "description": "Hệ thống hóa tài liệu, ghi chú và kết nối tri thức nghiên cứu hiệu quả, không bị thất lạc và dễ ứng dụng.",
        "tags": ["research", "knowledge-management", "pkm", "learning"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Muốn đọc, ghi chú và sử dụng lại kiến thức/y học cổ truyền hiệu quả nhưng tài liệu phân tán, khó tìm lại và dễ quên.",
            "normalized_statement": "Tăng hiệu suất tổng hợp và tái sử dụng tri thức nghiên cứu trong khi ngăn ngừa thất lạc và lãng quên thông tin",
            "contradiction_type": "technical",
            "improving_parameter": "productivity",
            "worsening_parameter": "loss_of_information",
            "domain": "research",
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
