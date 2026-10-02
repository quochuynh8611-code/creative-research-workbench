# Phase 10.3 Increment 3 Specification: Session Evidence Attachment & Contextual Handoff

## 1. Giới Thiệu & Bối Cảnh
Sau khi hoàn thành Phase 10.3 Increment 1 & 2 (Trang `/search` Semantic Knowledge Base Explorer và Unified Search Surface / Handoff giữa SearchOverlay và Explorer), Increment 3 hoàn thiện quy trình làm việc khép kín của nhà nghiên cứu: **Đính kèm trích dẫn tri thức trực tiếp vào Research Session hiện hành (Session Evidence Attachment)**.

---

## 2. Mục Tiêu Cốt Lõi
1. **Contextual Search Handoff:**
   - Khi mở `SearchOverlay` trong ngữ cảnh của một session (`sessionId`), nút CTA *"Mở trong Search Explorer"* bảo toàn tham số `session_id` trên URL (`/search?q=...&session_id=UUID`).
2. **Session Contextual Mode tại `/search`:**
   - Khi có `session_id` trên URL, trang `/search` hiển thị badge ngữ cảnh và liên kết *"← Quay lại Session"*.
   - Trên mỗi thẻ kết quả (Search Result Card), hiển thị nút hành động *"Đính kèm vào Session"*.
3. **Evidence / Research Note Attachment:**
   - Khi nhấp *"Đính kèm vào Session"*, hệ thống gọi API `createResearchNote(sessionId, payload)` tạo một ghi chú nghiên cứu loại `insight` chứa trích dẫn, đường dẫn nguồn và điểm tương đồng RRF.
   - Thao tác thành công chuyển nút thành trạng thái disabled và hiển thị badge *"Đã đính kèm"*.
4. **Standalone Mode Backward Compatibility:**
   - Khi không có `session_id` (truy cập `/search` trực tiếp), toàn bộ trải nghiệm giữ nguyên như Increment 2 (không hiển thị nút đính kèm).

---

## 3. Hợp Đồng Dữ Liệu & Giao Tiếp (Contracts)

### 3.1. Cập Nhật `SearchExplorerState` trong `search-utils.ts`
```typescript
export interface SearchExplorerState {
  query: string
  topic?: string
  source_type?: string
  golden?: boolean
  phase?: string
  top_k?: number
  session_id?: string // Mới bổ sung (optional)
}
```

- **`buildSearchExplorerUrl(state)`**: Nếu `state.session_id` có giá trị, serialize thành `&session_id=UUID`.
- **`parseSearchExplorerParams(params)`**: Parse `session_id` từ `params.get('session_id')` hoặc `params.get('sessionId')`.
- **`buildSearchPayload(state)`**: Loại bỏ `session_id` khi gửi payload sang `POST /api/v1/search` để bảo toàn schema backend.

### 3.2. Payload Gọi `createResearchNote`
```typescript
const input: CreateResearchNoteInput = {
  content: `[${item.source_ref}] (Độ liên quan: ${Math.round(item.score * 100)}%)\n${item.excerpt}`,
  note_type: 'insight',
  source_chunk_id: item.chunk_id || null,
}
```

---

## 4. UI/UX Interaction Design

```
+-----------------------------------------------------------------------------------+
|  [← Quay lại Session]   Đang tìm kiếm cho Session: sess-123                       |
+-----------------------------------------------------------------------------------+
|  [Search Input: mâu thuẫn kỹ thuật               ]  [Tìm kiếm]                    |
+-----------------------------------------------------------------------------------+
|  [Sidebar Filters]  |  [Card 1: docs/triz_principles.md]               [92%]     |
|  - Golden Only      |  "Nguyên tắc 1: Phân nhỏ đối tượng..."                      |
|  - Topic            |  [+ Đính kèm vào Session]                                   |
|  - Source Type      |                                                             |
|                     |  [Card 2: docs/case_studies.md]                  [88%]     |
|                     |  "Giải pháp giảm trọng lượng..."                            |
|                     |  [✓ Đã đính kèm] (disabled)                                 |
+-----------------------------------------------------------------------------------+
```
