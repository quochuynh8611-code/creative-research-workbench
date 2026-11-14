# ADR-016: Deterministic `method_id` for Recommended TRIZ Principles in MethodRecommender

## Status
Proposed

## Context
Trong kiến trúc tổng thể về lưu trữ ngữ cảnh nguồn gốc ghi chú (`source_context`) theo **ADR-014** và đặc tả **Batch C7c-1** (`docs/specs/batch-c7c1-note-source-context.md`), biến thể **Gợi ý nguyên tắc sáng tạo (`principle_suggestion`)** được định nghĩa chặt chẽ với schema Pydantic:
```python
class PrincipleSuggestionContext(BaseNoteContext):
    schema_version: Literal[1] = 1
    source_type: Literal["principle_suggestion"] = "principle_suggestion"
    principle_id: StrictInt = Field(..., ge=1, le=40)
    method_id: str = Field(..., min_length=1, max_length=100)
```
Trong đó, trường `method_id` là định danh bắt buộc dạng chuỗi tự do, độ dài từ 1 đến 100 ký tự (Unicode code points), cấm ký tự điều khiển ASCII (`\n`, `\r`, `\t`, `\0`, `< 32`), ký tự ngắt dòng Unicode (`U+2028`, `U+2029`), và không được rỗng hoặc chỉ toàn khoảng trắng.

Tuy nhiên, tại tầng cung cấp dữ liệu gợi ý nguyên tắc:
- Service `MethodRecommender.recommend_methods` (`backend/src/app/services/method_recommender.py`) hiện chỉ trả về các item mang các trường:
  `id`, `principle_id`, `principle`, `title`, `name_vi`, `name_en`, `description`, `explanation`, `examples`, cùng các trường metadata góc nhìn đời sống (`everyday_title`, `daily_application`, `daily_examples`, `action_prompt`).
- Các item trên **hoàn toàn chưa có trường `method_id`**.
- Tại tầng API (`GET /api/v1/sessions/{id}/recommendations` và `POST /api/v1/sessions/{id}/next-step`), response trả về danh sách `recommended_methods` kế thừa cấu trúc từ `MethodRecommender`, dẫn đến việc client frontend không có giá trị `method_id` chính thức từ hệ thống.

Nếu không có quyết định chuẩn hóa định danh tại backend, client frontend sẽ phải tự phỏng đoán hoặc tự sinh giá trị `method_id`, gây ra sự phân mảnh định danh và rủi ro vi phạm hợp đồng validation.

---

## Decision
Quyết định bổ sung trường **`method_id` có tính tất định (deterministic)** vào từng đối tượng phương pháp/nguyên tắc được trả về từ `MethodRecommender.recommend_methods`:

### 1. Định Dạng Chuẩn Hóa: `triz-principle-<principle_id>`
Mỗi nguyên tắc TRIZ được gợi ý sẽ mang `method_id` với quy ước định danh bất biến:
```text
method_id = f"triz-principle-{p_num}"
```
Ví dụ cụ thể:
- `principle_id = 1` $\rightarrow$ `method_id = "triz-principle-1"`
- `principle_id = 35` $\rightarrow$ `method_id = "triz-principle-35"`
- `principle_id = 40` $\rightarrow$ `method_id = "triz-principle-40"`

### 2. Nguyên Tắc Thiết Kế (Architectural Tenets)
1. **Backend là Nguồn Chân Lý Duy Nhất (Single Source of Truth)**:
   - Backend chịu trách nhiệm sinh và cung cấp `method_id` trong payload `recommended_methods`.
   - Frontend sau này chỉ việc đọc trực tiếp `method.method_id` để đưa vào `PrincipleSuggestionSourceContext`, tuyệt đối không tự sinh hay chuyển đổi kiểu.
2. **Tính Ổn Định & Tất Định (Idempotent & Deterministic)**:
   - Với cùng một `principle_id`, `method_id` luôn luôn có cùng một giá trị duy nhất, không phụ thuộc vào thời điểm gọi API hay phiên làm việc cụ thể.
   - Không sử dụng UUID ngẫu nhiên hay chuỗi có chứa timestamp cho các nguyên tắc chuẩn của catalog TRIZ 40 principles.
3. **Tuân Thủ Tuyệt Đối Hợp Đồng Pydantic**:
   - `method_id` có kiểu chuỗi `str`, độ dài từ 16 đến 17 ký tự (nằm trọn trong dải $[1, 100]$ code points).
   - Chỉ gồm các ký tự chữ cái thường `[a-z]`, dấu gạch ngang `-`, và chữ số `[0-9]`, hoàn toàn không chứa ký tự điều khiển hay khoảng trắng.

---

## Rationale
1. **Tránh Frontend Tự Sinh ID**: Ngăn ngừa sự lệch pha giữa các client khác nhau (web app, CLI, import/export scripts) khi tạo `source_context`.
2. **Liên Kết Trực Tiếp Với Domain Model**: Tiền tố `triz-principle-` thể hiện rõ phương pháp này thuộc danh mục 40 Nguyên Tắc Sáng Tạo TRIZ (Altshuller), phân biệt rõ ràng với các phương pháp sáng tạo khác trong tương lai (ví dụ: `scamper-...`, `six-hats-...`).
3. **Bảo Toàn Khả Năng Tương Thích Ngược**: Chỉ thêm một trường mới `method_id` vào JSON payload, không xóa hay đổi tên các trường hiện hữu (`id`, `principle_id`, `principle`).

---

## Alternatives Considered
1. **Frontend Tự Ép Kiểu `String(method.id)`**:
   - *Đánh giá*: Trong mock test frontend, `method.id` là số thứ tự `1, 2` trong khi `principle_id` là `10, 35`. Nếu ép kiểu `String(method.id)`, ID sẽ là `"1"` thay vì liên kết với nguyên tắc #10. Hơn nữa, định danh số dạng chuỗi thuần túy (`"35"`) không thể hiện ngữ cảnh nghiệp vụ.
   - *Kết luận*: **Từ chối**.
2. **Frontend Tự Sinh Slug `triz-principle-${principleNum}`**:
   - *Đánh giá*: Chuyển giao trách nhiệm sinh định danh sang client. Nếu sau này backend mở rộng thêm phương pháp không phải TRIZ hoặc thay đổi quy ước, toàn bộ frontend phải cập nhật lại.
   - *Kết luận*: **Từ chối**.
3. **Sinh UUID Ngẫu Nhiên (`uuid.uuid4()`) Mỗi Lần Gợi Ý**:
   - *Đánh giá*: Làm mất tính tất định. Hai lần gọi API cho cùng một nguyên tắc trong cùng một session sẽ sinh ra hai `method_id` khác nhau, làm phá vỡ tính ổn định khi kiểm tra trùng lặp (idempotency) hoặc đối chiếu nguồn.
   - *Kết luận*: **Từ chối**.
4. **Backend Deterministic Slug (`triz-principle-<p_num>`)**:
   - *Đánh giá*: Đáp ứng toàn diện các tiêu chí: tất định, ổn định, ngữ nghĩa rõ ràng, đúng hợp đồng Pydantic, bảo đảm backend là nguồn chân lý.
   - *Kết luận*: **Được chọn**.

---

## Consequences
- **Tầng API & Backend**:
  - Response của `MethodRecommender.recommend_methods`, `GET /api/v1/sessions/{id}/recommendations`, `POST /api/v1/sessions/{id}/next-step`, và `session_export_service` sẽ bổ sung thêm trường `method_id: str`.
  - Không cần migration cơ sở dữ liệu (các trường trong `recommended_methods` là derived data từ `MethodRecommender`, không lưu bảng riêng).
  - Không phá vỡ các consumer API hiện tại.
- **Tầng Frontend**:
  - Interface `RecommendedMethod` trong `apps/web/lib/types.ts` sẽ được bổ sung thuộc tính `method_id?: string`.
  - Component `PrincipleSuggestions` sẽ đọc trực tiếp `method.method_id` để khởi tạo `PrincipleSuggestionSourceContext`.

---

## Verification Plan
1. Viết test suite unit `backend/tests/unit/test_method_recommender_method_id.py` xác minh:
   - Các nguyên tắc biên (`principle_id = 1`, `40`) và điển hình (`principle_id = 35`) đều có trường `method_id` đúng định dạng `triz-principle-<principle_id>`.
   - `method_id` là kiểu `str`, không rỗng, không chứa ký tự điều khiển, và độ dài $\le 100$ code points.
2. Kiểm tra chu trình TDD:
   - Giai đoạn RED (Batch C7c-2d-1): Test fail vì `method_id` chưa có trong `MethodRecommender`.
   - Giai đoạn GREEN (Batch C7c-2d-2): Cập nhật `MethodRecommender` và toàn bộ test suite pass 100%.
