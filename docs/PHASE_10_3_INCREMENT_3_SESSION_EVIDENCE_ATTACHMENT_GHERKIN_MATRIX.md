# Phase 10.3 Increment 3: Gherkin Test Matrix
## Session Evidence Attachment & Contextual Handoff

---

### Feature 1: Parameter Serialization with `session_id` (`search-utils.ts`)

#### Scenario 1.1: Serialize state chứa `session_id` sang URL query string
```gherkin
Given một SearchExplorerState có:
  | query      | "vật liệu composite" |
  | session_id | "sess-abc-123"       |
  | golden     | true                 |
When hàm buildSearchExplorerUrl được gọi
Then kết quả trả về chứa "session_id=sess-abc-123" và "q=v%E1%BA%ADt+li%E1%BB%87u+composite"
```

#### Scenario 1.2: Parse `session_id` từ URLSearchParams
```gherkin
Given một query string "?q=triz&session_id=sess-xyz-789"
When hàm parseSearchExplorerParams được gọi
Then kết quả trả về object có:
  | query      | "triz"         |
  | session_id | "sess-xyz-789" |
```

#### Scenario 1.3: Build SearchRequest không đính kèm `session_id` thừa
```gherkin
Given một SearchExplorerState có `session_id = "sess-123"`
When hàm buildSearchPayload được gọi
Then object trả về chỉ có `query` và `top_k`, không có trường `session_id` ở root hay trong `filters`
```

---

### Feature 2: Contextual Handoff từ SearchOverlay (`search-overlay.tsx`)

#### Scenario 2.1: Handoff giữ lại `session_id` khi có prop `sessionId`
```gherkin
Given SearchOverlay được mở với `sessionId="sess-456"` và `defaultOpen=true`
When người dùng nhập từ khóa "độ bền" và nhấp nút "Mở trong Search Explorer"
Then Next.js router điều hướng tới "/search?q=%C4%91%E1%BB%99+b%E1%BB%81n&session_id=sess-456"
And SearchOverlay đóng lại
```

#### Scenario 2.2: Handoff không có `session_id` khi hoạt động ở chế độ toàn cục
```gherkin
Given SearchOverlay được mở không có prop `sessionId`
When người dùng nhập từ khóa "độ bền" và nhấp nút "Mở trong Search Explorer"
Then Next.js router điều hướng tới "/search?q=%C4%91%E1%BB%99+b%E1%BB%81n" (không có session_id)
```

---

### Feature 3: Contextual Mode & Evidence Attachment (`semantic-search-explorer.tsx`)

#### Scenario 3.1: Contextual Mode hiển thị affordance quay lại session và action đính kèm
```gherkin
Given người dùng truy cập "/search?q=triz&session_id=sess-789"
When danh sách kết quả tìm kiếm hiển thị
Then xuất hiện liên kết "Quay lại Session" trỏ về "/sessions/sess-789"
And trên mỗi thẻ kết quả có nút "Đính kèm vào Session"
```

#### Scenario 3.2: Nhấp "Đính kèm vào Session" tạo Research Note thành công
```gherkin
Given thẻ kết quả "chk-001" với source_ref "docs/triz.md" đang hiển thị
When người dùng nhấp nút "Đính kèm vào Session"
Then API createResearchNote được gọi với:
  | session_id       | "sess-789"     |
  | note_type        | "insight"      |
  | source_chunk_id  | "chk-001"      |
And nút đính kèm chuyển sang trạng thái "Đã đính kèm" (disabled)
```

#### Scenario 3.3: Standalone Mode không hiển thị các controls của session
```gherkin
Given người dùng truy cập "/search?q=triz" (không có session_id)
When danh sách kết quả tìm kiếm hiển thị
Then không có liên kết "Quay lại Session"
And trên các thẻ kết quả không hiển thị nút "Đính kèm vào Session"
```
