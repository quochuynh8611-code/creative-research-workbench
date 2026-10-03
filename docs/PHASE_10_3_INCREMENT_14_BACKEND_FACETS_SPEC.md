# Phase 10.3 Increment 14 — Backend Facets & Explorer Aggregate Counts Specification

## 1. Executive Summary
Nâng cấp Search API (`POST /api/v1/search`) và Semantic Search Explorer để hỗ trợ **Aggregate Metadata** từ backend:
- `total_hits`: Tổng số kết quả phù hợp trên toàn bộ tập dữ liệu (trước khi cắt theo `top_k`).
- `facet_counts`: Phân bố tần suất theo 4 chiều: `topic`, `source_type`, `phase`, và `golden`.
- Explorer tận dụng aggregate metadata này để hiển thị chính xác tổng số kết quả, phân đoạn nguồn và phân bố chất lượng, đồng thời duy trì 100% backward compatibility khi backend không trả aggregate.

---

## 2. API Contract & Schemas

### 2.1 Backend Contract (`POST /api/v1/search`)

#### Request (`SearchRequest`):
```python
class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    filters: dict[str, Any] | None = None
```

#### Facet Counts Schema (`FacetCounts`):
```python
class FacetCounts(BaseModel):
    topic: dict[str, int] = Field(default_factory=dict)
    source_type: dict[str, int] = Field(default_factory=dict)
    phase: dict[str, int] = Field(default_factory=dict)
    golden: dict[str, int] = Field(default_factory=dict)  # e.g., {"true": 3, "false": 5}
```

#### Response (`SearchResponse`):
```python
class SearchResponse(BaseModel):
    results: list[SearchResultItem]
    latency_ms: float
    total_hits: int = 0
    facet_counts: FacetCounts = Field(default_factory=FacetCounts)
```

---

### 2.2 Frontend TypeScript Contract (`apps/web/lib/types.ts`)

```typescript
export interface FacetCounts {
  topic: Record<string, number>
  source_type: Record<string, number>
  phase: Record<string, number>
  golden: Record<string, number>
}

export interface SearchResponse {
  results: SearchResultItem[]
  latency_ms: number
  total_hits?: number
  facet_counts?: FacetCounts
}
```

---

## 3. Retrieval & Aggregation Strategy

1. **Candidate Set Resolution**:
   - Sau khi thực thi FTS và Vector search với `_apply_filters`, danh sách fused chunk IDs (`fused_ids`) đại diện cho toàn bộ candidate matches thỏa mãn query và filters.
2. **`total_hits` Calculation**:
   - `total_hits = len(fused_ids)`.
   - Kết quả trả về trong `results` bị giới hạn bởi `top_k` (`fused_ids[:top_k]`), nhưng `total_hits` phản ánh tổng số candidate thực tế.
3. **`facet_counts` Calculation**:
   - Dựa trên metadata của toàn bộ candidate chunks trong `fused_ids` (được query/lấy từ `Document` metadata):
     - `topic`: `{ doc.topic: count }`
     - `source_type`: `{ doc.source_type: count }`
     - `phase`: `{ str(doc.phase): count }`
     - `golden`: `{ "true": count_true, "false": count_false }`
4. **Zero Results Handling**:
   - Khi không có match nào (`fused_ids` rỗng) hoặc query rỗng:
     - `results = []`
     - `total_hits = 0`
     - `facet_counts = { topic: {}, source_type: {}, phase: {}, golden: {} }`

---

## 4. Frontend Explorer Integration & Fallback Strategy

1. **Total Hits Resolution**:
   - `effectiveTotalHits = data?.total_hits ?? results.length`
2. **Summary Bar Display**:
   - Tổng kết quả: `<strong>{effectiveTotalHits}</strong> kết quả tìm thấy`.
   - Phân đoạn đang xem: Khi `displayedResults.length !== effectiveTotalHits`, hiển thị `Hiển thị {displayedResults.length} / {effectiveTotalHits} mục`.
3. **Source Buckets & Golden Metrics Resolution**:
   - Source bucket counts: Ưu tiên `data?.facet_counts?.source_type` (fallback sang `sourceCounts` client-side).
   - Golden count: Ưu tiên `data?.facet_counts?.golden?.["true"]` (fallback sang `metrics.goldenCount` client-side).
4. **Backward Compatibility**:
   - Nếu `data.total_hits` hoặc `data.facet_counts` bị thiếu/undefined (ví dụ mock hoặc response cũ), Explorer tự động fallback về client-side derivation như Increment 13 mà không bị crash.
