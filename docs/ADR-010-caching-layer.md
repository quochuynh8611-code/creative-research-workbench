---
title: "ADR-010 — Lựa chọn Kiến trúc Caching Layer cho Search và Analytics (In-Process TTL Cache)"
topic: "architecture"
source_type: "decision-record"
language: "vi"
tags: ["adr", "caching", "performance", "search", "analytics", "lru", "zero-dependency"]
phase: "12.3"
status: "accepted"
golden: true
created: "2026-11-17"
---

# ADR-010 — Lựa chọn Kiến trúc Caching Layer cho Search và Analytics (In-Process TTL Cache)

## 1. Bối cảnh (Context)

1. Trong hệ thống Creative Research Workbench, hai hot path đọc dữ liệu chính là:
   - **Hybrid Search (`POST /api/v1/search`)**: Gọi External Embedding API (OpenAI/Gemini/Ollama) để tính vector 1536 chiều, thực thi đồng thời full-text search và vector cosine search trên PostgreSQL, thực hiện RRF fusion và aggregate facet counts. Độ trễ trung bình từ 100ms đến 500ms+.
   - **Analytics Overview (`GET /api/v1/analytics/overview`)**: Thực thi tuần tự 10 câu truy vấn SQL aggregation trên 6 bảng của cơ sở dữ liệu.
2. Khi người dùng tương tác thường xuyên (tìm kiếm lặp lại, chuyển trang, xem dashboard), các truy vấn này lặp lại liên tục gây lãng phí chi phí API nhúng và tải không cần thiết lên database.
3. Cần thiết lập một tầng đệm (Caching Layer) để phục vụ các yêu cầu lặp lại tức thì (`< 5ms`).
4. **Ràng buộc Kiến trúc**:
   - Tại `ADR-004` (Phase 12.2), hệ thống đã từ chối đưa Redis / Celery vào kiến trúc nhằm bảo toàn tính tinh gọn hạ tầng (Zero-Infrastructure Overhead) và giảm thiểu rủi ro vận hành.
   - Yêu cầu không thêm dependency mới vào dự án (Zero New Dependencies).

---

## 2. Quyết định Kiến trúc (Architectural Decision)

Chúng tôi quyết định áp dụng **Phương án A: Lightweight In-Process Thread-Safe LRU + TTL Cache** làm nền tảng caching cho Search và Analytics:

1. **Sử dụng Thư viện Chuẩn Python (Pure Standard Library Implementation):**
   - Xây dựng module cache nội tại dựa trên `collections.OrderedDict`, `threading.RLock`, `time.monotonic` và `hashlib`.
   - Hoàn toàn không thêm bất kỳ third-party package nào (như `redis`, `memcached`, hay `cachetools`).
2. **Chiến lược Quản lý Bộ nhớ & Hạn sử dụng (LRU + TTL Policy):**
   - Giới hạn kích thước tối đa (`maxsize=1024` entries) để bảo vệ bộ nhớ RAM của tiến trình backend.
   - Áp dụng TTL khác biệt theo đặc thù nghiệp vụ:
     - Search Cache: TTL = **300 giây (5 phút)**.
     - Analytics Cache: TTL = **60 giây (1 phút)**.
3. **Cơ chế Vô hiệu hóa Có Kiểm Soát (Coordinated Invalidation):**
   - Phân chia namespace rõ ràng: `search:*` và `analytics:*`.
   - Vô hiệu hóa tức thì namespace tương ứng ngay khi phát sinh thao tác ghi/sửa/xóa dữ liệu (Write-through invalidation).
4. **Kỷ luật Dự phòng An toàn (Fail-Safe Graceful Degradation):**
   - Mọi thao tác truy xuất cache đều được bảo vệ trong khối try-except. Nếu xảy ra bất kỳ lỗi nào ở tầng cache, hệ thống tự động fallback trực tiếp về database query gốc, đảm bảo tính sẵn sàng 100% của API.

---

## 3. Các Phương án Đã Cân Nhắc (Options Considered)

### Phương án A (Được chọn): Lightweight In-Process LRU + TTL Cache
- **Ưu điểm:**
  - **Zero Dependency Blast Radius:** Không làm biến đổi `pyproject.toml`, tương thích 100% với môi trường container và CI hiện tại.
  - **Hiệu năng cực đại:** Đọc bộ nhớ trực tiếp trong tiến trình, độ trễ `< 0.1ms` (nhanh gấp hàng chục lần so với mạng IPC/TCP).
  - **Nhất quán với ADR-004:** Giữ nguyên mô hình kiến trúc 3-tier gọn nhẹ.
  - **Dễ kiểm thử:** Chạy độc lập trong pytest unit test mà không cần setup mock server.
- **Đánh giá:** **Chấp thuận (Canonical Choice cho Phase 12.3).**

### Phương án B: Distributed Redis-backed Cache
- **Ưu điểm:** Chia sẻ trạng thái cache giữa nhiều tiến trình Uvicorn worker hoặc multi-node container.
- **Nhược điểm:**
  - Vi phạm định hướng tinh gọn hạ tầng đã thống nhất tại `ADR-004`.
  - Phải bổ sung Redis container vào Docker Compose và cấu hình CI service container.
  - Phải quản lý rủi ro mất kết nối Redis (Network partition, connection pool exhaustion).
  - Tăng độ phức tạp kiểm thử và chi phí vận hành cho mô hình research workbench cục bộ.
- **Đánh giá:** **Bị từ chối.**

### Phương án C: Dùng `functools.lru_cache` thuần túy
- **Ưu điểm:** Có sẵn trong Python.
- **Nhược điểm:**
  - `functools.lru_cache` không hỗ trợ TTL (Time-To-Live). Dữ liệu sẽ tồn tại mãi mãi trong cache cho đến khi bị eviction do đầy bộ nhớ.
  - Khó vô hiệu hóa có chọn lọc theo namespace hoặc theo từng resource.
- **Đánh giá:** **Bị từ chối.**

---

## 4. Đánh Đổi & Hệ Quả (Consequences & Trade-offs)

### Tích cực:
1. **Trải nghiệm tìm kiếm mượt mà:** Người dùng nhận kết quả tìm kiếm trùng lặp hoặc lật trang với tốc độ tức thì (`< 5ms`).
2. **Tiết kiệm chi phí vận hành:** Giảm đáng kể số lượng request gọi embedding API từ xa.
3. **Giảm tải Database:** Giảm thiểu các câu truy vấn aggregation nặng nề trên bảng `chunks` và `sessions`.

### Tiêu cực & Rủi ro:
1. **Không chia sẻ đa tiến trình (Process-local Cache):** Nếu hệ thống chạy đa tiến trình worker (multi-worker process), mỗi worker sẽ duy trì bộ đệm riêng biệt. Với quy mô hiện tại của Research Workbench (single-container backend), đây là sự đánh đổi hoàn toàn hợp lý.
2. **Tiêu tốn bộ nhớ RAM tiến trình:** Mức tiêu tốn được khống chế an toàn nhờ giới hạn cứng `maxsize=1024` (ước tính `< 20MB` RAM).

---

## 5. Kế Hoạch Rollback (Rollback Plan)

Tầng cache được thiết kế theo cơ chế **Opt-in / Configurable**:
1. Có thể tắt hoàn toàn caching thông qua biến môi trường: `ENABLE_CACHE=False`.
2. Khi `ENABLE_CACHE=False`, decorator/service sẽ bypass thẳng xuống truy vấn SQL gốc mà không cần thay đổi cấu trúc bảng hay schema database.
3. Nếu cần revert mã nguồn, chỉ cần loại bỏ các lệnh gọi wrapper caching tại `search.py` và `analytics.py`, không ảnh hưởng tới dữ liệu cơ sở dữ liệu.

---

## 6. Trạng Thái Quyết Định (Status)

- **Trạng thái:** Proposed / Draft (Chờ Founder phê duyệt triển khai cho Batch C28).
