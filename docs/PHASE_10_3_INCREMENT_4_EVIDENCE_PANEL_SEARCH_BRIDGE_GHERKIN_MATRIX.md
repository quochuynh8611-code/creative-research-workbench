# Phase 10.3 Increment 4: Gherkin Test Matrix
## Evidence Panel ↔ Search Explorer Bi-directional Bridge

---

### Scenario 1: Render CTA “Mở trong Search Explorer” trên thanh công cụ Evidence Panel
- **Given** người dùng đang ở tab "Tài liệu & Bằng chứng" của phiên nghiên cứu `session-xyz`
- **When** component `EvidencePanel` được hiển thị
- **Then** nút CTA "Mở trong Search Explorer" xuất hiện trên giao diện
- **And** nút có icon điều hướng trực quan (`ArrowUpRight`)

---

### Scenario 2: Chuyển tiếp sang `/search` với query đang nhập trong ô tìm kiếm
- **Given** người dùng đang ở `EvidencePanel` với `sessionId="session-123"`
- **And** người dùng đã nhập "máy bơm nhiệt mini" vào ô tìm kiếm
- **When** người dùng nhấp nút "Mở trong Search Explorer"
- **Then** router chuyển hướng tới `/search?q=m%C3%A1y+b%C6%A1m+nhi%E1%BB%87t+mini&session_id=session-123`

---

### Scenario 3: Chuyển tiếp sang `/search` với `activeQuery` khi ô tìm kiếm rỗng
- **Given** `EvidencePanel` được khởi tạo với `initialQuery="triz contradiction"`
- **And** ô tìm kiếm hiện đang để trống
- **When** người dùng nhấp nút "Mở trong Search Explorer"
- **Then** router chuyển hướng tới `/search?q=triz+contradiction&session_id=session-123`

---

### Scenario 4: Chuyển tiếp an toàn sang `/search` khi không có query nào
- **Given** `EvidencePanel` không có query tìm kiếm nào và không có `initialQuery`
- **When** người dùng nhấp nút "Mở trong Search Explorer"
- **Then** router chuyển hướng an toàn tới `/search?session_id=session-123`
- **And** không xảy ra lỗi runtime hay exception

---

### Scenario 5: Giữ nguyên tính tương thích ngược và các workflow hiện tại
- **Given** `EvidencePanel` đang hiển thị danh sách bằng chứng đã đính kèm hoặc kết quả tìm kiếm cục bộ
- **When** người dùng thực hiện tìm kiếm nhanh hoặc gỡ đính kèm bằng chứng trong panel
- **Then** các luồng xử lý hiện hữu (Search quick results, Attach/Detach) vẫn hoạt động chính xác
