# Phase 10.3 Increment 8 — Contextual Empty-State Guidance & Actionable Recovery Actions Spec

## 1. Context & Rationale
Trong Search Explorer (`/search`), sau khi thực hiện tìm kiếm mà backend trả về 0 kết quả (`results.length === 0`):
- Trước đây: Chỉ hiển thị một thông báo text tĩnh: *"Không tìm thấy đoạn tri thức nào phù hợp. Hãy thử nới lỏng các bộ lọc..."*, gây dead-end trong luồng nghiên cứu của người dùng.
- Mục tiêu Increment 8: Chuyển đổi trạng thái Empty Results thành **Actionable Recovery Surface**:
  1. **Nới lỏng bộ lọc (Relax Filters CTA)**: Khi có ít nhất 1 bộ lọc đang active (`selectedTopic`, `selectedSourceType`, `goldenOnly`, `selectedPhase`, hoặc `topK !== 10`), hiển thị nút bấm cho phép reset toàn bộ bộ lọc về mặc định (`topic=""`, `source_type=""`, `golden=false`, `phase=""`, `top_k=10`), đồng thời **giữ nguyên từ khóa tìm kiếm `q`** và đồng bộ URL query parameters.
  2. **Quay lại phiên nghiên cứu (Contextual Return CTA)**: Khi đang ở chế độ liên kết session (`session_id`), hiển thị nút CTA điều hướng trực tiếp trở về phiên nghiên cứu tương ứng với đúng tab gốc (`from_tab || 'retrieval'`).
  3. **Không hiển thị CTA thừa**: Khi không có bộ lọc nào active và không ở trong session context, giữ giao diện sạch sẽ, chỉ hiển thị thông điệp hướng dẫn rõ ràng.

## 2. Scope & Behavioral Contract
### A. In-Scope:
- Component: `apps/web/features/search/semantic-search-explorer.tsx`
- Nâng cấp khối `Empty Results State` (`!isLoading && !isError && hasSearched && results.length === 0`):
  - Kiểm tra `hasActiveFilters = Boolean(selectedTopic || selectedSourceType || goldenOnly || selectedPhase || topK !== 10)`.
  - Nếu `hasActiveFilters` là `true`: render button `"Nới lỏng bộ lọc"` kích hoạt `handleResetFilters()`.
  - Nếu `sessionId` tồn tại: render link/button `"Quay lại phiên nghiên cứu"` điều hướng tới `/sessions/${sessionId}?tab=${fromTab || 'retrieval'}`.
- Test Coverage:
  - `apps/web/features/search/__tests__/semantic-search-explorer.test.tsx` (Scenarios 20, 21, 22, 23, 24).

### B. Out-of-Scope:
- Không thay đổi backend API contracts hay database schema.
- Không persist history vào localStorage/sessionStorage.
- Không can thiệp session workflow stepper hoặc các trang khác.

## 3. UI/UX Contract
- Nút "Nới lỏng bộ lọc":
  - Text: `"Nới lỏng bộ lọc"`
  - Variant: Secondary / Outline button với biểu tượng Filter / RotateCcw
  - Hành vi: Reset filter states về mặc định, giữ nguyên `searchInput` / `submittedQuery`, cập nhật URL qua `router.replace(...)`.
- Nút "Quay lại phiên nghiên cứu":
  - Text: `"Quay lại phiên nghiên cứu"`
  - Link đích: `/sessions/${sessionId}?tab=${fromTab || 'retrieval'}`
  - Variant: Outline button với biểu tượng `ArrowLeft` hoặc `Bookmark`.
