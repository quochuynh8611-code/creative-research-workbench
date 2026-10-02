# Phase 10.3 Increment 5: Gherkin Test Matrix
## Contextual Evidence Pre-hydration & Duplicate Attachment Guard

---

### Scenario 1: Tự động truy xuất danh sách research notes của session khi mở Search Explorer ở Contextual Mode
- **Given** người dùng truy cập `/search?q=triz&session_id=sess-123`
- **When** component `SemanticSearchExplorer` khởi tạo
- **Then** API `listResearchNotes` được gọi với `sess-123`
- **And** danh sách các `source_chunk_id` có trong notes được hydrate vào trạng thái đã đính kèm

---

### Scenario 2: Hiển thị ngay badge "Đã đính kèm" cho kết quả tìm kiếm đã tồn tại trong session notes
- **Given** session `sess-123` đã có note với `source_chunk_id="chk-existing-01"`
- **And** kết quả tìm kiếm trả về gồm chunk `chk-existing-01` và chunk `chk-new-02`
- **When** danh sách kết quả được render
- **Then** item `chk-existing-01` hiển thị badge "Đã đính kèm" thay vì nút bấm đính kèm
- **And** item `chk-new-02` hiển thị nút "Đính kèm vào Session"

---

### Scenario 3: Ngăn chặn gửi request đính kèm trùng lặp cho chunk đã tồn tại
- **Given** chunk `chk-existing-01` đã nằm trong tập `attachedChunkIds`
- **When** hàm xử lý đính kèm được gọi với `chk-existing-01`
- **Then** hệ thống không gọi hàm `createResearchNote`
- **And** không phát sinh network mutation dư thừa

---

### Scenario 4: Cho phép đính kèm chunk mới và cập nhật trạng thái UI ngay lập tức
- **Given** chunk `chk-new-02` chưa có trong session notes
- **When** người dùng nhấp nút "Đính kèm vào Session" trên item `chk-new-02`
- **Then** `createResearchNote` được gọi với đúng `sessionId` và `source_chunk_id="chk-new-02"`
- **And** item `chk-new-02` chuyển sang hiển thị badge "Đã đính kèm"

---

### Scenario 5: Standalone Mode không gọi `listResearchNotes` và không làm thay đổi luồng tìm kiếm công khai
- **Given** người dùng truy cập `/search?q=triz` không kèm tham số `session_id`
- **When** component `SemanticSearchExplorer` khởi tạo và hiển thị kết quả
- **Then** API `listResearchNotes` không được gọi
- **And** không có action đính kèm nào xuất hiện trên kết quả
