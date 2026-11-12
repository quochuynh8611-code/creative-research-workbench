---
title: "ADR-007 — Tích Hợp Lưu Nội Dung TRIZ 9-Windows Vào Research Notebook"
topic: "frontend-integration"
source_type: "decision-record"
language: "vi"
tags: ["adr", "frontend", "triz", "nine-windows", "notebook", "structuring", "research-note"]
phase: "C3b"
status: "canonical"
golden: true
created: "2026-11-11"
---

# ADR-007 — Tích Hợp Lưu Nội Dung TRIZ 9-Windows Vào Research Notebook

## 1. Bối Cảnh (Context)
Ở Batch C3a (ADR-006), bảng tham chiếu TRIZ 9-Windows đã được tích hợp thành công vào màn hình `NormalizedView` dưới dạng một khối mở rộng/thu gọn (Collapsible Section) ở chế độ thuần chỉ đọc.

Khi phân tích cấu trúc bài toán qua 9 màn hình, nhà nghiên cứu thường phát hiện các ý niệm quan trọng tại một góc nhìn cụ thể (ví dụ: một ràng buộc của siêu hệ thống trong quá khứ hoặc một xu hướng tiến hóa của phân hệ trong tương lai). Trong kiến trúc hiện tại của `creative-research-workbench`:
- Hệ thống đã có cơ chế lưu phát hiện từ các công cụ khác sang `ResearchNotebook` (như trích dẫn từ `EvidencePanel`, nguyên tắc từ `TrizMatrixLookup` và `PrincipleSuggestions`, hay ý tưởng từ `CandidateSolutions`).
- Tất cả đều sử dụng chung một hợp đồng dữ liệu `NoteDraft` (`content`, `note_type`, `source_chunk_id`) và luồng chuyển tiếp liên tab do `SessionDetail` điều phối (`handleSaveAsNote`).
- Tuy nhiên, 9-Windows hiện tại chưa có khả năng kết nối này, khiến người dùng phải ghi chép lại thủ công.

Do đó, Batch C3b cần bổ sung khả năng lưu nội dung từ 9-Windows sang `ResearchNotebook` một cách trực quan, nhất quán và không làm ảnh hưởng đến tính độc lập của component.

---

## 2. Quyết Định Kiến Trúc (Architectural Decision)

Chúng tôi quyết định áp dụng mô hình **Per-Cell Action với Optional Callback Propagation**:

1. **Nút "Lưu vào sổ tay" trên từng Cell (Per-Cell Action)**:
   - Mỗi ô trong 9 ô cửa sổ hiển thị một nút hành động độc lập `"Lưu vào sổ tay"` (icon `Bookmark`) tại chân thẻ.
   - Khi bấm, chỉ nội dung của đúng ô đó được đóng gói thành `NoteDraft` với phân loại mặc định là `'insight'` (phát hiện nghiên cứu) và `source_chunk_id: null`.
   - Chuỗi văn bản markdown được định dạng rõ ràng gồm: tên lăng kính, tọa độ tầng & thời gian, câu hỏi gợi mở, đặc điểm, và ví dụ thực tế (nếu có).

2. **Truyền Callback Tùy Chọn (Optional Callback Chaining)**:
   - Component `TrizNineWindows` nhận prop tùy chọn: `onSaveAsNote?: (draft: NoteDraft) => void`.
   - Component `NormalizedView` nhận prop tùy chọn: `onSaveAsNote?: (draft: NoteDraft) => void` và chuyển tiếp xuống `TrizNineWindows`.
   - `SessionDetail` truyền hàm `handleSaveAsNote` sẵn có vào `NormalizedView`.
   - **Quy tắc hiển thị có điều kiện**: Nút `"Lưu vào sổ tay"` chỉ được render khi `onSaveAsNote` tồn tại (`Boolean(onSaveAsNote) === true`).

3. **Bảo Tồn Tính Độc Lập Cho Route Standalone**:
   - Khi truy cập route độc lập `/triz/nine-windows`, component `TrizNineWindows` được render mà không truyền prop `onSaveAsNote`.
   - Giao diện trên trang độc lập tiếp tục duy trì trạng thái thuần chỉ đọc 100%, không xuất hiện nút lưu, đảm bảo hoàn toàn tính tương thích ngược.

---

## 3. Các Phương Án Đã Cân Nhắc (Alternatives Considered)

| Tiêu chí | Phương án A (Được chọn): Nút Lưu Trên Từng Cell | Phương án B: Một Nút Lưu Toàn Bộ 9 Cell | Phương án C: Chỉ Cho Phép Copy (Clipboard) |
| :--- | :--- | :--- | :--- |
| **UX & Tính tập trung** | **Cao**: Người dùng lưu đúng ô có phát hiện giá trị cho bài toán. | **Thấp**: Nhồi nhét toàn bộ 9 ô vào một note dài hàng nghìn ký tự, gây loãng thông tin. | **Thấp**: Đứt gãy luồng công việc, buộc người dùng tự chuyển tab và dán thủ công. |
| **Nhất quán kiến trúc** | **Rất cao**: Đồng nhất 100% với `EvidencePanel`, `TrizMatrixLookup`, `CandidateSolutions`. | **Trung bình**: Tạo ra một ngoại lệ note dạng batch duy nhất trong hệ thống. | **Kém**: Không tận dụng được hạ tầng draft hiện có của `SessionDetail`. |
| **Phạm vi thay đổi** | Vừa phải: Thêm prop tùy chọn vào 2 component hiển thị và 1 điểm truyền ở `SessionDetail`. | Vừa phải: Cần thêm hàm serializer ghép chuỗi 9 cell ở header. | Cực nhỏ: Chỉ can thiệp nội bộ `triz-nine-windows.tsx`. |

---

## 4. Hệ Quả & Đánh Đổi (Consequences & Trade-offs)

### 4.1. Tích cực (Pros)
- Đóng kín vòng lặp nhận thức: Từ lúc phân tích cấu trúc bài toán (Structuring) qua 9 cửa sổ TRIZ đến lúc ghi lại phát hiện (Capture Insight) trong Notebook diễn ra liền mạch chỉ với 1 click.
- Tận dụng trọn vẹn hạ tầng sẵn có của `SessionDetail` và `ResearchNotebook` (cơ chế preview nháp, banner hủy nháp, phân loại ghi chú, lưu trữ API).
- Giữ vững tính tái sử dụng cao của `<TrizNineWindows />` ở mọi ngữ cảnh (cả trong session lẫn standalone).

### 4.2. Rủi Ro Thực Tế & Biện Pháp Kiểm Soát (Realistic Risks & Mitigations)
1. **Rủi ro trùng lặp ghi chú (Duplicate Notes)**:
   - *Rủi ro*: Nếu người dùng bấm lưu nhiều lần cùng một ô, hệ thống sẽ tạo các bản ghi chú trùng lặp vì API backend không thực hiện deduplication nội dung ghi chú.
   - *Biện pháp*: Luồng `handleSaveAsNote` chuyển người dùng sang form compose của Notebook ở chế độ nháp (`initialDraft`). Người dùng luôn có bước xác nhận và có thể bấm "Hủy nháp" hoặc chỉnh sửa nội dung trước khi lưu thực sự.
2. **Rủi ro chuỗi truyền callback (Callback Chaining Prop-Drilling)**:
   - *Rủi ro*: Phải truyền `onSaveAsNote` qua 2 tầng component (`SessionDetail` → `NormalizedView` → `TrizNineWindows`). Nếu sau này cấu trúc DOM thay đổi, việc truyền prop thủ công có thể bị gián đoạn.
   - *Biện pháp*: Giữ prop là optional với kiểu dữ liệu `NoteDraft` tường minh trong TypeScript, đồng thời có test suite kiểm thử việc chuyển tiếp callback ở từng tầng.
3. **Rủi ro thay đổi props của component dùng chung (`TrizNineWindows`)**:
   - *Rủi ro*: Việc sửa đổi interface của component dùng chung có thể vô tình làm hỏng trang standalone `/triz/nine-windows`.
   - *Biện pháp*: Prop là hoàn toàn optional (`onSaveAsNote?: ...`), đảm bảo khi component được gọi không truyền props (`<TrizNineWindows />`), component hoạt động bình thường như trước.

---

## 5. Tính Khả Nghịch (Reversibility)
Đây là quyết định **hai chiều (Two-way Door)**:
- Tính năng không tạo thêm bảng cơ sở dữ liệu, không thay đổi migration, không tác động lên FSM state machine của `WorkflowEngine`.
- Dữ liệu lưu vào Notebook đơn thuần là các bản ghi `ResearchNote` thông thường với `note_type: 'insight'`.
- Nếu cần thay đổi định dạng hoặc gỡ bỏ tính năng, chỉ cần thu hồi prop và nút bấm hiển thị mà không để lại di chứng dữ liệu hoặc gãy vỡ hệ thống.
