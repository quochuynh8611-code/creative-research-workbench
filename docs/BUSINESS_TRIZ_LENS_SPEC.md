# Đặc Tả Kỹ Thuật: Business-TRIZ Lens (Batch B1)

## 1. Mục tiêu
Bổ sung lăng kính Kinh doanh (Business-TRIZ Lens) hoạt động song song với lăng kính Kỹ thuật (Engineering gốc) và lăng kính Đời sống (Everyday Lens) cho hệ thống tra cứu ma trận TRIZ 39x39 và 40 nguyên tắc sáng tạo.

## 2. Phạm vi
- Dữ liệu tĩnh read-only: 39 thông số kinh doanh và 40 nguyên tắc sáng tạo phiên giải theo bối cảnh quản trị doanh nghiệp, marketing, tài chính, vận hành, khách hàng.
- Bổ sung các trường `business_*` mang tính **additive**, tuyệt đối không phá vỡ response contract hiện có của các API TRIZ.
- Giao diện người dùng `TrizMatrixLookup`: bổ sung bộ chọn 3 lăng kính (Engineering / Business / Everyday) với mặc định là "Kỹ thuật".
- Tuyệt đối không thay đổi ma trận toán học tất định Altshuller 1985 (`triz_matrix_39x39.json`).
- Không persist lựa chọn lens vào cơ sở dữ liệu.
- Không tự động thay đổi trạng thái workflow hay tạo CandidateSolution.

## 3. Cấu trúc Dữ liệu: `backend/src/app/data/business_triz_lens.json`
File dữ liệu JSON chuẩn mực độc lập với schema:
```json
{
  "parameters": {
    "1": {
      "business_label": "Quy mô vốn luân chuyển, dòng tiền lưu động hoặc chi phí vận hành cần di chuyển"
    },
    ... (đúng 39 keys "1".."39")
  },
  "principles": {
    "1": {
      "business_title": "Phân khúc thị trường / Chia nhỏ quy trình (Phân đoạn)",
      "business_application": "Chia nhỏ tệp khách hàng thành các phân khúc ngách hoặc phân tách quy trình vận hành phức tạp thành các bước vi mô độc lập.",
      "business_examples": [
        "Phân khúc khách hàng theo giá trị vòng đời (LTV) để cá nhân hóa chiến dịch marketing.",
        "Chia quy trình on-boarding khách hàng thành 3 bước nhỏ thay vì một form đăng ký dài."
      ],
      "business_action_prompt": "Quy trình hoặc phân khúc nào đang quá cồng kềnh có thể chia nhỏ để quản lý linh hoạt hơn?"
    },
    ... (đúng 40 keys "1".."40")
  }
}
```

### Quy tắc Schema:
1. `parameters`: Dictionary chứa đúng 39 keys từ `"1"` đến `"39"`. Mỗi entry bắt buộc có:
   - `business_label`: string non-empty.
2. `principles`: Dictionary chứa đúng 40 keys từ `"1"` đến `"40"`. Mỗi entry bắt buộc có:
   - `business_title`: string non-empty.
   - `business_application`: string non-empty.
   - `business_examples`: array of strings non-empty (tối thiểu 1 ví dụ thực tiễn kinh doanh).
   - `business_action_prompt`: string non-empty.

## 4. Validator Fail-Closed & Loader
- **Hàm xác thực**: `validate_business_triz_lens_data(data: dict[str, Any]) -> None`.
  - Phải kiểm tra đúng 39 parameters và đúng 40 principles.
  - Keys phải từ `"1"` đến `"39"` (cho parameters) và `"1"` đến `"40"` (cho principles), không trùng lặp, không thừa, không thiếu.
  - Các trường bắt buộc phải là chuỗi không rỗng (`str.strip() != ""`).
  - `business_examples` phải là list không rỗng chứa các chuỗi không rỗng.
  - **Fail-closed**: Mọi vi phạm schema phải raise `ValueError` ngay lập tức, không được âm thầm bỏ qua.
- **Cơ chế nạp (`_load`)**:
  - `OSError` hoặc `json.JSONDecodeError` khi đọc file: Ghi log cảnh báo và xử lý graceful (không crash ứng dụng, trả về rỗng).
  - Lỗi validation từ `validate_business_triz_lens_data`: **BẮT BUỘC LAN TRUYỀN** (`ValueError`), không được bọc hay nuốt lỗi.

## 5. API Response Contracts (Additive Only)
Không thay đổi hay xóa bất kỳ field nào hiện có; không bổ sung query param `lens` trong Batch B1 để bảo toàn tính độc lập của client:
1. `GET /api/v1/triz/parameters`:
   Mỗi item bổ sung thêm trường tùy chọn:
   ```json
   {
     "id": 1,
     "code": "weight_moving",
     "name_vi": "Trọng lượng vật thể di động",
     "name_en": "Weight of moving object",
     "description": "...",
     "everyday_label": "...",
     "business_label": "..."
   }
   ```
2. `GET /api/v1/triz/principles`:
   Mỗi item bổ sung thêm các trường tùy chọn:
   ```json
   {
     "id": 1,
     "principle_id": 1,
     "name_vi": "...",
     "name_en": "...",
     "description": "...",
     "explanation": "...",
     "examples": [...],
     "everyday_title": "...",
     "daily_application": "...",
     "daily_examples": [...],
     "action_prompt": "...",
     "business_title": "...",
     "business_application": "...",
     "business_examples": [...],
     "business_action_prompt": "..."
   }
   ```
3. `GET /api/v1/triz/lookup`:
   `improving_parameter`, `worsening_parameter`, và từng principle trong mảng `principles` được làm giàu với các trường `business_*` tương ứng.

## 6. Giao diện Người dùng (`TrizMatrixLookup`)
- Bổ sung Segmented Control gồm 3 tùy chọn lăng kính:
  - **Kỹ thuật (Engineering)**: Mặc định (default). Hiển thị tên thông số kỹ thuật gốc và mô tả nguyên tắc kỹ thuật Altshuller.
  - **Kinh doanh (Business)**: Hiển thị nhãn thông số kinh doanh (`business_label`) và chi tiết ứng dụng kinh doanh (`business_title`, `business_application`, `business_examples`, `business_action_prompt`).
  - **Đời sống (Everyday)**: Giữ nguyên hành vi hiện tại của lăng kính đời sống (`everyday_label`, `everyday_title`, `daily_application`, `daily_examples`, `action_prompt`).
- **Xử lý thiếu dữ liệu (Graceful Fallback)**:
  - Nếu dữ liệu business metadata chưa tải được hoặc bị thiếu, giao diện hiển thị fallback tiếng Việt được kiểm soát (ví dụ: "Đang cập nhật diễn giải kinh doanh..."), tuyệt đối không để lộ raw error hay crash component.
- Không persist lựa chọn lens vào DB.
- Không thay đổi workflow state.
