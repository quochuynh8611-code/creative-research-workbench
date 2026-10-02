# Phase 10.3 Increment 7 Specification: Result Snippet Expansion & Metadata Inspector Toolkit

## 1. Giới Thiệu & Bối Cảnh
Sau Increment 6, luồng Contextual Search và roundtrip giữa Session Detail và Search Explorer đã hoàn thiện.
Tuy nhiên, trong quá trình nghiên cứu thực tế tại `/search`:
- Các đoạn trích tri thức (chunks) từ 10 Golden Documents và Case Studies thường có độ dài từ 100 đến 350 từ. Hiện tại giao diện hiển thị toàn bộ hoặc bị cắt cụt mà không có cơ chế thu gọn/mở rộng trực quan.
- Nhà nghiên cứu cần khả năng xem chi tiết nguồn gốc metadata (như `topic`, `source_type`, `chunk_id`, hoặc điểm tương đồng) và mở rộng/thu gọn đoạn trích nhanh chóng khi duyệt hàng chục kết quả.

---

## 2. Mục Tiêu Cốt Lõi
1. **Expand/Collapse Snippet Toggle:** Cung cấp nút chuyển đổi "Xem thêm" / "Thu gọn" (`ChevronDown` / `ChevronUp`) cho mỗi đoạn trích kết quả tìm kiếm, giúp giao diện gọn gàng và dễ đọc lướt.
2. **Provenance & Metadata Inspection:** Hiển thị rõ ràng mã định danh đoạn trích (`chunk_id`) và các trường siêu dữ liệu liên quan để nhà nghiên cứu kiểm chứng nguồn gốc.
3. **Enriched Markdown Citation Copy:** Tinh chỉnh chức năng sao chép trích dẫn chuẩn Markdown kèm nguồn gốc tài liệu và điểm tương đồng phần trăm.
4. **Blast Radius Tối Thiểu:** 100% nằm trong UI component `SemanticSearchExplorer`, không can thiệp backend, không đổi database.

---

## 3. Thiết Kế Kỹ Thuật

### 3.1. Quản lý trạng thái mở rộng (`expandedChunkIds`)
```typescript
const [expandedChunkIds, setExpandedChunkIds] = useState<Set<string>>(new Set())

const toggleExpandChunk = (chunkId: string) => {
  setExpandedChunkIds((prev) => {
    const next = new Set(prev)
    if (next.has(chunkId)) {
      next.delete(chunkId)
    } else {
      next.add(chunkId)
    }
    return next
  })
}
```

### 3.2. Hiển thị Excerpt và Nút Xem Thêm / Thu Gọn
```tsx
<div className="space-y-2">
  <p
    className={cn(
      'text-xs text-foreground/90 leading-relaxed bg-muted/20 p-3.5 rounded-xl border border-border/40 font-mono text-[11.5px] transition-all',
      !isExpanded && 'line-clamp-3'
    )}
  >
    {item.excerpt}
  </p>

  {item.excerpt.length > 160 && (
    <button
      type="button"
      onClick={() => toggleExpandChunk(item.chunk_id)}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
    >
      {isExpanded ? (
        <>
          <ChevronUp className="w-3 h-3" />
          <span>Thu gọn đoạn trích</span>
        </>
      ) : (
        <>
          <ChevronDown className="w-3 h-3" />
          <span>Xem đầy đủ đoạn trích</span>
        </>
      )}
    </button>
  )}
</div>
```

---

## 4. Blast Radius & Tính An Toàn
- **Tác động:** Cực nhỏ (Component-level state).
- **Backend/DB:** Giữ nguyên 100%.
- **Hiệu năng:** Tối ưu hóa render danh sách kết quả dài khi mặc định thu gọn các đoạn trích lớn.
