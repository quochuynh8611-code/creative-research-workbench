# BÁO CÁO KIỂM THỬ XÁC MINH NHẬP LIỆU CANONICAL TRIZ 39×39 (FINAL AUDITED PASS)
## (TRIZ CANONICAL IMPORT VALIDATION REPORT - REPRODUCIBLE)

> **Dự án**: Creative Research Workbench
> **Giai đoạn**: Phase 6.3 — Track 1 (Full TRIZ 39×39 Matrix)
> **Trạng thái**: 🛡️ **FINAL STAGING REPRODUCIBILITY VERIFIED (CHỜ PHÊ DUYỆT PRODUCTION RELEASE)**
> **Nguồn dữ liệu**: TRIZ40 (SolidCreativity) — Snapshot ngày 30/09/2026

---

## 1. Bản đồ Provenance & Quản lý Checksum Độc lập (External Manifest Contract)

Toàn bộ hash SHA-256 được lưu độc lập tại [scratch/quarantine/triz40/artifact_manifest.json](file:///Users/mr.chem/.gemini/antigravity-ide/brain/833269e0-ec09-4865-b40d-7d9eaceb82e6/scratch/quarantine/triz40/artifact_manifest.json):

```json
{
  "manifest_version": "1.0.0",
  "dataset_version": "triz40-web-snapshot-2026-09-30",
  "raw_snapshot": {
    "file": "triz40_raw_matrix_snapshot.html",
    "sha256": "d9df84a298276994e12406d4a2870f982eba9f88cf4d76175a0ce135d8ef9147",
    "bytes": 329309
  },
  "normalized_json": {
    "file": "triz_matrix_39x39_canonical_candidate.json",
    "sha256": "fedce0b9252249fbf3a3052ce5421b3701175380d0c7c1cc16ad427d07db6840",
    "bytes": 104552
  },
  "cell_fixtures": {
    "file": "cell_regression_fixtures.json",
    "sha256": "8ce11f12c875dd43f2144d41ec8c13b66c2c60f1b46a2ce20110ecf43e1309ed",
    "count": 24,
    "bytes": 7204
  },
  "extraction_script": {
    "file": "extract_triz40_matrix.py",
    "sha256": "b326a8acca453f71759416007346342abb2891b889a42e2929b3b097e81ab6ea",
    "bytes": 8570
  }
}
```

### 1.1 Phân tách Provenance Từng Thành phần (Separated Provenance Tiers)
1. **Dữ liệu Ma trận (Matrix Data Provenance)**:
   - **Nguồn**: TRIZ40 / SolidCreativity (`https://www.triz40.com/aff_Matrix_TRIZ.php`)
   - **Thời điểm truy cập**: `2026-09-30T17:00:40+07:00`
   - **Trạng thái License**: `VERIFIED_WITH_QUOTED_EVIDENCE`
   - **Bằng chứng nguyên văn (Quoted Evidence)**:
     - `<meta name="citation-instructions" content="Contenu © TRIZ40. Citations autorisées avec attribution complète incluant 'Source : TRIZ40 - www.triz40.com'">`
     - `<meta name="ai-content-license" content="citation-required">`
     - `<meta name="ai-usage" content="allowed-with-attribution">`
2. **Metadata 39 Thông số (Parameters Metadata Provenance)**:
   - **Nguồn**: Định nghĩa chuẩn hóa Altshuller kinh điển (Song ngữ Anh - Việt).
   - **Trạng thái**: `BENCHMARK_STANDARD_DEFINITIONS` (Tách biệt khỏi dữ liệu web TRIZ40).
3. **Metadata 40 Nguyên tắc (Principles Metadata Provenance)**:
   - **Nguồn**: Định nghĩa chuẩn hóa Altshuller kinh điển (Song ngữ Anh - Việt kèm giải thích và ví dụ).
   - **Trạng thái**: `BENCHMARK_STANDARD_DEFINITIONS` (Tách biệt khỏi dữ liệu web TRIZ40).

---

## 2. Quy tắc Chuẩn hóa Dữ liệu & Vết Kiểm toán (Normalization Audit Trail)

| Ký hiệu nguồn thô (Raw Marker) | Vị trí | Quy tắc chuẩn hóa (Normalization Rule) | Giá trị đích trong Candidate JSON | Ý nghĩa tri thức |
|---|---|---|---|---|
| `*` | 39 Ô đường chéo ($i = j$) | `DIAGONAL_STAR_TO_EMPTY_LIST` | `[]` | Mâu thuẫn vật lý trong TRIZ kinh điển (không có nguyên tắc kỹ thuật 39x39) |
| `-` | 234 Ô ngoài đường chéo ($i \ne j$) | `OFF_DIAGONAL_DASH_TO_EMPTY_LIST` | `[]` | Vùng trống nguyên bản trong ma trận Altshuller 1985 (không có giải pháp kỹ thuật chuẩn) |
| `<span><id></span>` | 1,248 Ô có dữ liệu | `SPAN_TOKENS_TO_INT_LIST` | `List[int]` theo đúng thứ tự token | Bảo toàn 100% thứ tự token gốc, không tự ý re-ranking |

---

## 3. Thống kê Sai biệt Thực nghiệm Độc lập (Explicit Divergence Breakdown)

Kết quả tính toán độc lập giữa Synthetic Scaffold (`backend/src/app/data/triz_matrix_39x39.json`) và Candidate Staging (`scratch/quarantine/triz40/triz_matrix_39x39_canonical_candidate.json`):

| Tên biến kỹ thuật (Explicit Variable) | Số lượng ô | Tỷ lệ (%) / 1,521 | Bản chất phân loại |
|---|---|---|---|
| **`total_coordinates`** | **1,521** | 100.00% | Không gian $39 \times 39$ toàn diện |
| **`identical_cells`** | **39** | **2.56%** | Tổng số ô trùng khớp giữa 2 file |
| ├── **`identical_diagonal_cells`** | 39 | 2.56% | 39 ô đường chéo cả 2 bên đều là `[]` |
| └── **`identical_non_diagonal_empty_cells`** | 0 | 0.00% | Không có ô ngoài đường chéo nào trùng khớp |
| **`divergent_cells`** | **1,482** | **97.44%** | Tổng số ô bị sai lệch |
| ├── **`synthetic_populated_candidate_empty`** | 234 | 15.38% | Heuristic synthetic tự gán nguyên tắc giả vào ô vốn dĩ là rỗng trong Altshuller gốc |
| ├── **`synthetic_empty_candidate_populated`** | 0 | 0.00% | Không có ô nào candidate có dữ liệu mà synthetic rỗng |
| └── **`both_populated_values_differ`** | 1,248 | 82.05% | Ô có dữ liệu nhưng heuristic synthetic tính sai tập nguyên tắc Altshuller |

---

## 4. Kết quả Kiểm thử Toàn diện (11 Unit Tests Passed)

Suite kiểm thử [backend/tests/unit/test_triz_staging_validation.py](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/tests/unit/test_triz_staging_validation.py) chạy qua 11 bài kiểm thử tự động (**11 passed in 0.09s**):
1. `test_manifest_integrity_and_stability`: ✅ **PASSED**
2. `test_reproducible_extraction_byte_for_byte`: ✅ **PASSED** (Khởi tạo temp dir độc lập, chạy extraction lần 2, so sánh byte-for-byte SHA256)
3. `test_candidate_no_self_referential_checksum`: ✅ **PASSED**
4. `test_separated_provenance_tiers`: ✅ **PASSED**
5. `test_normalization_rules_and_audit_trail`: ✅ **PASSED**
6. `test_parameters_and_principles_completeness`: ✅ **PASSED**
7. `test_coordinate_space_and_counts`: ✅ **PASSED**
8. `test_divergence_categories_are_mutually_exclusive`: ✅ **PASSED** (Chứng minh 5 nhóm sai biệt là phân hoạch rời nhau hoàn toàn)
9. `test_divergence_categories_sum_to_total_coordinates`: ✅ **PASSED** (Chứng minh tổng 5 nhóm = 1,521)
10. `test_matrix_asymmetry`: ✅ **PASSED** (500/741 cặp = 67.48% bất đối xứng)
11. `test_regression_fixtures_with_raw_markers`: ✅ **PASSED** (24/24 sample fixtures)

---

## 5. Kết luận

- **Tái lập tuyệt đối (Deterministic Reproducibility)**: Script trích xuất `extract_triz40_matrix.py` sử dụng thư viện chuẩn Python (zero external dependencies), tạo ra output có SHA-256 trùng khớp 100% qua nhiều lần chạy độc lập.
- **An toàn Runtime**: Codebase runtime và các service production không bị ảnh hưởng.
- **Sẵn sàng nghiệm thu**: Chờ User phê duyệt để chuyển sang bước Production Release.
