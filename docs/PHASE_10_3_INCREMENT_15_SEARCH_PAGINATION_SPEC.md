# Phase 10.3 Increment 15 — Search Pagination / Load More Specification

## 1. Executive Summary
Bổ sung cơ chế phân trang / tải thêm (Pagination / Load More) cho Semantic Search (`POST /api/v1/search`) và Semantic Search Explorer:
- **Backend**: Hỗ trợ `offset` (mặc định 0) và `limit` / `top_k` (mặc định 10), trả về `has_more`, `offset`, `limit` cùng với `total_hits` và `facet_counts` bất biến.
- **Frontend Explorer**: Thêm nút "Tải thêm" (Load More) dưới danh sách kết quả, cho phép append thêm kết quả vào in-view state mà không làm sai lệch các chỉ số thống kê (total_hits, facets, metrics).
- **Backward Compatibility**: Tương thích 100% với request cũ (chỉ truyền `top_k`) và response cũ (chưa có trường `has_more`).

---

## 2. Technical Decisions: Offset/Limit vs Cursor
**Quyết định:** Chọn mô hình **Offset/Limit** kết hợp `has_more`.
**Lý do:**
1. **Deterministic Slicing**: Hybrid search RRF tạo ra danh sách ứng viên được xếp hạng `all_fused_ids`. Việc cắt lát `all_fused_ids[offset : offset + limit]` diễn ra tự nhiên, nhanh chóng và không phát sinh chi phí tính toán lại đồ thị cursor.
2. **Blast Radius Nhỏ Gọn**: Không cần thêm opaque token hay phức tạp hóa client-side state.
3. **Phù hợp với UX "Tải thêm"**: Frontend chỉ cần yêu cầu trang tiếp theo với `offset = currentResults.length` và nối danh sách (append).

---

## 3. Contract & Schemas

### 3.1 Backend Contract (`POST /api/v1/search`)

#### Request (`SearchRequest`):
```python
class SearchRequest(BaseModel):
    query: str
    top_k: int = 5                  # Tương đương limit, mặc định 5 hoặc 10
    offset: int = 0                 # Vị trí bắt đầu cắt lát candidate (>= 0)
    limit: int | None = None        # Nếu truyền limit, ưu tiên limit hơn top_k
    filters: dict[str, Any] | None = None
```

#### Response (`SearchResponse`):
```python
class SearchResponse(BaseModel):
    results: list[SearchResultItem]
    latency_ms: float
    total_hits: int = 0
    facet_counts: FacetCounts = Field(default_factory=FacetCounts)
    offset: int = 0
    limit: int = 5
    has_more: bool = False
```

*Công thức tính:*
- `effective_limit = limit if limit is not None else top_k`
- `has_more = (offset + len(results)) < total_hits`

---

### 3.2 Frontend Contract (`apps/web/lib/types.ts`)

```typescript
export interface SearchRequest {
  query: string
  top_k?: number
  offset?: number
  limit?: number
  filters?: Record<string, any>
}

export interface SearchResponse {
  results: SearchResultItem[]
  latency_ms: number
  total_hits?: number
  facet_counts?: FacetCounts
  offset?: number
  limit?: number
  has_more?: boolean
}
```

---

## 4. Retrieval & Slicing Strategy
1. **Candidate Expansion**:
   - `n_candidates = max((offset + effective_limit) * _CANDIDATE_MULTIPLIER, 20)` để đảm bảo cả FTS và Vector search lấy đủ số candidate cho cửa sổ offset.
2. **Total Hits & Facets Invariance**:
   - `total_hits = len(all_fused_ids)` được tính trên toàn bộ tập matches.
   - `facet_counts` được tổng hợp trên toàn bộ `all_fused_ids` độc lập với `offset` và `limit`.
3. **Window Slicing**:
   - `window_ids = all_fused_ids[offset : offset + effective_limit]`
   - Chỉ hydrate metadata và excerpt cho các chunk IDs trong `window_ids`.

---

## 5. Frontend Explorer UX & State Flow

1. **Initial Search**:
   - Khi submit form hoặc đổi query/filters: Reset `results` về rỗng, gọi API với `offset: 0`.
2. **Load More Trigger**:
   - Khi `hasMore === true` (hoặc `results.length < totalHits`), hiển thị nút `Tải thêm kết quả (Hiển thị {results.length}/{totalHits})`.
   - Khi nhấp `Tải thêm`:
     - Bật cờ `isLoadingMore = true`.
     - Gọi `searchKnowledge({ ...payload, offset: results.length, top_k: topK })`.
     - Append kết quả mới vào `results`: `setResults(prev => [...prev, ...newResults])`.
     - Tắt cờ `isLoadingMore = false`.
3. **Edge Cases**:
   - Nếu backend trả về mảng rỗng hoặc `has_more: false`: Nút "Tải thêm" ẩn đi hoặc hiển thị "Đã tải hết kết quả".
   - Bộ lọc hoặc query thay đổi: Luôn xóa kết quả cũ và tải lại từ `offset: 0`.
