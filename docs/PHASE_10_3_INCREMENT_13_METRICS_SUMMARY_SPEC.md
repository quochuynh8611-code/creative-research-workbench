# Phase 10.3 Increment 13 — Result Distribution Metrics & Quick Context Summary Chips Specification

## 1. Executive Summary
Bổ sung dải metrics summary chips nhỏ gọn trên thanh Summary Bar của Semantic Search Explorer, cung cấp các chỉ số định lượng trực quan (Tổng kết quả, Số item Khớp từ khóa, Số item Chuẩn vàng, Chỉ số hiển thị theo phân đoạn nguồn `Hiển thị D / N mục`) mà không thay đổi contract API hay backend ranking.

---

## 2. Technical Contracts & Types

### 2.1 Metrics Interface
```typescript
export interface ResultDistributionMetrics {
  totalCount: number
  keywordMatchCount: number
  goldenCount: number
}
```

### 2.2 Pure Helper Contract
```typescript
export function calculateResultMetrics(
  results: SearchResultItem[],
  query: string
): ResultDistributionMetrics
```

#### Behavior Rules:
1. **Total Count**: Luôn tương ứng với `results.length`.
2. **Keyword Match Count**:
   - Đếm số lượng item trong `results` thỏa mãn `checkDirectKeywordMatch(query, item.excerpt, item.source_ref) === true`.
   - Chỉ render chip `{N} khớp từ khóa` khi `keywordMatchCount > 0`.
3. **Golden Count**:
   - Đếm số lượng item trong `results` có `item.metadata?.golden === true`.
   - Chỉ render chip `{N} chuẩn vàng` khi `goldenCount > 0`.
4. **Active Source Bucket Display Context**:
   - Khi `activeSourceBucket !== 'all'`, render chip `Hiển thị {displayedResults.length} / {results.length} mục`.
5. **Bảo toàn trạng thái**:
   - Tính toán metrics là pure derive từ `results`, `displayedResults`, `query` và `activeSourceBucket`.
   - Không gây side-effect lên `submittedQuery`, `selectedTopic`, `selectedSourceType`, `goldenOnly`, `sortBy`, `expandedChunkIds` hay `attachedChunkIds`.
