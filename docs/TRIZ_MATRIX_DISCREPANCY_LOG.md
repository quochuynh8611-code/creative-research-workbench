# NHẬT KÝ ĐỐI CHIẾU SAI BIỆT MA TRẬN TRIZ 39×39 (FINAL AUDITED PASS)
## (TRIZ CONTRADICTION MATRIX DISCREPANCY & DIVERGENCE LOG)

> **Dự án**: Creative Research Workbench
> **Giai đoạn**: Phase 6.3 — Track 1 (Full TRIZ 39×39 Matrix)
> **Trạng thái**: 📊 **FINAL STAGING AUDITED (EXPLICIT CATEGORIES)**
> **Mục tiêu**: Ghi nhận bằng chứng thực nghiệm độc lập về các biến sai biệt giữa Synthetic Scaffold và Candidate Staging Dataset.

---

## 1. Bảng Biến Sai biệt Độc lập (Explicit Variable Breakdown)

Kết quả tính toán độc lập giữa `backend/src/app/data/triz_matrix_39x39.json` (Synthetic Scaffold) và `scratch/quarantine/triz40/triz_matrix_39x39_canonical_candidate.json` (Candidate):

| Tên biến kỹ thuật | Giá trị thực tế | Tỷ lệ (%) / 1,521 | Bản chất phân loại |
|---|---|---|---|
| **`total_coordinates`** | **1,521** | 100.00% | Toàn bộ không gian tọa độ $(r, c) \in [1..39] \times [1..39]$ |
| **`identical_cells`** | **39** | **2.56%** | Tổng số ô trùng khớp giữa 2 file |
| ├── **`identical_diagonal_cells`** | 39 | 2.56% | 39 ô đường chéo cả 2 bên đều là `[]` |
| └── **`identical_non_diagonal_empty_cells`** | 0 | 0.00% | Không có ô ngoài đường chéo nào trùng khớp |
| **`divergent_cells`** | **1,482** | **97.44%** | Tổng số ô bị sai lệch |
| ├── **`synthetic_populated_candidate_empty`** | 234 | 15.38% | Heuristic synthetic tự gán nguyên tắc giả vào ô vốn dĩ là rỗng trong Altshuller gốc |
| ├── **`synthetic_empty_candidate_populated`** | 0 | 0.00% | Không có ô nào candidate có dữ liệu mà synthetic để rỗng |
| └── **`both_populated_values_differ`** | 1,248 | 82.05% | Ô có dữ liệu thật nhưng heuristic synthetic tính sai tập nguyên tắc Altshuller |

---

## 2. Tính Phân hoạch Rời nhau (Mutually Exclusive Partitioning)

Đã kiểm chứng toán học qua test suite tự động:
$$\text{total\_coordinates} = \text{identical\_diagonal\_cells} + \text{identical\_non\_diagonal\_empty\_cells} + \text{synthetic\_populated\_candidate\_empty} + \text{synthetic\_empty\_candidate\_populated} + \text{both\_populated\_values\_differ}$$
$$1,521 = 39 + 0 + 234 + 0 + 1,248$$

Mỗi tọa độ $(r, c)$ trong 1,521 ô thuộc về chính xác **1 nhóm duy nhất**, không có sự chồng lấn.

---

## 3. Danh mục Mục Sai biệt Điển hình Đã Kiểm toán

| ID | Coordinate | Thông số cải thiện ($i$) | Thông số bị xấu đi ($j$) | Giá trị Candidate (TRIZ40) | Giá trị Synthetic Scaffold (Giả lập) | Phân loại sai biệt | Đánh giá & Quyết định |
|---|---|---|---|---|---|---|---|
| **DRIFT-001** | **`1_2`** | Weight of moving (1) | Weight of stationary (2) | `[]` (Raw `-`) | `[1, 14, 35]` (Heuristic fake) | `synthetic_populated_candidate_empty` | Giữ `[]` theo Candidate (không có giải pháp kỹ thuật kinh điển). |
| **DRIFT-002** | **`1_3`** | Weight of moving (1) | Length of moving (3) | `[15, 8, 29, 34]` | `[1, 14, 35]` (Default pair) | `both_populated_values_differ` | Giữ `[15, 8, 29, 34]` theo Candidate. |
| **DRIFT-003** | **`1_5`** | Weight of moving (1) | Area of moving (5) | `[29, 17, 38, 34]` | `[1, 14, 35]` (Default pair) | `both_populated_values_differ` | Giữ `[29, 17, 38, 34]` theo Candidate. |
| **DRIFT-004** | **`1_4`** | Weight of moving (1) | Length of stationary (4) | `[]` (Raw `-`) | `[2, 10, 28]` (Heuristic fake) | `synthetic_populated_candidate_empty` | Giữ `[]` theo Candidate. |
| **DRIFT-005** | **`14_15`**| Strength (14) | Durability of moving (15) | `[27, 3, 26]` | `[3, 35, 10, 40]` (Heuristic) | `both_populated_values_differ` | Giữ `[27, 3, 26]` theo Candidate. |
| **DRIFT-006** | **`27_28`**| Reliability (27) | Measurement accuracy (28) | `[32, 3, 11, 23]` | `[10, 1, 35]` (Heuristic) | `both_populated_values_differ` | Giữ `[32, 3, 11, 23]` theo Candidate. |
| **DRIFT-007** | **`38_39`**| Extent of automation (38) | Productivity (39) | `[5, 12, 35, 26]` | `[10, 35, 1, 14]` (Heuristic) | `both_populated_values_differ` | Giữ `[5, 12, 35, 26]` theo Candidate. |

---

## 4. Chính sách Kiểm toán Dữ liệu (Data Governance Policy)

1. **Bảo tồn Vết kiểm toán**: Mỗi cell trong regression fixtures đều mang trường `source_raw_marker` (`"*"`, `"-"`, `"SPANS"`) để phân biệt rõ ràng giữa giá trị gốc và giá trị chuẩn hóa.
2. **Không tự suy diễn**: Tuyệt đối không nội suy dữ liệu khi gặp ô rỗng hoặc ô nghi vấn.
3. **An toàn Production**: Bảng log này phục vụ kiểm toán kỹ thuật trước khi trình duyệt bản diff cuối cùng.
