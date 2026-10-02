# 📋 Phase 9.3 — Session Import & Domain Templates Execution Specification

> **Phiên bản:** 1.0.0
> **Trạng thái:** DRAFT — Chờ phê duyệt
> **Ngày lập:** 2026-10-02
> **Tác giả:** Staff Software Engineer / Technical Architect
> **Căn cứ:** [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), [PROFESSIONAL_UPGRADE_ROADMAP.md](docs/PROFESSIONAL_UPGRADE_ROADMAP.md) (Phase 9.3), [ADR-005](docs/ADR/ADR-005-phase-9a-export-and-synthesis.md)

---

## 1. Bối cảnh & Mục tiêu Kỹ thuật

Sau khi hoàn thành Phase 9A và 9B (Export Markdown, JSON snapshot và PDF Print workflow), hệ thống Creative Research Workbench cần cung cấp khả năng nhập và tái sử dụng dữ liệu:
1. **Session Import (Phục hồi / Chia sẻ phiên):** Cho phép người dùng nhập file snapshot `.json` (được tạo ra từ tính năng Export JSON của Phase 9A/9B) để tái tạo toàn bộ phiên nghiên cứu mới gồm Problem Frame, Research Notes và Candidate Solutions.
2. **Domain Templates (Mẫu nghiên cứu theo lĩnh vực):** Cung cấp các mẫu nghiên cứu định sẵn (Engineering, Business, Software/IT) giúp người dùng nhanh chóng khởi tạo bài toán TRIZ mẫu mà không cần nhập thủ công từ đầu.
3. **Data Integrity & Backward Compatibility:**
   - Bảo đảm quá trình import sinh UUID phiên mới để không gây xung đột khóa chính với các phiên hiện có.
   - Kiểm tra validation chặt chẽ: từ chối file JSON sai cấu trúc hoặc thiếu thông tin phiên bắt buộc với mã lỗi `400 Bad Request`.

---

## 2. Thiết kế Hợp đồng Dữ liệu & API Contracts

### A. Backend Endpoints

#### 1. Import Session (`POST /api/v1/sessions/import`)
- **Request Body (JSON Snapshot Payload):**
```json
{
  "session": {
    "title": "Tối ưu hóa độ bền động cơ điện",
    "description": "Mô tả nghiên cứu...",
    "domain": "technical",
    "workflow_state": "ideation"
  },
  "problem_frame": {
    "raw_statement": "Động cơ cần tăng công suất nhưng không được tăng nhiệt độ",
    "normalized_statement": "Tăng công suất trong khi giữ nhiệt độ an toàn",
    "contradiction_type": "technical",
    "improving_parameter": "power",
    "worsening_parameter": "temperature",
    "domain": "technical"
  },
  "research_notes": [
    {
      "content": "Ghi chép về vật liệu tản nhiệt",
      "note_type": "insight"
    }
  ],
  "candidate_solutions": [
    {
      "title": "Rotor lõi rỗng",
      "mechanism": "Giảm quán tính và tăng lưu thông khí",
      "status": "candidate",
      "novelty_score": 0.8,
      "feasibility_score": 0.7,
      "risk_notes": "Cần thử nghiệm cân bằng động"
    }
  ]
}
```
- **Response Format (`HTTP 201 Created`):**
```json
{
  "data": {
    "id": "new-uuid-string",
    "title": "Tối ưu hóa độ bền động cơ điện",
    "domain": "technical",
    "status": "active",
    "workflow_state": "ideation",
    "created_at": "2026-10-02T...",
    "updated_at": "2026-10-02T..."
  },
  "imported_elements": {
    "problem_frame": true,
    "notes_count": 1,
    "solutions_count": 1
  },
  "message": "Session imported successfully"
}
```
- **Error Handling:**
  - `400 Bad Request`: Payload không phải là dict hợp lệ, thiếu khóa `session`, hoặc `session.title` rỗng / whitespace.

#### 2. Get Domain Templates (`GET /api/v1/sessions/templates`)
- **Response Format (`HTTP 200 OK`):**
```json
{
  "data": [
    {
      "id": "engineering_composite_arm",
      "title": "Tối ưu hóa Trọng lượng & Độ bền Cơ học",
      "domain": "technical",
      "description": "Mẫu bài toán mâu thuẫn giữa độ cứng vững và khối lượng kết cấu cơ khí.",
      "tags": ["engineering", "triz", "mechanics"],
      "problem_frame": {
        "raw_statement": "Kết cấu cánh tay robot cần tăng khả năng chịu tải và độ cứng vững nhưng không được tăng khối lượng để đảm bảo quán tính thấp.",
        "contradiction_type": "technical",
        "improving_parameter": "strength",
        "worsening_parameter": "weight_moving",
        "domain": "technical"
      }
    },
    {
      "id": "business_delivery_speed_cost",
      "title": "Tối ưu Tốc độ Giao hàng & Chi phí Vận hành",
      "domain": "business",
      "description": "Mẫu giải quyết mâu thuẫn giữa chi phí logistics và thời gian giao hàng.",
      "tags": ["business", "logistics", "operations"],
      "problem_frame": {
        "raw_statement": "Doanh nghiệp muốn rút ngắn thời gian giao hàng tức thì nhưng chi phí kho bãi và nhân sự bị đội lên cao.",
        "contradiction_type": "technical",
        "improving_parameter": "speed",
        "worsening_parameter": "loss_of_money",
        "domain": "business"
      }
    },
    {
      "id": "software_latency_security",
      "title": "Tăng cường Bảo mật Đa tầng & Giảm Độ trễ API",
      "domain": "software",
      "description": "Mẫu tối ưu hóa kiểm tra chữ ký số và mã hóa mà không làm suy giảm latency.",
      "tags": ["software", "security", "performance"],
      "problem_frame": {
        "raw_statement": "Hệ thống cần bổ sung các lớp mã hóa đa tầng và kiểm tra token liên tục nhưng không làm suy giảm thời gian phản hồi (latency) của API.",
        "contradiction_type": "technical",
        "improving_parameter": "reliability",
        "worsening_parameter": "duration_action",
        "domain": "software"
      }
    }
  ]
}
```

#### 3. Create Session From Template (`POST /api/v1/sessions/from-template`)
- **Request Body:**
```json
{
  "template_id": "engineering_composite_arm",
  "title": "Dự án Cánh tay Robot Thế hệ Mới (Tùy chọn)"
}
```
- **Response Format (`HTTP 201 Created`):** Trả về đối tượng `ResearchSession` mới đã được khởi tạo sẵn `ProblemFrame` theo template.

---

## 3. Phân tích Rủi ro & Blast Radius

| Thành phần | Mức độ ảnh hưởng | Biện pháp phòng vệ |
|---|---|---|
| `session_import_service.py` | Cực thấp | Tách service import riêng biệt, sử dụng transaction database rollback nếu import lỗi. |
| `sessions.py` | Cực thấp | Thêm 3 endpoints mới (`/import`, `/templates`, `/from-template`), không sửa endpoints hiện hữu. |
| DB Schema | Zero | Tái sử dụng bảng `research_sessions`, `problem_frames`, `research_notes`, `candidate_solutions`. Không migration. |
| Frontend `session-list.tsx` | Cực thấp | Bổ sung nút "Nhập JSON" và "Mẫu nghiên cứu" mà không ảnh hưởng luồng tạo session chuẩn. |
