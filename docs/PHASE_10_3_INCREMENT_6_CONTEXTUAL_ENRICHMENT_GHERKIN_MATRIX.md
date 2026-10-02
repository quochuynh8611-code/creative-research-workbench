# Phase 10.3 Increment 6: Gherkin Test Matrix
## Contextual Session Enrichment, Evidence Counter & Tab-Aware Roundtrip Navigation

---

### Scenario 1: `buildSearchExplorerUrl` và `parseSearchExplorerParams` hỗ trợ tham số `from_tab`
- **Given** trạng thái tìm kiếm chứa `session_id="sess-123"` và `from_tab="retrieval"`
- **When** gọi hàm `buildSearchExplorerUrl`
- **Then** URL trả về chứa query parameter `from_tab=retrieval`
- **And** hàm `parseSearchExplorerParams` parse chính xác trường `from_tab` từ URL

---

### Scenario 2: `EvidencePanel` handoff sang Search Explorer với `from_tab="retrieval"`
- **Given** người dùng đang ở tab "Tài liệu & Bằng chứng" của session `sess-123`
- **When** người dùng nhấp nút "Mở trong Search Explorer"
- **Then** router chuyển hướng tới `/search?session_id=sess-123&from_tab=retrieval` (kèm query nếu có)

---

### Scenario 3: Contextual Banner hiển thị tiêu đề nghiên cứu, nhãn lĩnh vực và bộ đếm bằng chứng
- **Given** người dùng truy cập `/search?session_id=sess-123&from_tab=retrieval`
- **And** API `getSession` trả về `{ title: "Tối ưu hóa máy bơm nhiệt", domain: "technical" }`
- **And** session hiện có 2 research notes
- **When** component `SemanticSearchExplorer` render
- **Then** banner hiển thị tiêu đề "Tối ưu hóa máy bơm nhiệt", badge "technical"
- **And** dòng thông tin hiển thị "Đã lưu 2 bằng chứng vào sổ tay"

---

### Scenario 4: Nút "Quay lại Session" điều hướng chính xác về tab nguồn (`/sessions/{sessionId}?tab={from_tab}`)
- **Given** người dùng đang ở Contextual Explorer với `session_id="sess-123"` và `from_tab="retrieval"`
- **When** người dùng quan sát nút "Quay lại Session"
- **Then** liên kết `href` của nút trỏ chính xác về `/sessions/sess-123?tab=retrieval`

---

### Scenario 5: Nút Sao chép trích dẫn (Copy Citation) chuẩn Markdown với feedback UI
- **Given** danh sách kết quả tìm kiếm hiển thị một đoạn trích tài liệu
- **When** người dùng nhấp nút "Trích dẫn" (Copy citation)
- **Then** nội dung định dạng `[source_ref]\n"excerpt"` được sao chép vào clipboard
- **And** nút chuyển sang trạng thái "Đã chép"

---

### Scenario 6: Standalone Mode không gọi `getSession` và không render contextual banner
- **Given** người dùng truy cập `/search?q=triz` không kèm `session_id`
- **When** component render
- **Then** hàm `getSession` không được gọi
- **And** không hiển thị contextual banner
