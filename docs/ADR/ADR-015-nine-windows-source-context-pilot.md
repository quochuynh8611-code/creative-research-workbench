# ADR-015: Frontend Transmission and Validation of TRIZ 9-Windows source_context (Batch C7c-2a Pilot)

## Status
Proposed

## Context
Tiếp nối quyết định kiến trúc tại **ADR-014** (Backend `source_context` JSONB nullable with Discriminated Union), hệ thống Creative Research Workbench đã hỗ trợ cột `source_context` ở tầng cơ sở dữ liệu PostgreSQL và API backend (`/api/v1/sessions/{id}/notes`).

Ở tầng frontend (`apps/web`), ghi chú nghiên cứu (`ResearchNote`) được khởi tạo từ 5 nguồn nghiệp vụ khác nhau. Tuy nhiên, việc triển khai đồng loạt cả 5 nguồn trong một lượt làm tăng đáng kể diện tích tác động (blast radius), nguy cơ xung đột trạng thái bản nháp (`NoteDraft`), và gây khó khăn cho việc cô lập lỗi nếu xảy ra sự cố.

Chủ dự án đã phê chuẩn chiến lược tiếp cận an toàn: **Thực hiện Pilot cho một nguồn duy nhất — Sơ đồ 9 Màn hình TRIZ (`triz_9_windows`)** trong batch **C7c-2a**, trước khi mở rộng cho các nguồn còn lại.

Nguồn TRIZ 9-Windows là ứng viên lý tưởng cho pilot vì:
1. Đã có catalog chuẩn hóa tĩnh 27 ô (3 lenses x 9 windows) với tọa độ cấp bậc (`supersystem`, `system`, `subsystem`) và trục thời gian (`past`, `present`, `future`).
2. Không phụ thuộc vào các tham số động từ mô hình học máy hay kết quả vector search.
3. Luồng lưu vào sổ tay (`onSaveAsNote`) đã có sẵn trên giao diện nhưng hiện tại chỉ ghép chuỗi văn bản vào `content`.

---

## Decision

Nhóm kỹ sư kiến trúc quyết định áp dụng các nguyên tắc kỹ thuật sau cho **Batch C7c-2a Pilot**:

### 1. Phân Tách Scope & Thu Hẹp Phạm Vi Thay Đổi (Scoped Pilot)
- Chỉ có component `TrizNineWindows` (`apps/web/features/triz/triz-nine-windows.tsx`) đóng gói thêm trường `source_context` vào đối tượng `NoteDraft`.
- Bốn nguồn còn lại (`triz_matrix`, `principle_suggestion`, `evidence`, `candidate_solution`) giữ nguyên format payload hiện tại, không thay đổi.
- Chưa triển khai các thành phần giao diện nâng cao như bộ lọc ghi chú theo nguồn (source filter) hay huy hiệu trực quan (source badge) trong danh sách ghi chú (dành cho C7c-2b).

### 2. Định Nghĩa Hợp Đồng Dữ Liệu Type-Safe & Không Ép Kiểu Ngầm
- Định nghĩa rõ variant `Triz9WindowsSourceContext` trong TypeScript:
  - `schema_version: 1` (number).
  - `source_type: 'triz_9_windows'`.
  - `lens`: `'engineering' | 'business' | 'everyday'`.
  - `level`: `'supersystem' | 'system' | 'subsystem'`.
  - `time`: `'past' | 'present' | 'future'`.
  - `cell_label`: `string` ($\le 100$ Unicode code points).
- Dữ liệu đọc từ API (`ResearchNote.source_context`) được khai báo an toàn là `unknown | null` (đồng bộ với `apps/web/lib/types.ts:253`), tuyệt đối không dùng toán tử ép kiểu thiếu căn cứ `as Triz9WindowsSourceContext`.
- Không khai báo các variant nguồn khác như thể đã hỗ trợ ghi.

### 3. Ràng Buộc Khớp Lens Với Dữ Liệu Đang Render & placeholderData
- `lens` trong context bắt buộc phải lấy từ dữ liệu grid đang hiển thị (`data.lens`), chống trường hợp người dùng vừa bấm đổi lăng kính và mạng đang chờ phản hồi mà lại gắn nhãn lens mới cho cell dữ liệu cũ.
- Component sử dụng `placeholderData: (previousData) => previousData` để giữ grid cũ hiển thị trong khi request đổi lens đang tải (tránh layout shift). Mặc dù selector UI có thể đã phản ánh lens mới được chọn, `source_context` vẫn bảo đảm lấy `data.lens` của dữ liệu ô thực tế đang render.

### 4. Định Nghĩa Ngữ Nghĩa "Nguồn Khởi Đầu" (Provenance Origin)
- `source_context` được định nghĩa là **nguồn khởi đầu** tạo cảm hứng cho ghi chú.
- Người dùng chỉnh sửa nội dung văn bản trong `textarea` hoặc thay đổi phân loại `note_type` **KHÔNG** làm mất `source_context`.
- Điều này bảo toàn nguồn gốc tư duy mà vẫn tôn trọng quyền tự do cá nhân hóa ghi chú của người dùng.

### 5. Kỷ Luật Vòng Đời Draft & Bảo Vệ Trạng Thái (Draft Lifecycle & Isolation)
- **Dirty Guard (C4a)**: Tiếp tục duy trì dựa trên sự khác biệt của `content` và `note_type`. Không thêm deep comparison trên `source_context`.
- **Hộp thoại Overwrite**:
  - Hủy ghi đè (`Cancel`): Giữ nguyên vẹn cả ba yếu tố `content`, `note_type`, và `source_context` của draft cũ.
  - Xác nhận ghi đè (`Confirm`): Thay thế đồng bộ cả ba yếu tố bằng dữ liệu từ draft mới.
- **Dọn sạch tàn dư (Zero Residue)**: Sau khi lưu thành công, sau khi bấm hủy nháp, hoặc khi chuyển đổi `sessionId`, draft state được reset sạch sẽ về `null`. Note thủ công tiếp theo không mang context của nháp trước.
- **Phân biệt context vắng mặt với context sai kiểu**:
  - Chỉ khi `source_context` là `null` hoặc `undefined` thì mới được xem là không có context (lưu note thủ công tự do).
  - Mọi giá trị khác (kể cả các giá trị falsy như `false`, `0`, `""`, `NaN`) đều bắt buộc phải đưa qua bộ kiểm thực `validateTriz9WindowsContext`.
  - Nếu context sai kiểu hoặc vi phạm hợp đồng, hệ thống chặn submit `fail-closed`, tuyệt đối không tự ý gỡ bỏ context sai kiểu để lưu lén plain note.

### 6. Kiểm Thực Fail-Closed & Xử Lý Lỗi Phòng Vệ (Defensive Validation & Error Safety)
- **Không tự ý sửa dữ liệu ngầm**: Không dùng `Number()`, `.trim()`, hay cắt chuỗi để che giấu dữ liệu sai quy chuẩn.
- **Chặn tại nguồn**: Nếu cell vi phạm validation (chuỗi rỗng, chứa ký tự điều khiển, sai enum), component nguồn hiển thị thông báo lỗi accessible, không gọi callback và không chuyển tab.
- **Chặn tại submit**: Nếu draft có context không hợp lệ tới được bước submit trong Notebook, form hiển thị lỗi dạng chuỗi, không gọi API `POST`, không tự ý retry bằng cách gỡ bỏ context.
- **An toàn trước lỗi 422 từ FastAPI**:
  - FastAPI trả về lỗi validation dưới dạng mảng đối tượng `detail: [{ loc, msg, type }]`.
  - Component bắt buộc phải chuyển đổi thông báo lỗi thành chuỗi đơn giản trước khi đưa vào React state, ngăn chặn lỗi React runtime crash (`Objects are not valid as a React child`).

---

## Alternatives Considered

### 1. Phương Án Triển Khai Đồng Loạt Cả 5 Nguồn Ngay Từ Đầu
- *Mô tả*: Cùng lúc cập nhật cả 5 component nguồn để truyền `source_context`.
- *Lý do loại bỏ*:
  - Blast radius quá lớn. Nếu có lỗi validation hoặc sai lệch hợp đồng dữ liệu ở 1 nguồn, toàn bộ nhánh frontend sẽ bị ảnh hưởng.
  - Khó khăn trong việc viết kiểm thử hồi quy và diễn tập rollback.
  - Vi phạm nguyên tắc phân rã nhiệm vụ thành các bước nhỏ có thể kiểm chứng độc lập.

### 2. Phương Án Xóa `source_context` Khi Người Dùng Chỉnh Sửa Văn Bản
- *Mô tả*: Nếu người dùng gõ thêm bất kỳ ký tự nào vào `content`, tự động xóa `source_context` và coi như ghi chú tự do.
- *Lý do loại bỏ*:
  - Phá vỡ mục tiêu cốt lõi của tính năng provenance tracking. Hầu hết người dùng khi lưu từ 9-Windows đều muốn bổ sung thêm 1-2 câu nhận xét riêng. Việc xóa sạch context sẽ làm mất liên kết với ô phân tích ban đầu.

### 3. Phương Án Tự Động Fallback Gỡ Bỏ Context Khi Submit Lỗi
- *Mô tả*: Nếu gửi `source_context` bị lỗi validation, tự động retry bằng payload không có context để lưu được ghi chú.
- *Lý do loại bỏ*:
  - Che giấu lỗi hệ thống (silent data loss). Người dùng tưởng rằng ghi chú đã được liên kết với nguồn 9-Windows nhưng thực chất trong DB lại là SQL NULL.
  - Vi phạm nguyên tắc minh bạch và tính toàn vẹn dữ liệu.

---

## Consequences & Risk Analysis

### Tích Cực
- Hoàn thành luồng dữ liệu end-to-end cho nguồn TRIZ 9-Windows từ frontend xuống PostgreSQL database.
- Ngăn ngừa lỗi crash UI khi gặp lỗi API 422 bằng bộ chuyển đổi thông báo lỗi an toàn (safe string conversion).
- Kiểm soát diện tích rủi ro ở mức tối thiểu, không làm ảnh hưởng tới 4 nguồn còn lại và các chức năng hiện hữu (C6 Use insight, C7b Copy clipboard).
- Cung cấp mô hình mẫu (blueprint) chuẩn xác để mở rộng tiếp cho 4 nguồn còn lại trong các batch sau.

### Rủi Ro, Điểm Nhận Thức UX & Giới Hạn Nghiệm Thu
- *Rủi ro*: Người dùng chỉnh sửa nội dung hoàn toàn khác biệt với ô 9-Windows ban đầu nhưng context vẫn giữ nguyên.
  - *Ứng phó*: Đây là hành vi có chủ đích theo định nghĩa "Nguồn khởi đầu" (Provenance Origin). Trong batch C7c-2b, UI sẽ hiển thị nhãn rõ ràng "Khởi tạo từ ô..." thay vì khẳng định nội dung đồng nhất.
- *Lệch pha hiển thị tạm thời khi chuyển lens (`placeholderData`)*:
  - Khi người dùng bấm chuyển lăng kính, selector UI cập nhật sang lens mới ngay, trong khi dữ liệu lưới ô cũ vẫn hiển thị trong thời gian mạng đang tải. Dù logic dữ liệu fail-closed đảm bảo `lens` khớp đúng với ô thực tế đang render (`data.lens`), người dùng có thể nhận thấy sự lệch pha thị giác nếu bấm lưu ngay khoảnh khắc chuyển tiếp.
- *Giới hạn nghiệm thu thủ công tại pilot C7c-2a*:
  - Quá trình kiểm chứng runtime thực tế đã xác nhận tính cô lập dữ liệu (Runtime Data Isolation PASS: note 9-Windows có context đầy đủ, note thủ công tiếp theo mang giá trị SQL NULL chuẩn trong PostgreSQL).
  - Tuy nhiên, do chưa xác nhận người dùng có reload trang hoặc chuyển session giữa 2 lần lưu hay không, hệ thống chưa tuyên bố đã chứng minh same-page immediate reset chỉ thuần túy qua thao tác tay.
- *Phương án Rollback*: Revert commit của C7c-2a đưa frontend về trạng thái không truyền `source_context`, hoàn toàn không ảnh hưởng tới backend runtime hay database revision 006.
