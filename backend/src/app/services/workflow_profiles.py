"""
workflow_profiles.py — Application-layer workflow archetypes & guidance catalog (Batch C35).

Cung cấp 3 workflow profiles:
  1. standard_triz: Quy trình TRIZ 6 bước cổ điển đầy đủ
  2. rapid_prototyping: Luồng lặp nhanh ý tưởng, chế tạo mẫu thử & kiểm chứng giả thuyết
  3. stakeholder_alignment: Luồng đồng thuận đa góc nhìn & đánh giá giải pháp đa tiêu chí

Bảo toàn kiến trúc:
  - Hoàn toàn ở tầng ứng dụng (Application Layer), KHÔNG thay đổi FSM cốt lõi (WorkflowState).
"""
from __future__ import annotations

from typing import Any

WORKFLOW_PROFILES: list[dict[str, Any]] = [
    {
        "id": "standard_triz",
        "name_vi": "Quy trình TRIZ Tiêu chuẩn (6 Bước)",
        "name_en": "Standard TRIZ Workflow",
        "description_vi": "Quy trình tuần tự cổ điển đi từ phân tích mâu thuẫn kỹ thuật/vật lý đến tra cứu 40 nguyên tắc và tổng hợp giải pháp.",
        "description_en": "Classic sequential methodology from contradiction structuring and patent retrieval to 40 inventive principles and synthesis.",
        "recommended_lenses": ["engineering", "business", "everyday"],
        "stages_guidance": {
            "intake": "Thu thập thông tin bối cảnh và hiện trạng bài toán cần giải quyết.",
            "structuring": "Xác định thông số cần cải thiện, thông số bị suy giảm và loại mâu thuẫn.",
            "retrieval": "Tra cứu các sáng chế và tài liệu kỹ thuật liên quan.",
            "ideation": "Ứng dụng 40 nguyên tắc sáng tạo và 9 màn hình để sinh ý tưởng đột phá.",
            "evaluation": "Sàng lọc ý tưởng theo tính khả thi kỹ thuật và hiệu quả kinh tế.",
            "synthesis": "Tổng hợp giải pháp khả thi thành đề cương nghiên cứu hoàn chỉnh.",
        },
    },
    {
        "id": "rapid_prototyping",
        "name_vi": "Tạo Mẫu Thử Nghiệm Nhanh (Rapid Prototyping)",
        "name_en": "Rapid Prototyping Workflow",
        "description_vi": "Luồng tối ưu cho chu kỳ lặp nhanh: cô đọng mâu thuẫn trọng yếu, sinh concept cấp tốc và thử nghiệm giả thuyết rủi ro cao nhất (Riskiest Assumptions).",
        "description_en": "Fast-iteration workflow focusing on critical contradiction framing, rapid concept ideation, and riskiest assumption testing.",
        "recommended_lenses": ["design_thinking", "lean_startup"],
        "stages_guidance": {
            "intake": "Nhận diện vấn đề cốt lõi của người dùng và các rào cản kỹ thuật tức thì.",
            "structuring": "Đóng khung bài toán thành mâu thuẫn then chốt cần giải quyết bằng mẫu thử.",
            "retrieval": "Tham khảo nhanh các mẫu thử tương đồng và công nghệ sẵn có ngoài thị trường.",
            "ideation": "Sinh các phương án mẫu thử khả thi tối thiểu (MVP) với chi phí thấp nhất.",
            "evaluation": "Thử nghiệm trên người dùng thực tế và ghi nhận phản hồi định lượng.",
            "synthesis": "Quyết định tăng tốc hoàn thiện hoặc chuyển hướng (Pivot) giải pháp.",
        },
    },
    {
        "id": "stakeholder_alignment",
        "name_vi": "Đồng Thuận Đa Bên (Stakeholder Alignment)",
        "name_en": "Stakeholder Alignment Workflow",
        "description_vi": "Luồng tối ưu cho các bài toán phức hợp có nhiều bên liên quan xung đột quyền lợi: phân tích mâu thuẫn đa chiều và thiết lập ma trận tiêu chí chung.",
        "description_en": "Consensus-building workflow for complex systems with conflicting multi-stakeholder interests, multi-perspective framing, and aligned decision criteria.",
        "recommended_lenses": ["systems_thinking", "business"],
        "stages_guidance": {
            "intake": "Lập bản đồ các bên liên quan và thu thập góc nhìn, kỳ vọng của từng nhóm.",
            "structuring": "Mô hình hóa xung đột lợi ích giữa các bên thành các cặp mâu thuẫn có thể giải quyết.",
            "retrieval": "Tìm kiếm các tiền lệ chính sách, tiêu chuẩn ngành và mô hình giải quyết xung đột.",
            "ideation": "Đồng sáng tạo (Co-creation) các giải pháp cùng có lợi (Win-Win) xóa bỏ mâu thuẫn.",
            "evaluation": "Đánh giá phương án qua ma trận đồng thuận với trọng số của từng nhóm bên liên quan.",
            "synthesis": "Soạn thảo biên bản thỏa thuận hành động và lộ trình triển khai thống nhất.",
        },
    },
]


def get_workflow_profiles() -> list[dict[str, Any]]:
    """Trả về danh sách 3 workflow profiles được hỗ trợ."""
    return WORKFLOW_PROFILES


def get_workflow_profile_by_id(profile_id: str) -> dict[str, Any] | None:
    """Tìm workflow profile theo ID."""
    clean_id = (profile_id or "").strip()
    for profile in WORKFLOW_PROFILES:
        if profile["id"] == clean_id:
            return profile
    return None
