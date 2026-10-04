# PHASE 11 — ANALYTICS & RESEARCH INTELLIGENCE SPECIFICATION
- **Tài liệu:** Đặc tả kỹ thuật & Kiến trúc hoàn thiện Module Analytics (Phase 11.1A → 11.11)
- **Dự án:** Creative Research Workbench
- **Trạng thái:** ✅ COMPLETED & SIGNED OFF
- **Kỷ luật áp dụng:** Spec-first, Test-first, Read-before-write, Semantic Landmarks & Accessible A11y

---

## 1. Tổng quan & Mục tiêu Nghiệp vụ

Module Analytics (Phase 11) cung cấp bảng thông tin trực quan hóa toàn diện và tự động tổng hợp dữ liệu nghiên cứu thời gian thực cho Creative Research Workbench. Người dùng có thể:
1. Nắm bắt tức thì toàn bộ quy mô hệ thống thông qua 4 chỉ số KPI cốt lõi: **Research Sessions**, **Candidate Solutions**, **Knowledge Base**, và **Mâu thuẫn TRIZ**.
2. Khám phá các phân bố chi tiết theo từng giai đoạn nghiên cứu (workflow stages), loại nội dung, trạng thái giải pháp, định dạng tài liệu, và loại mâu thuẫn.
3. Điều hướng liền mạch (contextual deep links) từ mọi chỉ số phân tích trực tiếp đến không gian làm việc chuyên sâu (`/sessions`, `/knowledge`, `/search`).
4. Nhận phản hồi tương tác rõ ràng với trạng thái rỗng có định hướng hành động (actionable global & local empty states) cùng khả năng làm mới tức thì (refresh button with dynamic accessibility feedback).

---

## 2. Kiến trúc Hệ thống & Ranh giới Module

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js 14)                              │
│                                                                                 │
│   Route: /analytics  ──>  Page: apps/web/app/analytics/page.tsx                │
│                                      │                                          │
│                                      ▼                                          │
│             Feature Component: apps/web/features/analytics/                     │
│                            analytics-dashboard.tsx                              │
│                                      │                                          │
│             Client API Layer: apps/web/lib/api-client.ts                        │
│                     (getAnalyticsOverview via axios)                            │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ HTTP GET /api/v1/analytics/overview
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│                              BACKEND (FastAPI)                                  │
│                                                                                 │
│   Router: backend/src/app/api/v1/endpoints/analytics.py                         │
│                                      │                                          │
│   Service Layer: backend/src/app/services/analytics_service.py                  │
│                     (SQLAlchemy ORM Aggregations)                               │
│                                      │                                          │
│   Database: PostgreSQL 16 (Sessions, ContentPieces, Solutions, Docs, TRIZ)      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Chi tiết API Contract & Dữ liệu Tổng hợp

### 3.1 Endpoint
- **Method:** `GET`
- **Path:** `/api/v1/analytics/overview`
- **Authentication:** Public / Workspace Session Context

### 3.2 Schema Payload Response
```json
{
  "sessions": {
    "total_sessions": 12,
    "by_status": {
      "active": 8,
      "completed": 3,
      "archived": 1
    },
    "by_stage": {
      "intake": 2,
      "structuring": 4,
      "retrieval": 3,
      "ideation": 2,
      "evaluation": 1,
      "synthesis": 0
    }
  },
  "content": {
    "total_pieces": 28,
    "by_type": {
      "problem_frame": 12,
      "hypothesis": 8,
      "insight": 6,
      "synthesis": 2
    }
  },
  "candidate_solutions": {
    "total_solutions": 15,
    "by_status": {
      "draft": 5,
      "under_review": 4,
      "approved": 5,
      "rejected": 1
    }
  },
  "knowledge_base": {
    "total_documents": 24,
    "golden_documents": 10,
    "by_file_type": {
      "pdf": 14,
      "markdown": 6,
      "text": 4
    }
  },
  "triz": {
    "total_contradictions": 6,
    "by_contradiction_type": {
      "technical": 4,
      "physical": 2
    }
  },
  "generated_at": "2026-10-03T22:30:00.000Z"
}
```

---

## 4. Đặc tả Chi tiết Giao diện & Tương tác Frontend

### 4.1 Header Navigation & Data Freshness
- **Breadcrumb & Quick Links:** Cung cấp link quay lại `/sessions` và các link phụ tới `/knowledge`, `/search`.
- **Timestamp (`generated_at`):** Hiển thị thời điểm cập nhật gần nhất được format thân thiện tiếng Việt (`toLocaleTimeString('vi-VN')`).
- **Nút Làm mới (Refresh Button):**
  - Trạng thái rảnh rỗi (`idle`): Hiển thị text `"Làm mới"`, `aria-busy="false"`, `aria-label="Làm mới dữ liệu phân tích"`, `data-testid="analytics-refresh-button"`.
  - Trạng thái đang tải lại (`isFetching`): Nút chuyển `disabled`, icon quay (`animate-spin`), text chuyển thành `"Đang làm mới..."`, `aria-busy="true"`, `aria-label="Đang làm mới dữ liệu phân tích"`.

### 4.2 Hàng 4 Thẻ KPI Cốt lõi (Top KPI Cards)
1. **Card 1: Research Sessions**
   - Giá trị chính: `sessions.total_sessions`
   - Subtitle: `"{active} đang chạy & {completed} hoàn tất"` (hoặc `"Chưa có session nào"`)
   - Chân thẻ: Link drilldown `"Xem danh sách" -> /sessions`
2. **Card 2: Candidate Solutions**
   - Giá trị chính: `candidate_solutions.total_solutions`
   - Subtitle: `"{approved} giải pháp đã phê duyệt"` (hoặc `"Chưa có giải pháp nào"`)
   - Chân thẻ: Link drilldown `"Xem giải pháp" -> /sessions`
3. **Card 3: Knowledge Base**
   - Giá trị chính: `knowledge_base.total_documents`
   - Subtitle / Badge: Badge tỷ lệ chuẩn hóa `"{golden}/{total} chuẩn tắc ({ratio}%)"` khi `total > 0`; hoặc text `"Chưa nạp tài liệu"` khi `total === 0`.
   - Chân thẻ: Link drilldown `"Quản lý tri thức" -> /knowledge`
4. **Card 4: Mâu thuẫn TRIZ**
   - Giá trị chính: `triz.total_contradictions`
   - Subtitle: `"{technical} kỹ thuật & {physical} vật lý"` khi `total > 0`; hoặc `"Chưa ghi nhận mâu thuẫn"` khi `total === 0`.
   - Chân thẻ: Link drilldown `"Tra cứu TRIZ" -> /search`

### 4.3 Actionable Empty-State Guidance Panel
- Khi toàn bộ 4 chỉ số tổng đều bằng 0 (`total_sessions === 0 && total_pieces === 0 && total_documents === 0 && total_contradictions === 0`):
  - Hiển thị banner `data-testid="analytics-empty-state"` với viền nét đứt (dashed border).
  - Cung cấp hướng dẫn bắt đầu nghiên cứu và 3 CTA buttons dẫn trực tiếp đến:
    - `"Tạo Session mới"` -> `/sessions`
    - `"Nạp tài liệu Tri thức"` -> `/knowledge`
    - `"Khám phá TRIZ Matrix"` -> `/search`

### 4.4 3 Detailed Breakdown Sections (Semantic Landmarks)
Được bọc trong các thẻ ngữ nghĩa `<section aria-labelledby="..." data-testid="...">`:
1. **Section 1: Phân tích Sessions (`data-testid="section-sessions"`)**
   - Tiêu đề có `id="section-sessions-heading"` kèm link `"Quản lý Sessions" -> /sessions`.
   - Hiển thị distribution chips theo Stage và Status; hoặc local-empty guidance khi rỗng.
2. **Section 2: Nội dung & Giải pháp (`data-testid="section-content"`)**
   - Tiêu đề có `id="section-content-heading"` kèm link `"Xem phiên làm việc" -> /sessions`.
   - Hiển thị distribution chips theo Content Type và Solution Status; hoặc local-empty guidance khi rỗng.
3. **Section 3: Tri thức & Mâu thuẫn TRIZ (`data-testid="section-triz"`)**
   - Tiêu đề có `id="section-triz-heading"` kèm 2 links `"Kho tri thức" -> /knowledge` và `"Tra cứu TRIZ" -> /search`.
   - Hiển thị distribution chips theo File Type và Contradiction Type; hoặc local-empty guidance khi rỗng.

---

## 5. Danh mục Phase Increments Hoàn tất (11.1A → 11.11)

- **Phase 11.1A:** Backend Analytics Service & API endpoint `GET /api/v1/analytics/overview`.
- **Phase 11.1B:** Frontend Core `AnalyticsDashboard`, loading skeleton, error retry.
- **Phase 11.2:** Điều hướng trang chủ và layout link tới `/analytics`.
- **Phase 11.3:** Contextual deep links ở header navigation.
- **Phase 11.4:** Contextual deep links ở tiêu đề các breakdown sections.
- **Phase 11.5:** Global Actionable Empty State Guidance Panel.
- **Phase 11.6:** Section-level local empty guidance cho dữ liệu phân mảnh/rỗng cục bộ.
- **Phase 11.7:** KPI Cards contextual drilldowns ở chân 4 thẻ chỉ số.
- **Phase 11.8:** Golden Documents local empty guidance & Quality ratio badge.
- **Phase 11.9:** Semantic landmarks (`<section>`), `aria-labelledby`, và test selectors ổn định.
- **Phase 11.10:** Subtitle động cho thẻ KPI Mâu thuẫn TRIZ (đối xứng cấu trúc chỉ số).
- **Phase 11.11:** Phản hồi trạng thái nút Làm mới với nhãn động `"Đang làm mới..."`, `aria-busy`, `aria-label`, và test selector.

---

## 6. Kết luận & Trạng thái Bàn giao
- **Code Frontend:** `apps/web/features/analytics/analytics-dashboard.tsx` (Hoàn thiện 100%).
- **Code Backend:** `backend/src/app/services/analytics_service.py` & `analytics.py` (Hoàn thiện 100%).
- **Test Suite:** 27/27 frontend tests PASS, 4/4 backend tests PASS.
- **Bảo toàn hồi quy:** 250/250 tests toàn frontend PASS, type-check 0 lỗi.
- **Đánh giá:** Module 11 Analytics chính thức hoàn tất và sẵn sàng cho các phase tiếp theo.
