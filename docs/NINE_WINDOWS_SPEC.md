# Đặc Tả Kiến Trúc: TRIZ 9-Windows System Operator (Batch C1 — Backend-Only)

## 1. Bối cảnh & Mục tiêu

- **Bối cảnh**: Trong phương pháp luận TRIZ của Genrich Altshuller, **Sơ đồ 9 Màn hình (9-Windows / System Operator / Multi-Screen Scheme)** là công cụ kinh điển giúp người nghiên cứu mở rộng góc nhìn tư duy theo 2 trục:
  - **Trục Tung (Không gian / Cấp bậc hệ thống - System Levels)**: Siêu hệ thống (`supersystem`), Hệ thống (`system`), Phân hệ (`subsystem`).
  - **Trục Hoành (Thời gian / Tiến trình tiến hóa - Time Horizons)**: Quá khứ (`past`), Hiện tại (`present`), Tương lai (`future`).
- **Mục tiêu Batch C1**:
  - Xây dựng kho dữ liệu chuẩn hóa, dịch vụ nạp & xác thực fail-closed cho 9 ô trên cả 3 lăng kính: Kỹ thuật (`engineering`), Kinh doanh (`business`), và Đời sống (`everyday`).
  - Cung cấp endpoint REST API chỉ đọc: `GET /api/v1/triz/nine-windows`.
  - Đảm bảo tính bất biến: Không tạo migration cơ sở dữ liệu, không thay đổi entity `ProblemFrame`, không can thiệp trạng thái FSM workflow, không thay đổi frontend trong Batch C1.

---

## 2. Thiết kế Dữ liệu & Quy tắc Xác thực Fail-Closed

### 2.1. Đường dẫn file dữ liệu & Service
- File JSON: `backend/src/app/data/triz_nine_windows.json`
- Service phụ trách: `backend/src/app/services/triz_nine_windows_service.py`

### 2.2. Quy tắc sắp xếp 9 ô (Grid Order Contract)
Lưới 9 ô được sắp xếp tuần tự theo thứ tự chuẩn từ trên xuống dưới, từ trái sang phải:
1. `(supersystem, past)`
2. `(supersystem, present)`
3. `(supersystem, future)`
4. `(system, past)`
5. `(system, present)`
6. `(system, future)`
7. `(subsystem, past)`
8. `(subsystem, present)`
9. `(subsystem, future)`

### 2.3. Quy tắc Kiểm thực Fail-Closed (`validate_nine_windows_data`)
- Root data bắt buộc là `dict`.
- Phải chứa trường `lenses` dạng `dict` với đầy đủ chính xác 3 lăng kính: `{"engineering", "business", "everyday"}`.
- Mỗi lăng kính phải chứa danh sách `windows` có **chính xác 9 phần tử**.
- Bộ tọa độ `(level, time)` trong mỗi lăng kính phải:
  - `level` $\in$ `{"supersystem", "system", "subsystem"}`.
  - `time` $\in$ `{"past", "present", "future"}`.
  - Phủ kín 9 tọa độ, không trùng lặp, không khuyết thiếu.
- Các trường bắt buộc trong từng ô:
  - `label_vi`: `str` không rỗng sau khi `strip()`.
  - `prompt_vi`: `str` không rỗng sau khi `strip()` (câu hỏi gợi mở tư duy cốt lõi).
  - `description_vi`: `str` không rỗng sau khi `strip()`.
- Các trường tùy chọn:
  - `label_en`: `str` tùy chọn.
  - `examples_vi`: `list[str]` tùy chọn, `[]` hợp lệ. Nếu có phần tử thì mỗi phần tử phải là chuỗi non-empty sau khi `strip()`.
- **Xử lý ngoại lệ**:
  - Vi phạm schema/dữ liệu: `ValueError` được ném ra và lan truyền (fail-closed) để chặn chạy hệ thống với dữ liệu sai.
  - Lỗi I/O (`OSError`, `FileNotFoundError`) hoặc lỗi cú pháp JSON (`json.JSONDecodeError`): Được bắt và ghi log warning/error một cách an toàn (graceful fallback rỗng).

---

## 3. Hợp Đồng API REST (`GET /api/v1/triz/nine-windows`)

### 3.1. Request
- **Method**: `GET`
- **Path**: `/api/v1/triz/nine-windows`
- **Query Parameter**:
  - `lens`: `Optional[Literal["engineering", "business", "everyday"]] = "engineering"`
- **Mã lỗi validation**:
  - Nếu `lens` không thuộc allowlist (`engineering`, `business`, `everyday`): Trả về HTTP `422 Unprocessable Entity`.

### 3.2. Response Shape
```json
{
  "lens": "engineering",
  "lens_title": "Lăng kính Kỹ thuật & Công nghệ",
  "grid": [
    {
      "level": "supersystem",
      "time": "past",
      "label_vi": "Siêu hệ thống trong quá khứ",
      "label_en": "Past Supersystem",
      "prompt_vi": "Môi trường kỹ thuật hoặc hạ tầng trước đây chứa hệ thống như thế nào?",
      "description_vi": "Bối cảnh hạ tầng lịch sử.",
      "examples_vi": ["Đường ray và đầu máy hơi nước thế kỷ 19"]
    }
  ],
  "meta": {
    "total_windows": 9,
    "system_levels": ["supersystem", "system", "subsystem"],
    "time_horizons": ["past", "present", "future"]
  }
}
```

---

## 4. Đặc tả Hành vi bằng Gherkin (Gherkin Scenarios)

```gherkin
Feature: TRIZ 9-Windows System Operator (Batch C1)
  As an innovation researcher
  I want to access a structured 9-Windows thinking operator across 3 lenses (engineering, business, everyday)
  So that I can analyze space-time system resources and resolve contradictions without bias

  Scenario: 1. Xác thực bộ dữ liệu 9-Windows hợp lệ (Valid Dataset)
    Given một payload JSON chứa đủ 3 lăng kính: engineering, business, everyday
    And mỗi lăng kính có đúng 9 ô phủ kín 3 cấp độ (supersystem, system, subsystem) và 3 thời gian (past, present, future)
    When chạy hàm validate_nine_windows_data
    Then dữ liệu được xác thực thành công mà không phát sinh ngoại lệ

  Scenario: 2. Bắt lỗi fail-closed khi thiếu lăng kính hoặc thiếu ô
    Given một payload JSON thiếu lăng kính "business" hoặc một lăng kính chỉ có 8 ô
    When chạy hàm validate_nine_windows_data
    Then ném ra ngoại lệ ValueError với thông điệp rõ ràng

  Scenario: 3. Bắt lỗi fail-closed khi sai tọa độ hoặc trùng lặp ô
    Given một lăng kính chứa hai ô có cùng tọa độ (system, present) hoặc level không hợp lệ
    When chạy hàm validate_nine_windows_data
    Then ném ra ngoại lệ ValueError chỉ rõ tọa độ bị sai hoặc trùng lặp

  Scenario: 4. Bắt lỗi fail-closed khi trường bắt buộc tiếng Việt bị rỗng
    Given một ô trong 9-Windows có trường prompt_vi hoặc description_vi rỗng
    When chạy hàm validate_nine_windows_data
    Then ném ra ngoại lệ ValueError từ chối dữ liệu rỗng

  Scenario: 5. Nạp dữ liệu an toàn khi gặp lỗi I/O hoặc JSON hỏng
    Given file dữ liệu triz_nine_windows.json không tồn tại hoặc cú pháp JSON bị hỏng
    When hàm nạp dữ liệu được thực thi
    Then ghi nhận cảnh báo và xử lý an toàn (graceful) mà không làm sập ứng dụng

  Scenario: 6. Truy vấn API với lăng kính mặc định Kỹ thuật (Engineering)
    When gửi yêu cầu GET tới "/api/v1/triz/nine-windows" không truyền tham số lens
    Then nhận về HTTP status 200
    And trường lens có giá trị "engineering"
    And danh sách grid có đúng 9 phần tử theo thứ tự chuẩn từ supersystem_past đến subsystem_future

  Scenario: 7. Truy vấn API với lăng kính Kinh doanh (Business) và Đời sống (Everyday)
    When gửi yêu cầu GET tới "/api/v1/triz/nine-windows?lens=business" hoặc "?lens=everyday"
    Then nhận về HTTP status 200
    And trường lens phản ánh đúng lăng kính được yêu cầu
    And grid chứa nội dung chuyên biệt của lăng kính đó

  Scenario: 8. Từ chối tham số lens không hợp lệ với mã HTTP 422
    When gửi yêu cầu GET tới "/api/v1/triz/nine-windows?lens=invalid_domain"
    Then nhận về HTTP status 422 Unprocessable Entity
    And không làm thay đổi trạng thái của bất kỳ session hay ProblemFrame nào

  Scenario: 9. Bất biến với ProblemFrame và Workflow Engine
    When gọi API /api/v1/triz/nine-windows ở bất kỳ lăng kính nào
    Then không có bản ghi nào được tạo hoặc cập nhật trong cơ sở dữ liệu
    And trạng thái workflow state của session không bị biến đổi
```
