# Phase 10.3 Increment 5 Specification: Contextual Evidence Pre-hydration & Duplicate Attachment Guard

## 1. Giới Thiệu & Bối Cảnh
Trong các increment trước của Phase 10.3:
- Increment 1: Xây dựng trang `/search` (Semantic KB Explorer).
- Increment 2: Handoff từ Command-K / SearchOverlay sang `/search`.
- Increment 3: Chế độ Contextual Mode với action đính kèm tài liệu vào Research Session (`createResearchNote`).
- Increment 4: Cầu nối trực tiếp từ `EvidencePanel` sang `/search` với `session_id`.

**Khoảng trống kỹ thuật & UX hiện tại:**
Khi nhà nghiên cứu mở `/search?session_id={sessionId}`, `SemanticSearchExplorer` chỉ duy trì danh sách `attachedChunkIds` trong memory tạm thời của component. Nếu session trước đó đã có các research note hoặc người dùng chuyển qua lại giữa Session Detail và Search Explorer:
1. Explorer không biết những chunk nào đã được lưu trong session, dẫn đến hiển thị nút đính kèm như thể chưa có.
2. Khi người dùng bấm đính kèm lần nữa, request tạo note trùng lặp vẫn được gửi tới backend.
3. Khi reload trang `/search?session_id=...`, trạng thái đã đính kèm bị mất.

---

## 2. Mục Tiêu Cốt Lõi
1. **Contextual Evidence Pre-hydration:** Khi có `session_id`, `SemanticSearchExplorer` tự động tải danh sách notes của session qua `listResearchNotes(sessionId)` và hydrate các `source_chunk_id` vào tập `attachedChunkIds`.
2. **Instant Visual Feedback:** Các kết quả tìm kiếm có `chunk_id` trùng khớp với bất kỳ `source_chunk_id` nào của session sẽ lập tức hiển thị badge `[✓ Đã đính kèm]`.
3. **Duplicate Attachment Guard:** Chặn gọi hàm `createResearchNote` nếu `chunk_id` đã tồn tại trong `attachedChunkIds` hoặc đang trong quá trình gửi request.
4. **Zero-Overhead Standalone Mode:** Khi người dùng truy cập `/search` không kèm `session_id`, hook truy vấn notes sẽ ở trạng thái `enabled: false`, hoàn toàn không phát sinh network request hay ảnh hưởng hiệu năng.

---

## 3. Thiết Kế Kỹ Thuật

### 3.1. Truy vấn & Hydrate Notes trong `semantic-search-explorer.tsx`
```typescript
import { searchKnowledge, createResearchNote, listResearchNotes } from '@/lib/api-client'

// Trong component:
const { data: existingNotesResponse } = useQuery({
  queryKey: ['sessions', sessionId, 'notes'],
  queryFn: () => listResearchNotes(sessionId),
  enabled: Boolean(sessionId),
})

useEffect(() => {
  const rawNotes = (existingNotesResponse as any)?.data || (Array.isArray(existingNotesResponse) ? existingNotesResponse : [])
  if (rawNotes && rawNotes.length > 0) {
    const chunkIdsFromNotes = rawNotes
      .map((n: any) => n.source_chunk_id)
      .filter((id: any): id is string => Boolean(id))

    if (chunkIdsFromNotes.length > 0) {
      setAttachedChunkIds((prev) => {
        const next = new Set(prev)
        chunkIdsFromNotes.forEach((id: string) => next.add(id))
        return next
      })
    }
  }
}, [existingNotesResponse])
```

### 3.2. Duplicate Guard trong Handler Đính Kèm
```typescript
const handleAttachToSession = async (item: SearchResultItem) => {
  if (!sessionId || attachedChunkIds.has(item.chunk_id) || attachingChunkId) return

  try {
    setAttachingChunkId(item.chunk_id)
    const noteContent = `[Trích dẫn từ ${item.source_ref}]\n"${item.excerpt}"`
    await createResearchNote(sessionId, {
      content: noteContent,
      note_type: 'insight',
      source_chunk_id: item.chunk_id,
    })
    setAttachedChunkIds((prev) => new Set(prev).add(item.chunk_id))
  } catch (err) {
    console.error('Lỗi khi đính kèm bằng chứng vào session:', err)
  } finally {
    setAttachingChunkId(null)
  }
}
```

---

## 4. Blast Radius & Tính An Toàn
- **Tác động:** Cực nhỏ, chỉ tinh chỉnh logic state và query trong `SemanticSearchExplorer`.
- **Backend/DB:** Không thay đổi API hay cơ sở dữ liệu.
- **Tương thích ngược:** Giữ nguyên 100% các tính năng hiện có của Standalone Search và Contextual Search.
