# Phase 10.3 Increment 4 Specification: Evidence Panel ↔ Search Explorer Bi-directional Bridge

## 1. Giới Thiệu & Bối Cảnh
Sau khi hoàn thành Phase 10.3 Increment 1, 2 và 3, hệ thống đã sở hữu trang `/search` (Semantic KB Explorer) độc lập với đầy đủ bộ lọc, khả năng hydrate URL và chế độ Contextual Mode hỗ trợ đính kèm kết quả vào Research Session.

Increment 4 hoàn tất nhịp cầu điều hướng hai chiều: **Cho phép nhà nghiên cứu đang làm việc tại tab "Tài liệu & Bằng chứng" (`EvidencePanel`) trong Session Detail mở trực tiếp không gian tìm kiếm toàn diện tại `/search` với từ khóa hiện tại và ngữ cảnh của phiên nghiên cứu.**

---

## 2. Mục Tiêu Cốt Lõi
1. **Direct Bridge from Evidence Panel:** Cung cấp CTA *"Mở trong Search Explorer"* ngay trên thanh công cụ của `EvidencePanel`.
2. **Contextual Handoff:** Khi nhấp CTA, hệ thống sử dụng `buildSearchExplorerUrl` để tạo đường dẫn chuyển tiếp `/search?q={query}&session_id={sessionId}`.
3. **Query Selection Priority:** Ưu tiên từ khóa người dùng vừa gõ trong ô tìm kiếm (`searchInput`), nếu rỗng thì fallback về từ khóa đang kích hoạt (`activeQuery` / `initialQuery`), nếu cả hai đều rỗng thì chuyển tiếp `/search?session_id={sessionId}`.
4. **Preserve Session Workflow:** Kết hợp với Increment 3, nhà nghiên cứu sau khi sang `/search` có thể dùng bộ lọc sâu, đính kèm các tài liệu bổ sung và nhấp *"← Quay lại Session"* để trở về tiếp tục phiên làm việc.

---

## 3. Thiết Kế Kỹ Thuật

### 3.1. Tích Hợp Navigation trong `evidence-panel.tsx`
```typescript
import { useRouter } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { buildSearchExplorerUrl } from '@/features/search/search-utils'

// Handler chuyển tiếp sang Search Explorer
const handleOpenInExplorer = () => {
  const queryToUse = searchInput.trim() || activeQuery.trim()
  const url = buildSearchExplorerUrl({
    query: queryToUse || undefined,
    session_id: sessionId,
  })
  router.push(url)
}
```

### 3.2. Vị Trí CTA trên Giao Diện
Đặt nút CTA bên cạnh form tìm kiếm nhanh của `EvidencePanel`:
```tsx
<button
  type="button"
  onClick={handleOpenInExplorer}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
>
  <span>Mở trong Search Explorer</span>
  <ArrowUpRight className="w-3.5 h-3.5" />
</button>
```

---

## 4. Blast Radius & Tính An Toàn
- **Tác động:** Cực nhỏ, chỉ bổ sung 1 action button trong `evidence-panel.tsx` và test cases tương ứng.
- **Không thay đổi:** Backend API, database schema, và các component khác.
