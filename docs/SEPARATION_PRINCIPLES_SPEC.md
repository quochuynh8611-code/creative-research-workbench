# TÀI LIỆU ĐẶC TẢ KỸ THUẬT: TRIZ SEPARATION PRINCIPLES CHO MÂU THUẪN VẬT LÝ
## (SEPARATION PRINCIPLES SPECIFICATION — BATCH A)

> **Dự án**: Creative Research Workbench  
> **Module**: TRIZ Problem Structuring & Ideation Engine  
> **Trạng thái**: 📝 **DRAFT / RED SPECIFICATION (BATCH A)**  
> **Canonical Data Path**: `backend/src/app/data/triz_separation_principles.json`  
> **Phạm vi áp dụng**: Mâu thuẫn vật lý (`contradiction_type == "physical"`). Tuyệt đối không can thiệp mâu thuẫn kỹ thuật (`technical`), không mâu thuẫn (`none`), hoặc chưa xác định (`unknown`) ngoài việc bảo toàn hồi quy (regression protection).

---

## 1. Mục Tiêu & Bối Cảnh Nghiệp Vụ

### 1.1 Mục Tiêu
Cung cấp **4 chiến lược phân tách kinh điển của TRIZ** (Separation Principles) dành riêng cho việc giải quyết **Mâu thuẫn Vật lý (Physical Contradictions)**:
1. **Phân tách trong không gian (Separation in Space)**: Khi các yêu cầu đối nghịch xảy ra ở các vị trí, bộ phận hoặc không gian khác nhau.
2. **Phân tách trong thời gian (Separation in Time)**: Khi các yêu cầu đối nghịch xảy ra tại các thời điểm, giai đoạn hoặc chu kỳ khác nhau.
3. **Phân tách theo điều kiện (Separation upon Condition)**: Khi các yêu cầu đối nghịch phụ thuộc vào trạng thái môi trường, tải trọng hoặc hoàn cảnh kích hoạt.
4. **Phân tách giữa hệ thống và các thành phần (Separation between System and Components / System Level)**: Khi tính chất đối nghịch xuất hiện ở cấp độ vĩ mô (toàn hệ thống) nhưng không xuất hiện (hoặc ngược lại) ở cấp độ vi mô (thành phần con).

### 1.2 Bối Cảnh Kỹ Thuật
Hiện tại, khi người dùng chuẩn hóa một bài toán thành mâu thuẫn vật lý (`contradiction_type == "physical"`), hệ thống gán cứng một danh sách rút gọn:
```python
_PHYSICAL_PRINCIPLES: list[int] = [1, 2, 3, 4]
```
Điều này hạn chế khả năng khám phá của nhà nghiên cứu. Đặc tả này định nghĩa kiến trúc mở rộng để:
- Cung cấp câu hỏi chẩn đoán gợi mở bằng tiếng Việt (`diagnostic_question_vi`).
- Ánh xạ chính xác từng chiến lược phân tách sang tập hợp các nguyên tắc sáng tạo TRIZ (trong 40 nguyên tắc Altshuller).
- Cho phép người dùng lựa chọn linh hoạt một hoặc nhiều chiến lược để lọc và hợp nhất các nguyên tắc gợi ý.
- Duy trì tính tương thích ngược tuyệt đối: nếu người dùng không chọn chiến lược nào, fallback `[1, 2, 3, 4]` được giữ nguyên.

---

## 2. Hợp Đồng Dữ Liệu Canonical (JSON Contract)

### 2.1 Đường Dẫn Lưu Trữ
```
backend/src/app/data/triz_separation_principles.json
```

### 2.2 Schema JSON Chuẩn Mực

```json
{
  "version": "1.0-separation-canonical",
  "title": "TRIZ Separation Principles for Physical Contradictions",
  "description": "Bốn chiến lược phân tách kinh điển trong TRIZ để giải quyết mâu thuẫn vật lý và ánh xạ tới 40 nguyên tắc sáng tạo.",
  "strategies": [
    {
      "id": "space",
      "name_vi": "Phân tách trong không gian",
      "name_en": "Separation in Space",
      "diagnostic_question_vi": "Vấn đề hoặc tính chất đối nghịch này có thể tách biệt tại các vị trí/vùng không gian khác nhau không?",
      "principle_ids": [1, 2, 3, 4, 7, 13, 17, 24, 26, 30]
    },
    {
      "id": "time",
      "name_vi": "Phân tách trong thời gian",
      "name_en": "Separation in Time",
      "diagnostic_question_vi": "Tính chất đối nghịch này có thể xuất hiện tại các thời điểm hoặc giai đoạn khác nhau không?",
      "principle_ids": [9, 10, 11, 15, 16, 18, 19, 20, 21, 29, 34, 37]
    },
    {
      "id": "condition",
      "name_vi": "Phân tách theo điều kiện",
      "name_en": "Separation upon Condition",
      "diagnostic_question_vi": "Hệ thống có thể chuyển đổi tính chất khi điều kiện môi trường hoặc trạng thái thay đổi không?",
      "principle_ids": [28, 31, 32, 35, 36, 38, 39, 40]
    },
    {
      "id": "system_level",
      "name_vi": "Phân tách giữa hệ thống và các thành phần (mức hệ thống)",
      "name_en": "Separation between System and its Components",
      "diagnostic_question_vi": "Tính chất này có thể thuộc về toàn bộ hệ thống trong khi các thành phần riêng lẻ có tính chất ngược lại không?",
      "principle_ids": [1, 3, 5, 6, 7, 12, 25, 27, 33, 40]
    }
  ]
}
```

### 2.3 Quy Tắc Ánh Xạ Nguyên Tắc Sáng Tạo (Principle Mappings)
| Strategy ID | Tên Chiến Lược Tiếng Việt | Danh Sách Principle IDs | Số Lượng |
| :--- | :--- | :--- | :---: |
| `space` | Phân tách trong không gian | `[1, 2, 3, 4, 7, 13, 17, 24, 26, 30]` | 10 |
| `time` | Phân tách trong thời gian | `[9, 10, 11, 15, 16, 18, 19, 20, 21, 29, 34, 37]` | 12 |
| `condition` | Phân tách theo điều kiện | `[28, 31, 32, 35, 36, 38, 39, 40]` | 8 |
| `system_level` | Phân tách giữa hệ thống và các thành phần | `[1, 3, 5, 6, 7, 12, 25, 27, 33, 40]` | 10 |

---

## 3. Quy Tắc Xác Thực Dữ Liệu Fail-Closed (Validation Invariants)

Hàm kiểm tra `validate_separation_principles_data(data: dict)` phải tuân thủ kỷ luật fail-closed nghiêm ngặt:
1. **Kiểu dữ liệu gốc**: Phải là một JSON dictionary hợp lệ.
2. **Số lượng chiến lược**: Danh sách `strategies` phải có chính xác **4 phần tử**.
3. **Định danh chiến lược (Strategy ID)**:
   - Các ID phải duy nhất, không trùng lặp.
   - Tập hợp các ID phải khớp chính xác với `{"space", "time", "condition", "system_level"}`.
4. **Trường bắt buộc trong mỗi strategy**:
   - `id`: Chuỗi ký tự định danh không rỗng.
   - `name_vi`: Chuỗi ký tự tiếng Việt không rỗng.
   - `diagnostic_question_vi`: Chuỗi ký tự câu hỏi chẩn đoán không rỗng.
   - `principle_ids`: Danh sách số nguyên không rỗng.
5. **Giới hạn Principle IDs**:
   - Mọi `principle_id` trong `principle_ids` phải là số nguyên nằm trong đoạn $[1, 40]$.
   - Bất kỳ giá trị nào ngoài khoảng $[1, 40]$ hoặc sai kiểu dữ liệu phải lập tức kích hoạt `RuntimeError` hoặc `ValueError`.
6. **Fallback Invariant**:
   - Khi chưa chọn strategy nào hoặc khi dữ liệu file JSON separation bị lỗi/không khả dụng, hệ thống phải giữ nguyên fallback mặc định `[1, 2, 3, 4]`.

---

## 4. Quy Tắc Tương Tác Nghiệp Vụ & Luồng Dữ Liệu (Business & UI Rules)

### 4.1 Điều Kiện Hiển Thị (Trigger Condition)
- **Chỉ hiển thị** khối Chiến lược phân tách khi `problem_frame.contradiction_type == "physical"`.
- Với các loại mâu thuẫn `technical`, `none`, hoặc `unknown`:
  - **Tuyệt đối không hiển thị** khu vực chọn chiến lược phân tách.
  - Giữ nguyên luồng tra cứu ma trận 39x39 hoặc gợi ý hiện tại.

### 4.2 Lựa Chọn Chiến Lược (Multi-selection & Deduplication)
- Người dùng có thể chọn **0, 1 hoặc nhiều chiến lược** cùng lúc (Checkbox / Toggle Chips).
- **Hành vi khi không chọn strategy nào (0 selected)**:
  - Giữ nguyên danh sách nguyên tắc gợi ý mặc định `[1, 2, 3, 4]`.
- **Hành vi khi chọn 1 strategy**:
  - Lọc và hiển thị đúng các nguyên tắc thuộc mapping của strategy đó.
- **Hành vi khi chọn nhiều strategy (ví dụ: `space` và `condition`)**:
  - Hợp nhất (Union) các danh sách `principle_ids` và loại bỏ trùng lặp (Deduplication).
  - Ví dụ: `space` `[1, 2, 3, 4, 7, 13, 17, 24, 26, 30]` + `condition` `[28, 31, 32, 35, 36, 38, 39, 40]` $\rightarrow$ Hợp nhất 18 nguyên tắc duy nhất.

### 4.3 Giới Hạn Tác Động & Bất Biến Lưu Trữ (Non-Persistence & Isolation)
- **Không ghi đè dữ liệu cơ sở dữ liệu**:
  - Không tự ý ghi đè cột `suggested_principles` đã lưu trong bảng `contradictions`.
  - Không tự động persist lựa chọn strategy vào DB trong phạm vi Batch A (lựa chọn chỉ diễn ra ở runtime / client-side view state).
- **Không tự ý chuyển đổi trạng thái**:
  - Không tự tạo `CandidateSolution`.
  - Không tự chuyển đổi `workflow_state` của `ResearchSession`.
- **Xử lý lỗi an toàn (Resilient UX)**:
  - Nếu API gặp sự cố hoặc JSON separation principles không nạp được, giao diện người dùng **không được hiển thị lỗi thô (raw backend error)**.
  - Phải hiển thị fallback gracefully với thông báo thân thiện và danh sách nguyên tắc mặc định `[1, 2, 3, 4]`.

---

## 5. Hợp Đồng API & Tính Tương Thích Ngược (API Contract Compatibility)

### 5.1 Endpoint `POST /api/v1/sessions/{session_id}/problem-frame`
Endpoint tạo và chuẩn hóa ProblemFrame phải bảo toàn chính xác **9 trường dữ liệu cốt lõi**:
```json
{
  "id": "uuid-string",
  "session_id": "uuid-string",
  "raw_statement": "string",
  "normalized_statement": "string",
  "contradiction_type": "physical",
  "improving_parameter": null,
  "worsening_parameter": null,
  "domain": "technical",
  "created_at": "2026-03-15T09:00:00Z"
}
```
**Quy tắc tương thích**:
- Mọi trường mở rộng liên quan đến Separation Strategies (nếu có bổ sung vào response payload) phải là **additive (bổ sung)** và **optional-safe**.
- Không được đổi tên, không được xóa, và không được thay đổi kiểu dữ liệu của bất kỳ trường nào trong số 9 trường trên.

### 5.2 Endpoint Truy Vấn Danh Mục Separation Strategies (Read-Only Endpoint)
Dự kiến cung cấp endpoint đọc tĩnh:
```http
GET /api/v1/triz/separation-principles
```
- Trả về danh sách đầy đủ 4 chiến lược kèm câu hỏi chẩn đoán và principle IDs.
- Hỗ trợ caching và fail-closed validation khi khởi động.
