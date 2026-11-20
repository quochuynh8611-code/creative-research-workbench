---
title: "ADR-020 — Batch C39: Multi-Session Batch Export & Archive Architecture"
topic: "architecture-decision-record"
source_type: "adr"
language: "vi"
tags: ["adr", "c39", "batch-export", "zip-archive", "tag-filtering", "data-preservation", "zero-dependency"]
status: "Proposed"
created: "2026-11-20"
---

# ADR-020 — Batch C39: Multi-Session Batch Export & Archive Architecture

## Status

Accepted & Implemented (Batch C39 Close-Out Verified)

## Implementation & Verification Evidence

- **Trạng thái thực thi**: Hoàn thành 100% qua 4 lô tuân thủ nghiêm ngặt kỷ luật Test-First:
  - **Lô 1**: Backend Streaming ZIP Service & API Endpoint (`2c69bd6`)
  - **Lô 2**: Frontend API Client & Accessible BatchExportModal (`146d964`)
  - **Lô 3**: Frontend Multi-Select & SessionList Integration (`d144fb3`)
  - **Lô 4**: E2E Smoke, Documentation & Close-Out
- **Bằng chứng kiểm thử (Test Evidence)**:
  - Backend Suite: **665/665 PASS (100% GREEN)**
  - Frontend Suite: **888/888 PASS across 84 suites (100% GREEN)**
  - Migration & Runtime Suite: **40/40 PASS**
  - Database Schema: **Alembic head 007** (Zero new migration)
  - Dependencies: **Zero new dependencies** (Cả pip và npm)
  - Secret Scan: **0 findings** (Clean)
  - Disk Footprint: **Zero client/server temporary files** (In-memory streaming)

## Context

Sau khi hoàn tất Batch C38 (Founder Product Hardening), sản phẩm Creative Research Workbench đã sở hữu hệ thống gắn thẻ ghi chép chuẩn hóa (`tags` và `note_tags` theo migration 007), hỗ trợ đầy đủ 6 lăng kính 9-Windows, biểu mẫu biên tập bản nháp AI Coach an toàn (Append-Only) và khả năng bảo toàn dữ liệu nháp trước sự cố ngắt kết nối mạng.

Tuy nhiên, trong quá trình vận hành nghiên cứu quy mô lớn, Founder thường tích lũy hàng chục đến hàng trăm phiên nghiên cứu (Research Sessions). Hiện tại, khâu kết xuất dữ liệu chỉ hỗ trợ xuất từng phiên đơn lẻ (`GET /api/v1/sessions/{id}/export?format=md|json`) trực tiếp trên trang chi tiết phiên (`SessionDetail`). Người dùng gặp các rào cản nghiêm trọng:
1. **Thiếu khả năng xuất hàng loạt (No Batch Export)**: Để sao lưu hoặc chuyển giao 30 phiên nghiên cứu, Founder buộc phải mở từng phiên và bấm xuất thủ công 30 lần, tốn nhiều thời gian và dễ bỏ sót.
2. **Không có tệp nén lưu trữ tổng hợp (No Archive Package)**: Chưa có cơ chế đóng gói cấu trúc thư mục chứa tài liệu Markdown tổng quan kèm bản snapshot JSON đầy đủ và siêu dữ liệu tóm lược (`manifest.json`) cho cả dự án.
3. **Chưa tận dụng bộ lọc thẻ C38 và thời gian**: Không thể xuất nhanh một nhóm phiên nghiên cứu theo chuyên đề gắn thẻ (ví dụ: tất cả các phiên có chứa ghi chú gắn thẻ `#pin-lithium` hoặc `#nhiet-dong-hoc`) hoặc theo khoảng thời gian thực hiện (ví dụ: toàn bộ quý 3/2026).
4. **Nguy cơ rác không gian làm việc (Workspace Clutter)**: Sau khi hoàn thành và xuất bản các phiên nghiên cứu cũ, Founder cần một quy trình thuận tiện để chuyển trạng thái các phiên đã xuất sang `archived` nhằm giữ cho danh sách phiên chính gọn gàng mà không bao giờ làm mất dữ liệu.

---

## Decisions

### Decision 1: Streaming Tệp Nén ZIP Trên Bộ Nhớ (In-Memory Zero-Dependency ZIP Streaming) Thay Vì Lưu Tạm Trên Ổ Đĩa

- **Quyết định**:
  - Tận dụng thư viện chuẩn của Python: `zipfile.ZipFile` kết hợp với `io.BytesIO`.
  - Toàn bộ quá trình tạo tệp nén ZIP diễn ra thuần túy trên bộ nhớ RAM (In-Memory Buffer), sau đó được stream trực tiếp về client qua HTTP response:
    - `Content-Type: application/zip`
    - `Content-Disposition: attachment; filename="creative-research-archive-{YYYYMMDD_HHmmss}.zip"`
  - **Tuyệt đối KHÔNG lưu file tạm trên ổ đĩa máy chủ (Zero Disk Footprint)**.
- **Lý do**:
  - **Zero Dependency**: Không cần cài đặt thêm bất kỳ thư viện ngoài nào (như `shutil`, các wrapper nén 3rd-party hay Celery/Redis).
  - **Stateless & Clean**: Không phát sinh rác ổ đĩa (disk leak), không đòi hỏi cơ chế cron/background worker dọn dẹp file tạm, bảo vệ quyền riêng tư và tối ưu hóa tài nguyên.
  - Với quy mô điển hình của Founder (10 đến 100 sessions), kích thước dữ liệu văn bản JSON/Markdown nén chỉ dao động từ vài trăm KB đến tối đa vài MB, xử lý trong RAM chỉ mất < 200ms.

### Decision 2: Thiết Kế Endpoint `POST /api/v1/sessions/batch-export` Hỗ Trợ Cả Chỉ Định Trực Tiếp & Lọc Theo Tiêu Chí

- **Quyết định**:
  - Tạo endpoint mới: `POST /api/v1/sessions/batch-export`.
  - Schema yêu cầu `BatchExportRequest`:
    ```python
    class BatchExportFilter(BaseModel):
        status: Optional[str] = None          # 'active', 'archived', 'all'
        domain: Optional[str] = None          # 'life', 'business', 'healthcare', ...
        tag: Optional[str] = None             # lọc sessions chứa notes có tag này
        date_from: Optional[datetime] = None  # lọc session.created_at >= date_from
        date_to: Optional[datetime] = None    # lọc session.created_at <= date_to
        q: Optional[str] = None               # tìm kiếm theo tiêu đề

    class BatchExportRequest(BaseModel):
        session_ids: Optional[list[UUID]] = None
        filters: Optional[BatchExportFilter] = None
        format: Literal["both", "markdown", "json"] = "both"
        archive_after_export: bool = False
    ```
- **Lý do**:
  - Dùng phương thức `POST` thay vì `GET` vì danh sách `session_ids` có thể chứa hàng chục UUID vượt quá giới hạn an toàn của URL query string, đồng thời cho phép gửi payload JSON có cấu trúc rõ ràng.
  - Hỗ trợ cả 2 chế độ:
    - **Mode A (Explicit Selection)**: Founder chủ động tích chọn $N$ phiên trên giao diện.
    - **Mode B (Filter-Based Bulk)**: Xuất toàn bộ phiên thỏa mãn bộ lọc hiện tại mà không cần tích chọn thủ công.

### Decision 3: Thiết Lập Trần An Toàn Giới Hạn Phiên (Safety Guard Ceiling $\le 100$ Sessions)

- **Quyết định**:
  - Giới hạn cứng số lượng phiên trong 1 lần xuất là **tối đa 100 phiên**.
  - Nếu số phiên thỏa mãn tiêu chí vượt quá 100, backend trả về mã lỗi `HTTP 422 Unprocessable Entity` với thông điệp: `"Số lượng phiên yêu cầu vượt quá giới hạn an toàn (100 phiên). Vui lòng thu hẹp bộ lọc thời gian hoặc thẻ để xuất từng đợt."`
  - Nếu không tìm thấy phiên nào phù hợp (0 phiên), backend trả về `HTTP 404 Not Found` với thông điệp: `"Không tìm thấy phiên nghiên cứu nào phù hợp với tiêu chí xuất."`
- **Lý do**:
  - Ngăn ngừa tình trạng tràn bộ nhớ (Out-Of-Memory) và bảo đảm thời gian phản hồi HTTP luôn dưới 2 giây theo đúng chỉ tiêu hiệu năng của hệ thống.
  - Đảm bảo tính sẵn sàng cao mà không cần đầu tư hệ thống hàng đợi bất đồng bộ phức tạp (Celery/RabbitMQ).

### Decision 4: Cấu Trúc Gói Tệp Nén ZIP & Siêu Dữ Liệu `manifest.json`

- **Quyết định**:
  - Cấu trúc tệp nén ZIP chuẩn hóa:
    ```text
    creative-research-archive-{timestamp}.zip
    ├── manifest.json
    ├── markdown/
    │   ├── {safe_slug}_{short_id}.md
    │   └── ...
    └── json/
        ├── {safe_slug}_{short_id}.json
        └── ...
    ```
  - Tệp `manifest.json` chứa:
    - `archive_version`: "1.0"
    - `exported_at`: ISO 8601 UTC
    - `total_sessions`: Số lượng phiên được đóng gói
    - `applied_filters`: Bản sao tiêu chí lọc đã áp dụng
    - `sessions_index`: Danh mục tóm lược từng phiên gồm: `id`, `title`, `domain`, `status`, `created_at`, `notes_count`, `solutions_count`, `filename_markdown`, `filename_json`.
  - Quy tắc đặt tên tệp: `{safe_slug}_{first_8_chars_of_uuid}.{ext}` (slug được chuẩn hóa chữ thường, thay khoảng trắng và ký tự đặc biệt bằng dấu gạch ngang, cắt ngắn tối đa 50 ký tự) để đảm bảo không trùng lặp và tương thích với mọi hệ điều hành (macOS, Windows, Linux).

### Decision 5: Tái Sử Dụng 100% Logic Xuất Bản Hiện Có (Zero Data Drift)

- **Quyết định**:
  - Tái sử dụng trực tiếp hai hàm cốt lõi đã được kiểm thử nghiêm ngặt trong `session_export_service.py`:
    - `export_session_as_markdown(session, db)`
    - `export_session_as_json(session, db)`
- **Lý do**:
  - **Zero Drift**: Đảm bảo định dạng của từng tệp Markdown và JSON trong file ZIP hoàn toàn đồng nhất với khi người dùng bấm xuất lẻ từ `SessionDetail`.
  - Bảo toàn 100% tính truy nguyên tri thức (Provenance từ ARIZ, Evolution, Resource, AI Coach), các thẻ ghi chép (`tags`), liên kết nguồn (`source_context`), đánh giá giải pháp (`novelty_score`, `feasibility_score`).

### Decision 6: Bảo Toàn Dữ Liệu Tuyệt Đối & Tùy Chọn Lưu Trữ Không Phá Hủy (`archive_after_export`)

- **Quyết định**:
  - **CẤM HARD-DELETE**: Tuyệt đối không xóa bất kỳ dữ liệu nào khỏi cơ sở dữ liệu sau khi xuất.
  - Tham số `archive_after_export` mặc định là `False`.
  - Chỉ khi người dùng chủ động tích chọn `archive_after_export = True`, backend mới cập nhật `status = 'archived'` cho các phiên có trạng thái khác `archived` trong danh sách đã xuất.
  - Thao tác cập nhật trạng thái diễn ra trong cùng một transaction sau khi tệp ZIP đã được sinh thành công trong bộ nhớ. Nếu quá trình tạo ZIP gặp lỗi, transaction sẽ tự động rollback.
- **Lý do**:
  - Tuân thủ hiến pháp dự án về bảo vệ dữ liệu Founder và Golden Data.
  - Giúp dọn dẹp danh sách làm việc mà vẫn giữ nguyên vẹn khả năng khôi phục (Restore) bất cứ lúc nào qua tab "Đã lưu trữ".

### Decision 7: Kiến Trúc Giao Diện — Thanh Công Cụ Đa Tuyển & Modal Xuất Lưu Trữ Tiếp Cận (WCAG 2.1 AA)

- **Quyết định**:
  - Trên `SessionList`:
    - Thêm hộp kiểm (checkbox) chọn phiên trên từng thẻ session card kèm `aria-label="Chọn phiên: {title}"`.
    - Hộp kiểm tổng "Chọn tất cả trên trang hiện tại" / "Bỏ chọn tất cả".
    - Khi có $\ge 1$ phiên được chọn, hiển thị thanh công cụ nổi (Floating Batch Action Toolbar) với chỉ báo số lượng và nút "Xuất lưu trữ".
    - Nút "Xuất hàng loạt" trên thanh công cụ chính cho phép mở `BatchExportModal` để xuất theo bộ lọc ngay cả khi không chọn thủ công từng thẻ.
  - `BatchExportModal`:
    - Hiển thị tóm tắt phạm vi xuất (số phiên đã chọn hoặc số phiên khớp bộ lọc).
    - Lựa chọn định dạng: `Cả Markdown & JSON` (mặc định), `Chỉ Markdown (.md)`, `Chỉ JSON snapshot (.json)`.
    - Bộ lọc bổ sung tùy chọn: Khoảng ngày tạo (`Từ ngày`, `Đến ngày`), lọc theo thẻ ghi chép (`#tag`).
    - Hộp kiểm tùy chọn: `Lưu trữ các phiên này sau khi xuất (Archive)`.
    - Quản lý tiêu điểm (Focus trap) và phím `Escape` để đóng theo chuẩn WCAG 2.1 AA.

---

## Consequences

### Positive
1. **Trải nghiệm Founder vượt trội**: Cho phép sao lưu định kỳ toàn bộ công trình nghiên cứu chỉ bằng 1 cú click chuột.
2. **Zero Blast Radius**: Không thay đổi schema cơ sở dữ liệu (Alembic head giữ nguyên `007`), không thêm dependency, không chạm vào API single-export hiện hữu.
3. **An toàn dữ liệu tuyệt đối**: Không lưu file tạm gây rò rỉ bộ nhớ/ổ đĩa; giao dịch DB nguyên tử; không hard-delete.
4. **Tương thích hoàn hảo**: Tận dụng trực tiếp định dạng Markdown GFM và snapshot JSON đã có, hỗ trợ round-trip import ngược lại từng session trong tương lai.

### Negative / Trade-offs
1. **Giới hạn quy mô (100 sessions/lần)**: Chấp nhận giới hạn đồng bộ trong bộ nhớ để đổi lấy sự đơn giản, tin cậy và zero dependency. Founder có hàng nghìn phiên sẽ cần xuất theo từng đợt thời gian/chủ đề.
2. **Tải bộ nhớ tạm thời**: Khi nén 100 phiên cùng lúc, server có thể sử dụng tạm thời khoảng 30–50MB RAM trong vài trăm mili-giây trước khi giải phóng.
