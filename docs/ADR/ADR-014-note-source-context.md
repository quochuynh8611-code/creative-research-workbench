# ADR-014: Versioned Discriminated JSONB source_context for Research Notes

## Status
Proposed

## Context
Trong quy trình nghiên cứu sáng tạo của Creative Research Workbench, ghi chú nghiên cứu (`ResearchNote`) được khởi tạo từ 5 nguồn nghiệp vụ khác nhau trong các giai đoạn phân tích mâu thuẫn và sinh ý tưởng:
1. **Lưới 9 màn hình TRIZ (`triz_9_windows`)**: Mang thông tin góc nhìn (`lens`: kỹ thuật, kinh doanh, đời sống), tầng hệ thống (`level`: hệ thống, dưới hệ thống, trên hệ thống), và trục thời gian (`time`: quá khứ, hiện tại, tương lai).
2. **Tra cứu Ma trận mâu thuẫn TRIZ (`triz_matrix`)**: Mang thông số cần cải thiện (`improving_param_id`), thông số xấu đi (`worsening_param_id`), mã nguyên tắc sáng chế (`principle_id`), và góc nhìn (`lens`).
3. **Gợi ý nguyên tắc sáng tạo (`principle_suggestion`)**: Mang mã nguyên tắc (`principle_id`) và định danh phương pháp (`method_id`).
4. **Bằng chứng tri thức (`evidence`)**: Mang thông tin tài liệu nguồn (`source_ref`) liên kết với đoạn văn bản trích dẫn.
5. **Giải pháp ứng viên (`candidate_solution`)**: Mang định danh giải pháp (`solution_id`), nguyên tắc áp dụng (`principle_used`), và trạng thái đánh giá (`solution_status`).

Hiện tại, toàn bộ thông tin ngữ cảnh có cấu trúc trên đều bị thất thoát khi chuyển sang ghi chú nháp (`NoteDraft`), do hệ thống chỉ ghép chuỗi tiền tố trực quan (ví dụ: `[TRIZ 9-Windows: ...]`) vào trường `content`. Điều này gây ra các hạn chế nghiêm trọng:
- Không thể lọc, thống kê hoặc tổng hợp ghi chú theo góc nhìn (lens) hoặc nguyên tắc sáng chế ở backend.
- Phụ thuộc vào việc parse chuỗi văn bản không tin cậy nếu người dùng chỉnh sửa nội dung ghi chú.
- Không thể tái tạo lại ngữ cảnh chính xác khi xuất/nhập phiên làm việc (Export/Import Session).

Do đó, cần bổ sung một cơ chế lưu trữ ngữ cảnh nguồn gốc có cấu trúc, chặt chẽ, có phiên bản và tương thích ngược hoàn toàn với hệ thống hiện tại.

---

## Decision
Áp dụng **Cột JSONB Nullable có phiên bản với Schema Discriminated Union chặt chẽ**, đặt tên là **`source_context`**:

### 1. Bất Biến Đặt Tên: `source_context` (Tuyệt Đối Không Dùng `metadata`)
- Trong SQLAlchemy Declarative API, thuộc tính `metadata` là **tên dành riêng** của lớp cơ sở (`Base.metadata` là đối tượng `sqlalchemy.MetaData` quản lý toàn bộ bảng và schema).
- **Thực nghiệm xác minh trên môi trường thực tế (SQLAlchemy 2.1.1)**:
  Khi khai báo một model con kế thừa trực tiếp từ `app.domain.models.Base` có thuộc tính `metadata: Mapped[dict] = mapped_column(JSONB, nullable=True)`, SQLAlchemy phát ra cảnh báo:
  ```text
  SAWarning: Attribute name 'metadata' should be left reserved for the MetaData instance when using a Declarative class.
  ```
  Đồng thời, thuộc tính `metadata` trên model class bị ghi đè thành một `InstrumentedAttribute`, làm biến mất hoàn toàn thuộc tính `.tables`, `.create_all`, `.drop_all`. Điều này dẫn đến sự cố phá vỡ hoàn toàn khả năng tương tác với database metadata của SQLAlchemy và các công cụ reflection.
- Do đó, tên cột cơ sở dữ liệu VÀ thuộc tính trên model `ResearchNote` được thống nhất bắt buộc là **`source_context`**.

### 2. Định Dạng Lưu Trữ JSONB & Tương Thích Ngược
- Cột `source_context` được tạo với kiểu `JSONB` trong PostgreSQL, cấu hình `nullable=True`, mặc định `None` ở mức ứng dụng.
- **Quy chuẩn lưu trữ SQL NULL thay vì JSON null**: Trên ORM model `ResearchNote`, cột được định nghĩa với `JSONB(none_as_null=True)`. Điều này đảm bảo rằng khi một ghi chú không có ngữ cảnh (`source_context = None`), SQLAlchemy sẽ gửi giá trị SQL `NULL` thật sự xuống cơ sở dữ liệu (`source_context IS NULL = true`, `jsonb_typeof(source_context)` trả về `NULL`), thay vì lưu chuỗi JSON `'null'` (`jsonb_typeof = 'null'`). Nhờ đó, các truy vấn lọc SQL `WHERE source_context IS NULL` hoạt động chính xác và nhất quán.
- Đối với tất cả ghi chú cũ (hoặc ghi chú tự do tạo không qua công cụ), `source_context` lưu giá trị `NULL`.
- Client cũ gửi payload tạo ghi chú không chứa `source_context` vẫn được xử lý hợp lệ (`HTTP 201 Created`).

### 3. Pydantic Discriminated Union với Phiên Bản Hóa (`schema_version`)
- Dữ liệu `source_context` được kiểm thực nghiêm ngặt qua Pydantic Discriminated Union dựa trên trường phân loại `source_type`.
- Mọi schema context đều có trường `schema_version = 1`.
- Kích hoạt chính sách `model_config = ConfigDict(extra="forbid")` để từ chối tuyệt đối các trường lạ nằm ngoài đặc tả.
- Ràng buộc giá trị bám sát catalog thực tế trong repository:
  - `principle_id`: Giới hạn trong đoạn `[1, 40]`, bắt buộc kiểu số nguyên chặt (`StrictInt`), từ chối tuyệt đối bool (`True`/`False`), chuỗi số (`"1"`), và float (`1.0`).
  - `improving_param_id` và `worsening_param_id`: Giới hạn trong đoạn `[1, 39]`, bắt buộc kiểu số nguyên chặt (`StrictInt`), từ chối bool, chuỗi số, float.
  - `principle_used`: Nhận số nguyên `1..40` (chặt, cấm bool/float) hoặc chuỗi tự do hợp lệ.
  - Giới hạn độ dài chuỗi (`max_length` 100 hoặc 255) đối với các nhãn định danh.
  - **Kiểm soát ký tự điều khiển trên chuỗi gốc (No Pre-strip)**: Các trường chuỗi tự do (`cell_label`, `source_ref`, `method_id`, `principle_used`) tuyệt đối không chứa ký tự điều khiển (`\n`, `\r`, `\t`, NUL `\0`, ASCII < 32), kể cả khi nằm ở rìa chuỗi (`"abc\n"`). Kiểm tra trực tiếp trên chuỗi gốc, không strip trước.
  - **Cấm ký tự ngắt dòng Unicode U+2028 & U+2029**: Các trường chuỗi tự do từ chối tuyệt đối `U+2028` (LINE SEPARATOR) và `U+2029` (PARAGRAPH SEPARATOR).
  - **Cấm chuỗi rỗng hoặc chỉ khoảng trắng**: Từ chối chuỗi sau khi strip rỗng (`not v.strip()`).
  - **Không biến đổi dữ liệu (No Data Mutation)**: Không tự ý `.strip()` chuỗi hợp lệ của người dùng; bảo toàn khoảng trắng đầu/cuối ban đầu.
  - Cho phép đầy đủ ký tự Unicode tiếng Việt hợp lệ.
  - **Bảo toàn hiển thị Markdown (Markdown Export Sanitization)**: Khi xuất Markdown, các ký tự định dạng (`*`, `_`, `` ` ``, `[`, `]`, `<`, `>`, `\`) trong `source_ref` được escape an toàn để chống vỡ cấu trúc và ngăn chèn link/HTML injection.
- Tuyệt đối không lưu lại nội dung text của ghi chú trong `source_context`.
- Nguồn `evidence` không lưu lại `chunk_id` (đã có khóa ngoại `source_chunk_id`) và không lưu `score` biến động.

### 4. Cơ Chế Xử Lý Lỗi Khi Import Session: Atomic Reject HTTP 422
- Khi người dùng gọi API `POST /api/v1/sessions/import` với một file snapshot chứa ghi chú có `source_context` sai định dạng:
  - Hệ thống áp dụng nguyên tắc **Fail-Closed Atomic**: Từ chối toàn bộ phiên import và trả về mã trạng thái `HTTP 422 Unprocessable Entity`.
  - Toàn bộ transaction được rollback tự động. Tuyệt đối không lưu lại session mồ côi hay import một phần dữ liệu.

### 5. Chiến Lược Triển Khai Phân Tách: Backend Trước (C7c-1)
- Triển khai toàn diện ở tầng Backend trước (DB schema, models, schemas, endpoints, export/import, tests).
- Frontend giữ nguyên trong phase C7c-1, sẵn sàng kết nối ở phase C7c-2.

---

## Alternatives Considered

### 1. Phương Án B: Tách Thành Nhiều Cột Rời Rạc (`source_type`, `lens`, `principle_id`, `param_id`...)
- *Mô tả*: Thêm 5-6 cột riêng biệt vào bảng `research_notes`.
- *Lý do loại bỏ*:
  - Mỗi nguồn trong 5 nguồn có tập thuộc tính hoàn toàn khác nhau. Bảng dữ liệu sẽ trở nên thưa thớt (sparse table) với phần lớn các cột mang giá trị `NULL`.
  - Mỗi khi bổ sung một công cụ mới (ví dụ SCAMPER, Six Thinking Hats), hệ thống lại phải chạy một DDL migration mới để thêm cột.
  - Tăng độ phức tạp của model và truy vấn ORM mà không đem lại lợi ích hiệu năng đáng kể do tần suất truy vấn ghi chú là theo từng session.

### 2. Phương Án C: Giữ Nguyên Backend, Parse Regex Tiền Tố Văn Bản ở Client
- *Mô tả*: Không thay đổi cơ sở dữ liệu. Viết logic frontend dùng Regular Expression để bóc tách thông tin từ `content` (ví dụ `[TRIZ 9-Windows: ...]`).
- *Lý do loại bỏ*:
  - Rất mỏng manh (brittle): Người dùng có thể vô tình sửa, xóa một ký tự trong tiền tố khiến regex thất bại.
  - Không thể thực hiện truy vấn tổng hợp, analytics hay AI synthesis đáng tin cậy ở backend.
  - Vi phạm nguyên tắc phân tách rõ ràng giữa nội dung thể hiện (presentation) và dữ liệu ngữ cảnh (metadata).

### 3. Phương Án Đặt Tên `metadata`
- *Lý do loại bỏ*: Xung đột trực tiếp với SQLAlchemy Declarative API dẫn đến lỗi khởi tạo ứng dụng không thể phục hồi.

---

## Consequences & Risk Analysis

### Tích Cực
- Bảo toàn 100% dữ liệu ngữ cảnh phát sinh từ các bước tư duy TRIZ và tìm kiếm tài liệu.
- Mô hình dữ liệu linh hoạt, hỗ trợ mở rộng thêm các nguồn mới trong tương lai thông qua việc bổ sung schema variant trong Discriminated Union mà không cần DDL migration.
- Duy trì tính toàn vẹn và an toàn tuyệt đối cho các ghi chú hiện có nhờ thuộc tính `nullable=True`.
- API và Import/Export được kiểm soát chất lượng dữ liệu chặt chẽ qua Pydantic `extra="forbid"`.

### Rủi Ro & Chiến Lược Ứng Phó (Rollback Strategy)
1. **Mất Dữ Liệu Cột Mới Khi Downgrade**:
   - *Rủi ro*: Nếu thực hiện rollback migration từ `006` về `005`, lệnh `op.drop_column('research_notes', 'source_context')` sẽ xóa vĩnh viễn dữ liệu ngữ cảnh đã lưu trong cột này (dù các cột cũ được bảo toàn).
   - *Ứng phó*: Luôn tạo backup database đầy đủ trước khi chạy upgrade lên `006`. Đã có bài test integration xác minh rõ hành vi mất dữ liệu cột mới này khi downgrade.
2. **Cạm Bẫy Rollback Container (Container Rollback Trap)**:
   - *Rủi ro*: Cơ chế `runtime_verification.py` và `runner.py` của backend hoạt động theo nguyên tắc **Fail-Closed**. Nếu người dùng rollback image Docker API về phiên bản cũ (chỉ nhận head `005`) trong khi cơ sở dữ liệu đang ở revision `006`, container API cũ sẽ lập tức dừng với lỗi `MigrationVerificationError: expected revision '005', but database is at '006'`.
   - *Ứng phó*: Khi cần rollback ứng dụng, **BẮT BUỘC** phải thực hiện lệnh `alembic downgrade 005` trên database TRƯỚC KHI chuyển đổi image container API.
3. **Diễn Tập Trên Container Cô Lập**:
   - Mọi script migration và downgrade phải được kiểm chứng tự động trên disposable container trong test harness trước khi áp dụng vào môi trường runtime thật.
