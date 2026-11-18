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
    {
        "id": "life_daily_habit_energy_management",
        "title": "Cân Bằng Nhịp Sống & Tái Tạo Năng Lượng Mỗi Ngày",
        "domain": "life",
        "description": "Xây dựng thói quen sinh hoạt lành mạnh và duy trì hiệu suất làm việc mà không dẫn đến tình trạng kiệt sức hay giảm sút năng lượng.",
        "tags": ["life", "habits", "energy", "wellness"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Muốn duy trì hiệu suất làm việc cao và thói quen sinh hoạt kỷ luật nhưng thường xuyên cảm thấy cạn kiệt năng lượng vào cuối ngày.",
            "normalized_statement": "Tăng năng suất và hiệu quả hoạt động cá nhân trong khi giảm thiểu hao tổn năng lượng và căng thẳng thể chất",
            "contradiction_type": "technical",
            "improving_parameter": "productivity",
            "worsening_parameter": "loss_of_energy",
            "domain": "life",
        },
    },
    {
        "id": "culture_heritage_preservation_tourism",
        "title": "Bảo Tồn Di Sản Văn Hóa & Phát Triển Trải Nghiệm Du Khách",
        "domain": "culture",
        "description": "Gìn giữ tính nguyên bản và độ bền vững của di sản văn hóa truyền thống trong khi mở rộng khả năng tiếp cận và trải nghiệm cho cộng đồng du khách.",
        "tags": ["culture", "heritage", "tourism", "preservation"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Khu di sản muốn mở cửa đón thêm nhiều du khách để quảng bá văn hóa bản địa nhưng lo ngại việc khai thác du lịch làm tổn hại cấu trúc và tính nguyên bản của di sản.",
            "normalized_statement": "Duy trì tính ổn định và tính nguyên bản của di sản văn hóa trong khi tạo điều kiện thuận lợi và dễ dàng cho du khách trải nghiệm",
            "contradiction_type": "technical",
            "improving_parameter": "stability",
            "worsening_parameter": "ease_of_operation",
            "domain": "culture",
        },
    },
    {
        "id": "society_community_waste_sorting_compliance",
        "title": "Thúc Đẩy Phân Loại Rác Cộng Đồng & Giảm Thời Gian Vận Hành",
        "domain": "society",
        "description": "Nâng cao tỷ lệ phân loại rác tại nguồn ở khu dân cư mà không làm phát sinh gánh nặng thời gian giám sát và thu gom của đơn vị dịch vụ công.",
        "tags": ["society", "community", "environment", "public-service"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Chính quyền đô thị muốn tăng độ tin cậy của việc phân loại rác thải tại nguồn của cư dân nhưng lo ngại mất nhiều thời gian tuyên truyền, kiểm tra và phân loại lại.",
            "normalized_statement": "Tăng độ tin cậy và sự tuân thủ phân loại rác của cộng đồng trong khi giảm thiểu tổn thất thời gian giám sát và xử lý của hệ thống đô thị",
            "contradiction_type": "technical",
            "improving_parameter": "reliability",
            "worsening_parameter": "loss_of_time",
            "domain": "society",
        },
    },
    # ──────────────────────────────────────────────
    # Batch C35: Mở rộng Healthcare, Education, Sustainability (2 templates / domain)
    # ──────────────────────────────────────────────
    {
        "id": "healthcare_clinical_accuracy_emergency_speed",
        "title": "Cân Bằng Độ Chính Xác Chẩn Đoán & Tốc Độ Cấp Cứu",
        "domain": "healthcare",
        "description": "Nâng cao độ chính xác và an toàn phân loại bệnh nhân cấp cứu mà không làm gia tăng thời gian chờ và độ trễ can thiệp lâm sàng.",
        "tags": ["healthcare", "emergency", "clinical-safety", "triage"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Khoa cấp cứu muốn thực hiện xét nghiệm chuyên sâu và chẩn đoán chính xác tuyệt đối nhưng bệnh nhân nguy kịch đòi hỏi can thiệp tức thì.",
            "normalized_statement": "Tăng độ tin cậy và độ chính xác chẩn đoán lâm sàng trong khi giảm thời gian thao tác và trì hoãn cấp cứu",
            "contradiction_type": "technical",
            "improving_parameter": "reliability",
            "worsening_parameter": "duration_action",
            "domain": "healthcare",
        },
    },
    {
        "id": "healthcare_medical_device_sterilization_longevity",
        "title": "Tiệt Trùng Dụng Cụ Y Tế Vi Sinh & Bảo Toàn Độ Bền Thiết Bị",
        "domain": "healthcare",
        "description": "Đạt chuẩn vô khuẩn tuyệt đối cho dụng cụ phẫu thuật nội soi tinh vi mà không làm suy giảm tuổi thọ vật liệu quang học và cơ khí.",
        "tags": ["healthcare", "medical-devices", "sterilization", "durability"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Cần khử khuẩn nhiệt độ cao và áp suất lớn để diệt 100% bào tử vi sinh nhưng làm hỏng các cảm biến điện tử và lớp phủ quang học của dụng cụ nội soi.",
            "normalized_statement": "Nâng cao mức độ làm sạch và độ tin cậy vô khuẩn mà không làm tổn hại độ bền và độ ổn định kết cấu thiết bị",
            "contradiction_type": "technical",
            "improving_parameter": "reliability",
            "worsening_parameter": "durability",
            "domain": "healthcare",
        },
    },
    {
        "id": "education_personalized_learning_class_scale",
        "title": "Cá Nhân Hóa Lộ Trình Học & Giảng Dạy Quy Mô Lớn",
        "domain": "education",
        "description": "Điều chỉnh nội dung và nhịp độ học tập phù hợp từng học viên trong lớp học đông người mà không làm quá tải giáo viên.",
        "tags": ["education", "personalized-learning", "pedagogy", "scale"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Giáo viên muốn theo sát điểm mạnh yếu của từng học sinh để giảng dạy phân hóa nhưng lớp học có 45 học sinh và thời lượng tiết học cố định.",
            "normalized_statement": "Tăng năng suất và hiệu quả tiếp thu cá nhân hóa của người học trong khi kiểm soát độ phức tạp và áp lực quản lý lớp",
            "contradiction_type": "technical",
            "improving_parameter": "productivity",
            "worsening_parameter": "complexity",
            "domain": "education",
        },
    },
    {
        "id": "education_interactive_edtech_digital_distraction",
        "title": "Ứng Dụng EdTech Tương Tác & Kiểm Soát Phân Tâm Kỹ Thuật Số",
        "domain": "education",
        "description": "Tận dụng trò chơi hóa và thiết bị thông minh để tạo hứng thú học tập mà không dẫn đến xao nhãng và lạm dụng màn hình.",
        "tags": ["education", "edtech", "engagement", "digital-wellness"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Sử dụng máy tính bảng để học tập tương tác giúp học sinh hào hứng nhưng trẻ dễ bị phân tâm bởi trò chơi và thông báo ngoại vi.",
            "normalized_statement": "Nâng cao mức độ tự động hóa và tính tiện dụng của phương tiện học tập trong khi ngăn ngừa suy giảm sự chú ý và lãng phí thời gian",
            "contradiction_type": "technical",
            "improving_parameter": "automation_level",
            "worsening_parameter": "loss_of_time",
            "domain": "education",
        },
    },
    {
        "id": "sustainability_circular_packaging_barrier_strength",
        "title": "Bao Bì Sinh Học Tuần Hoàn & Khả Năng Bảo Quản Chịu Lực",
        "domain": "sustainability",
        "description": "Chuyển đổi sang vật liệu bao bì phân hủy sinh học tự nhiên mà vẫn đảm bảo độ kín khí, chống thấm ẩm và độ bền vận chuyển.",
        "tags": ["sustainability", "circular-economy", "packaging", "materials"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Doanh nghiệp muốn dùng bao bì từ sợi thực vật phân hủy hoàn toàn nhưng khả năng chống thấm nước kém và dễ rách khi vận chuyển xa.",
            "normalized_statement": "Tăng tính thân thiện môi trường và khả năng tái sinh của vật liệu trong khi bảo toàn độ bền cơ học và tính bảo vệ",
            "contradiction_type": "technical",
            "improving_parameter": "strength",
            "worsening_parameter": "loss_of_substance",
            "domain": "sustainability",
        },
    },
    {
        "id": "sustainability_carbon_abatement_industrial_throughput",
        "title": "Cắt Giảm Phát Thải Carbon & Duy Trì Năng Suất Nhà Máy",
        "domain": "sustainability",
        "description": "Giảm lượng tiêu thụ năng lượng hóa thạch và khí thải nhà máy mà không làm sụt giảm sản lượng dây chuyền sản xuất.",
        "tags": ["sustainability", "carbon-reduction", "energy-efficiency", "manufacturing"],
        "workflow_state": "structuring",
        "problem_frame": {
            "raw_statement": "Nhà máy cần cắt giảm 30% phát thải carbon để đạt tiêu chuẩn xanh nhưng việc giảm nhiệt lò nung làm chậm tốc độ đóng gói và giảm sản lượng.",
            "normalized_statement": "Giảm thiểu tổn thất năng lượng và tiêu hao nhiên liệu trong khi duy trì năng suất và tốc độ vận hành công nghiệp",
            "contradiction_type": "technical",
            "improving_parameter": "loss_of_energy",
            "worsening_parameter": "speed",
            "domain": "sustainability",
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
