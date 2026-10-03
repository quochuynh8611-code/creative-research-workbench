# KẾ HOẠCH NHẬP LIỆU DỮ LIỆU CANONICAL TRIZ 39×39 (SOURCE-VERIFIED SPEC)
## (TRIZ CANONICAL DATASET PRODUCTION IMPORT PLAN - REFINED)

> **Dự án**: Creative Research Workbench
> **Giai đoạn**: Phase 6.3 — Track 1 (Full TRIZ 39×39 Matrix)
> **Trạng thái**: 📋 **PLAN ONLY — STRICTLY NO EXECUTION / NO PRODUCTION CODE MODIFICATION**
> **Mục tiêu**: Thiết lập tài liệu quy hoạch và kế hoạch thực thi chi tiết, có chứng cứ trực tiếp ở cấp độ mã nguồn (Source-Code-Level Evidence), xác định rõ ràng ranh giới giữa sự thật đã kiểm chứng (Verified Facts) và giả định cần phê duyệt (Assumptions Requiring Approval).

---

## 1. Bằng chứng Mã nguồn về Kiến trúc Hiện tại (Source-Code Evidence Audit)

### 1.1 Điểm A: Vị trí và cơ chế nạp file `triz_matrix_39x39.json` trong runtime
- **Tệp nguồn 1**: [`backend/src/app/services/problem_structuring_service.py`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/services/problem_structuring_service.py#L40-L64)
  - **Đoạn mã hiện tại (Lines 40–64)**:
    ```python
    _DATA_DIR = pathlib.Path(__file__).parent.parent / "data"
    _MATRIX_JSON_PATH = _DATA_DIR / "triz_matrix_39x39.json"

    _TRIZ_DATA: dict[str, Any] = {}
    _CONTRADICTION_MATRIX_39X39: dict[tuple[int, int], list[int]] = {}
    _PARAM_CODE_TO_ID: dict[str, int] = {}

    if _MATRIX_JSON_PATH.exists():
        try:
            with open(_MATRIX_JSON_PATH, "r", encoding="utf-8") as _f:
                _TRIZ_DATA = json.load(_f)
                _raw_matrix = _TRIZ_DATA.get("matrix", {})
                for _k, _v in _raw_matrix.items():
                    _parts = _k.split("_")
                    if len(_parts) == 2 and _parts[0].isdigit() and _parts[1].isdigit():
                        _CONTRADICTION_MATRIX_39X39[(int(_parts[0]), int(_parts[1]))] = _v
                _raw_params = _TRIZ_DATA.get("parameters", {})
                for _p_id_str, _p_val in _raw_params.items():
                    _p_id = int(_p_id_str)
                    _code = _p_val.get("code")
                    if _code:
                        _PARAM_CODE_TO_ID[_code] = _p_id
        except Exception as _e:
            logger.warning("Không thể tải triz_matrix_39x39.json: %s", _e)
    ```
  - **Kết luận**: Service nạp file tĩnh ở cấp module vào biến toàn cục `_CONTRADICTION_MATRIX_39X39`. Nếu file lỗi hoặc thiếu, service chỉ ghi log warning mà **không raise exception (Fail-Open)**.

- **Tệp nguồn 2**: [`backend/src/app/services/method_recommender.py`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/services/method_recommender.py#L31-L47)
  - **Đoạn mã hiện tại (Lines 31–47)**:
    ```python
    _DATA_DIR = pathlib.Path(__file__).parent.parent / "data"
    _MATRIX_JSON_PATH = _DATA_DIR / "triz_matrix_39x39.json"

    _PRINCIPLES_METADATA: dict[int, dict[str, Any]] = {}

    if _MATRIX_JSON_PATH.exists():
        try:
            with open(_MATRIX_JSON_PATH, "r", encoding="utf-8") as _f:
                _data = json.load(_f)
                _raw_principles = _data.get("principles", {})
                for _k, _v in _raw_principles.items():
                    if str(_k).isdigit():
                        _p_id = int(_k)
                        _PRINCIPLES_METADATA[_p_id] = _v
        except Exception as _e:
            logger.warning("Không thể tải principles từ triz_matrix_39x39.json: %s", _e)
    ```
  - **Kết luận**: Service nạp metadata của 40 nguyên tắc vào `_PRINCIPLES_METADATA`. Nếu không nạp được, dữ liệu rơi vào fallback tĩnh `_PRINCIPLES_MAP_FALLBACK`.

---

### 1.2 Điểm B & C: Cơ chế xử lý ô rỗng `[]` và sự tồn tại của Synthetic / Heuristic Fallback
- **Tệp nguồn**: [`backend/src/app/services/problem_structuring_service.py`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/services/problem_structuring_service.py#L375-L391)
  - **Đoạn mã hiện tại (Lines 375–391)**:
    ```python
    def _create_contradiction(
        self,
        frame: ProblemFrame,
        contradiction_type: ContradictionType,
        improving_param: str | None,
        worsening_param: str | None,
    ) -> Contradiction:
        if contradiction_type == ContradictionType.technical:
            improving_id = _PARAM_TO_ID_MAP.get(improving_param or "", 0)
            worsening_id = _PARAM_TO_ID_MAP.get(worsening_param or "", 0)

            principles = _CONTRADICTION_MATRIX_39X39.get(
                (improving_id, worsening_id), _DEFAULT_TECHNICAL_PRINCIPLES
            )
            statement = f"Cải thiện '{improving_param}' làm suy giảm '{worsening_param}'."
        else:
            principles = _PHYSICAL_PRINCIPLES
            statement = f"Mâu thuẫn vật lý giữa các trạng thái đối nghịch trong hệ thống."

        return Contradiction(
            type=contradiction_type,
            statement=statement,
            suggested_principles=principles,
        )
    ```
  - **Bằng chứng Heuristic Fallback (Lines 23–25, Lines 379–381)**:
    - Trong code hiện có định nghĩa: `_DEFAULT_TECHNICAL_PRINCIPLES = [1, 35, 10, 2]`
    - Nếu `(improving_id, worsening_id)` không nằm trong dictionary (như 39 ô đường chéo bị thiếu ở scaffold cũ), hàm `.get(...)` sẽ trả về `_DEFAULT_TECHNICAL_PRINCIPLES` thay vì `[]`.
    - Khi một ô có trong dictionary và giá trị là `[]`, hàm `.get(...)` trả về `[]`.
- **Tệp nguồn**: [`backend/src/app/services/method_recommender.py`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/services/method_recommender.py#L147-L149)
  - **Đoạn mã hiện tại (Lines 147–149)**:
    ```python
    if not contradiction or not contradiction.suggested_principles:
        return []
    ```
  - **Kết luận**: Khi `contradiction.suggested_principles` là danh sách rỗng `[]`, `MethodRecommender` trả về ngay danh sách rỗng `[]` và **không gây lỗi**.

---

### 1.3 Điểm D: Khả năng chấp nhận `[]` của Frontend TypeScript Types & Consumer Components
- **Tệp nguồn**: [`apps/web/lib/types.ts`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/apps/web/lib/types.ts#L68-L84)
  - **Đoạn mã hiện tại (Lines 68–83)**:
    ```typescript
    export interface RecommendedMethod {
      id: number
      principle_id: number
      principle?: number
      title: string
      description: string
    }

    export interface NextStepResponse {
      session_id: string
      previous_state: string
      current_state: string
      workflow_state: string
      next_step: string
      recommended_methods: RecommendedMethod[]
    }
    ```
- **Tệp nguồn Consumer**: [`apps/web/features/session/session-detail.tsx`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/apps/web/features/session/session-detail.tsx) & API client tests:
  - `recommended_methods` là kiểu mảng `RecommendedMethod[]`. Khi API trả về `[]`, frontend duyệt qua `.map()` trả về `[]` bình thường, hiển thị trạng thái danh sách rỗng mà không bị crash hay unhandled exception.

---

## 2. Bảng Đối chiếu Sự thật vs Giả định (Assumptions vs Verified Facts)

| Phân loại | Nội dung | Bằng chứng mã nguồn / Cơ sở |
|---|---|---|
| **Verified Fact** | File runtime hiện tại mang metadata cách ly `QUARANTINED_SYNTHETIC_SCAFFOLD` và `is_canonical: false`. | [`backend/src/app/data/triz_matrix_39x39.json`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/data/triz_matrix_39x39.json#L3-L4) |
| **Verified Fact** | Scaffold cũ chỉ có 1,482 keys, thiếu hoàn toàn 39 ô đường chéo trong JSON. | `len(json.load(f)["matrix"]) == 1482` |
| **Verified Fact** | Candidate TRIZ40 có đủ 1,521 coordinates ($39 \times 39$), 1,248 ô populated, 234 ô off-diagonal rỗng, 39 ô đường chéo `[]`. | [artifact_manifest.json](file:///Users/mr.chem/.gemini/antigravity-ide/brain/833269e0-ec09-4865-b40d-7d9eaceb82e6/scratch/quarantine/triz40/artifact_manifest.json) & [test_triz_staging_validation.py](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/tests/unit/test_triz_staging_validation.py) |
| **Verified Fact** | Cơ chế nạp dữ liệu hiện tại là **FAIL-OPEN** (dùng `try-except Exception` và fallback sang giá trị mặc định). | `problem_structuring_service.py:L62` & `method_recommender.py:L45` |
| **Verified Fact** | Khi `suggested_principles` là `[]`, backend trả về `recommended_methods: []` và frontend an toàn 100%. | `method_recommender.py:L147` & `types.ts:L82` |
| **Assumption (Needs Approval)** | **Fail-Closed on Startup**: Nên chuyển đổi `try-except` thành `raise RuntimeError` nghiêm ngặt nếu dataset bị thiếu hoặc hỏng để bảo vệ tính toàn vẹn khoa học. | Đang chờ Human Approval |
| **Assumption (Needs Approval)** | **Empty Cell UX Copy**: Khi gặp ô rỗng `[]`, trả về `[]` và giao diện thông báo *"Không có nguyên tắc kỹ thuật Altshuller kinh điển cho cặp mâu thuẫn này"*. | Đang chờ Human Approval |

---

## 3. Bảng Phân tích Bán kính Ảnh hưởng (Blast Radius Table)

| Tệp / Thành phần | Loại thay đổi | Mức rủi ro | Khả năng hoàn tác (Reversible?) | Biện pháp Rollback |
|---|---|---|---|---|
| `backend/src/app/data/triz_matrix_39x39.json` | **Data-only** (Thay bằng 1,521 coordinates canonical) | **Thấp** | **Có (100% trong < 5s)** | `cp backend/src/app/data/triz_matrix_39x39.json.bak backend/src/app/data/triz_matrix_39x39.json` |
| `backend/src/app/services/problem_structuring_service.py` | **Code** (Thêm validation startup + bỏ fallback `_DEFAULT_TECHNICAL_PRINCIPLES`) | **Thấp** | **Có** | Git revert commit |
| `backend/src/app/services/method_recommender.py` | **Code** (Thêm validation 40 principles startup) | **Rất Thấp** | **Có** | Git revert commit |
| `backend/tests/integration/test_triz_full_matrix.py` | **Test** (Thêm assertions 1,521 coordinates, empty-cell fidelity, fail-closed) | **Không có rủi ro** | **Có** | Git revert commit |
| `POST /api/v1/sessions/{id}/problem-frame` & `next-step` | **API Contract** | **Không đổi** | **Có** | Schema response giữ nguyên 100% (trả về danh sách `principles`) |

---

## 4. Kế hoạch Kiểm thử Pre-Implementation Failing Tests (Test-First Guard)

Trước khi chỉnh sửa bất kỳ dòng code service hay ghi đè file dataset, các test cases sau sẽ được viết trước vào `backend/tests/integration/test_triz_full_matrix.py` để chứng minh lỗi hiện tại và đảm bảo chuyển trạng thái **RED $\to$ GREEN**:

1. **Test 1: `test_empty_contradiction_returns_empty_list_without_synthetic_fallback`**
   - *Hành vi kiểm tra*: Truy vấn cặp mâu thuẫn $(1, 2)$ (Weight of moving vs Weight of stationary).
   - *Trạng thái hiện tại*: ❌ **FAIL (RED)** vì dataset cũ gán `[1, 14, 35]` hoặc fallback `_DEFAULT_TECHNICAL_PRINCIPLES`.
   - *Trạng thái sau import*: ✅ **PASS (GREEN)** với `suggested_principles == []`.

2. **Test 2: `test_diagonal_contradiction_returns_empty_list`**
   - *Hành vi kiểm tra*: Truy vấn mâu thuẫn đường chéo $(10, 10)$ (Force vs Force).
   - *Trạng thái hiện tại*: ❌ **FAIL (RED)** vì scaffold cũ thiếu key `10_10` nên service fallback sang `_DEFAULT_TECHNICAL_PRINCIPLES`.
   - *Trạng thái sau import*: ✅ **PASS (GREEN)** với `suggested_principles == []`.

3. **Test 3: `test_matrix_data_fails_closed_on_invalid_principles`**
   - *Hành vi kiểm tra*: Kiểm tra hàm validation khi gặp dữ liệu chứa principle ID $99 > 40$.
   - *Trạng thái hiện tại*: ❌ **FAIL (RED)** vì code hiện tại chỉ warning và chạy tiếp (Fail-Open).
   - *Trạng thái sau import*: ✅ **PASS (GREEN)** ném `RuntimeError` rõ ràng.

---

## 5. Trả lời Dứt khoát 2 Câu hỏi Trọng tâm

1. **Empty cell hiện tại có thật sự đi qua UI mà không crash không?**
   - **TRẢ LỜI**: **CÓ, HOÀN TOÀN KHÔNG CRASH**.
   - **Chứng cứ**: `MethodRecommender.recommend_methods` kiểm tra `if not contradiction or not contradiction.suggested_principles: return []` ([line 147](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/services/method_recommender.py#L147)). Endpoint `POST /{session_id}/next-step` trả về `recommended_methods: []` ([line 482-496](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/api/v1/endpoints/sessions.py#L482-L496)). Frontend `types.ts` định nghĩa `recommended_methods: RecommendedMethod[]` ([line 82](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/apps/web/lib/types.ts#L82)), việc render mảng rỗng `[]` là hoàn toàn tự nhiên và chuẩn mực trong React.

2. **Fail-closed hiện tại đã tồn tại chưa, hay phải implement mới?**
   - **TRẢ LỜI**: **CHƯA TỒN TẠI; PHẢI IMPLEMENT MỚI**.
   - **Chứng cứ**: Hiện tại cả `problem_structuring_service.py` ([line 62](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/services/problem_structuring_service.py#L62)) và `method_recommender.py` ([line 45](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/services/method_recommender.py#L45)) đều bắt ngoại lệ bằng `except Exception as _e:` và chỉ ghi `logger.warning(...)`. Nếu file JSON bị lỗi cú pháp hoặc thiếu, hệ thống tự động rơi vào fallback `_DEFAULT_TECHNICAL_PRINCIPLES` và `_PRINCIPLES_MAP_FALLBACK` (Fail-Open). Để đạt chuẩn tin cậy khoa học, chúng ta **bắt buộc phải implement mới** cơ chế Fail-Closed (raise `RuntimeError` khi dataset không hợp lệ).

---

## 6. Cổng Phê duyệt (Approval Gates)

```
[CỔNG HIỆN TẠI]: Phê duyệt Bản Kế hoạch Hoàn thiện (docs/TRIZ_PRODUCTION_IMPORT_PLAN.md)
       │
       ▼ (Khi User phê duyệt "APPROVED FOR PRODUCTION IMPORT")
[CỔNG 1]: Tạo Backup File triz_matrix_39x39.json.bak & Xác nhận SHA-256
       │
       ▼
[CỔNG 2]: Viết Pre-Implementation Failing Tests (test_triz_full_matrix.py -> RED)
       │
       ▼
[CỔNG 3]: Copy Candidate Staging -> backend/src/app/data/triz_matrix_39x39.json (is_canonical=true)
       │
       ▼
[CỔNG 4]: Cập nhật Code Service (Bỏ synthetic fallback, Thêm Fail-Closed validation -> GREEN)
       │
       ▼
[CỔNG 5]: Chạy Toàn bộ Integration Test Suite & Nghiệm thu
```

---

> 🛑 **DỪNG LẠI**: Không ghi đè runtime dataset. Không sửa production code. Chờ User phê duyệt kế hoạch hoàn thiện.
