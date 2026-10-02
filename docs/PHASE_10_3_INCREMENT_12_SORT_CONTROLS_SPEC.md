# Phase 10.3 Increment 12 — In-View Result Ordering & Priority Sort Controls Specification

## 1. Executive Summary
Bổ sung bộ điều khiển sắp xếp ưu tiên (Priority Sort Controls) client-side ngay trong Semantic Search Explorer, cho phép người dùng thay đổi thứ tự ưu tiên đọc tài liệu (Độ liên quan RRF, Ưu tiên Khớp từ khóa, Ưu tiên Chuẩn vàng) mà không cần gọi lại API backend.

---

## 2. Technical Contracts & Types

### 2.1 Sort Modes
```typescript
export type SearchSortMode = 'relevance' | 'keyword_first' | 'golden_first'
```

### 2.2 Pure Helper Contract
```typescript
export function sortSearchResults(
  items: SearchResultItem[],
  sortMode: SearchSortMode,
  query: string
): SearchResultItem[]
```

#### Behavior Rules:
1. **`relevance` (Default)**: Giữ nguyên thứ tự danh sách kết quả (tức thứ tự RRF Score giảm dần từ backend).
2. **`keyword_first`**:
   - Các item có `checkDirectKeywordMatch(query, excerpt, source_ref) === true` được xếp lên trước.
   - Các item trong cùng nhóm (có match hoặc không match) được xếp theo `score` giảm dần.
3. **`golden_first`**:
   - Các item có `metadata.golden === true` được xếp lên trước.
   - Các item trong cùng nhóm (golden hoặc không golden) được xếp theo `score` giảm dần.
4. **Tương thích phân đoạn (Source Bucket Segmentation)**:
   - Sort áp dụng trên tập kết quả sau khi đã lọc theo `activeSourceBucket`.
5. **Bảo toàn trạng thái**:
   - Việc đổi sort mode không làm thay đổi hay reset `submittedQuery`, `activeSourceBucket`, `expandedChunkIds`, hay `attachedChunkIds`.
   - Việc đổi `activeSourceBucket` không làm reset `sortBy` hiện tại.

---

## 3. UI Layout & Accessibility
- Đặt cạnh / cùng hàng với thanh In-View Source Segment Tabs.
- Dropdown select có `aria-label="Sắp xếp kết quả"`.
- Options gồm:
  - `relevance`: "Độ liên quan (RRF)"
  - `keyword_first`: "Ưu tiên khớp từ khóa"
  - `golden_first`: "Ưu tiên chuẩn vàng"
