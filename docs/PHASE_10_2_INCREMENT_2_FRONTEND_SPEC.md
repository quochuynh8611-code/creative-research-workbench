# Specification: Phase 10.2 Increment 2 — Frontend Cross-Session Discovery Panel

## 1. Giới thiệu & Mục tiêu
- **Mã định danh:** Phase 10.2 (Increment 2 - Frontend UI Integration)
- **Mục tiêu:** Tích hợp giao diện khám phá các phiên nghiên cứu tương đồng (`RelatedSessionsPanel`) vào trang chi tiết phiên nghiên cứu (`SessionDetail`), trực thuộc tab **"Tài liệu & Bằng chứng" (`retrieval`)**.
- **Nguyên tắc cốt lõi:**
  - Zero-Crash: Lỗi mạng/API được cô lập hoàn toàn trong panel, không làm gián đoạn toàn bộ `SessionDetail`.
  - Conditional Fetch: Chỉ kích hoạt query khi có `sessionId` hợp lệ và đang ở tab `retrieval`.
  - Deterministic Empty States: Phân biệt rõ ràng giữa các trạng thái (chưa có problem frame, không có phiên tương đồng, lỗi API).

---

## 2. TypeScript Data Contracts

### 2.1 Types
```typescript
export interface CrossSessionSharedParams {
  improving_parameter?: string
  worsening_parameter?: string
  contradiction_type?: string
  shared_principles?: number[]
}

export interface MatchedSessionItem {
  session_id: string
  title: string
  domain?: string | null
  status: string
  similarity_score: number
  match_reasons: string[]
  shared_parameters: CrossSessionSharedParams
  created_at?: string | null
}

export interface CrossSessionSearchResponse {
  source_session_id: string
  has_problem_frame: boolean
  reason?: string | null
  matched_sessions: MatchedSessionItem[]
  total_candidates_analyzed: number
  latency_ms: number
}
```

### 2.2 API Client Signature
```typescript
export async function findRelatedSessions(
  sessionId: string,
  topK: number = 5,
  minScore: number = 0.1
): Promise<CrossSessionSearchResponse>
```

---

## 3. UI Component Architecture (`RelatedSessionsPanel`)

### 3.1 Props Interface
```typescript
interface RelatedSessionsPanelProps {
  sessionId: string
  isActiveTab?: boolean
  className?: string
}
```

### 3.2 Fetching Strategy
- Sử dụng `@tanstack/react-query`:
  ```typescript
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['cross-session-discovery', sessionId, 5, 0.1],
    queryFn: () => findRelatedSessions(sessionId, 5, 0.1),
    enabled: Boolean(sessionId && sessionId.trim() && isActiveTab),
    staleTime: 60_000,
  })
  ```

### 3.3 Trạng thái UX (UX States)
1. **Loading State:** Skeleton / spinner với thông điệp: *"Đang quét và so khớp các phiên nghiên cứu tương đồng..."*.
2. **No Problem Frame State (`!has_problem_frame || reason === 'no_problem_frame'`):**
   - Banner hướng dẫn: *"Phiên nghiên cứu hiện tại chưa có bài toán TRIZ được cấu trúc. Hãy hoàn tất bước 'Nhập vấn đề' để hệ thống tự động khám phá các phiên liên quan."*
3. **Empty Matched List (`has_problem_frame && matched_sessions.length === 0`):**
   - Banner trung tính: *"Chưa tìm thấy phiên nghiên cứu nào có mâu thuẫn TRIZ hoặc thông số tương tự (trong tổng số {total_candidates_analyzed} phiên đã phân tích)."*
4. **Success State (List of Cards):**
   - Header hiển thị tổng số kết quả khớp (`N phiên liên quan`).
   - Mỗi card hiển thị:
     - `title` kèm link dẫn tới `/sessions/[session_id]`.
     - Badge Domain & Status (`active`, `completed`).
     - Badge điểm tương đồng dạng % (e.g. `85% tương đồng`).
     - Danh sách `match_reasons` trực quan.
     - Danh sách các nguyên tắc TRIZ trùng khớp (`shared_principles`).
5. **Error State (`isError`):**
   - Alert lỗi cục bộ kèm nút **"Thử lại" (`refetch`)**, không làm ảnh hưởng các thành phần khác.
