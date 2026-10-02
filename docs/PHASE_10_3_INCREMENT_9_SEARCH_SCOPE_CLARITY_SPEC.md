# Phase 10.3 Increment 9 — Active Search Scope Clarity & Removable Filter Chips Bar Spec

## 1. Context & Rationale
Trong Search Explorer (`/search`), khi thực hiện tìm kiếm với nhiều tiêu chí bộ lọc (`topic`, `source_type`, `golden`, `phase`) hoặc trong chế độ contextual (`session_id`), thanh tóm tắt kết quả (`Summary Bar`) trước đây chỉ hiển thị số lượng kết quả và latency.
Người dùng gặp khó khăn trong việc nhận diện nhanh phạm vi tìm kiếm hiện tại và phải quay lại sidebar để hủy từng bộ lọc riêng lẻ.

Mục tiêu Increment 9:
1. **Scope Mode Badge**: Hiển thị rõ chế độ tìm kiếm:
   - Contextual Mode (`session_id` present): `Phiên: [Tên Session]`.
   - Standalone Mode: `Toàn bộ kho tri thức`.
2. **Removable Active Filter Chips**:
   - Khi có bất kỳ bộ lọc nào đang bật (`topic`, `source_type`, `goldenOnly`, `phase`), render các chips tương ứng ngay tại Summary Bar.
   - Mỗi chip có nút `✕` cho phép gỡ bỏ riêng bộ lọc đó một cách trực tiếp.
   - Khi gỡ một chip, giữ nguyên query `q` và các bộ lọc khác, đồng thời đồng bộ URL params và kích hoạt tìm kiếm cập nhật.

## 2. Scope & Behavioral Contract
### A. In-Scope:
- Component: `apps/web/features/search/semantic-search-explorer.tsx`
- Cập nhật khối `Summary & Scope Bar`:
  - Thêm badge phạm vi phiên / kho tri thức.
  - Thêm danh sách Active Filter Chips có nhãn tiếng Việt rõ ràng và nút `✕`.
  - Handler `handleRemoveFilter(key: 'topic' | 'source_type' | 'golden' | 'phase')`.
- Test Coverage:
  - `apps/web/features/search/__tests__/semantic-search-explorer.test.tsx` (Scenarios 24, 25, 26, 27).

### B. Out-of-Scope:
- Không thay đổi backend API / schema.
- Không sửa đổi logic lọc ở sidebar (vẫn giữ đồng bộ 2 chiều).
- Không thêm persistence lưu query history.

## 3. UI/UX Contract
- Scope Badge:
  - Contextual: `inline-flex items-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded-md px-2 py-0.5`
  - Standalone: `inline-flex items-center gap-1 text-[11px] font-semibold bg-muted text-muted-foreground border border-border rounded-md px-2 py-0.5`
- Filter Chips:
  - Topic: `Chủ đề: [Tên chủ đề tiếng Việt]` + nút `✕` (`aria-label="Xóa bộ lọc chủ đề"`)
  - Source Type: `Nguồn: [Tên nguồn]` + nút `✕` (`aria-label="Xóa bộ lọc loại nguồn"`)
  - Golden Only: `Chỉ Golden Documents` + nút `✕` (`aria-label="Xóa bộ lọc Golden Documents"`)
  - Phase: `Phase [X]` + nút `✕` (`aria-label="Xóa bộ lọc Phase"`)
