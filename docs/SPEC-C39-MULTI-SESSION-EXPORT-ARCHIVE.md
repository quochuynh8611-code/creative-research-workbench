---
title: "SPEC-C39 — MULTI-SESSION BATCH EXPORT & ARCHIVE SPECIFICATION"
topic: "export-archive-spec"
source_type: "spec"
language: "vi"
tags: ["c39", "spec", "batch-export", "zip-archive", "tag-filtering", "data-preservation", "test-first", "gherkin"]
status: "canonical"
acceptance_status: "verified"
created: "2026-11-20"
---

# SPEC-C39 — Multi-Session Batch Export & Archive Specification

> Tài liệu đặc tả kỹ thuật chi tiết cho Batch C39: Multi-Session Batch Export & Archive (C39-FEAT-02).
> Tuân thủ quy trình OODA, kỷ luật Test-First, bảo toàn dữ liệu Founder, zero database mutation và zero new dependencies.

---

## 1. Mục Tiêu & Phạm Vi (Scope)

Batch C39 tập trung giải quyết bài toán quản lý, sao lưu và đóng gói tri thức nghiên cứu quy mô lớn cho Founder:
1. **Multi-Session Batch Export**: Xuất đồng thời nhiều phiên nghiên cứu (Research Sessions) được chọn thủ công hoặc theo bộ lọc tìm kiếm.
2. **ZIP Archive Packaging**: Đóng gói toàn bộ tài liệu Markdown GFM và bản snapshot JSON cấu trúc vào một tệp nén `.zip` hoàn chỉnh với siêu dữ liệu danh mục `manifest.json`.
3. **Chuyên Đề Lọc Đa Chiều (Multi-Dimensional Filters)**:
   - Lọc theo thẻ ghi chép (`#tag`) từ hạ tầng C38.
   - Lọc theo khoảng thời gian (`date_from`, `date_to`).
   - Lọc theo lĩnh vực (`domain`) và trạng thái phiên (`status`: `active`, `archived`, `completed`, `all`).
4. **Tùy Chọn Lưu Trữ Không Phá Hủy (Non-Destructive Archive)**:
   - Cung cấp tùy chọn chuyển trạng thái các phiên đã xuất sang `archived` nhằm giữ không gian làm việc gọn gàng.
   - **Cam kết không xóa bất kỳ dữ liệu nào (Zero Hard-Delete)**.
5. **Zero New Dependencies & Zero Database Migration**:
   - Sử dụng thư viện chuẩn của Python (`zipfile`, `io.BytesIO`).
   - Streaming trực tiếp tệp nén về trình duyệt người dùng; không lưu rác trên ổ cứng máy chủ.
   - Giữ nguyên Alembic migration head `007`.

---

## 2. Ranh Giới Ngoài Phạm Vi (Non-Goals)

- Không thêm bất kỳ thư viện ngoài (npm/pip) nào cho nén file (như `archiver`, `shutil` wrappers, `adm-zip`).
- Không thêm hệ thống hàng đợi tác vụ nền (Background Queue: Celery, Redis, BullMQ).
- Không lưu trữ tệp nén trên máy chủ hoặc cloud bucket ngoài (S3, GCS); chỉ stream trực tiếp HTTP response.
- Không cho phép hard-delete bất kỳ phiên nghiên cứu, ghi chú hay giải pháp nào.
- Không can thiệp hoặc thay đổi các endpoints xuất lẻ hiện có (`GET /api/v1/sessions/{id}/export`).

---

## 3. Kiến Trúc & Luồng Dữ Liệu (Architecture & Data Flow)

```
[ Founder / UI ]
       │
       ▼
[ SessionList Selection / Filter Criteria ]
       │
       ▼ (Click "Xuất lưu trữ")
[ BatchExportModal ] (Chọn định dạng, xem trước số lượng, tùy chọn archive)
       │
       ▼ POST /api/v1/sessions/batch-export (Payload: session_ids, filters, format, archive_after_export)
[ FastAPI Endpoint: batch_export_sessions ]
       │
       ├─► 1. Query & Validate matching sessions (Kiểm tra trần an toàn <= 100 sessions)
       │
       ├─► 2. In-Memory ZIP Generation (SessionExportService)
       │        ├── Tái sử dụng export_session_as_markdown(session, db)
       │        ├── Tái sử dụng export_session_as_json(session, db)
       │        └── Sinh manifest.json (Tổng quan, index, applied filters)
       │
       ├─► 3. Atomic Post-Export Status Update (Nếu archive_after_export=True: update status='archived')
       │
       ▼ Stream ZIP binary (Content-Type: application/zip)
[ Browser Client ] ──► Tự động kích hoạt Download file ZIP "creative-research-archive-{timestamp}.zip"
```

---

## 4. Chi Tiết Hợp Đồng API (API Contract)

### 4.1 Endpoint: `POST /api/v1/sessions/batch-export`

- **URL**: `/api/v1/sessions/batch-export`
- **Method**: `POST`
- **Content-Type Request**: `application/json`
- **Content-Type Response**: `application/zip` (hoặc `application/json` khi có lỗi)

#### Request Payload Schema:
```json
{
  "session_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  ],
  "filters": {
    "status": "active",
    "domain": "business",
    "tag": "pin-lithium",
    "date_from": "2026-01-01T00:00:00Z",
    "date_to": "2026-11-20T23:59:59Z",
    "q": "bánh răng"
  },
  "format": "both",
  "archive_after_export": false
}
```

#### Quy Tắc Kiểm Thực (Validation Rules):
1. **Targeting Constraint**: Bắt buộc phải có ít nhất `session_ids` (mảng không rỗng) HOẶC ít nhất 1 tiêu chí trong `filters`. Nếu cả hai đều rỗng hoặc thiếu, trả về `HTTP 400 Bad Request` (`"Phải cung cấp danh sách session_ids hoặc tiêu chí lọc filters."`).
2. **Format Allowed Values**: `both`, `markdown`, `json`. Mặc định: `both`. Nếu sai format, trả về `HTTP 400 Bad Request`.
3. **Safety Ceiling**:
   - Nếu số lượng sessions thỏa mãn $> 100$, hệ thống từ chối xử lý và trả về `HTTP 422 Unprocessable Entity` kèm header `X-Error-Code: EXCEED_BATCH_LIMIT`:
     ```json
     {
       "detail": "Số lượng phiên yêu cầu (124) vượt quá giới hạn an toàn (100 phiên). Vui lòng thu hẹp bộ lọc ngày hoặc thẻ."
     }
     ```
4. **Zero Results**: Nếu không tìm thấy session nào (0 session), trả về `HTTP 404 Not Found` (`"Không tìm thấy phiên nghiên cứu nào phù hợp với tiêu chí."`).

#### Headers Phản Hồi Thành Công (HTTP 200 OK):
- `Content-Type`: `application/zip`
- `Content-Disposition`: `attachment; filename="creative-research-archive-20261120_154500.zip"`
- `X-Exported-Count`: `15`

---

## 5. Quy Chuẩn Đóng Gói Tệp Nén ZIP & `manifest.json`

### 5.1 Cấu Trúc Tệp Nén

```text
creative-research-archive-{YYYYMMDD_HHmmss}.zip
├── manifest.json
├── markdown/
│   ├── thiet-ke-banh-rang_550e8400.md
│   └── giai-phap-pin-dien_6ba7b810.md
└── json/
    ├── thiet-ke-banh-rang_550e8400.json
    └── giai-phap-pin-dien_6ba7b810.json
```
*(Nếu `format == "markdown"`, thư mục `json/` sẽ không được tạo. Nếu `format == "json"`, thư mục `markdown/` sẽ không được tạo).*

### 5.2 Quy Tắc Đặt Tên Tệp
- Tên tệp: `{safe_slug}_{uuid_first_8}.{ext}`
- Hàm sinh `safe_slug`:
  - Chuyển tiếng Việt có dấu sang không dấu (hoặc giữ ký tự ascii a-z0-9).
  - Thay thế toàn bộ ký tự đặc biệt, khoảng trắng, dấu chấm bằng dấu gạch ngang `-`.
  - Loại bỏ các gạch ngang liên tiếp `--`.
  - Cắt tối đa 40 ký tự.
  - Ví dụ: `"Phân tích Mâu thuẫn Pin Lithium (Cực dương & Cực âm)"` -> `"phan-tich-mau-thuan-pin-lithium"` + `_` + `a1b2c3d4` + `.md`.

### 5.3 Cấu Trúc `manifest.json`

```json
{
  "archive_version": "1.0",
  "exported_at": "2026-11-20T15:45:00Z",
  "total_sessions": 2,
  "requested_format": "both",
  "applied_filters": {
    "status": "active",
    "tag": "pin-lithium"
  },
  "sessions_index": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Phân tích mâu thuẫn trong thiết kế bánh răng",
      "domain": "mechanical",
      "status": "active",
      "workflow_state": "ideation",
      "created_at": "2026-11-15T08:30:00Z",
      "notes_count": 5,
      "solutions_count": 2,
      "filename_markdown": "markdown/thiet-ke-banh-rang_550e8400.md",
      "filename_json": "json/thiet-ke-banh-rang_550e8400.json"
    }
  ]
}
```

---

## 6. Đặc Tả Giao Diện Người Dùng (Frontend UX & A11y)

### 6.1 Bổ Sung Trên `SessionList`
1. **Multi-Select Checkboxes**:
   - Mỗi thẻ phiên nghiên cứu có 1 checkbox ở góc trên bên trái:
     `<input type="checkbox" aria-label="Chọn phiên: {title}" checked={selectedIds.has(s.id)} />`
   - Nhấp vào checkbox chỉ kích hoạt chọn/bỏ chọn, không kích hoạt mở trang chi tiết phiên.
2. **Master Select Checkbox**:
   - Đặt trên thanh tiêu đề danh sách: `"Chọn tất cả trên trang này ({count})"` kèm phím tắt hoặc nút bấm.
3. **Floating Batch Action Toolbar**:
   - Xuất hiện khi `selectedIds.size > 0`.
   - Vị trí: Cố định dưới chân màn hình (sticky bottom) hoặc thanh ngang nổi với hiệu ứng chuyển cảnh mượt mà.
   - Hiển thị: `"Đã chọn {N} phiên nghiên cứu"`.
   - Các nút hành động:
     - Nút `"Xuất tệp nén (.zip)"` -> Mở `BatchExportModal` với chế độ `explicit_selection`.
     - Nút `"Bỏ chọn tất cả"` -> Xóa sạch `selectedIds`.
4. **Header Toolbar Action**:
   - Thêm nút `"Xuất lưu trữ hàng loạt"` cạnh nút `"Nhập phiên (JSON)"` trên thanh công cụ chính, cho phép mở modal xuất theo bộ lọc ngay cả khi chưa chọn từng thẻ.

### 6.2 Component `BatchExportModal`
- **Accessibility**:
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby="batch-export-title"`.
  - Bẫy tiêu điểm (Focus Trap) và đóng modal khi nhấn `Escape`.
- **Nội dung Modal**:
  - **Phạm vi xuất**:
    - Nếu mở từ chọn thủ công: `"Đang xuất {N} phiên đã chọn."`
    - Nếu mở từ bộ lọc: `"Xuất toàn bộ phiên phù hợp bộ lọc hiện tại ({count} phiên)."`
  - **Tùy chọn định dạng** (Radio Group hoặc Segmented Buttons):
    - `Cả Markdown & JSON` (Khuyên dùng)
    - `Chỉ tài liệu Markdown (.md)`
    - `Chỉ bản snapshot JSON (.json)`
  - **Tùy chọn bộ lọc bổ sung** (Accordion hoặc Collapsible):
    - Khoảng thời gian: Ô nhập `Từ ngày` và `Đến ngày`.
    - Lọc theo thẻ ghi chép (`#tag`): Dropdown gợi ý danh sách tags phổ biến.
  - **Tùy chọn lưu trữ (Archive)**:
    - Checkbox: `"Đồng thời chuyển các phiên này sang trạng thái Đã lưu trữ (Archived) sau khi tải xuống thành công"` (Mặc định: Unchecked).
    - Đoạn chú thích an toàn: `*Lưu ý: Dữ liệu của bạn được bảo toàn nguyên vẹn và có thể khôi phục bất cứ lúc nào từ tab 'Đã lưu trữ'.`
  - **Nút hành động**:
    - Nút `"Hủy"`
    - Nút `"Tải xuống file ZIP"` (Hiển thị Spinner trạng thái `"Đang nén dữ liệu..."` khi mutation đang chạy).
    - Khi lỗi (ví dụ vượt 100 phiên hoặc lỗi mạng): Hiển thị `role="alert"` với thông điệp rõ ràng và cho phép thử lại.

---

## 7. Ma Trận Kịch Bản Gherkin (BDD Scenarios)

```gherkin
Feature: Multi-Session Batch Export & Archive (C39-FEAT-02)
  Là một Founder quản lý nhiều dự án nghiên cứu
  Tôi muốn xuất hàng loạt phiên nghiên cứu ra một tệp nén ZIP duy nhất
  Để có thể sao lưu an toàn, phân tích ngoại tuyến hoặc chuyển giao toàn bộ tài sản tri thức.

  Background:
    Given cơ sở dữ liệu đã có 5 phiên nghiên cứu:
      | title                              | domain     | status   | tags            |
      | Nghiên cứu Pin Thể Rắn             | mechanical | active   | pin, dien-cuc   |
      | Giải pháp Tản nhiệt Động cơ        | mechanical | active   | tan-nhiet       |
      | Mô hình Kinh doanh Tinh gọn ST25   | business   | active   | kinh-doanh, gao |
      | Tối ưu Vận tải Gạo ĐBSCL           | business   | archived | gao, van-tai    |
      | Nghiên cứu Dinh dưỡng Gạo Huyết Rồng| healthcare | draft    | dinh-duong, gao |

  Scenario: Xuất hàng loạt các phiên được chọn thủ công ra file ZIP chứa cả Markdown và JSON
    When Founder gửi yêu cầu POST /api/v1/sessions/batch-export với:
      | session_ids          | ["id-pin", "id-tan-nhiet"] |
      | format               | both                       |
      | archive_after_export | false                      |
    Then hệ thống trả về mã trạng thái 200 OK
    And Content-Type là "application/zip"
    And Content-Disposition chứa tên tệp ".zip"
    And tệp ZIP chứa tệp "manifest.json" với total_sessions = 2
    And tệp ZIP chứa 2 file trong thư mục "markdown/"
    And tệp ZIP chứa 2 file trong thư mục "json/"
    And trạng thái của 2 phiên nghiên cứu vẫn giữ nguyên là "active"

  Scenario: Xuất theo bộ lọc thẻ ghi chép (Filter by Tag)
    When Founder gửi yêu cầu POST /api/v1/sessions/batch-export với:
      | filters.tag          | gao   |
      | format               | json  |
      | archive_after_export | false |
    Then hệ thống tìm thấy đúng 3 phiên nghiên cứu có chứa thẻ "gao"
    And hệ thống trả về mã 200 OK kèm tệp ZIP
    And tệp ZIP chỉ chứa thư mục "json/" và tệp "manifest.json" (không có "markdown/")
    And manifest.json ghi nhận applied_filters.tag = "gao"

  Scenario: Xuất kèm tùy chọn lưu trữ không phá hủy (Archive after export)
    Given phiên "Nghiên cứu Pin Thể Rắn" có status = "active"
    When Founder gửi yêu cầu POST /api/v1/sessions/batch-export với:
      | session_ids          | ["id-pin"] |
      | archive_after_export | true       |
    Then hệ thống trả về mã 200 OK kèm tệp ZIP
    And phiên "Nghiên cứu Pin Thể Rắn" được cập nhật status = "archived" trong cơ sở dữ liệu
    And không có dữ liệu nào bị xóa

  Scenario: Chặn yêu cầu vượt quá trần an toàn 100 phiên (Safety Ceiling Guard)
    Given cơ sở dữ liệu có 105 phiên nghiên cứu
    When Founder gửi yêu cầu POST /api/v1/sessions/batch-export không có bộ lọc (lấy toàn bộ)
    Then hệ thống từ chối với mã HTTP 422 Unprocessable Entity
    And header phản hồi có "X-Error-Code: EXCEED_BATCH_LIMIT"
    And nội dung thông báo giải thích vượt quá 100 phiên và hướng dẫn thu hẹp phạm vi

  Scenario: Xử lý khi không có phiên nào khớp bộ lọc (Zero Results)
    When Founder gửi yêu cầu POST /api/v1/sessions/batch-export với filter.domain = "nonexistent"
    Then hệ thống trả về mã HTTP 404 Not Found
    And thông điệp thông báo không tìm thấy phiên nghiên cứu nào

  Scenario: Xử lý ngoại lệ mạng khi tải file ZIP trên trình duyệt (Network Resilience)
    Given Founder đang ở màn hình BatchExportModal
    When API client gọi batch-export và gặp lỗi mạng "Failed to fetch"
    Then modal hiển thị thông báo lỗi thân thiện có role="alert"
    And modal KHÔNG tự động đóng để bảo toàn các lựa chọn bộ lọc
    And nút "Thử lại" sẵn sàng cho người dùng kích hoạt
```

---

## 8. Lộ Trình Phân Lô Thực Thi (Proposed Lots Breakdown)

Để kiểm soát chặt chẽ blast radius và duy trì 100% test passing, Batch C39 được chia thành 4 lô thực thi tuần tự:

### Lô 1: Backend Batch Export Service & Streaming API
- **Phạm vi**:
  - `backend/src/app/services/session_export_service.py`: Hàm `create_multi_session_zip_archive`.
  - `backend/src/app/schemas/batch_export.py` (hoặc schemas trong `sessions.py`): Pydantic models `BatchExportFilter`, `BatchExportRequest`.
  - `backend/src/app/api/v1/endpoints/sessions.py`: Route `POST /api/v1/sessions/batch-export`.
  - Hỗ trợ lọc theo `session_ids`, `status`, `domain`, `tag`, `date_from`, `date_to`, `q`.
  - Giới hạn trần an toàn 100 phiên; hỗ trợ tùy chọn `archive_after_export`.
- **Kiểm thử**:
  - `backend/tests/unit/test_batch_export_service.py`
  - `backend/tests/integration/test_c39_batch_export_api.py` (Zero Testcontainers, fast).
- **Ràng buộc**: Zero database migration (Alembic head giữ nguyên `007`), Zero new dependencies.

### Lô 2: Frontend API Client & Accessible BatchExportModal
- **Phạm vi**:
  - `apps/web/lib/api-client.ts`: Hàm `batchExportSessions(request: BatchExportRequest): Promise<Blob>`.
  - `apps/web/features/session/batch-export-modal.tsx`: Component modal chuẩn tiếp cận WCAG 2.1 AA.
  - Xử lý tải xuống file blob với định dạng tên tệp trích xuất từ header `Content-Disposition`.
  - Xử lý các trạng thái: Đang nén (loading spinner), Lỗi mạng (retry alert), Vượt ngưỡng 100 phiên (warning).
- **Kiểm thử**:
  - `apps/web/features/session/__tests__/batch-export-modal.test.tsx` (Test-First Red-Green).

### Lô 3: Frontend Multi-Select & SessionList Integration
- **Phạm vi**:
  - `apps/web/features/session/session-list.tsx`:
    - Checkbox chọn từng thẻ session card.
    - Checkbox "Chọn tất cả trên trang hiện tại".
    - Thanh công cụ nổi `FloatingBatchToolbar`.
    - Nút bấm xuất nhanh theo bộ lọc trên thanh header.
    - Tự động invalidate `['sessions']` query cache nếu `archive_after_export == true`.
- **Kiểm thử**:
  - `apps/web/features/session/__tests__/session-list-batch-export-integration.test.tsx`.

### Lô 4: E2E Verification, Repository Hygiene & Batch Close-Out
- **Phạm vi**:
  - Chạy full regression test suites (Backend 665 tests, Frontend 888 tests).
  - Migration freshness & runtime verification (40 tests, Alembic head 007).
  - Targeted secret scan trên diff C39: 0 findings.
  - Cập nhật tài liệu kỹ thuật: `docs/API_CONTRACTS.md`, `docs/IMPLEMENTATION_ROADMAP.md`, `docs/ADR-020-multi-session-export-archive.md`, `docs/SPEC-C39-MULTI-SESSION-EXPORT-ARCHIVE.md`, `docs/FAILING_INTEGRATION_TEST_SPEC_C39.md`.
  - Nghiệm thu ADR-020 (chuyển sang Accepted & Implemented).

---

## 9. Kết Quả Nghiệm Thu Thực Tế (Acceptance Verification)

- [x] **AC-1 (Explicit Multi-Session ZIP)**: Đạt. File ZIP chứa `manifest.json`, `markdown/`, `json/` cho các session được chọn.
- [x] **AC-2 (Filter-Based Tag Export)**: Đạt. Lọc chính xác các session chứa ghi chú có tag yêu cầu.
- [x] **AC-3 (Non-Destructive Safe Archive)**: Đạt. `archive_after_export = true` cập nhật `status = 'archived'` nguyên tử trong DB mà không làm mất dữ liệu.
- [x] **AC-4 (Safety Ceiling Guard)**: Đạt. Quá 100 sessions trả về HTTP 422 `X-Error-Code: EXCEED_BATCH_LIMIT`.
- [x] **AC-5 (Zero Matching Sessions)**: Đạt. 0 session phù hợp trả về HTTP 404.
- [x] **AC-6 (Empty Request)**: Đạt. Không có session_ids và không có filters trả về HTTP 400.
- [x] **AC-7 (WCAG 2.1 AA BatchExportModal)**: Đạt. Trợ năng đầy đủ, focus trap, escape key, role dialog/alert.
- [x] **AC-8 (Zero Client/Server Temp Files)**: Đạt. In-memory streaming, không tạo file tạm trên disk.
- [x] **AC-9 (UI Multi-Select & Floating Toolbar)**: Đạt. Master checkbox, checkbox từng card, toolbar nổi có `aria-live="polite"`.
- [x] **AC-10 (Full Regression & Zero Migration)**: Đạt. Backend 665/665 PASS, Frontend 888/888 PASS, Alembic head 007, 0 dependencies.
