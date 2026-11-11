# Đặc Tả Kỹ Thuật: Business-Aware TRIZ Auto-Map (Batch B2)

## 1. Mục tiêu và Phạm vi

### 1.1. Mục tiêu
Bổ sung khả năng nhận diện các thuật ngữ và khái niệm kinh doanh (Business-aware lens) một cách **opt-in** cho API tự động ánh xạ thông số TRIZ: `POST /api/v1/triz/auto-map`.

### 1.2. Phạm vi và Ranh giới (Invariance & Boundary)
- **Không thay đổi luồng ProblemFrame extraction**: Hàm `_extract_parameters_and_type()` và các quy trình tạo `ProblemFrame` trong `ProblemStructuringService` tiếp tục chỉ sử dụng từ điển kỹ thuật kinh điển, đảm bảo bài toán kỹ thuật không bị sai lệch.
- **Không có UI caller trong Batch B2**: Chưa tích hợp gọi `auto-map` từ giao diện người dùng. Switcher tab trong `TrizMatrixLookup` vẫn duy trì trạng thái client-side độc lập.
- **Bảo tồn tính tương thích ngược (Backward Compatibility)**: Mọi lời gọi hiện có không truyền `lens` (hoặc truyền `lens="engineering"`) hoạt động 100% như legacy behavior.
- **Khẳng định tính chất dữ liệu**: Toàn bộ mapping kinh doanh là **heuristic / domain lens phái sinh** nhằm hỗ trợ tư duy mâu thuẫn trong quản trị và kinh doanh, **không phải là thuật ngữ TRIZ nguyên bản của Genrich Altshuller (1985)**.

---

## 2. API Contract

### 2.1. Request Contract: `POST /api/v1/triz/auto-map`
```json
{
  "text": "string (bắt buộc, không được rỗng hoặc chỉ toàn khoảng trắng)",
  "top_k": 5, // int, ge=1, le=39, default=5
  "lens": "engineering" // string enum: "engineering" | "business", default="engineering"
}
```

- `text`: Chuỗi mô tả bài toán tự do (tiếng Việt hoặc tiếng Anh).
- `top_k`: Số lượng thông số gợi ý tối đa trả về, từ 1 đến 39. Mặc định là 5.
- `lens`: Chế độ từ điển đối soát:
  - `"engineering"` (mặc định): Chỉ sử dụng bộ từ khóa kỹ thuật truyền thống `_PARAMETER_KEYWORDS`.
  - `"business"`: Sử dụng phối hợp cả từ khóa kỹ thuật và danh mục cụm từ kinh doanh được phê duyệt, có khử trùng lặp (dedup).
  - Giá trị khác: Trả về lỗi `HTTP 422 Unprocessable Content`.

### 2.2. Response Contract (Giữ nguyên cấu trúc hiện hành)
```json
{
  "data": [
    {
      "id": 9,
      "code": "speed",
      "name_vi": "Tốc độ",
      "name_en": "Speed",
      "score": 0.88,
      "matched_keywords": [
        "tốc độ ra mắt thị trường"
      ],
      "description": "Tốc độ thực hiện hành động hoặc vận tốc di chuyển của đối tượng..."
    }
  ],
  "meta": {
    "total_candidates": 1,
    "query_text": "Cần tối ưu tốc độ ra mắt thị trường nhưng thiếu nhân lực"
  }
}
```

### 2.3. Quy tắc xử lý HTTP Status
1. **Chuỗi rỗng / chỉ khoảng trắng** (`""` hoặc `"   "`):
   - Trả về `HTTP 400 Bad Request` kèm `{"detail": "text must not be empty or whitespace only"}`.
2. **Chuỗi non-empty không khớp bất kỳ từ khóa nào**:
   - Trả về `HTTP 200 OK` kèm `{"data": [], "meta": {"total_candidates": 0, "query_text": "..."}}`.
3. **Giá trị `lens` không hợp lệ** (ví dụ `"medical"`, `"unknown"`):
   - Trả về `HTTP 422 Unprocessable Content` (FastAPI / Pydantic validation).
4. **Giới hạn `top_k` ngoài [1..39]**:
   - Trả về `HTTP 422 Unprocessable Content`.

---

## 3. Danh mục Cụm từ Kinh doanh Được Phê duyệt (Approved Business Phrases)

Chỉ có đúng **6 cụm từ cụ thể** dưới đây được đưa vào tập từ điển kinh doanh:

| # | Cụm từ cụ thể | Parameter ID | Parameter Code | Khái niệm đối ứng kinh doanh | Phân loại |
|---|---|---|---|---|---|
| 1 | `"tốc độ ra mắt thị trường"` | 9 | `speed` | Chu kỳ Time-to-Market đưa sản phẩm dịch vụ mới ra thị trường | Heuristic Business Lens |
| 2 | `"tỷ lệ giữ chân nhân sự"` | 13 | `stability` | Độ ổn định cơ cấu tổ chức và gắn kết đội ngũ | Heuristic Business Lens |
| 3 | `"vòng đời khách hàng"` | 16 | `duration_stationary` | Customer Lifetime Value (LTV), độ bền vững quan hệ khách hàng | Heuristic Business Lens |
| 4 | `"hao hụt hàng tồn kho"` | 23 | `loss_of_substance` | Mất mát, hao tổn giá trị hoặc hư hỏng vật tư/hàng hóa lưu kho | Heuristic Business Lens |
| 5 | `"thời gian chờ phê duyệt"` | 25 | `loss_of_time` | Lãng phí thời gian, độ trễ quy trình hành chính và quyết sách | Heuristic Business Lens |
| 6 | `"trải nghiệm người dùng"` | 33 | `ease_of_operation` | Tính dễ sử dụng, thân thiện, tiện ích của giải pháp đối với khách hàng | Heuristic Business Lens |

### Nguyên tắc phòng vệ ngữ nghĩa (False-Positive Defense)
- **Tuyệt đối không match từ đơn mơ hồ**: Không đưa các từ đơn lẻ như `"vốn"`, `"thị trường"`, `"khách hàng"`, `"rủi ro"`, `"chuyển đổi"`, `"marketing"` vào từ điển vì nguy cơ gây nhiễu rất cao.
- **Chống false-positive từ ghép**: Các chuỗi như `"vốn dĩ"`, `"cố vấn"`, `"thị trường ngách"`, `"khách hàng tiềm năng"` không được tự ý match vào các parameter trừ phi chứa chính xác cụm từ được phê duyệt.
- **Exact phrase matching**: Khớp nguyên cụm từ (case-insensitive) sau khi đã chuẩn hóa khoảng trắng thừa.

---

## 4. Quản lý Dữ liệu và Kiến trúc

1. **Vị trí lưu trữ dữ liệu**:
   - Dữ liệu từ khóa kinh doanh được lưu trữ trong file cấu trúc JSON `backend/src/app/data/business_triz_lens.json` (dưới trường `auto_map_keywords`) hoặc một schema quản lý tập trung.
   - **Tuyệt đối không hardcode** danh sách từ khóa kinh doanh trực tiếp vào file Python `problem_structuring_service.py`.
2. **Khử trùng lặp và tính điểm (Scoring & Deduplication)**:
   - Khi ở `lens="business"`, nếu một câu chứa cả từ khóa kỹ thuật lẫn cụm từ kinh doanh cùng trỏ về một tham số (ví dụ: `"tốc độ"` và `"tốc độ ra mắt thị trường"` cùng trỏ về Parameter 9), hệ thống phải **gộp vào cùng một candidate entry** (deduplicate theo `param_id`), danh sách `matched_keywords` chứa đủ các từ khớp.
   - Điểm số `score` tuân thủ công thức tất định hiện có:
     $$\text{score} = \min\left(1.0, 0.6 + 0.15 \times |\text{matched\_keywords}| + 0.02 \times \max(\text{len}(k))\right)$$
   - Thứ tự xếp hạng: Sắp xếp theo `score` giảm dần, tie-breaking theo `id` tăng dần.

---

## 5. Kế hoạch Kiểm thử (Test Strategy)

Bộ test tích hợp tại `backend/tests/integration/test_business_auto_map_api.py` phải bảo đảm:
1. `test_auto_map_default_lens_is_engineering_legacy`: Không truyền `lens` -> 6 cụm kinh doanh trả về `data: []`.
2. `test_auto_map_explicit_engineering_lens_legacy`: Truyền `lens="engineering"` -> 6 cụm kinh doanh trả về `data: []`.
3. `test_auto_map_business_lens_recognizes_all_6_approved_phrases`: Truyền `lens="business"` cho từng cụm trong 6 cụm -> Khớp đúng Parameter ID tương ứng.
4. `test_auto_map_business_lens_deduplicates_same_parameter`: Khi câu chứa cả kỹ thuật và kinh doanh cùng 1 param -> Chỉ trả về 1 entry kèm danh sách `matched_keywords` đầy đủ.
5. `test_auto_map_non_empty_no_match_returns_200_empty_list`: Chuỗi không khớp trả về HTTP 200, `data: []`, `total_candidates: 0`.
6. `test_auto_map_empty_and_whitespace_returns_400`: Chuỗi rỗng hoặc whitespace trả về HTTP 400.
7. `test_auto_map_invalid_lens_returns_422`: `lens="invalid"` trả về HTTP 422.
8. `test_auto_map_business_lens_false_positive_defense`: Các chuỗi như `"vốn dĩ"`, `"cố vấn"`, `"khách hàng"`, `"thị trường"` không match thành mâu thuẫn.
9. `test_auto_map_determinism_top_k_and_tie_breaking`: Đảm bảo tie-breaking dựa trên ID tăng dần.
10. `test_problem_framing_extraction_unaffected_by_business_phrases`: Gọi `service._extract_parameters_and_type()` để khẳng định luồng trích xuất khung bài toán không bị ảnh hưởng.
