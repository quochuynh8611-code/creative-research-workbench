# Phase 10.3 Increment 6 Specification: Contextual Session Enrichment, Evidence Counter & Tab-Aware Roundtrip Navigation

## 1. Giới Thiệu & Bối Cảnh
Sau các Increment 1 đến 5 của Phase 10.3:
- Hệ thống đã có trang `/search` (Semantic KB Explorer) độc lập với đầy đủ bộ lọc, handoff từ SearchOverlay, contextual handoff từ `EvidencePanel`, 1-click note attachment và note pre-hydration kèm duplicate guard.

**Mục tiêu Increment 6:**
Hoàn thiện trải nghiệm roundtrip và ngữ cảnh của Contextual Mode:
1. **Tab-Aware Roundtrip:** Khi điều hướng từ `EvidencePanel` (tab "Tài liệu & Bằng chứng") sang `/search`, URL giữ lại tham số `from_tab=retrieval`. Khi người dùng nhấp *"← Quay lại Session"*, hệ thống đưa người dùng về chính xác `/sessions/{sessionId}?tab=retrieval` thay vì nhảy về tab mặc định.
2. **Contextual Session Banner Enrichment:** Thay vì chỉ hiển thị raw UUID của session, Explorer tự động tải thông tin session (`getSession`) để hiển thị tiêu đề nghiên cứu (`session.title`) và nhãn lĩnh vực (`session.domain`).
3. **Real-time Evidence Counter:** Hiển thị bộ đếm số tài liệu/bằng chứng đã đính kèm vào session (`attachedChunkIds.size`) ngay trên contextual header.
4. **Quick Markdown Citation Copy:** Cung cấp nút sao chép nhanh trích dẫn chuẩn Markdown `[source_ref] "excerpt"` trên mỗi card kết quả tìm kiếm với phản hồi trực quan "Đã chép".

---

## 2. Thiết Kế Kỹ Thuật

### 2.1. Mở rộng Search State & URL Utils trong `search-utils.ts`
```typescript
export interface SearchExplorerState {
  query: string
  topic?: string
  source_type?: string
  golden?: boolean
  phase?: string
  top_k?: number
  session_id?: string
  from_tab?: string
}

// buildSearchExplorerUrl:
if (state.from_tab?.trim()) {
  params.set('from_tab', state.from_tab.trim())
}

// parseSearchExplorerParams:
const rawFromTab = getParam('from_tab') || getParam('fromTab') || ''
// ...
from_tab: rawFromTab.trim() || undefined,
```

### 2.2. Handoff từ `evidence-panel.tsx`
```typescript
const handleOpenInExplorer = () => {
  const queryToUse = searchInput.trim() || activeQuery.trim()
  const url = buildSearchExplorerUrl({
    query: queryToUse || undefined,
    session_id: sessionId,
    from_tab: 'retrieval',
  })
  if (router?.push) {
    router.push(url)
  } else if (typeof window !== 'undefined') {
    window.location.href = url
  }
}
```

### 2.3. Tải Session Data & Render Contextual Banner trong `semantic-search-explorer.tsx`
```typescript
import { getSession } from '@/lib/api-client'

const fromTab = initialState.from_tab || 'retrieval'

const { data: sessionData } = useQuery({
  queryKey: ['sessions', sessionId],
  queryFn: () => getSession(sessionId),
  enabled: Boolean(sessionId),
})
```

```tsx
{sessionId && (
  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs">
    <div className="flex items-center gap-2.5">
      <Bookmark className="w-4 h-4 text-primary shrink-0" />
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            {sessionData?.title || 'Phiên nghiên cứu'}
          </span>
          {sessionData?.domain && (
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold">
              {sessionData.domain}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Đã lưu <strong className="text-foreground">{attachedChunkIds.size}</strong> bằng chứng vào sổ tay
        </p>
      </div>
    </div>

    <Link
      href={`/sessions/${sessionId}?tab=${fromTab}`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-border text-foreground hover:bg-muted transition-colors font-medium shadow-sm"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>Quay lại Session</span>
    </Link>
  </div>
)}
```

### 2.4. Quick Copy Citation
```typescript
const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null)

const handleCopyCitation = (item: SearchResultItem) => {
  const citationText = `[${item.source_ref}]\n"${item.excerpt}"`
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(citationText)
    setCopiedChunkId(item.chunk_id)
    setTimeout(() => setCopiedChunkId(null), 2000)
  }
}
```

---

## 3. Blast Radius & Tính An Toàn
- **Phạm vi tác động:** Chỉ nâng cấp tiện ích frontend tại `search-utils.ts`, `semantic-search-explorer.tsx`, và `evidence-panel.tsx`.
- **Backend / Database:** Giữ nguyên 100%, không phát sinh query hay migration mới.
- **Standalone Mode:** Khi không có `session_id`, không gọi `getSession`, không render banner, bảo toàn trọn vẹn hiệu năng.
