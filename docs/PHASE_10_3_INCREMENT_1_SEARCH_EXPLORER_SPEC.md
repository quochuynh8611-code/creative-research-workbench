# Specification: Phase 10.3 Increment 1 — Semantic Knowledge Base Explorer

## 1. Giới thiệu & Mục tiêu
- **Mã định danh:** Phase 10.3 (Increment 1 - Search Page & Backend Filters)
- **Mục tiêu:** Cung cấp trang tìm kiếm tri thức chuyên dụng `/search` (Semantic Knowledge Base Explorer) kết hợp mở rộng bộ lọc `golden` và `source_type` tại backend `POST /api/v1/search`.
- **Phạm vi Increment 1:**
  - **Backend:** Mở rộng `RetrievalService._apply_filters` hỗ trợ `golden: boolean` và `source_type: string | list[str]`, bảo đảm 100% tương thích ngược với `topic` và `phase`.
  - **Frontend:** Xây dựng trang độc lập `apps/web/app/search/page.tsx` và feature component `apps/web/features/search/semantic-search-explorer.tsx`.
  - **UX States:** Đầy đủ 5 trạng thái: Initial Blank (kèm Quick Suggestions), Loading, Success Results, Empty Results, và Isolated Error Alert.
  - **Ngoài scope:** Chưa làm attach-to-session, chưa làm save-search persistence vào DB.

---

## 2. API Contract & Filtering Specification

### 2.1 Endpoint
```http
POST /api/v1/search
```

### 2.2 Request Payload Mở rộng
```json
{
  "query": "mâu thuẫn tốc độ và độ bền",
  "top_k": 10,
  "filters": {
    "topic": ["contradiction", "learning"],
    "phase": "1",
    "golden": true,
    "source_type": ["golden_kb", "standard_triz"]
  }
}
```

### 2.3 Filter Rules trong `RetrievalService`
1. `golden`: boolean (`True` hoặc `False`) $\implies$ `Document.golden == bool(golden)`
2. `source_type`: string hoặc list[str] $\implies$ `Document.source_type.in_(source_types)`
3. `topic`: string hoặc list[str] $\implies$ `Document.topic.in_(topics)`
4. `phase`: string $\implies$ `Document.phase == str(phase)`

---

## 3. Frontend Component Architecture

### 3.1 Route
- Path: `apps/web/app/search/page.tsx`
- Layout: 2 cột trên màn hình desktop (Cột trái: Filter Controls / Sidebar; Cột phải: Search Bar + Results List).

### 3.2 Component Breakdown
- `SemanticSearchExplorer`: Main container quản lý query state, filters state, và `@tanstack/react-query` hook.
- `SearchResultCard`: Card hiển thị trích dẫn (`excerpt`), tiêu đề nguồn (`source_ref`), huy hiệu `golden`, `topic`, `source_type`, và điểm số `score` (RRF).
- `QuickSuggestions`: Danh sách gợi ý từ khóa thông dụng khi trang ở trạng thái Initial Blank.

### 3.3 UX States Specification
1. **Initial Blank State (`query === ''`):** Hiển thị màn hình chào đón với mô tả tính năng và các thẻ gợi ý từ khóa nhanh (`QUICK_SUGGESTIONS`).
2. **Loading State (`isLoading`):** Hiển thị skeleton loaders giả lập 3 kết quả tìm kiếm.
3. **Success State (`results.length > 0`):** Hiển thị thanh đếm số lượng kết quả kèm thời gian phản hồi `latency_ms` và danh sách thẻ kết quả.
4. **Empty State (`results.length === 0`):** Thông báo không tìm thấy kết quả và gợi ý nới lỏng bộ lọc.
5. **Error State (`isError`):** Alert lỗi cục bộ kèm nút **"Thử lại" (`refetch`)**.
