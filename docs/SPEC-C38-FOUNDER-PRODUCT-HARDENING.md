---
title: "SPEC-C38 — FOUNDER PRODUCT HARDENING SPECIFICATION"
topic: "product-hardening-spec"
source_type: "spec"
language: "vi"
tags: ["c38", "spec", "product-hardening", "accessibility", "resilience", "tagging", "nine-windows", "ai-coach", "test-first"]
status: "draft"
created: "2026-11-20"
---

# SPEC-C38 — Founder Product Hardening Specification

> Tài liệu đặc tả kỹ thuật chi tiết cho Batch C38 (Founder Product Hardening), giải quyết 5 hạng mục còn tồn đọng sau kiểm chứng thực tế tại Batch C37.

---

## 1. Scope & Mục Tiêu

Batch C38 tập trung làm vững chắc hóa sản phẩm (Product Hardening) dựa trên phản hồi và phát hiện thực tế của Founder, bao gồm đúng 5 hạng mục:

1. **C38-GAP-01 (Product Gap): Per-note tagging** — Hỗ trợ gắn nhãn phân loại tùy biến cho từng ghi chú trong Sổ tay nghiên cứu (Research Notebook).
2. **C38-GAP-02 (Product Gap): AI Coach editable draft form** — Bổ sung biểu mẫu cho phép Founder biên tập, hoàn thiện gợi ý từ AI Coach trước khi lưu thành Solution hoặc Note.
3. **C38-GAP-03 (Product Gap): Extended-lens save from 9-Windows** — Cho phép trích xuất ghi chú vào Sổ tay từ cả 3 lăng kính mở rộng (`systems_thinking`, `design_thinking`, `lean_startup`) của Sơ đồ 9 Màn hình TRIZ.
4. **C38-GAP-04 (QA Debt): Browser network failure simulation** — Bộ kiểm thử tự động mô phỏng sự cố ngắt mạng trình duyệt để kiểm chứng cơ chế bảo toàn bản nháp và hiển thị thông báo lỗi.
5. **C38-GAP-05 (Accessibility Polish): Form field accessibility improvements** — Nâng cấp toàn diện các biểu mẫu cốt lõi đạt chuẩn tiếp cận WCAG 2.1 AA.

---

## 2. Non-Goals (Ngoài Phạm Vi)

- Không thêm nhà cung cấp AI bên thứ ba mới; tiếp tục duy trì Mock mode làm baseline mặc định an toàn.
- Không phát triển các tính năng TRIZ mới (ví dụ: Su-Field Analysis, Trends Matrix mở rộng).
- Không tạo các bảng quản lý tài chính, kho hàng, chi phí, nhân sự (tuân thủ nghiêm ngặt Hiến pháp Doanh nghiệp 1 người).
- Không tự ý commit, push, tạo PR, merge hay deploy production khi chưa có phê duyệt tại Human Gate.
- Không thêm bất kỳ thư viện (dependency) npm hoặc pip mới nào vào dự án.

---

## 3. Data Model & Schema Changes

### 3.1 Bảng `tags` và `note_tags` (C38-GAP-01: Normalized Tagging)

Thay vì dùng `ARRAY(String)` không tương thích chuẩn và khó mở rộng phân tích, hệ thống triển khai kiến trúc chuẩn hóa (Normalized Tagging Architecture) qua 2 bảng:

```sql
-- Migration: 007_create_tags_and_note_tags_tables.py
CREATE TABLE tags (
    id UUID PRIMARY KEY,
    canonical_slug VARCHAR(50) NOT NULL UNIQUE,
    display_label VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_tags_canonical_slug ON tags (canonical_slug);

CREATE TABLE note_tags (
    note_id UUID NOT NULL REFERENCES research_notes (id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (note_id, tag_id)
);
CREATE INDEX ix_note_tags_note_id ON note_tags (note_id);
CREATE INDEX ix_note_tags_tag_id ON note_tags (tag_id);
```

**SQLAlchemy ORM Mapping (`backend/src/app/domain/models.py`)**:
```python
class Tag(Base):
    __tablename__ = "tags"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canonical_slug: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    display_label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    notes = relationship("ResearchNote", secondary="note_tags", back_populates="tags")

class NoteTag(Base):
    __tablename__ = "note_tags"
    note_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("research_notes.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

class ResearchNote(Base):
    __tablename__ = "research_notes"
    # ... các cột hiện có giữ nguyên ...
    tags = relationship("Tag", secondary="note_tags", back_populates="notes", lazy="selectin")
```

### 3.2 Note Source Context Schema (C38-GAP-03)

Cập nhật Pydantic Schema `Triz9WindowsContext` trong `backend/src/app/schemas/note_context.py`:

```python
class Triz9WindowsContext(BaseNoteContext):
    """Nguồn 1: Lưới 9 Màn Hình TRIZ (Hỗ trợ 6 lăng kính)."""
    schema_version: Literal[1] = 1
    source_type: Literal["triz_9_windows"] = "triz_9_windows"
    lens: Literal[
        "engineering",
        "business",
        "everyday",
        "systems_thinking",
        "design_thinking",
        "lean_startup",
    ]
    level: Literal["supersystem", "system", "subsystem"]
    time: Literal["past", "present", "future"]
    cell_label: str = Field(..., min_length=1, max_length=100)
```

**TypeScript Types (`apps/web/lib/types.ts`)**:
```typescript
export type TrizNineWindowsLens =
  | 'engineering'
  | 'business'
  | 'everyday'
  | 'systems_thinking'
  | 'design_thinking'
  | 'lean_startup'

export interface Triz9WindowsSourceContext {
  schema_version: 1
  source_type: 'triz_9_windows'
  lens: TrizNineWindowsLens
  level: 'supersystem' | 'system' | 'subsystem'
  time: 'past' | 'present' | 'future'
  cell_label: string
}
```

---

## 4. API Contract Draft

### 4.1 Tạo Research Note Kèm Tags

**`POST /api/v1/sessions/{session_id}/notes`**

- **Request Body**:
  ```json
  {
    "content": "Cần sử dụng lớp cách nhiệt dạng gel khí để giảm truyền nhiệt sang cụm pin lân cận.",
    "note_type": "hypothesis",
    "tags": ["battery", "thermal-runaway", "triz-principle-35"],
    "source_chunk_id": null,
    "source_context": null
  }
  ```
- **Validation Rules cho `tags`**:
  - Kiểu dữ liệu: `list[str]`. Mặc định: `[]`.
  - Chuẩn hóa: Tự động `strip()` và `lower()`.
  - Ký tự hợp lệ: Chỉ chứa chữ cái, số, dấu gạch nối `-`, gạch dưới `_`. Loại bỏ các ký tự lạ hoặc khoảng trắng bên trong tag.
  - Giới hạn: Tối đa 10 tags mỗi note; độ dài mỗi tag từ 1 đến 50 ký tự.
- **Response 201 Created**:
  ```json
  {
    "id": "c1a9c372-8f92-4d51-b847-ef9905c74281",
    "session_id": "f5b80421-2e6b-4e67-93e8-8a8b27df9452",
    "content": "Cần sử dụng lớp cách nhiệt dạng gel khí...",
    "note_type": "hypothesis",
    "tags": ["battery", "thermal-runaway", "triz-principle-35"],
    "source_chunk_id": null,
    "source_context": null,
    "created_at": "2026-11-20T10:15:30.123456Z",
    "updated_at": "2026-11-20T10:15:30.123456Z",
    "data": { ... }
  }
  ```

### 4.2 Lấy Danh Sách Research Notes Kèm Tags

**`GET /api/v1/sessions/{session_id}/notes`**

- **Query Params**:
  - `tag` (tùy chọn, string): Lọc các notes chứa tag này.
- **Response 200 OK**:
  ```json
  {
    "data": [
      {
        "id": "c1a9c372-8f92-4d51-b847-ef9905c74281",
        "session_id": "f5b80421-2e6b-4e67-93e8-8a8b27df9452",
        "content": "...",
        "note_type": "hypothesis",
        "tags": ["battery", "thermal-runaway"],
        "source_chunk_id": null,
        "source_context": null,
        "created_at": "2026-11-20T10:15:30.123456Z",
        "updated_at": "2026-11-20T10:15:30.123456Z"
      }
    ],
    "meta": { "total": 1 }
  }
  ```

### 4.3 Gỡ Bỏ Tag Association Khỏi Note

**`DELETE /api/v1/sessions/{session_id}/notes/{note_id}/tags/{tag_slug}`**

- **URL Params**:
  - `session_id` (UUID): ID của session.
  - `note_id` (UUID): ID của ghi chú.
  - `tag_slug` (string): Slug của tag cần gỡ.
- **Behavior**:
  - Gỡ bỏ liên kết giữa note và tag trong bảng `note_tags`.
  - Giữ nguyên bản ghi canonical tag trong bảng `tags` (Zero hard-delete).
  - Giữ nguyên nội dung và trạng thái ghi chú.
- **Response 200 OK**:
  ```json
  {
    "id": "c1a9c372-8f92-4d51-b847-ef9905c74281",
    "session_id": "f5b80421-2e6b-4e67-93e8-8a8b27df9452",
    "content": "...",
    "note_type": "hypothesis",
    "tags": ["thermal-runaway"],
    "status": "success",
    "removed_tag": "battery"
  }
  ```

### 4.4 Cập Nhật Danh Sách Tags Của Note

**`PUT /api/v1/sessions/{session_id}/notes/{note_id}/tags`**

- **Request Body**:
  ```json
  {
    "tags": ["thermal-runaway", "safety-margin"]
  }
  ```
- **Behavior**:
  - Đồng bộ liên kết trong bảng `note_tags`: Thêm association cho tag mới, xóa association cho tag bị loại bỏ.
  - Tự động tạo bản ghi canonical trong bảng `tags` nếu chưa tồn tại.
  - Không xóa các bản ghi canonical trong bảng `tags` khi bị gỡ khỏi note.
- **Response 200 OK**:
  ```json
  {
    "id": "c1a9c372-8f92-4d51-b847-ef9905c74281",
    "session_id": "f5b80421-2e6b-4e67-93e8-8a8b27df9452",
    "content": "...",
    "note_type": "hypothesis",
    "tags": ["thermal-runaway", "safety-margin"],
    "status": "success"
  }
  ```

---

## 5. UI/UX Flow

### 5.1 Luồng Per-Note Tagging (C38-GAP-01)
1. Trong form tạo ghi chú (`ResearchNotebook`), xuất hiện trường nhập `Tags` bên dưới textarea nội dung:
   - Placeholder: `"Nhập tags, phân tách bằng dấu phẩy (vd: triz, cost, battery)..."`
   - Hỗ trợ nhập và hiển thị tag chips.
2. Trên mỗi thẻ ghi chú (Note Card):
   - Danh sách tag hiển thị dưới dạng badge nhỏ màu xám nhạt (`bg-muted text-muted-foreground text-[11px]`).
   - Bấm vào một tag badge sẽ tự động kích hoạt bộ lọc danh sách ghi chú theo tag đó.
3. Thanh công cụ lọc (`Notebook Toolbar`):
   - Bổ sung bộ lọc Tag bên cạnh bộ lọc `Loại ghi chú` và `Nguồn gốc`.

### 5.2 Luồng AI Coach Editable Draft Form (C38-GAP-02)
1. Trong `AICoachPanel`, khi gợi ý xuất hiện:
   - Với gợi ý loại `solution_candidate`: Nút bấm `"Biên tập & Lưu giải pháp"`.
   - Với các gợi ý khác (`clarifying_question`, `possible_cause`, v.v.): Nút bấm `"Biên tập & Lưu ghi chép"`.
2. Khi người dùng bấm:
   - Mở modal biên tập `EditableDraftModal`:
     - Tiêu đề modal: `"Biên tập Giải pháp ứng viên"` hoặc `"Biên tập Ghi chép nghiên cứu"`.
     - Cho giải pháp: Điền sẵn `Tiêu đề` và `Cơ chế hoạt động`. Người dùng có thể tự do gõ sửa, thêm chi tiết, sửa lỗi chính tả.
     - Cho ghi chép: Điền sẵn `Nội dung ghi chú` và `Loại ghi chú`.
     - Hiển thị thông tin tham chiếu căn cứ (`Căn cứ: Nguyên tắc TRIZ #35 - Chuyển đổi trạng thái`).
3. Hành động trong Modal:
   - Nút `"Hủy"`: Đóng modal, không tạo bất kỳ dữ liệu nào, giữ nguyên gợi ý trên bảng AI Coach.
   - Nút `"Lưu giải pháp"` / `"Lưu ghi chép"`: Kiểm tra tính hợp lệ (báo lỗi nếu để trống), gọi API mutation tương ứng, đóng modal và đánh dấu gợi ý đã xử lý.

### 5.3 Luồng 9-Windows Extended-Lens Save (C38-GAP-03)
1. Người dùng chọn 1 trong 3 lăng kính mở rộng: `Tư duy Hệ thống`, `Tư duy Thiết kế`, `Khởi nghiệp Tinh gọn`.
2. Lưới 9 ô hiển thị thông tin đặc trưng của lăng kính đó.
3. Bấm nút `"Lưu vào sổ tay"` tại một ô bất kỳ:
   - `validateTriz9WindowsContext` chấp nhận `lens` thuộc 6 lăng kính hợp lệ.
   - Note được nạp vào draft của `ResearchNotebook` (hoặc lưu trực tiếp) kèm `source_context` chuẩn.
   - Thẻ note trong sổ tay hiển thị huy hiệu nguồn gốc chính xác: ví dụ `[9-Windows: Tư duy Hệ thống • Hệ thống - Hiện tại: ...]`.

### 5.4 Luồng Phục Hồi Khi Mạng Lỗi (C38-GAP-04)
1. Người dùng đang soạn thảo (Problem Statement, Note, hoặc Candidate Solution).
2. Khi bấm nút gửi, mạng bị rớt (`TypeError: Failed to fetch` hoặc `NetworkError`):
   - Nút gửi trở lại trạng thái khả dụng (không bị treo ở `isPending`).
   - Banner thông báo lỗi xuất hiện nổi bật với `role="alert"`: `"Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền và thử lại."`
   - **Bản nháp trong form TUYỆT ĐỐI KHÔNG BỊ XÓA**.
3. Khi kết nối mạng phục hồi, người dùng bấm lại nút gửi -> Dữ liệu lưu thành công, banner lỗi biến mất, form nháp được dọn sạch an toàn.

### 5.5 Luồng Trợ Năng Biểu Mẫu (C38-GAP-05)
1. Người khiếm thị sử dụng Screen Reader:
   - Khi focus vào bất kỳ ô nhập liệu nào (`Tiêu đề`, `Nội dung`, `Lĩnh vực`, `Thanh tìm kiếm`), Screen Reader đọc to nhãn trường và trạng thái bắt buộc (`aria-required="true"`).
2. Khi submit form bị thiếu trường bắt buộc:
   - Con trỏ focus hoặc thông báo lỗi `aria-invalid="true"` được kích hoạt ngay lập tức.
   - Screen Reader đọc to nội dung thông báo lỗi thông qua liên kết `aria-describedby` và vùng `role="alert"`.
3. Bàn phím thuần túy (Tab/Shift+Tab):
   - Mọi nút, input, select, textarea đều có viền xanh focus rõ ràng (`ring-2 ring-primary`).

---

## 6. Gherkin Scenarios (Given-When-Then)

```gherkin
Feature: C38-GAP-01 Per-Note Tagging
  Để tổ chức và phân loại ghi chép nghiên cứu sâu
  Là Founder / Nhà nghiên cứu
  Tôi cần gắn nhãn linh hoạt cho từng ghi chú và lọc theo nhãn

  Scenario: Tạo ghi chú mới kèm danh sách tags hợp lệ
    Given phiên nghiên cứu "ses-101" đang hoạt động
    When người dùng gửi POST "/api/v1/sessions/ses-101/notes" với nội dung:
      | content | Sử dụng vật liệu composite gia cường |
      | note_type | hypothesis |
      | tags | ["materials", "strength", "lightweight"] |
    Then response trả về mã 201 Created
    And trường "tags" trong response chứa đúng 3 thẻ ["materials", "strength", "lightweight"]
    And ghi chú trong cơ sở dữ liệu có cột "tags" chứa 3 thẻ trên

  Scenario: Chuẩn hóa tags tự động (lowercase, strip, lọc trùng)
    Given phiên nghiên cứu "ses-101" đang hoạt động
    When người dùng gửi POST "/api/v1/sessions/ses-101/notes" với tags:
      | tags | [" Materials ", "MATERIALS", "weight "] |
    Then response trả về mã 201 Created
    And trường "tags" được chuẩn hóa thành ["materials", "weight"]

  Scenario: Lọc ghi chú theo tag trong sổ tay nghiên cứu
    Given phiên nghiên cứu "ses-101" có 3 ghi chú với tags lần lượt là:
      | Note 1 | ["thermal", "battery"] |
      | Note 2 | ["cost", "process"] |
      | Note 3 | ["thermal", "coolant"] |
    When người dùng kích hoạt bộ lọc tag "thermal"
    Then danh sách chỉ hiển thị Note 1 và Note 3
    And Note 2 bị ẩn đi

# ─────────────────────────────────────────────────────────────

Feature: C38-GAP-02 AI Coach Editable Draft Form
  Để kiểm soát chất lượng và tính chính xác của tri thức AI đề xuất
  Là Founder
  Tôi cần có biểu mẫu biên tập nội dung gợi ý trước khi lưu vào hệ thống

  Scenario: Biên tập giải pháp từ AI Coach trước khi lưu
    Given AI Coach đã phân tích và đề xuất gợi ý "Tách biệt ma sát theo thời gian" loại "solution_candidate"
    When người dùng bấm nút "Biên tập & Lưu giải pháp"
    Then một modal biên tập mở ra với:
      | Tiêu đề | Tách biệt ma sát theo thời gian |
      | Cơ chế | Áp dụng nguyên tắc TRIZ #19 tác động định kỳ... |
    When người dùng sửa Tiêu đề thành "Giải pháp bôi trơn chủ động ngắt quãng"
    And người dùng bấm "Lưu giải pháp"
    Then CandidateSolution mới được tạo với tiêu đề "Giải pháp bôi trơn chủ động ngắt quãng"
    And modal biên tập đóng lại
    And thông báo lưu thành công hiển thị

  Scenario: Hủy bỏ biên tập không tạo dữ liệu rác
    Given modal biên tập giải pháp đang mở
    When người dùng bấm nút "Hủy"
    Then modal đóng lại
    And không có CandidateSolution hoặc Note nào được tạo
    And số lượng giải pháp trong phiên không thay đổi

# ─────────────────────────────────────────────────────────────

Feature: C38-GAP-03 Extended-Lens Save From 9-Windows
  Để lưu trữ tri thức hệ thống từ các lăng kính hiện đại
  Là Founder
  Tôi cần lưu các ô trong lăng kính Tư duy Thiết kế, Hệ thống hoặc Lean Startup vào Sổ tay

  Scenario: Lưu ô trong lăng kính Systems Thinking vào Sổ tay nghiên cứu
    Given người dùng đang xem Sơ đồ 9 Màn hình với lăng kính "systems_thinking"
    When người dùng bấm "Lưu vào sổ tay" tại ô "Siêu hệ thống - Tương lai"
    Then dữ liệu context được kiểm thực thành công với lens "systems_thinking"
    And không có thông báo lỗi "Dữ liệu ô không hợp lệ"
    And một ResearchNote mới được tạo kèm source_context chứa lens "systems_thinking"
    And thẻ ghi chú hiển thị badge "Tư duy Hệ thống"

# ─────────────────────────────────────────────────────────────

Feature: C38-GAP-04 Browser Network Failure Simulation & Draft Resilience
  Để đảm bảo an toàn dữ liệu khi kết nối mạng chập chờn
  Là Founder
  Tôi cần hệ thống giữ nguyên bản nháp khi gửi yêu cầu gặp lỗi mạng

  Scenario: Bảo toàn bản nháp ghi chú khi mất kết nối máy chủ
    Given người dùng đã nhập nội dung ghi chú "Ý tưởng giải nhiệt cục bộ"
    And trình duyệt bị ngắt kết nối mạng (Network Error)
    When người dùng bấm nút "Thêm ghi chú"
    Then một thông báo lỗi mạng xuất hiện có thuộc tính role="alert"
    And nội dung "Ý tưởng giải nhiệt cục bộ" vẫn còn nguyên trong ô soạn thảo
    And nút "Thêm ghi chú" không bị vô hiệu hóa vĩnh viễn

# ─────────────────────────────────────────────────────────────

Feature: C38-GAP-05 Form Field Accessibility
  Để mọi người dùng và công nghệ trợ năng sử dụng phần mềm thuận tiện
  Là Người dùng sử dụng bàn phím hoặc Screen Reader
  Tôi cần các trường biểu mẫu có nhãn đầy đủ và thông báo lỗi đúng chuẩn WCAG 2.1 AA

  Scenario: Báo lỗi tiếp cận khi thiếu trường bắt buộc
    Given người dùng đang ở form tạo session mới
    When người dùng để trống ô Tiêu đề và bấm Submit
    Then ô Tiêu đề nhận thuộc tính aria-invalid="true"
    And thuộc tính aria-describedby trỏ tới id của phần tử thông báo lỗi
    And phần tử thông báo lỗi có role="alert"
```

---

## 7. Test Plan

### 7.1 Kiểm Thử Backend (Pytest)
- `tests/unit/test_note_tags_schema.py`: Kiểm thử chuẩn hóa mảng tags, giới hạn độ dài, ký tự lạ, lọc trùng lặp.
- `tests/integration/test_note_tags_api.py`: Kiểm thử CRUD note với tags, lọc query param `?tag=...`.
- `tests/unit/test_triz_9_windows_context_expansion.py`: Kiểm thử Pydantic validator chấp nhận cả 6 lăng kính.
- `tests/integration/test_c38_export_tags.py`: Kiểm thử xuất Markdown và JSON snapshot có chứa tags của từng note.

### 7.2 Kiểm Thử Frontend (Jest & React Testing Library)
- `apps/web/features/session/__tests__/c38-network-failure-simulation.test.tsx`:
  - Mô phỏng `fetch` reject với `TypeError: Failed to fetch`.
  - Xác nhận bản nháp form không bị xóa.
  - Xác nhận thông báo lỗi có `role="alert"`.
- `apps/web/features/notebook/__tests__/research-notebook-tagging.test.tsx`:
  - Nhập tags trong form note compose.
  - Hiển thị tag badge trên note card.
  - Lọc danh sách theo tag.
- `apps/web/features/triz/__tests__/triz-nine-windows-extended-save.test.tsx`:
  - Lưu ghi chú từ lăng kính `systems_thinking`, `design_thinking`, `lean_startup`.
  - Xác nhận không có lỗi `cellError`.
- `apps/web/features/ideation/__tests__/ai-coach-editable-draft.test.tsx`:
  - Mở modal biên tập khi chọn giải pháp / ghi chú.
  - Sửa tiêu đề, cơ chế, bấm submit -> gọi mutation với nội dung đã sửa.
- `apps/web/features/session/__tests__/form-accessibility.test.tsx`:
  - Kiểm tra `htmlFor`/`id`, `aria-required`, `aria-invalid`, `aria-describedby` trên các form.

---

## 8. Rollout Order & Definition of Done

### Thứ Tự Thực Thi 4 Lô:

| Lô | Mã Hạng Mục | Nội Dung Chính | Blast Radius | Phụ Thuộc |
|---|---|---|---|---|
| **Lô 1** | C38-GAP-05 + C38-GAP-04 | Form Field A11y Polish + Browser Network Failure Simulation | Cực thấp (Client a11y & Test suite) | Không |
| **Lô 2** | C38-GAP-01 | Per-note Tagging (Migration 007, API, UI Chips & Filters, Export) | Thấp (Nullable column in `research_notes`) | Không |
| **Lô 3** | C38-GAP-03 | Extended-Lens Save 9-Windows (Schema validation for 6 lenses) | Cực thấp (Zero DB migration, Pydantic/TS update) | Không |
| **Lô 4** | C38-GAP-02 | AI Coach Editable Draft Form (Modal form trước khi lưu) | Thấp (Frontend modal interaction) | Lô 2 (tùy chọn gắn tag) |

### Tiêu Chí Hoàn Tất (DoD):
1. Cả 4 lô đều có failing integration test spec trước khi viết code sản phẩm.
2. Toàn bộ test suites mới và cũ (631 backend tests, 76 frontend test suites) đạt GREEN 100%.
3. Migration 007 có kịch bản upgrade và downgrade kiểm chứng an toàn.
4. Không có bất kỳ console error hoặc TypeScript error nào.
5. Cập nhật `docs/IMPLEMENTATION_ROADMAP.md` và ghi nhận phiên làm việc vào Obsidian Second Brain.
