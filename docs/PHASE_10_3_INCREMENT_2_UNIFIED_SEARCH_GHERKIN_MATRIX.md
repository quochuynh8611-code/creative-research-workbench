# Phase 10.3 Increment 2: Gherkin Test Matrix
## Unified Search Surface & Explorer Handoff

---

### Feature 1: Shared Search Parameters Serializer & Request Builder (`search-utils.ts`)

#### Scenario 1.1: Serialize SearchExplorerState to URL Query String
```gherkin
Given một state tìm kiếm có:
  | query       | "nguyên lý triz" |
  | topic       | "contradiction"  |
  | golden      | true             |
  | source_type | "golden_kb"      |
  | top_k       | 20               |
When hàm buildSearchExplorerUrl được gọi
Then kết quả trả về đường dẫn "/search?q=nguy%C3%AAn+l%C3%BD+triz&topic=contradiction&source_type=golden_kb&golden=true&top_k=20"
And các trường rỗng hoặc mặc định không bị serialize thừa vào URL
```

#### Scenario 1.2: Parse URLSearchParams to Typed SearchExplorerState
```gherkin
Given một URL query string "?q=composite&golden=true&top_k=50&phase=solution"
When hàm parseSearchExplorerParams được gọi
Then kết quả trả về object:
  | query  | "composite" |
  | golden | true        |
  | top_k  | 50          |
  | phase  | "solution"  |
And giá trị boolean golden được ép kiểu boolean chuẩn xác
And giá trị top_k được parse thành số nguyên
```

#### Scenario 1.3: Build SearchRequest Payload from State
```gherkin
Given một SearchExplorerState đầy đủ bộ lọc
When hàm buildSearchPayload được gọi
Then payload trả về có cấu trúc SearchRequest hợp lệ:
  | query   | "mâu thuẫn"                        |
  | top_k   | 10                                 |
  | filters | { topic: "triz", golden: true }    |
```

---

### Feature 2: Quick Search Overlay Handoff (`search-overlay.tsx`)

#### Scenario 2.1: Render CTA "Mở trong Search Explorer" khi có query
```gherkin
Given SearchOverlay đang mở
When người dùng nhập từ khóa "vật liệu nhẹ"
Then xuất hiện nút CTA "Mở trong Search Explorer"
```

#### Scenario 2.2: Click CTA điều hướng sang `/search` và đóng overlay
```gherkin
Given SearchOverlay đang mở với từ khóa "vật liệu nhẹ"
When người dùng nhấp chuột vào nút "Mở trong Search Explorer"
Then Next.js router điều hướng tới "/search?q=v%E1%BA%ADt+li%E1%BB%87u+nh%E1%BA%B9"
And SearchOverlay tự động đóng lại
```

---

### Feature 3: Semantic KB Explorer URL Hydration & Synchronization (`semantic-search-explorer.tsx`)

#### Scenario 3.1: Hydrate trạng thái từ URL parameters khi tải trang
```gherkin
Given người dùng truy cập trực tiếp vào "/search?q=pin+lithium&golden=true&topic=case_study"
When component SemanticSearchExplorer được render
Then ô nhập liệu có giá trị "pin lithium"
And checkbox "Chỉ tài liệu chuẩn vàng" ở trạng thái checked
And dropdown Chủ đề được chọn giá trị "case_study"
And API searchKnowledge được tự động gọi với query "pin lithium" và filters tương ứng
```

#### Scenario 3.2: Reset filters dọn sạch stale params trên URL
```gherkin
Given trang "/search?q=triz&topic=contradiction&golden=true" đang hiển thị kết quả
When người dùng nhấp vào nút "Đặt lại" (Reset filters)
Then các bộ lọc UI trở về trạng thái mặc định
And URL được cập nhật thành "/search?q=triz" (loại bỏ stale topic và golden params)
```
