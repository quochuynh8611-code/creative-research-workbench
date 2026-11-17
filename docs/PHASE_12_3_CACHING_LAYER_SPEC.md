# PHASE 12.3 — CACHING LAYER FOR SEARCH AND ANALYTICS SPECIFICATION

- **Tài liệu:** Đặc tả kỹ thuật & Kiến trúc Hệ thống Caching Layer (Phase 12.3)
- **Dự án:** Creative Research Workbench
- **Giai đoạn:** Phase 12.3 (Quality & Performance Hardening — In-Memory Caching Subsystem)
- **Trạng thái:** 🟡 DRAFT SPEC (Chờ Founder phê duyệt triển khai)
- **Tài liệu tham chiếu:** `docs/ADR-010-caching-layer.md`, `docs/ADR-001-architecture.md`, `docs/ADR-004-async-background-processing.md`
- **Kỷ luật áp dụng:** First-Principles Thinking, Spec-First, Test-First, Zero-New-Dependencies, Fail-Safe Graceful Degradation

---

## 1. Problem Statement & Mục tiêu

### 1.1 Bối cảnh & Điểm nghẽn Hiệu năng (Hot Paths)
Trong Creative Research Workbench:
1. **Search Endpoint (`POST /api/v1/search`)**:
   - Là hot path tốn tài nguyên nhất: Mỗi truy vấn Hybrid Search yêu cầu gọi mô hình nhúng (`EmbeddingClient.embed` tạo vector 1536 chiều qua OpenAI/Gemini/Ollama API), thực thi song song 2 câu truy vấn SQL (`_fts_search` trên tsvector và `_vector_search` cosine distance `<=>`), tính toán xếp hạng RRF fusion trong Python, và truy vấn aggregate `facet_counts` (topic, source_type, phase, golden).
   - Độ trễ dao động từ **100ms đến 500ms+** cho mỗi truy vấn, gây lãng phí chi phí API và slot database khi người dùng lặp lại cùng một truy vấn tìm kiếm hoặc chuyển đổi phân trang.
2. **Analytics Overview Endpoint (`GET /api/v1/analytics/overview`)**:
   - Thực thi tuần tự **10 câu truy vấn SQL aggregation** (`count`, `group_by`, `distinct`, `outerjoin`) quét qua 6 bảng (`research_sessions`, `problem_frames`, `research_notes`, `candidate_solutions`, `documents`, `chunks`, `contradictions`).
   - Khi khối lượng dữ liệu nghiên cứu tăng trưởng, việc tính toán lại toàn bộ chỉ số cho mỗi lượt xem dashboard làm tăng tải không cần thiết lên PostgreSQL.

### 1.2 Mục tiêu Phase 12.3
1. **Tăng tốc phản hồi (Latency Reduction)**: Giảm độ trễ cho các truy vấn Search và Analytics lặp lại xuống dưới **5ms** (phục vụ từ bộ nhớ in-process).
2. **Tiết kiệm tài nguyên (Resource Conservation)**: Cắt giảm tới 80% các lời gọi External Embedding API và database queries dư thừa đối với các truy vấn trùng lặp.
3. **Kỷ luật Zero-New-Dependencies**: Sử dụng thư viện chuẩn của Python (`collections.OrderedDict`, `threading.Lock`, `time.monotonic`, `hashlib`), không bổ sung Redis, memcached hay các thư viện bên ngoài, bảo toàn triệt để nguyên tắc tinh gọn hạ tầng đã cam kết tại `ADR-004`.
4. **An toàn & Bền bỉ (Fail-Safe & Graceful Degradation)**: Mọi sự cố phát sinh tại tầng cache (hết bộ nhớ, lỗi serialization, cache miss) đều tự động fallback 100% về truy vấn cơ sở dữ liệu gốc mà không gây gián đoạn API hay trả về HTTP 500.

---

## 2. Phạm vi (Scope & Boundaries)

### Trong phạm vi (In-Scope):
1. Xây dựng module Caching Layer nội tại `app.core.cache` (hoặc `app.infrastructure.caching`):
   - Hỗ trợ LRU eviction policy với tham số `maxsize`.
   - Hỗ trợ TTL (Time-To-Live) theo từng namespace.
   - Thread-safe thông qua reentrant lock (`threading.RLock`).
2. Tích hợp caching cho `RetrievalService` / `POST /api/v1/search`:
   - Deterministic cache key generation từ: `query`, `top_k`, `offset`, `filters`.
   - Cấu hình TTL mặc định: **300 giây (5 phút)**.
3. Tích hợp caching cho `AnalyticsService` / `GET /api/v1/analytics/overview`:
   - Cache key theo namespace `analytics:overview`.
   - Cấu hình TTL mặc định: **60 giây (1 phút)**.
   - Hỗ trợ query parameter `refresh=true` để chủ động bypass cache và làm mới dữ liệu.
4. Cơ chế vô hiệu hóa bộ đệm (Cache Invalidation):
   - Invalidate namespace `search` khi có thay đổi dữ liệu Knowledge Base (Upload document, Update document, Delete document).
   - Invalidate namespace `analytics` khi có thay đổi trong Sessions, Notes, Solutions, hoặc Documents.
5. Bộ kiểm thử toàn diện (Unit tests cho Cache Engine, Integration tests cho API contracts và Gherkin scenarios).

### Ngoài phạm vi (Out-of-Scope / Non-Goals):
1. Không triển khai Redis cluster hay distributed cache broker (tuân thủ ADR-004).
2. Không can thiệp cấu hình PostgreSQL server hay bảng `alembic_version`.
3. Không can thiệp Frontend UI (Next.js sẽ tự động hưởng lợi từ độ trễ phản hồi thấp của backend).

---

## 3. Kiến trúc Caching Đề Xuất (Architecture & Key Strategy)

### 3.1 Chiến lược Cache Engine (In-Process Thread-Safe LRU + TTL)
Module cache nội tại quản lý các phần tử dưới dạng:
```
CacheEntry = (value, expires_at: float)
```
- Khi đọc (`get`): Nếu `time.monotonic() > expires_at` -> xóa phần tử, trả về `None` (Cache Miss). Nếu còn hạn -> chuyển key lên đầu `OrderedDict` (LRU) và trả về `value` (Cache Hit).
- Khi ghi (`set`): Nếu số lượng phần tử vượt quá `maxsize` -> loại bỏ phần tử ít được sử dụng nhất (oldest item).
- Khi vô hiệu hóa (`invalidate`): Hỗ trợ xóa theo prefix/namespace hoặc xóa toàn bộ (`clear`).

### 3.2 Chiến lược Sinh Khóa (Deterministic Cache Key Generation)
1. **Search Key**:
   ```python
   # Chuẩn hóa filters thành chuỗi JSON sắp xếp thứ tự keys
   normalized_filters = json.dumps(filters or {}, sort_keys=True)
   raw_key = f"search:{query.strip().lower()}:{top_k}:{offset}:{normalized_filters}"
   cache_key = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
   ```
2. **Analytics Key**:
   ```python
   cache_key = "analytics:overview:global"
   ```

### 3.3 Ma trận Invalidation Triggers

| Hành động Người dùng / Hệ thống | Namespace Bị Vô Hiệu Hóa | Phương thức Thực thi |
| :--- | :--- | :--- |
| `POST /api/v1/documents/upload` | `search`, `analytics` | Invalidate đồng bộ sau khi commit DB / Background job xong |
| `PUT /api/v1/documents/{id}` | `search`, `analytics` | Invalidate đồng bộ sau khi re-chunking/embedding |
| `DELETE /api/v1/documents/{id}` | `search`, `analytics` | Invalidate đồng bộ sau khi cascade delete |
| `POST /api/v1/sessions` (Create/Update/Delete) | `analytics` | Invalidate namespace `analytics` |
| `POST /api/v1/sessions/{id}/notes` | `analytics` | Invalidate namespace `analytics` |
| `POST /api/v1/sessions/{id}/solutions` | `analytics` | Invalidate namespace `analytics` |
| Hết hạn TTL (300s search / 60s analytics) | Từng key riêng lẻ | Tự động loại bỏ khi `get()` kiểm tra thời gian |
| Gọi `GET /api/v1/analytics/overview?refresh=true` | `analytics:overview:global` | Bypass cache, ghi đè giá trị mới vào cache |

---

## 4. Hợp đồng API (API Contracts)

1. **`POST /api/v1/search`**:
   - Header trả về: Bổ sung header chẩn đoán `X-Cache: HIT` hoặc `X-Cache: MISS`.
   - Payload: Không thay đổi cấu trúc `SearchResponse`. Trường `latency_ms` phản ánh thời gian thực tế (với Cache HIT thường `< 2ms`).
2. **`GET /api/v1/analytics/overview`**:
   - Query parameter tùy chọn: `refresh: bool = False`.
   - Header trả về: Bổ sung header chẩn đoán `X-Cache: HIT` hoặc `X-Cache: MISS`.
   - Payload: Không thay đổi cấu trúc `AnalyticsOverviewResponse`. Trường `generated_at` phản ánh thời điểm dữ liệu được sinh ra và nạp vào cache.

---

## 5. Gherkin Scenarios cho Phase 12.3

```gherkin
Feature: In-Process Caching Layer for Search and Analytics

  Scenario: Cached search response returns faster on repeat query
    Given cơ sở dữ liệu đã có tài liệu và vector chunks
    When client gửi truy vấn tìm kiếm "mâu thuẫn kỹ thuật" lần đầu (Cache Miss)
    Then response trả về danh sách kết quả với HTTP 200 và header "X-Cache" là "MISS"
    When client gửi lại cùng truy vấn "mâu thuẫn kỹ thuật" trong khoảng thời gian TTL 300 giây (Cache Hit)
    Then response trả về kết quả giống hệt lần đầu
    And header "X-Cache" có giá trị "HIT"
    And thời gian phản hồi (latency_ms) của lần gọi thứ hai thấp hơn đáng kể so với lần đầu

  Scenario: Cache invalidation on document mutation
    Given truy vấn tìm kiếm "kiến trúc phần mềm" đã được nạp vào cache
    When người dùng nạp một tài liệu mới có chứa từ khóa "kiến trúc phần mềm"
    Then namespace cache "search" bị vô hiệu hóa
    When client thực hiện lại truy vấn "kiến trúc phần mềm"
    Then hệ thống thực hiện truy vấn mới xuống database với header "X-Cache" là "MISS"
    And kết quả tìm kiếm phản ánh tài liệu mới vừa nạp

  Scenario: Analytics cache serves within TTL and updates after manual refresh
    Given client đã gọi "GET /api/v1/analytics/overview" lần đầu (Cache Miss)
    When client gọi lại endpoint trong vòng 60 giây
    Then response được phục vụ từ cache với "X-Cache: HIT"
    And timestamp "generated_at" giữ nguyên thời điểm của lần gọi đầu
    When client gọi "GET /api/v1/analytics/overview?refresh=true"
    Then hệ thống bỏ qua cache, truy vấn lại database và cập nhật timestamp "generated_at" mới

  Scenario: Cache failure or exception guarantees graceful degradation
    Given tầng cache in-process bị lỗi hoặc gặp ngoại lệ bất ngờ
    When client gửi truy vấn tìm kiếm hoặc tra cứu analytics
    Then hệ thống tự động bắt lỗi, ghi log cảnh báo và fallback về truy vấn cơ sở dữ liệu gốc
    And client vẫn nhận được dữ liệu hợp lệ với HTTP 200 mà không gặp lỗi 500
```

---

## 6. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

1. **Hiệu năng**: Latency của `POST /api/v1/search` khi Cache HIT đạt `< 5ms`.
2. **Tính toàn vẹn**: Dữ liệu Cache HIT phải khớp 100% với dữ liệu sinh ra từ database query ban đầu.
3. **Tính kịp thời (Freshness)**: Không để xảy ra tình trạng Stale Cache sau khi có mutation tài liệu hoặc session.
4. **Độ ổn định**: Tỷ lệ lỗi 0% khi cache đầy (kích hoạt LRU eviction an toàn) và fail-safe fallback 100%.
5. **Kiểm thử**: 100% unit tests và integration tests cho Caching Layer vượt qua thành công trên môi trường cục bộ và CI.
