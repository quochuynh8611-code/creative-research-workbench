# TÀI LIỆU ĐẶC TẢ KỸ THUẬT: CANONICAL TRIZ 39×39 MATRIX DATASET
## (PHASE 6.3 — CANONICAL TRIZ SPECIFICATION)

> **Dự án**: Creative Research Workbench
> **Giai đoạn**: Phase 6.3 / Quick-Win 1 (QW-1) — Intelligent TRIZ Recommendation
> **Trạng thái**: ✅ **CANONICAL & AUDITED**
> **Vị trí Canonical Dataset**: `backend/src/app/data/triz_matrix_39x39.json`

---

## 1. Tổng Quan & Vị Trí Lưu Trữ Canonical

### 1.1 Đường dẫn Canonical
Đường dẫn chính thức và duy nhất của dataset TRIZ Classical 39x39 trong dự án là:
```
backend/src/app/data/triz_matrix_39x39.json
```

### 1.2 Rationale (Lý do lựa chọn đường dẫn)
1. **Python Package Co-location**: Thư mục `backend/src/app/data/` nằm bên trong module `app`, cho phép dịch vụ (`problem_structuring_service.py`, `method_recommender.py`) nạp dữ liệu thông qua relative path `pathlib.Path(__file__).parent.parent / "data"` một cách tất định.
2. **Containerized Deployment**: Khi Docker build backend (`Dockerfile`), toàn bộ `src/app` được sao chép vào image production mà không cần cấu hình thêm external volume hay bind mount cho thư mục data rời bên ngoài.
3. **Tính Đơn Nhất (Single Source of Truth)**: Loại bỏ nguy cơ dữ liệu bị phân mảnh giữa `backend/data/` và `backend/src/app/data/`.

---

## 2. JSON Schema & Cấu Trúc Dữ Liệu

Dataset là một đối tượng JSON đơn nhất với các trường cấp cao sau:

```json
{
  "version": "1.0-triz40-canonical",
  "status": "CANONICAL_ALTSHULLER_1985",
  "is_canonical": true,
  "title": "Full TRIZ Contradiction Matrix 39x39 (Classical Altshuller 1985 Canonical Reference)",
  "provenance": { ... },
  "normalization_rules": { ... },
  "statistics": { ... },
  "parameters": { ... },
  "principles": { ... },
  "matrix": { ... }
}
```

### 2.1 Cấu trúc `parameters` (39 Thông số kỹ thuật)
- Dictionary gồm chính xác **39 entries** với key là chuỗi ID từ `"1"` đến `"39"`.
- Mỗi entry có các thuộc tính:
  - `id` (`int`): Định danh số từ 1 đến 39.
  - `code` (`str`): Mã snake_case chuẩn hóa (ví dụ: `"weight_moving"`, `"strength"`, `"productivity"`).
  - `name_vi` (`str`): Tên tiếng Việt chuẩn mực TRIZ (ví dụ: `"Trọng lượng vật thể di động"`).
  - `name_en` (`str`): Tên tiếng Anh chuẩn Altshuller 1985 (ví dụ: `"Weight of moving object"`).
  - `description` (`str`): Mô tả kỹ thuật song ngữ hoặc giải thích ý nghĩa tham số.

### 2.2 Cấu trúc `principles` (40 Nguyên tắc sáng tạo)
- Dictionary gồm chính xác **40 entries** với key là chuỗi ID từ `"1"` đến `"40"`.
- Mỗi entry có các thuộc tính:
  - `id` (`int`): Định danh số từ 1 đến 40.
  - `principle_id` (`int`): Đồng nhất với `id`.
  - `name_vi` (`str`): Tên tiếng Việt nguyên tắc (ví dụ: `"Nguyên tắc Phân đoạn"`).
  - `name_en` (`str`): Tên tiếng Anh nguyên tắc (ví dụ: `"Segmentation"`).
  - `description` (`str`): Định nghĩa tóm tắt cách áp dụng.
  - `explanation` (`str`): Cơ chế giải thích chi tiết mâu thuẫn kỹ thuật được hóa giải như thế nào.
  - `examples` (`list[str]`): Danh sách ví dụ thực tế minh họa nguyên tắc.

### 2.3 Cấu trúc `matrix` (1,521 Tọa độ)
- Dictionary gồm chính xác **1,521 entries** tương ứng $39 \times 39$ ô ma trận.
- **Quy ước đặt tên tọa độ**: `{improving}_{worsening}`
  - `improving`: ID thông số cần cải thiện ($1 \le i \le 39$).
  - `worsening`: ID thông số bị suy giảm / xấu đi ($1 \le j \le 39$).
  - Ví dụ: `"1_3"`, `"17_14"`, `"39_22"`, `"5_5"`.
- **Giá trị của mỗi ô (Cell Value)**:
  - Bắt buộc là một `list[int]` chứa từ 0 đến 4 principle IDs hợp lệ ($1 \le \text{pid} \le 40$).
  - Không bao giờ được dùng `null` hoặc chuỗi rỗng.
  - Thứ tự các principle IDs trong danh sách tuân thủ nguyên bản từ tài liệu gốc (không tự ý sắp xếp lại).

---

## 3. Quy Ước Ô Rỗng & Đường Chéo (Empty & Diagonal Cell Conventions)

| Tọa độ | Ký hiệu nguồn thô | Giá trị chuẩn hóa | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| **Đường chéo ($i = j$)** | `*` (39 ô) | `[]` | Mâu thuẫn vật lý trong TRIZ kinh điển; ma trận 39x39 không giải quyết mâu thuẫn cùng thông số. |
| **Ô rỗng ngoài đường chéo ($i \ne j$)** | `-` (234 ô) | `[]` | Altshuller 1985 không tìm thấy nguyên tắc sáng chế kinh điển cho cặp thông số này. |
| **Ô có dữ liệu ($i \ne j$)** | `<span><id></span>` (1,248 ô) | `[pid_1, pid_2, ...]` | Các nguyên tắc sáng chế được gợi ý theo thống kê bằng sáng chế của Altshuller. |

---

## 4. Cơ Chế Xác Thực Bất Biến (Fail-Closed Validation)

Hàm `validate_triz_matrix_data(data)` trong `ProblemStructuringService` được kích hoạt ngay khi khởi động backend:
1. `data` phải là dictionary hợp lệ.
2. `len(data["parameters"]) == 39`, đủ keys `"1"` .. `"39"`.
3. `len(data["principles"]) == 40`, đủ keys `"1"` .. `"40"`.
4. `len(data["matrix"]) == 1521`, đủ các keys `"i_j"` cho mọi $i, j \in [1..39]$.
5. Mọi cell trong matrix phải là kiểu `list`.
6. Mọi principle ID trong cell phải là integer thỏa mãn $1 \le \text{pid} \le 40$.

> **Hành vi khi có lỗi**: Ném `RuntimeError` chi tiết và chặn đứng việc khởi động ứng dụng (Fail-Closed) thay vì bỏ qua lỗi hoặc fallback giả định.

### 4.1 Cơ Chế Fallback An Toàn Tại Tầng Recommender (Runtime Resilience)
Trong quá trình vận hành, nếu bản ghi `Contradiction` trong cơ sở dữ liệu chứa một `principle_id` không nằm trong danh mục metadata (hoặc ngoài dải 1..40):
- `MethodRecommender` **không làm gián đoạn (crash)** luồng xử lý HTTP request.
- Kích hoạt fallback tạo đối tượng gợi ý an toàn với tiêu đề `Principle {id}`, mô tả cơ bản và `examples = []`.

---

## 5. Nguồn Gốc Dữ Liệu (Provenance & Provenance Tiers)

1. **Ma trận Mâu thuẫn 39×39**:
   - **Nguồn**: TRIZ40 / SolidCreativity (`https://www.triz40.com/aff_Matrix_TRIZ.php`).
   - **Snapshot**: Ngày 30/09/2026.
   - **Bản quyền & AI Usage**: Cho phép trích dẫn và sử dụng cho hệ thống AI kèm attribution nguyên văn.
2. **Metadata 39 Parameters & 40 Principles**:
   - **Nguồn**: Tiêu chuẩn Altshuller kinh điển (Song ngữ Anh - Việt).

---

## 6. Cam Kết Tương Thích Public API

| Endpoint | Method | Contract |
|---|---|---|
| `/api/v1/triz/parameters` | `GET` | Trả về `{ "data": [ 39 items ], "meta": { "total": 39 } }` |
| `/api/v1/triz/principles` | `GET` | Trả về `{ "data": [ 40 items ], "meta": { "total": 40 } }` |
| `/api/v1/triz/lookup` | `GET` | Query params: `improving`, `worsening` $\in [1..39]$. Trả về `{ "improving_parameter": {...}, "worsening_parameter": {...}, "is_diagonal": bool, "principles": [...], "principles_count": int }` |

---

## 7. Rủi Ro Kỹ Thuật Còn Lại & Biện Pháp Kiểm Soát (Residual Risks & Mitigations)

1. **Độ phủ của Rule-based Keyword Extraction**: Trích xuất tham số dựa trên từ khóa tiếng Việt/Anh có thể bỏ sót các câu phát biểu phức tạp (đã được lên kế hoạch bổ trợ bằng LLM Problem Framing ở Phase 6.2).
2. **Giới hạn 234 ô rỗng của Ma trận Altshuller 1985**: Khoảng 15.79% ô ngoài đường chéo không có nguyên tắc kinh điển. Hệ thống bảo toàn tính nguyên bản `[]` thay vì tự bịa nguyên tắc, và sẽ cung cấp gợi ý mở rộng qua AI Ideation ở các phase sau.
3. **Vòng đời In-Memory Cache**: Dữ liệu được nạp vào memory một lần khi khởi động. Mọi thay đổi về file JSON yêu cầu restart dịch vụ để có hiệu lực.

---

## 8. Phạm Vi Không Bao Gồm (Out of Scope)
- Không tích hợp LLM để tự động sinh ma trận thay thế.
- Không thay đổi cấu trúc database table `problem_frames` hay `contradictions`.
- Không thay đổi schema response của REST API hiện tại.
