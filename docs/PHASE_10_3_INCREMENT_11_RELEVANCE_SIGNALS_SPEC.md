# Phase 10.3 Increment 11 — Lightweight Relevance Tiers & Keyword Match Indicators Spec

## 1. Context & Rationale
Trong Search Explorer (`/search`), danh sách kết quả hiện tại chỉ hiển thị điểm số float thô (`Score: 0.9412`). 
Người dùng nghiên cứu cần có tín hiệu trực quan nhanh để:
1. **Phân tầng mức độ liên quan (Relevance Tiers)**: Phân biệt rõ nhóm kết quả có độ tương đồng xuất sắc ($\ge 90\%$), nhóm tốt ($\ge 75\% - < 90\%$), và nhóm tham khảo ($< 75\%$).
2. **Khớp từ khóa trực tiếp (Direct Keyword Match)**: Nhận biết ngay các kết quả có chứa từ khóa của truy vấn trong nội dung trích dẫn (`excerpt`) hoặc tên nguồn (`source_ref`) mà không cần đọc hết văn bản.

## 2. Scope & Behavioral Contract
### A. In-Scope:
- Component: `apps/web/features/search/semantic-search-explorer.tsx`
- Pure Helpers:
  - `getRelevanceTierInfo(score: number)`: Trả về tier (`high` | `good` | `reference`), nhãn tiếng Việt (`Độ khớp cao (XX%)` | `Độ khớp tốt (XX%)` | `Tham khảo (XX%)`), và class styling tương ứng.
  - `checkDirectKeywordMatch(query: string, excerpt: string, sourceRef?: string)`: Kiểm tra case-insensitive sự xuất hiện của các token có độ dài $\ge 3$ ký tự từ `submittedQuery` trong `excerpt` hoặc `source_ref`.
- UI Badges:
  - Relevance Tier Badge hiển thị tại hàng đầu của từng thẻ kết quả.
  - Keyword Match Badge (`Khớp từ khóa`) hiển thị khi `checkDirectKeywordMatch` trả về `true`.
- Test Coverage:
  - `apps/web/features/search/__tests__/semantic-search-explorer.test.tsx` (Scenarios 32, 33, 34, 35).

### B. Out-of-Scope:
- Không thay đổi backend search API hay logic ranking RRF.
- Không thay đổi schema hay database.
- Không làm highlight text phức tạp trong excerpt (giữ excerpt sạch và performance cao).

## 3. UI/UX Contract
- **Relevance Tiers:**
  - $\ge 0.90$: `Độ khớp cao (XX%)` — `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20`
  - $\ge 0.75 \land < 0.90$: `Độ khớp tốt (XX%)` — `bg-primary/10 text-primary border-primary/20`
  - $< 0.75$: `Tham khảo (XX%)` — `bg-muted text-muted-foreground border-border`
- **Keyword Match Badge:**
  - `Khớp từ khóa` — `bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20`
