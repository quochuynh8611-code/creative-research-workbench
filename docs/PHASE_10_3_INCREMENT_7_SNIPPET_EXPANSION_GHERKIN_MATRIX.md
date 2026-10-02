# Phase 10.3 Increment 7: Gherkin Test Matrix
## Result Snippet Expansion & Metadata Inspector Toolkit

---

### Scenario 1: Mặc định hiển thị đoạn trích dài ở chế độ thu gọn kèm nút "Xem đầy đủ đoạn trích"
- **Given** kết quả tìm kiếm có đoạn trích `item.excerpt` dài hơn 160 ký tự
- **When** component `SemanticSearchExplorer` render danh sách kết quả
- **Then** đoạn văn được áp dụng class `line-clamp-3`
- **And** xuất hiện nút "Xem đầy đủ đoạn trích"

---

### Scenario 2: Nhấp "Xem đầy đủ đoạn trích" mở rộng toàn văn và chuyển sang nút "Thu gọn đoạn trích"
- **Given** đoạn trích đang ở trạng thái thu gọn
- **When** người dùng nhấp nút "Xem đầy đủ đoạn trích"
- **Then** đoạn văn bỏ class `line-clamp-3` để hiển thị toàn bộ nội dung
- **And** nút chuyển thành "Thu gọn đoạn trích"

---

### Scenario 3: Nhấp "Thu gọn đoạn trích" đóng lại chế độ xem gọn
- **Given** đoạn trích đang ở trạng thái mở rộng
- **When** người dùng nhấp nút "Thu gọn đoạn trích"
- **Then** đoạn văn áp dụng lại class `line-clamp-3`
- **And** nút chuyển về "Xem đầy đủ đoạn trích"

---

### Scenario 4: Đoạn trích ngắn (dưới hoặc bằng 160 ký tự) không hiển thị nút mở rộng thừa
- **Given** kết quả tìm kiếm có `item.excerpt` ngắn (dưới 160 ký tự)
- **When** kết quả được render
- **Then** không xuất hiện nút "Xem đầy đủ đoạn trích"

---

### Scenario 5: Sao chép trích dẫn giàu thông tin (Enriched Markdown Citation)
- **Given** kết quả tìm kiếm có `source_ref="docs/triz_matrix.md"` và điểm tương đồng 95%
- **When** người dùng nhấp nút "Trích dẫn"
- **Then** nội dung sao chép vào clipboard có định dạng: `[docs/triz_matrix.md] (Độ liên quan: 95%)\n"..."`
- **And** nút hiển thị trạng thái "Đã chép"
