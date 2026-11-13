# Batch C7c-1 — Cột source_context Cho Ghi Chú Nghiên Cứu (Backend Only)

## 1. Mục Tiêu (Purpose)
Bổ sung trường dữ liệu có cấu trúc `source_context` (JSONB nullable) cho thực thể ghi chú nghiên cứu (`ResearchNote`) ở tầng backend, nhằm lưu trữ chuẩn xác nguồn gốc phát sinh ghi chú từ 5 nguồn thành phần trong quy trình TRIZ & Problem Structuring:
1. TRIZ 9-Windows (`triz_9_windows`)
2. Tra cứu Ma trận TRIZ (`triz_matrix`)
3. Gợi ý Nguyên tắc Sáng chế (`principle_suggestion`)
4. Bằng chứng Tri thức (`evidence`)
5. Giải pháp Ứng viên (`candidate_solution`)

Khắc phục hoàn toàn tình trạng thất thoát thông tin cấu trúc (lens, level, time, principle_id, parameter_ids, solution_id) do trước đây chỉ ghép tiền tố văn bản `[TRIZ ...]` vào `content`.

---

## 2. Ranh Giới & Ràng Buộc Kỹ Thuật (Technical Boundaries)
- **Backend-Only (Scope C7c-1)**: Không sửa đổi mã nguồn frontend (`apps/web`), không sửa UI hay component trong lượt này.
- **Tương thích ngược tuyệt đối (Backward Compatibility)**:
  - Client cũ gửi payload tạo ghi chú không có trường `source_context` vẫn được chấp nhận (`HTTP 201 Created`), hệ thống tự động lưu `source_context = None`.
  - Endpoint danh sách (`GET /api/v1/sessions/{session_id}/notes`) trả về trường `source_context` (mang giá trị `null` đối với ghi chú cũ).
  - Snapshot export/import phiên bản cũ không chứa `source_context` vẫn import thành công 100%.
  - **Hợp đồng lưu trữ SQL NULL vs JSON null**: Cột `source_context` khai báo trên SQLAlchemy model bằng `JSONB(none_as_null=True)`. Khi không có context (Python `None`), giá trị lưu trữ trong PostgreSQL bắt buộc là **SQL NULL** thật sự (`source_context IS NULL = true`, `jsonb_typeof(source_context)` trả về `NULL`). Tuyệt đối **KHÔNG** lưu thành chuỗi JSON `'null'` (`jsonb_typeof = 'null'`), đảm bảo các câu truy vấn lọc SQL `WHERE source_context IS NULL` hoạt động chính xác. Đã có integration test kiểm tra bằng truy vấn raw SQL độc lập với ORM.
- **Bất biến tên trường (Đã xác minh thực tế trên SQLAlchemy 2.1.1)**:
  - Tên cột cơ sở dữ liệu VÀ thuộc tính ORM model bắt buộc là **`source_context`**.
  - **TUYỆT ĐỐI KHÔNG** đặt tên là `metadata`. Thực nghiệm trực tiếp trên `app.domain.models.Base` (SQLAlchemy 2.1.1) chứng minh: khi khai báo cột mang tên `metadata`, SQLAlchemy phát ra cảnh báo `SAWarning: Attribute name 'metadata' should be left reserved for the MetaData instance when using a Declarative class.`, đồng thời biến thuộc tính này thành `InstrumentedAttribute`, hoàn toàn che khuất (shadowing) đối tượng `MetaData` của class và phá vỡ các phương thức cốt lõi như `.tables`, `.create_all`, `.drop_all`.
- **Tiết kiệm & Chuẩn hóa dữ liệu (Payload Normalization)**:
  - Chỉ lưu trữ các trường định danh, enum, chỉ số tham số và chuỗi ngắn có giới hạn độ dài (`max_length`).
  - **Quy tắc Kiểm Soát Chuỗi Tự Do & Số Nguyên Chặt Chẽ (Strict Validation Rules)**:
    - **Số nguyên chặt (`StrictInt`)**: `principle_id`, `improving_param_id`, `worsening_param_id` và `principle_used` (nhánh int) từ chối tuyệt đối boolean (`True`/`False`), chuỗi số (`"1"`), và số thực float (`1.0`). `principle_used` vẫn nhận chuỗi hợp lệ.
    - **Kiểm soát ký tự điều khiển trên chuỗi GỐC (No Pre-strip)**: Mọi trường chuỗi tự do (`cell_label`, `source_ref`, `method_id`, `principle_used` dạng chuỗi) **TUYỆT ĐỐI KHÔNG** được chứa ký tự điều khiển (ASCII < 32, `\n`, `\r`, `\t`, NUL `\0`), kể cả khi nằm ở rìa chuỗi (`"abc\n"` hoặc `"\tabc"` đều bị từ chối). Kiểm tra trực tiếp trên chuỗi gốc, không strip trước.
    - **Cấm ký tự ngắt dòng Unicode U+2028 và U+2029**: Các trường chuỗi tự do từ chối tuyệt đối `U+2028` (LINE SEPARATOR) và `U+2029` (PARAGRAPH SEPARATOR).
    - **Cấm chuỗi rỗng hoặc chỉ toàn khoảng trắng**: Từ chối chuỗi sau khi strip rỗng (`not v.strip()`).
    - **Không biến đổi dữ liệu (No Data Mutation)**: Không tự ý gọi `.strip()` trên chuỗi hợp lệ của người dùng; khoảng trắng đầu/cuối được bảo toàn nguyên vẹn.
    - Các chuỗi văn bản thông thường chứa ký tự có dấu tiếng Việt (Unicode printable) được hỗ trợ đầy đủ.
  - **Bảo Vệ Định Dạng Khi Xuất Báo Cáo Markdown**:
    - Khi xuất Markdown (`session_export_service.py`), chuỗi do client cung cấp (đặc biệt `source_ref`) phải được escape các ký tự điều khiển/định dạng Markdown (`*`, `_`, `` ` ``, `[`, `]`, `<`, `>`, `\`), đảm bảo không làm vỡ cấu trúc dòng, không bị hỏng khối in nghiêng `*(Mã ghi chú: ...)*`, và không thể chèn liên kết hoặc mã HTML độc hại.
  - **KHÔNG** lưu lại nội dung văn bản ghi chú hay trích dẫn trong `source_context` (tránh dư thừa dữ liệu với `content`).
  - Nguồn `evidence` **KHÔNG** lặp lại `chunk_id` (đã có cột quan hệ khóa ngoại `source_chunk_id`) và **KHÔNG** lưu `score` (điểm tương đồng thay đổi theo thuật toán truy vấn). Nếu client cố tình gửi `chunk_id` hoặc `score` trong `source_context`, hệ thống sẽ từ chối qua cơ chế `extra="forbid"`.
- **Phân loại Rủi ro & Khả nghịch**:
  - *Schema migration*: Khả nghịch hai chiều (Two-way door) qua script Alembic downgrade `op.drop_column('research_notes', 'source_context')`.
  - *Dữ liệu trong cột mới*: **Mất dữ liệu cột mới khi downgrade** (dữ liệu trong `source_context` sẽ bị hủy khi drop cột, mặc dù các cột cũ `content`, `note_type`, `created_at` được bảo toàn; đã có test integration xác minh điều này).
  - *Rollback Container Trap*: Nếu rollback image Docker API về phiên bản cũ (trước C7c-1) trong khi DB đã chạy migration `006`, container API cũ sẽ fail khởi động do runner postflight phát hiện drift (`Can't locate revision 006`). Do đó, quy trình rollback **bắt buộc** phải downgrade database về `005` trước khi rollback image API.

---

## 3. Đặc Tả Schema & Hợp Đồng Dữ Liệu (Data Contract)

### 3.1. Discriminated Union Schema (`source_context`)
Mọi đối tượng `source_context` phải tuân thủ nghiêm ngặt schema có phiên bản (`schema_version: 1`), phân loại theo trường phân biệt `source_type`, và kích hoạt chính sách cấm trường lạ (`extra = "forbid"`):

```python
# Cấu hình chung cho toàn bộ context models
model_config = ConfigDict(extra="forbid")
```

#### Nguồn 1: `triz_9_windows` (Lưới 9 Màn Hình TRIZ)
- `schema_version`: `Literal[1] = 1`
- `source_type`: `Literal["triz_9_windows"] = "triz_9_windows"`
- `lens`: `Literal["engineering", "business", "everyday"]` (Bắt buộc)
- `level`: `Literal["supersystem", "system", "subsystem"]` (Bắt buộc)
- `time`: `Literal["past", "present", "future"]` (Bắt buộc)
- `cell_label`: `str = Field(..., min_length=1, max_length=100)` (Nhãn tiếng Việt của ô)

#### Nguồn 2: `triz_matrix` (Tra Cứu Ma Trận TRIZ 39x39)
- `schema_version`: `Literal[1] = 1`
- `source_type`: `Literal["triz_matrix"] = "triz_matrix"`
- `principle_id`: `int = Field(..., ge=1, le=40)` (Mã nguyên tắc sáng tạo Altshuller 1..40)
- `improving_param_id`: `int = Field(..., ge=1, le=39)` (Thông số cần cải thiện 1..39)
- `worsening_param_id`: `int = Field(..., ge=1, le=39)` (Thông số bị xấu đi 1..39)
- `lens`: `Literal["engineering", "business", "everyday"]` (Góc nhìn diễn giải)

#### Nguồn 3: `principle_suggestion` (Gợi Ý Nguyên Tắc Sáng Chế)
- `schema_version`: `Literal[1] = 1`
- `source_type`: `Literal["principle_suggestion"] = "principle_suggestion"`
- `principle_id`: `int = Field(..., ge=1, le=40)` (Mã nguyên tắc sáng chế 1..40)
- `method_id`: `str = Field(..., min_length=1, max_length=100)` (Định danh phương pháp đề xuất)

#### Nguồn 4: `evidence` (Trích Dẫn Bằng Chứng Kho Tri Thức)
- `schema_version`: `Literal[1] = 1`
- `source_type`: `Literal["evidence"] = "evidence"`
- `source_ref`: `str = Field(..., min_length=1, max_length=255)` (Tên tài liệu, bài viết hoặc vị trí trang)

#### Nguồn 5: `candidate_solution` (Giải Pháp Sáng Tạo Ứng Viên)
- `schema_version`: `Literal[1] = 1`
- `source_type`: `Literal["candidate_solution"] = "candidate_solution"`
- `solution_id`: `uuid.UUID` (ID giải pháp ứng viên)
- `principle_used`: `Optional[Union[int, str]] = None` (Nếu là int: 1..40; nếu là str: max_length=100)
- `solution_status`: `Literal["candidate", "accepted", "rejected"]` (Trạng thái đánh giá giải pháp)

---

### 3.2. Hợp Đồng API Endpoints

#### 1. Tạo Ghi Chú: `POST /api/v1/sessions/{session_id}/notes`
- **Request Body (`ResearchNoteCreate`)**:
  ```json
  {
    "content": "Nội dung ghi chú phân tích",
    "note_type": "insight",
    "source_chunk_id": "d259f17f-75bd-499b-8dc3-5cc5bcff417e",
    "source_context": {
      "schema_version": 1,
      "source_type": "triz_9_windows",
      "lens": "business",
      "level": "system",
      "time": "present",
      "cell_label": "Mô hình kinh doanh hiện tại"
    }
  }
  ```
- **Xử lý Validation**:
  - `source_context` là trường tùy chọn (`Optional[NoteSourceContextUnion] = None`).
  - Nếu `source_context` được gửi lên: Bắt buộc parse qua Pydantic Discriminated Union. Bất kỳ sai lệch nào (sai `schema_version`, thừa trường, sai range tham số, sai enum) đều trả về `HTTP 422 Unprocessable Entity`.
- **Response (`HTTP 201 Created`)**:
  Trả về payload note hoàn chỉnh chứa trường `source_context` vừa lưu.

#### 2. Liệt Kê Ghi Chú: `GET /api/v1/sessions/{session_id}/notes`
- **Response (`HTTP 200 OK`)**:
  Mỗi phần tử trong mảng `data` chứa trường `source_context` (`dict` hoặc `null`).

#### 3. Xóa Ghi Chú: `DELETE /api/v1/sessions/{session_id}/notes/{note_id}`
- Giữ nguyên hành vi hiện có, không bị ảnh hưởng.

---

### 3.3. Hợp Đồng Export & Import Session

#### 1. JSON Export (`session_export_service.py`)
- Mỗi phần tử trong `research_notes` của snapshot JSON bao gồm trường `source_context` (`dict` hoặc `null`).

#### 2. Markdown Export (`session_export_service.py`)
- Nếu ghi chú có `source_context`: Bổ sung thông tin nguồn có cấu trúc vào phần metadata của ghi chú (ví dụ: `*(Mã ghi chú: ... | Nguồn: Lưới 9-Windows [business • system - present])*`).
- Nếu `source_context` là `null`: Giữ nguyên định dạng cũ không gây lỗi.

#### 3. Session Import (`session_import_service.py` & Endpoint `POST /api/v1/sessions/import`) — [QUYẾT ĐỊNH ĐÃ CHỐT: ATOMIC REJECT 422]
- **Snapshot phiên bản cũ** (không có trường `source_context` hoặc giá trị `null`): Import bình thường, gán `source_context = None`.
- **Snapshot có `source_context` hợp lệ**: Parse và lưu trữ nguyên vẹn cấu trúc vào session mới.
- **Snapshot có `source_context` sai định dạng** (trường lạ, sai range, sai kiểu, sai schema_version):
  - **Quy tắc Từ Chối Nguyên Tử (Atomic Reject)**:
    - Ở tầng Service (`import_session_from_json`): Ném ngoại lệ validation / `ValueError` và rollback transaction.
    - Ở tầng API (`POST /api/v1/sessions/import`): Bắt ngoại lệ và trả về `HTTP 422 Unprocessable Entity` kèm thông báo chi tiết.
    - **Không để lại orphan records**: Không có bất kỳ `ResearchSession`, `ProblemFrame`, `ResearchNote` hay `CandidateSolution` nào được tạo trong cơ sở dữ liệu.
  - Tuyệt đối không import nửa vời, không tự ý làm sạch (silent sanitize) dữ liệu lỗi.

---

## 4. Đặc Tả Kịch Bản Kiểm Thử (Gherkin Scenarios)

### Kịch Bản 1: Tạo ghi chú có context hợp lệ từ Ma trận TRIZ
```gherkin
Scenario: Tạo ghi chú nghiên cứu kèm source_context ma trận TRIZ hợp lệ
  Given một session nghiên cứu đang active
  When client gửi yêu cầu POST "/api/v1/sessions/{session_id}/notes" với payload:
    """
    {
      "content": "Áp dụng nguyên tắc Phân nhỏ để giải quyết mâu thuẫn trọng lượng và độ bền",
      "note_type": "hypothesis",
      "source_context": {
        "schema_version": 1,
        "source_type": "triz_matrix",
        "principle_id": 1,
        "improving_param_id": 1,
        "worsening_param_id": 14,
        "lens": "engineering"
      }
    }
    """
  Then mã phản hồi là HTTP 201 Created
  And payload trả về có trường "source_context" khớp 100% với dữ liệu đã gửi
  And cơ sở dữ liệu lưu trữ cột "source_context" dạng JSONB chính xác
```

### Kịch Bản 2: Tương thích ngược khi client cũ tạo ghi chú không có context
```gherkin
Scenario: Client cũ gửi payload tạo ghi chú không chứa source_context
  Given một session nghiên cứu đang active
  When client gửi yêu cầu POST "/api/v1/sessions/{session_id}/notes" với payload cũ:
    """
    {
      "content": "Ghi chú độc lập không qua công cụ TRIZ",
      "note_type": "insight"
    }
    """
  Then mã phản hồi là HTTP 201 Created
  And payload trả về có trường "source_context" là null
  And cơ sở dữ liệu lưu trữ ghi chú với cột "source_context" là NULL
```

### Kịch Bản 3: Từ chối atomic khi import snapshot có context sai định dạng
```gherkin
Scenario: Từ chối import session khi source_context trong snapshot bị sai định dạng
  Given một tệp snapshot session hợp lệ ngoại trừ một research_note có:
    """
    {
      "content": "Ghi chú context lỗi",
      "source_context": {
        "schema_version": 1,
        "source_type": "triz_matrix",
        "principle_id": 999
      }
    }
    """
  When người dùng gọi endpoint POST "/api/v1/sessions/import" với snapshot này
  Then mã phản hồi là HTTP 422 Unprocessable Entity
  And không có bất kỳ ResearchSession, ProblemFrame hay ResearchNote nào được tạo trong cơ sở dữ liệu (Rollback toàn vẹn)
```

---

## 5. Tiêu Chí Nghiệm Thu (Acceptance Criteria)
1. **Schema Integrity**: Cột `source_context` được định nghĩa kiểu `JSONB`, `nullable=True` trên bảng `research_notes`.
2. **Strict Validation**: Pydantic từ chối mọi payload có trường lạ (`extra="forbid"`), sai `schema_version != 1`, hoặc tham số ngoài catalog chuẩn (1..40 đối với nguyên tắc, 1..39 đối với thông số TRIZ).
3. **Database Migration Safety**:
   - Migration `006` upgrade thành công trên database có sẵn dữ liệu, gán `NULL` cho các hàng cũ.
   - Downgrade `006 -> 005` drop cột an toàn mà không phá vỡ các cột còn lại; xác nhận dữ liệu trong cột mới bị mất vĩnh viễn theo đúng thiết kế.
   - Migration runner postflight check thật chấp nhận revision `006` trên disposable DB.
4. **Export / Import Consistency**:
   - JSON export xuất đầy đủ `source_context`.
   - Import snapshot cũ thành công; import snapshot có `source_context` hợp lệ được bảo toàn; import context sai bị chặn atomic với HTTP 422.
5. **No Regressions**: Toàn bộ 435 tests backend cũ tiếp tục pass 100%.

---

## 6. Các Hành Vi Bị Cấm (Forbidden Behaviors)
- CẤM đặt tên cột hoặc thuộc tính ORM là `metadata`.
- CẤM lưu lại nội dung text của ghi chú vào `source_context`.
- CẤM lưu `score` hoặc lặp lại `chunk_id` trong `source_context` của nguồn `evidence`.
- CẤM sửa đổi mã nguồn frontend trong scope Batch C7c-1.
- CẤM cấu hình migration default value không nullable trên cột mới.
- CẤM bypass validation khi import dữ liệu không đạt chuẩn.
