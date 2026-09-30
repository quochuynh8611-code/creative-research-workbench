# Phase 5.3c — Search & Filter Enhancement (Mini Spec & ADR)

## 1. Bối cảnh
Tại Phase 5.3a & 5.3b, trang `/sessions` đã hoàn thiện đường đọc và tạo session. Tuy nhiên, thanh tìm kiếm (`Search`) hiện tại chỉ lọc đơn giản theo `title` (chưa hỗ trợ tìm theo `tags`, `description`, `domain`), chưa cập nhật số lượng kết quả đang lọc trên header, và khi tìm kiếm không ra kết quả thì chưa có hành động nhanh để xóa bộ lọc ("Xóa tìm kiếm").

Phase 5.3c hoàn thiện trải nghiệm tìm kiếm và lọc danh sách session cục bộ (Client-side Search & Filtering Hardening).

---

## 2. Phạm vi (In-Scope)
- **Multi-field Search:** Tìm kiếm từ khóa đồng thời trên `title`, `description`, `tags` (hỗ trợ cả tìm dạng `#tag` hoặc `tag`), và `domain`.
- **Active Filter Counter:** Cập nhật counter trên Header: hiển thị `${filtered.length} / ${totalCount} sessions` khi đang có từ khóa tìm kiếm.
- **Empty Filter State & Reset Action:** Khi tìm kiếm không có kết quả (`filtered.length === 0` và `search !== ''`), hiển thị thông báo rõ ràng kèm nút `"Xóa tìm kiếm"` để reset nhanh ô search về rỗng.

---

## 3. Non-Goals (Out of Scope)
- Chưa triển khai server-side search qua query param `q` (để dành cho phase tối ưu hóa dataset lớn).
- Chưa bổ sung dropdown multi-select filter theo Status / Domain trên toolbar.
- Không thay đổi backend API contracts hay schema.

---

## 4. Quyết định Thiết kế
1. **Thuật toán lọc đa trường (Multi-field Match):**
   ```typescript
   const q = search.toLowerCase().trim()
   const cleanTagQuery = q.startsWith('#') ? q.slice(1) : q
   const matches = (session: ResearchSession) => {
     if (!q) return true
     const matchTitle = session.title.toLowerCase().includes(q)
     const matchDesc = session.description?.toLowerCase().includes(q) ?? false
     const matchDomain = session.domain?.toLowerCase().includes(q) ?? false
     const matchTags = session.tags?.some(tag =>
       tag.toLowerCase().includes(cleanTagQuery) || tag.toLowerCase().includes(q)
     ) ?? false
     return matchTitle || matchDesc || matchDomain || matchTags
   }
   ```
2. **Counter Header:**
   - Khi không tìm kiếm: `${totalCount} sessions`.
   - Khi đang tìm kiếm (`search.trim() !== ''`): `${filtered.length} / ${totalCount} sessions`.
3. **Empty Filter UX:**
   - Hiển thị nút bấm `"Xóa tìm kiếm"` khi `filtered.length === 0` và `search.trim() !== ''`.
   - Click nút sẽ gọi `setSearch('')` và đưa danh sách về đầy đủ.

---

## 5. Gherkin Scenarios

### Scenario 1: Tìm kiếm theo Tag
```gherkin
Given danh sách có session với tiêu đề "Nghiên cứu pin" và tags ["battery", "ev"]
When người dùng nhập "#battery" hoặc "battery" vào ô tìm kiếm
Then session "Nghiên cứu pin" xuất hiện trong danh sách kết quả
```

### Scenario 2: Tìm kiếm theo Mô tả (Description)
```gherkin
Given danh sách có session với mô tả "Nâng cao hiệu suất chuyển đổi quang năng"
When người dùng nhập "quang năng" vào ô tìm kiếm
Then session tương ứng xuất hiện trong danh sách kết quả
```

### Scenario 3: Cập nhật Counter khi đang lọc
```gherkin
Given tổng cộng có 2 sessions trong danh sách
When người dùng nhập từ khóa tìm kiếm khớp với 1 session
Then header counter hiển thị "1 / 2 sessions"
```

### Scenario 4: Nút "Xóa tìm kiếm" khi không có kết quả
```gherkin
Given người dùng nhập từ khóa "xyz123khongtontai" vào ô tìm kiếm
Then danh sách hiển thị thông báo không tìm thấy kết quả
And xuất hiện nút "Xóa tìm kiếm"
When người dùng bấm nút "Xóa tìm kiếm"
Then ô tìm kiếm được xóa về rỗng
And toàn bộ danh sách sessions ban đầu được hiển thị lại
```

---

## 6. Blast Radius & Test Strategy
- **Blast Radius:** Chỉ tác động file `apps/web/features/session/session-list.tsx` và test file liên quan.
- **Test Strategy (TDD):**
  - Viết 4 failing tests (RED) tương ứng với 4 scenarios trên vào `apps/web/features/session/__tests__/session-list.test.tsx`.
  - Xác nhận tests fail do component hiện tại chưa hỗ trợ tìm theo tag/desc, chưa có counter `X / Y` và chưa có nút `Xóa tìm kiếm`.
