# ADR-009: Context Mapping: Domain to Nine-Windows Lens

## Status
Proposed

## Context
Trong Creative Research Workbench, Sơ đồ 9 Màn hình TRIZ (`TrizNineWindows`) hỗ trợ 3 lăng kính tư duy: Kỹ thuật (`engineering`), Kinh doanh (`business`), và Đời sống (`everyday`).

Trước Batch C5, mọi session mở Sơ đồ 9 Màn hình (thông qua `NormalizedView` hoặc trang standalone `/triz/nine-windows`) đều mặc định khởi tạo với lăng kính `engineering`. Khi người dùng nghiên cứu một bài toán thuộc lĩnh vực kinh doanh (`business`) hoặc đời sống (`life`), họ buộc phải bấm nút chuyển lăng kính thủ công mỗi lần mở.

Mục tiêu của Batch C5 là tự động chọn lăng kính khởi tạo phù hợp với lĩnh vực (`domain`) của bài toán đã chuẩn hóa (`ProblemFrame.domain`), đồng thời tuyệt đối không ghi đè hoặc can thiệp khi người dùng đã chủ động chuyển lăng kính thủ công.

## Decision
Áp dụng cơ chế **Static Explicit Mapping** thông qua một hàm thuần túy (pure deterministic resolver) `resolveLensFromDomain`:

1. **Pure Resolver**:
   - `resolveLensFromDomain(domain?: string | null): TrizNineWindowsLens`
   - Chuẩn hóa chuỗi domain (trim whitespace, lowercase).
   - So khớp chính xác tuyệt đối (exact matching) theo từ điển ánh xạ tường minh.
   - Không sử dụng regex, substring search hay fuzzy matching.

2. **Bảng Ánh Xạ Tường Minh (Mapping Table)**:
   - `business` ➔ `'business'`
   - `life`, `personal`, `culture`, `society` ➔ `'everyday'`
   - `technical`, `software`, `research`, `education` ➔ `'engineering'`
   - `null`, `undefined`, chuỗi rỗng, khoảng trắng, hoặc domain chưa định nghĩa ➔ `'engineering'` (fail-safe fallback)

3. **Khởi tạo Một Chiều (initialLens-only)**:
   - Thêm prop tùy chọn `initialLens?: TrizNineWindowsLens` vào `TrizNineWindowsProps` (mặc định `'engineering'`).
   - `initialLens` chỉ dùng làm giá trị khởi tạo cho internal state `activeLens`.
   - Tuyệt đối không dùng `useEffect` lắng nghe `domain` để tự reset `activeLens`.
   - Khi component re-render, lựa chọn thủ công của người dùng được bảo toàn 100%.

## Alternatives Considered

1. **Keyword / Fuzzy Substring Mapping**:
   - Phân tích chuỗi con (e.g. chứa "kinh doanh" hoặc "business").
   - *Lý do loại bỏ*: Dễ vỡ (fragile), dễ sinh false positive (ví dụ `business-software` gây xung đột), khó viết unit test tất định.

2. **User-Controlled Initial Lens (Không tự map)**:
   - Giữ nguyên default `engineering`, người dùng tự chọn và hệ thống nhớ tạm.
   - *Lý do loại bỏ*: Không cải thiện trải nghiệm ngữ cảnh (context-aware UX), tăng boilerplate state mà không đem lại giá trị tự động hóa.

3. **Static Explicit Mapping (Được chọn)**:
   - Ánh xạ 1-1 tất định, an toàn, zero side-effect, dễ kiểm thử và tương thích ngược hoàn hảo.

## Consequences

- **Tích cực**:
  - Bài toán kinh doanh tự động mở với lăng kính Kinh doanh.
  - Bài toán đời sống / văn hóa / xã hội tự động mở với lăng kính Đời sống.
  - Bài toán kỹ thuật / phần mềm / nghiên cứu tự động mở với lăng kính Kỹ thuật.
  - Standalone route `/triz/nine-windows` không truyền `initialLens` nên tiếp tục mặc định là `engineering`.
  - Quyền chủ động của người dùng được tôn trọng tối đa: bấm đổi lens thủ công thì không bao giờ bị reset.
- **Tiêu cực**:
  - Không có.

## Reversibility
Quyết định có tính khả nghịch cao (two-way door). Trong trường hợp cần rollback, chỉ cần xóa `resolveLensFromDomain` và bỏ prop `initialLens`, `TrizNineWindows` sẽ quay về mặc định `engineering` như cũ mà không ảnh hưởng backend hay cơ sở dữ liệu.
