# Phase 10.3 Increment 10 — Result Source Buckets & In-View Quick Segment Tabs Spec

## 1. Context & Rationale
Trong Search Explorer (`/search`), khi một truy vấn trả về nhiều kết quả từ các loại nguồn tri thức khác nhau (`golden_kb`, `case_study`, `system_doc`, v.v.):
- Trước đây: Kết quả hiển thị thành danh sách phẳng (flat list) duy nhất theo điểm relevance score. Người dùng muốn xem riêng một loại nguồn phải cuộn duyệt qua toàn bộ hoặc quay lại sidebar để chọn dropdown lọc (làm kích hoạt API search mới tốn tài nguyên).
- Mục tiêu Increment 10:
  1. **In-View Source Segmentation**: Tự động gom nhóm kết quả theo `source_type` từ metadata hiện có của `SearchResultItem`.
  2. **Quick Segment Tabs**: Render hàng tab phân đoạn ngay dưới Summary Bar khi có từ 2 loại nguồn trở lên trong tập kết quả:
     - Tab `Tất cả ([N])` (active mặc định).
     - Các tab nguồn tri thức kèm badge số lượng: `Golden Knowledge Base ([X])`, `Case Study ([Y])`, v.v.
  3. **Zero API Refetch / Zero State Regress**: Khi chuyển tab phân đoạn:
     - Chỉ lọc danh sách hiển thị trên client (`displayedResults`).
     - Không gửi API request mới.
     - Không làm mất query `q`, active filter chips, hay URL params.
     - Giữ nguyên trạng thái mở rộng trích dẫn (`expandedChunkIds`) và trạng thái đính kèm (`attachedChunkIds`).
  4. **Non-redundant Rendering**: Nếu toàn bộ kết quả trả về chỉ thuộc 1 loại nguồn duy nhất, không render hàng tab phân đoạn để giữ giao diện tinh giản.

## 2. Scope & Behavioral Contract
### A. In-Scope:
- Component: `apps/web/features/search/semantic-search-explorer.tsx`
  - State: `activeSourceBucket: string` (mặc định `'all'`).
  - Derived states: `sourceCounts`, `availableSourceBuckets`, `displayedResults`.
  - Render hàng Segment Tabs UI ngay dưới thanh Summary Bar.
  - Sử dụng `displayedResults` để render danh sách thẻ kết quả.
- Test Coverage:
  - `apps/web/features/search/__tests__/semantic-search-explorer.test.tsx` (Scenarios 28, 29, 30, 31).

### B. Out-of-Scope:
- Không thay đổi backend search API hay database schema.
- Không thay thế bộ lọc ở sidebar (sidebar là bộ lọc server-side; segment tabs là bộ lọc in-view client-side).
- Không persist segment tab state vào URL hay storage.

## 3. UI/UX Contract
- Segment Tabs Bar:
  - Đặt ngay dưới Summary Bar, trước danh sách kết quả.
  - Giao diện segment pill/tabs hiện đại (`bg-muted/40 p-1 rounded-xl border border-border w-fit flex gap-1.5`).
  - Tab active: `bg-background text-foreground shadow-sm font-semibold`.
  - Tab inactive: `text-muted-foreground hover:text-foreground font-semibold`.
  - Badge đếm số lượng: `px-1.5 py-0.2 rounded-full text-[10px] bg-muted font-mono`.
