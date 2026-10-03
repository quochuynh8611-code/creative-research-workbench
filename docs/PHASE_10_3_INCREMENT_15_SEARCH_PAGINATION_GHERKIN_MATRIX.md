# Phase 10.3 Increment 15 — Search Pagination / Load More Gherkin Matrix

## Feature: Phân trang và Tải thêm kết quả tìm kiếm (Search Pagination / Load More)

### Scenario 50: Backend nhận offset/limit và trả về phân trang chính xác kèm has_more
```gherkin
Given kho tri thức có 5 chunks phù hợp với query "triz"
When client gửi POST /api/v1/search với query "triz", offset = 0, top_k = 2
Then response trả về 2 kết quả đầu tiên
And total_hits = 5
And offset = 0, limit = 2, has_more = true
When client gửi POST /api/v1/search với query "triz", offset = 2, top_k = 2
Then response trả về 2 kết quả tiếp theo (không trùng lặp với trang 1)
And total_hits = 5
And offset = 2, limit = 2, has_more = true
When client gửi POST /api/v1/search với query "triz", offset = 4, top_k = 2
Then response trả về 1 kết quả cuối cùng
And total_hits = 5
And offset = 4, limit = 2, has_more = false
```

### Scenario 51: Facet counts và total hits ổn định bất biến qua các trang phân trang
```gherkin
Given kho tri thức có 10 chunks phù hợp với query "contradiction"
When client gửi POST /api/v1/search với offset = 5, top_k = 2
Then total_hits vẫn bằng 10
And facet_counts chứa đầy đủ phân bố của toàn bộ 10 chunks
And kết quả trả về đúng 2 chunks ứng với index [5:7]
```

### Scenario 52: Hiển thị nút Tải thêm khi tổng kết quả lớn hơn số lượng hiện tại
```gherkin
Given user đã thực hiện tìm kiếm "năng lượng"
And backend trả về 2 results, total_hits = 5, has_more = true
Then explorer hiển thị danh sách 2 kết quả
And hiển thị nút "Tải thêm kết quả" ở cuối danh sách
```

### Scenario 53: Nhấp Tải thêm gọi API trang kế tiếp và nối thêm kết quả (Append)
```gherkin
Given explorer đang hiển thị 2 kết quả với total_hits = 4
When user nhấp nút "Tải thêm kết quả"
Then api searchKnowledge được gọi với offset = 2, top_k = 10
And explorer cập nhật danh sách hiển thị thành 4 kết quả
And summary metrics vẫn phản ánh đúng total_hits = 4
```

### Scenario 54: Ẩn hoặc disable nút Tải thêm khi đã xem hết toàn bộ kết quả
```gherkin
Given explorer đang hiển thị toàn bộ kết quả (displayed count == total_hits hoặc has_more == false)
Then nút "Tải thêm kết quả" không còn hiển thị (hoặc hiển thị thông báo đã tải hết)
```

### Scenario 55: Backward compatibility khi API response cũ không có has_more hoặc offset
```gherkin
Given API response trả về dạng cũ chỉ có results và total_hits (không có has_more, offset)
When explorer render dữ liệu
Then explorer vẫn hiển thị bình thường danh sách kết quả trang đầu
And không gây lỗi runtime hay crash giao diện
```
