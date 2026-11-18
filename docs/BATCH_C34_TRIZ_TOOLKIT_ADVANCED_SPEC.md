# BATCH C34 SPECIFICATION — TRIZ TOOLKIT ADVANCED (ARIZ, EVOLUTION PATTERNS & RESOURCE ANALYSIS)

**Mã tài liệu:** SPEC-C34-TRIZ-ADVANCED  
**Phiên bản:** v1.0.0 (Batch C34 — TRIZ Toolkit Advanced)  
**Tác giả:** Senior Product Engineer / TRIZ Methodologist  
**Ngày:** 2026-11-18  
**Trạng thái:** PR 1 Implementation Phase (Approved with 4 Strict Constraints)  
**Baseline Git Commit:** `21243ae0953f2759fd2f6007b5e608f00bad627b` (Batch C33 Merged, CI 3/3 PASS)  

---

## 0. Bốn Ràng Buộc Bắt Buộc Của Founder (Founder Mandatory Constraints)

Trước khi viết code cho PR 1, toàn bộ hệ thống bắt buộc tuân thủ 4 nguyên tắc bất biến:
1. **ARIZ Đúng 6 Bước Rút Gọn (Strict 6 Steps):**
   - Giữ nguyên vẹn đúng 6 bước chuẩn hóa hướng trải nghiệm (`ariz_step_1`..`ariz_step_6`).
   - Tuyệt đối **KHÔNG** mở rộng thành quy trình ARIZ đầy đủ 9 phần / 40 bước cổ điển gây rối và quá tải nhận thức.
2. **Quy Luật Tiến Hóa Chỉ Đúng 8 Quy Luật (Strict 8 Trends):**
   - Giữ nguyên vẹn đúng 8 quy luật Altshuller kinh điển.
   - Tuyệt đối **KHÔNG** bổ sung thêm các quy luật phái sinh hay quy luật mở rộng khác ngoài 8 quy luật này.
3. **Phân Tích Nguồn Lực Chỉ Đúng 5 Nhóm (Strict 5 Categories):**
   - Giữ nguyên vẹn đúng 5 nhóm nguồn lực kinh điển: `substance`, `field`, `time`, `space`, `information`.
   - Tuyệt đối **KHÔNG** bổ sung thêm các nhóm tài nguyên mở rộng khác vào taxonomy cốt lõi.
4. **Dữ Liệu Tĩnh (Static JSON) Là Read-Only Tuyệt Đối:**
   - Các tệp dữ liệu JSON (`triz_ariz_steps.json`, `triz_evolution_trends.json`, `triz_resource_taxonomy.json`) là kho tri thức phương pháp luận chỉ đọc (Read-Only Static Repositories).
   - Hệ thống không cung cấp API cho phép người dùng sửa đổi trực tiếp dữ liệu tĩnh này. Mọi tùy biến hay ghi chép của người dùng được lưu trữ độc lập vào bảng `research_notes` thông qua trường `source_context`. Đây là sự chấp nhận có chủ đích nhằm giữ vững tính bất biến và độ tin cậy của kho tri thức.  

---

## 1. Tổng Quan & Bối Cảnh (Context & Motivation)

### 1.1. Hiện Trạng Sản Phẩm (Current State)
Sau khi hoàn tất Batch C33 (Productization & Onboarding), Creative Research Workbench (CRW) đã sở hữu:
- Ma trận Mâu thuẫn Kỹ thuật Altshuller 39x39 (`triz_matrix_39x39.json`) và 40 Nguyên tắc Sáng tạo.
- Danh mục 4 Chiến lược Phân tách cho Mâu thuẫn Vật lý (Trong không gian, Thời gian, Điều kiện, Thành phần).
- Sơ đồ 9 Màn hình (TRIZ Nine Windows / System Operator) đa lăng kính (Kỹ thuật, Kinh doanh, Đời sống).
- AI Solution Coach (Hard Grounding, Cap 5, Fallback Heuristic, Masking).
- Hạ tầng quan sát (Structured Logging, Correlation ID, InMemoryMetrics) và Benchmark Suite.
- Welcome Onboarding Modal 3 bước và Sample Data Seeder bất đồng bộ.

### 1.2. Vấn Đề Cần Giải Quyết (Problem Statement)
Phương pháp luận TRIZ hiện tại trong CRW tập trung chủ yếu vào cấp độ cơ bản: nhận diện mâu thuẫn kỹ thuật/vật lý và tra cứu nguyên tắc giải quyết. Tuy nhiên, đối với các bài toán đổi mới sáng tạo phức tạp (bài toán cấp 3, cấp 4 theo phân loại Altshuller), các nhà nghiên cứu và kỹ sư cần các công cụ chuyên sâu hơn của TRIZ:
1. **Thiếu Quy trình Giải quyết Bài toán Sáng chế có Hệ thống (ARIZ):** Người dùng gặp khó khăn khi bài toán không thể phân loại ngay thành mâu thuẫn 39x39 mà cần bóc tách từ bài toán mơ hồ thành mô hình "Mini-problem", xác định Kết quả Lý tưởng Cuối cùng (IFR), và khoanh vùng mâu thuẫn vật lý trong không-thời gian thao tác.
2. **Thiếu Dự báo Tiến hóa Hệ thống Kỹ thuật (Trends of Engineering System Evolution - TESE):** Nghiên cứu sáng tạo không chỉ là "chữa lỗi" (solve bottlenecks) mà còn là "dẫn dắt xu hướng" (anticipate future). Người dùng thiếu công cụ đối soát xem hệ thống đang ở nấc tiến hóa nào trong 8 quy luật kinh điển để tạo ra bước nhảy vọt (evolutionary leap).
3. **Thiếu Công Cụ Phân Tích & Kiểm Kê Nguồn Lực Tại Chỗ (Resource Analysis):** Một nguyên lý cốt lõi của TRIZ là "đạt mục tiêu bằng việc tiêu tốn ít chi phí nhất nhờ tận dụng tài nguyên có sẵn tại chỗ (free/available resources)". Hiện sản phẩm chưa có module phân loại 5 nguồn lực (Chất, Trường, Thời gian, Không gian, Thông tin).

---

## 2. Mục Tiêu & Ranh Giới (Goals & Non-Goals)

### 2.1. Mục Tiêu (Goals)
1. **Module Hướng Dẫn Từng Bước ARIZ (ARIZ Step-by-Step Guide):**
   - Chuẩn hóa 6 giai đoạn rút gọn từ ARIZ-85C phù hợp với phần mềm hiện đại (Mini-Problem $\to$ Vùng Thao Tác OZ/OT $\to$ Kết Quả Lý Tưởng IFR $\to$ Huy Động Tài Nguyên Chất-Trường $\to$ Phân Tách & Nguyên Tắc $\to$ Đánh Giá Giải Pháp).
   - Cung cấp REST API `GET /api/v1/triz/ariz-steps` phục vụ dữ liệu hướng dẫn, câu hỏi kích hoạt tư duy (trigger questions), và hành động khuyến nghị.
   - Giao diện tương tác trực quan (Interactive Stepper) cho phép người dùng ghi nhận câu trả lời cho từng bước và lưu trực tiếp vào Research Notebook (`onSaveAsNote`).
2. **Quy Luật Tiến Hóa Hệ Thống Kỹ Thuật (Trends of Evolution):**
   - Chuẩn hóa 8 quy luật tiến hóa Altshuller kinh điển kèm mở rộng ví dụ cho Kỹ thuật, Phần mềm và Kinh doanh.
   - Cung cấp REST API `GET /api/v1/triz/evolution-trends`.
   - Component trực quan (Timeline/Cards Explorer) giúp đối soát vị trí hiện tại và gợi mở nấc tiến hóa tiếp theo, hỗ trợ 1-click lưu thành Research Note.
3. **Phân Tích Nguồn Lực Tại Chỗ (Resource Analysis):**
   - Phân loại 5 nhóm nguồn lực: Chất (Substance), Trường (Field), Thời gian (Time), Không gian (Space), Thông tin (Information) + Lăng kính mở rộng.
   - Cung cấp REST API `GET /api/v1/triz/resource-taxonomy`.
   - Component kiểm kê tài nguyên (Resource Inventory Matrix) giúp lập danh mục các tài nguyên sẵn có và lưu vào Research Notebook.
4. **Bảo Tồn Toàn Vẹn Hệ Thống (Zero Disruption & Zero Schema Mutation):**
   - Tuyệt đối **không thay đổi schema PostgreSQL** (Alembic giữ nguyên `006 (head)`).
   - Tận dụng cột `research_notes.source_context` (JSONB) đã có để lưu trữ ngữ cảnh xuất xứ của ARIZ, Evolution và Resource.
   - Không làm chậm hoặc phá vỡ các luồng workflow, seeder, benchmark hiện có.
   - Zero hard-coded secrets, zero leak.

### 2.2. Ranh Giới Ngoài Phạm Vi (Non-Goals)
- ❌ KHÔNG tự động sinh mã nguồn giải quyết bài toán bằng AI mà không có sự kiểm soát của con người (giữ vững nguyên lý Human-in-the-Loop).
- ❌ KHÔNG thay đổi schema database hay tạo migration mới trong Batch C34.
- ❌ KHÔNG thay đổi hợp đồng API hiện có của `/api/v1/sessions` hay `/api/v1/triz/lookup`.
- ❌ KHÔNG triển khai lên production.

### 2.3. Bốn Điều Chỉnh Bắt Buộc Trước Khi Code (Founder Mandates)
Theo chỉ thị phê duyệt từ Founder cho Batch C34 PR 2:
1. **ARIZ STEPPER CHỈ 6 BƯỚC, KHÔNG THÊM:**
   - Giữ đúng 6 bước như spec đã nêu (B1 đến B6).
   - KHÔNG mở rộng thành ARIZ đầy đủ 9 phần (40 bước).
2. **EVOLUTION EXPLORER CHỈ 8 QUY LUẬT, KHÔNG THÊM:**
   - Giữ đúng 8 quy luật Altshuller kinh điển.
   - KHÔNG thêm quy luật khác.
3. **RESOURCE PANEL CHỈ 5 TABS, KHÔNG THÊM:**
   - Giữ đúng 5 nhóm tài nguyên (`substance`, `field`, `time`, `space`, `information`).
   - KHÔNG thêm nhóm khác.
4. **COMPONENTS CHỈ GỌI API READ-ONLY:**
   - Các components frontend chỉ gọi các API endpoints read-only (`GET /api/v1/triz/ariz-steps`, `GET /api/v1/triz/evolution-trends`, `GET /api/v1/triz/resource-taxonomy`).
   - KHÔNG cho phép user edit trực tiếp static JSON. Đây là sự chấp nhận có chủ đích (Intentional Trade-off). Mọi ghi chú và giải pháp được lưu vào `research_notes` qua trường `source_context`.

---

## 3. Kiến Trúc Hệ Thống (System Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js / React)                      │
│                                                                        │
│   Tab: Phân Tích Cấu Trúc (Structuring)   Tab: Ý Tưởng (Ideation)       │
│   ┌───────────────────────────────────┐   ┌──────────────────────────┐ │
│   │ [Mới] ARIZ Step-by-Step Guide     │   │ [Mới] Trends of          │ │
│   │ • 6 Giai đoạn Mini-Problem -> IFR │   │       Evolution Explorer │ │
│   │ • Trigger Questions & Prompts     │   │ • 8 Quy luật kinh điển   │ │
│   │ • 1-Click Save Note / Solution    │   │ • Nấc tiến hóa tiếp theo │ │
│   └───────────────────────────────────┘   └──────────────────────────┘ │
│                                           ┌──────────────────────────┐ │
│                                           │ [Mới] Resource Analysis  │ │
│                                           │ • Ma trận 5 nhóm tài     │ │
│                                           │   nguyên (S, F, T, S, I) │ │
│                                           │ • Checklist khai thác    │ │
│                                           └──────────────────────────┘ │
│                                                        │               │
│                                  1-Click Lưu Note      ▼               │
│                                           ┌──────────────────────────┐ │
│                                           │ Tab: Research Notebook   │ │
│                                           │ • Source Context Provenance│
│                                           └──────────────────────────┘ │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ REST API (Read-Only)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (FastAPI / Python)                      │
│                                                                        │
│   Endpoints Mới (Read-only, Deterministic):                            │
│   • GET /api/v1/triz/ariz-steps                                        │
│   • GET /api/v1/triz/evolution-trends                                  │
│   • GET /api/v1/triz/resource-taxonomy                                 │
│                                                                        │
│   Tệp Dữ Liệu Tĩnh (Static JSON Repositories):                         │
│   • backend/src/app/data/triz_ariz_steps.json                          │
│   • backend/src/app/data/triz_evolution_trends.json                    │
│   • backend/src/app/data/triz_resource_taxonomy.json                   │
│                                                                        │
│   Schema Mở Rộng Cho Source Context (note_context.py):                 │
│   • TrizArizContext (source_type = 'triz_ariz')                        │
│   • TrizEvolutionContext (source_type = 'triz_evolution')              │
│   • TrizResourceContext (source_type = 'triz_resource')                │
│                                                                        │
│   Database PostgreSQL: KHÔNG ĐỔI (Alembic 006 head giữ nguyên)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Chi Tiết Các Phân Hệ Chức Năng (Detailed Modules)

### 4.1. Phân Hệ 1: ARIZ Step-by-Step Guide
- **6 Bước Chuẩn Hóa:**
  1. **Bước 1: Mô hình hóa Bài toán & Phát biểu Mini-Problem:** Xác định xung đột kỹ thuật, giữ nguyên hệ thống mà không làm phức tạp hóa. Câu hỏi then chốt: *"Hệ thống cần giữ nguyên những yếu tố nào và chỉ thay đổi tối thiểu yếu tố nào để ngăn chặn hậu quả xấu?"*
  2. **Bước 2: Phân tích Vùng Thao Tác (OZ) và Thời Gian Thao Tác (OT):** Khoanh vùng chính xác không gian nơi mâu thuẫn xảy ra và thời điểm trước/trong/sau xung đột.
  3. **Bước 3: Xác định Kết Quả Lý Tưởng Cuối Cùng (IFR) & Mâu Thuẫn Vật Lý (PC):** Đặt mục tiêu lý tưởng: *"Yếu tố X tự nó loại bỏ tác hại mà không cần thêm chi phí"*. Nhận diện mâu thuẫn vật lý: *"Thông số P phải TĂNG để... nhưng phải GIẢM để..."*
  4. **Bước 4: Huy động Tài nguyên Chất - Trường (SFR):** Rà soát các chất và trường có sẵn trong vùng thao tác OZ/OT để hỗ trợ đạt IFR.
  5. **Bước 5: Áp dụng Chiến Lược Phân Tách & Hiệu Ứng Khoa Học:** Sử dụng 4 nguyên tắc phân tách (Thời gian, Không gian, Điều kiện, Thành phần) hoặc liên kết với 40 nguyên tắc sáng tạo.
  6. **Bước 6: Đánh giá Giải pháp & Hoàn thiện Ý tưởng:** Kiểm tra xem giải pháp có tạo ra mâu thuẫn thứ cấp không; chuyển hóa kết quả thành Candidate Solution hoặc Research Note.

### 4.2. Phân Hệ 2: Quy Luật Tiến Hóa Hệ Thống Kỹ Thuật (Trends of Evolution)
- **8 Quy Luật Kinh Điển:**
  1. *Quy luật Tính hoàn thiện của các bộ phận (Completeness):* Động cơ $\to$ Dẫn động $\to$ Bộ phận công tác $\to$ Bộ điều khiển $\to$ Tự động hóa thông minh.
  2. *Quy luật Dẫn truyền năng lượng (Energy Conductivity):* Luồng năng lượng xuyên suốt, giảm thiểu thất thoát qua các khớp nối.
  3. *Quy luật Phối hợp nhịp điệu (Coordination of Rhythms):* Đồng bộ tần số, chu kỳ tác động, chuyển từ liên tục sang xung (pulsed).
  4. *Quy luật Tăng tính lý tưởng (Increasing Ideality):* Tăng công năng có ích, giảm chi phí và tác hại hướng tới giá trị vô hạn.
  5. *Quy luật Phát triển không đều giữa các phân hệ (Non-uniform Evolution):* Sự lệch pha giữa các bộ phận gây ra mâu thuẫn mới.
  6. *Quy luật Chuyển lên Siêu hệ thống (Transition to Super-system):* Hệ đơn lẻ $\to$ Hệ kép $\to$ Đa hệ thống $\to$ Tích hợp vào nền tảng.
  7. *Quy luật Chuyển sang Mức vi mô (Transition to Micro-level):* Khối vĩ mô $\to$ Hạt/Bột $\to$ Phân tử/Dung dịch $\to$ Thể khí/Plasma $\to$ Trường/Sóng điện từ $\to$ Thuật toán phần mềm/Cloud.
  8. *Quy luật Tăng tính Động học và Khả năng Điều khiển (Dynamism & Controllability):* Kết cấu cứng $\to$ Khớp nối $\to$ Linh hoạt đàn hồi $\to$ Khí nén/Thủy lực $\to$ Trường điện từ/Tự thích nghi.

### 4.4. Chi Tiết Kiến Trúc Frontend Giao Diện (PR 2 Deliverables)

1. **`ArizStepperPanel` (`apps/web/features/triz/ariz-stepper-panel.tsx`):**
   - Đặt trong tab `structuring` bên trong `NormalizedView` dưới dạng **Collapsible Card** (tương tự `TrizNineWindows`).
   - Gồm Stepper 6 bước đánh số từ 1..6, có trạng thái Active / Completed.
   - Thẻ nội dung của từng bước hiển thị:
     - Tên bước song ngữ Việt - Anh.
     - Mô tả mục tiêu ngắn gọn.
     - Danh sách 2-3 câu hỏi kích hoạt tư duy (Trigger Questions).
     - Danh sách hành động khuyến nghị (Recommended Actions).
     - Ô nhập nhanh quan sát/kết luận của người dùng (`textarea`).
     - Nút "Lưu bước này vào Notebook" kích hoạt callback `onSaveAsNote` với `source_context`:
       `{ schema_version: 1, source_type: 'triz_ariz', step_number, step_name }`.
   - Nút điều hướng "Bước trước" và "Bước tiếp theo".

2. **`EvolutionPatternsExplorer` (`apps/web/features/triz/evolution-patterns-explorer.tsx`):**
   - Đặt trong tab `ideation` (`session-detail.tsx`), bên cạnh `PrincipleSuggestions`.
   - Hiển thị danh sách 8 quy luật Altshuller kinh điển dạng danh sách thẻ có thể mở rộng (Accordion / Cards).
   - Khi mở rộng một quy luật:
     - Hiển thị mô tả quy luật.
     - Hiển thị chuỗi các nấc tiến hóa (Evolution Stages timeline: từ nấc sơ khai đến nấc tự thích nghi cao cấp).
     - Hiển thị ví dụ thực tế trong Kỹ thuật và Phần mềm.
     - Ô nhập nhận định về bước nhảy vọt của hệ thống và nút "Lưu định hướng tiến hóa vào Notebook" với `source_context`:
       `{ schema_version: 1, source_type: 'triz_evolution', trend_id, trend_name }`.

3. **`ResourceAnalysisPanel` (`apps/web/features/triz/resource-analysis-panel.tsx`):**
   - Đặt trong tab `ideation` (`session-detail.tsx`).
   - Thiết kế giao diện 5 tabs tương ứng với 5 nhóm tài nguyên cốt lõi:
     - `substance` (Chất)
     - `field` (Trường & Năng lượng)
     - `time` (Thời gian)
     - `space` (Không gian)
     - `information` (Thông tin & Dữ liệu)
   - Mỗi tab hiển thị:
     - Phân loại phụ (Subtypes) của nhóm tài nguyên.
     - Danh sách câu hỏi kiểm tra (Checklist Questions) kích hoạt việc tận dụng tài nguyên miễn phí sẵn có.
     - Ô ghi nhận tài nguyên tìm được và nút "Lưu tài nguyên vào Notebook" với `source_context`:
       `{ schema_version: 1, source_type: 'triz_resource', resource_type, resource_name }`.

---

## 5. Hợp Đồng Dữ Liệu & API (Data Contracts)

### 5.1. Endpoints Mới (Tất định, Read-Only)
1. `GET /api/v1/triz/ariz-steps`
   - **Response Structure:**
     ```json
     {
       "data": [
         {
           "step_number": 1,
           "code": "ariz_step_1",
           "name_vi": "Xác định Bài toán nhỏ (Mini-Problem) & Mô hình hóa",
           "name_en": "Mini-Problem Formulation & Modeling",
           "description": "Giữ nguyên hệ thống, hạn chế tối đa việc thêm thiết bị phức tạp...",
           "trigger_questions": ["Yếu tố nào đang xung đột?", "Cái gì không được phép thay đổi?"],
           "recommended_actions": ["Phát biểu mâu thuẫn cốt lõi", "Khoanh vùng phần tử gây hại"]
         }
       ],
       "total_steps": 6
     }
     ```
2. `GET /api/v1/triz/evolution-trends`
   - **Response Structure:**
     ```json
     {
       "data": [
         {
           "trend_id": "trend_dynamism",
           "name_vi": "Quy luật Tăng tính Động học & Khả năng Điều khiển",
           "name_en": "Trend of Increasing Dynamism and Controllability",
           "description": "Hệ thống phát triển từ cấu trúc cứng nhắc đến linh hoạt và tự thích nghi.",
           "evolution_stages": ["Cấu trúc cứng (Rigid)", "Có một khớp (One joint)", "Nhiều khớp (Multi-joint)", "Linh hoạt (Flexible)", "Chất lỏng/khí (Liquid/Gas)", "Điều khiển bằng trường (Field)"],
           "domain_examples": {
             "engineering": "Thước cuộn kim loại chuyển sang thước laser",
             "software": "Monolith cứng nhắc chuyển sang microservices hướng sự kiện"
           }
         }
       ],
       "total_trends": 8
     }
     ```
3. `GET /api/v1/triz/resource-taxonomy`
   - **Response Structure:**
     ```json
     {
       "data": [
         {
           "category": "substance",
           "name_vi": "Tài nguyên Chất (Substance Resources)",
           "name_en": "Substance Resources",
           "subtypes": ["Vật liệu của hệ thống", "Vật liệu siêu hệ thống", "Môi trường tự nhiên", "Phế phẩm/Chất thải"],
           "checklist_questions": ["Có chất thải nào có thể tận dụng?", "Có thể dùng chất rẻ tiền/miễn phí nào?"]
         }
       ],
       "total_categories": 5
     }
     ```

### 5.2. Mở Rộng Schema `source_context` Cho Research Note (`backend/src/app/schemas/note_context.py`)
Bổ sung 3 context schemas vào Discriminated Union `NoteSourceContextUnion` (không sửa đổi database schema):
- `TrizArizContext`: `source_type = "triz_ariz"`, `step_number: StrictInt` (1..6), `step_name: str`.
- `TrizEvolutionContext`: `source_type = "triz_evolution"`, `trend_id: str`, `trend_name: str`.
- `TrizResourceContext`: `source_type = "triz_resource"`, `resource_type: Literal["substance", "field", "time", "space", "information"]`, `resource_name: str`.

---

## 6. Ma Trận Kịch Bản Kiểm Thử (Gherkin Matrix)

### Gherkin Scenario 1: ARIZ Step-by-Step API & Stepper Flow
```gherkin
Feature: ARIZ Step-by-Step Problem Solving Guide
  As a researcher or engineer facing a complex inventive problem
  I want a structured 6-step ARIZ guide
  So that I can systematically formulate the mini-problem, identify the physical contradiction, and reach the Ideal Final Result (IFR)

  Scenario: Retrieve ARIZ steps catalog via REST API
    When I send a GET request to "/api/v1/triz/ariz-steps"
    Then The response status code should be 200
    And The response should contain exactly 6 steps
    And Step 1 should have code "ariz_step_1" and focus on Mini-Problem modeling
    And Step 3 should focus on Ideal Final Result (IFR) and Physical Contradiction

  Scenario: Save an ARIZ step finding as a research note
    Given I am working on step 3 (IFR) of the ARIZ guide for a session
    When I click "Lưu vào Notebook" with note content "Yếu tố X phải tự làm mát khi nhiệt độ > 80C"
    Then A research note is created with source_context.source_type "triz_ariz"
    And The note's source_context contains step_number 3 and step_name "Ideal Final Result"
```

### Gherkin Scenario 2: Trends of Engineering System Evolution
```gherkin
Feature: Trends of Engineering System Evolution (TESE)
  As an innovator seeking next-generation breakthroughs
  I want to inspect the 8 classic TRIZ evolution trends with multi-domain examples
  So that I can anticipate the future trajectory of my system

  Scenario: Retrieve 8 evolution trends via REST API
    When I send a GET request to "/api/v1/triz/evolution-trends"
    Then The response status code should be 200
    And The response should contain 8 evolution trends
    And Trends should include "Completeness", "Increasing Ideality", and "Increasing Dynamism"

  Scenario: Save an evolutionary leap insight to notebook
    Given I select the trend "Increasing Dynamism" in the evolution explorer
    When I click "Lưu định hướng tiến hóa" with content "Chuyển từ cấu trúc cứng sang điều khiển bằng phần mềm tự thích nghi"
    Then A research note is created with source_context.source_type "triz_evolution"
```

### Gherkin Scenario 3: Resource Analysis Matrix
```gherkin
Feature: Resource Analysis Taxonomy & Inventory
  As a problem solver aiming for high ideality
  I want to inventory available substance, field, time, space, and information resources
  So that I can solve contradictions using existing resources without adding costly components

  Scenario: Retrieve resource taxonomy via REST API
    When I send a GET request to "/api/v1/triz/resource-taxonomy"
    Then The response status code should be 200
    And Exactly 5 categories (substance, field, time, space, information) should be returned
    And Each category should provide discovery checklist questions

  Scenario: Save a resource inventory entry to notebook
    Given I identify an idle field resource (waste heat)
    When I save the resource note into the research notebook
    Then A research note is created with source_context.source_type "triz_resource"
```

### Gherkin Scenario 4: Zero Secret Leakage & Anti-Production Safety
```gherkin
Feature: Security & Safety Guard
  Scenario: Endpoints and responses do not leak secrets
    When I call "/api/v1/triz/ariz-steps", "/api/v1/triz/evolution-trends", and "/api/v1/triz/resource-taxonomy"
    Then Responses must not contain "sk-proj", "Bearer", "password", or credentials
    And Alembic current revision must remain at 006 head
```

---

## 7. Phân Tích Rủi Ro & Chiến Lược Đánh Đổi (Risks & Trade-offs)

| Rủi ro tiềm ẩn | Mức độ | Biện pháp giảm thiểu |
|:---|:---:|:---|
| **Rủi ro quá tải thông tin (Information Overload) do ARIZ quá phức tạp** | Trung bình | Rút gọn quy trình từ 9 phần 40 bước của ARIZ-85C thành 6 giai đoạn cốt lõi trực quan, mỗi bước có trigger questions và gợi ý cụ thể. |
| **Rủi ro ảnh hưởng tới các tests hiện có khi mở rộng Union `source_context`** | Thấp | Sử dụng Discriminated Union chặt chẽ với discriminator `source_type`. Các types cũ (`triz_9_windows`, `triz_matrix`, v.v.) không bị xáo trộn. |
| **Rủi ro schema migration ngoài ý muốn** | Nghiêm ngặt | Bắt buộc kiểm tra `backend/alembic/versions` không có file mới. Cột `source_context` đã là JSONB nullable nên không cần DDL thay đổi. |
| **Rủi ro hiệu năng API** | Thấp | Dữ liệu tĩnh JSON được load sẵn in-memory khi module khởi động (cached), độ trễ truy vấn $< 5\text{ms}$. |

---

## 8. Đề Xuất Phân Rã Thành Các Pull Request Nhỏ (PR Breakdown)

Để tuân thủ kỷ luật Small PRs, Batch C34 được đề xuất chia thành 3 PRs độc lập:

1. **PR 1: Backend Data & Endpoints cho Advanced TRIZ (`feat(backend): triz advanced endpoints for ariz, evolution and resources`)** [x] DONE (Merged PR #75):
   - Thêm các tệp dữ liệu tĩnh: `triz_ariz_steps.json`, `triz_evolution_trends.json`, `triz_resource_taxonomy.json`.
   - Cập nhật `backend/src/app/api/v1/endpoints/triz.py` với 3 endpoints read-only mới.
   - Cập nhật Pydantic schemas trong `note_context.py` để hỗ trợ 3 source types mới.
   - 7 unit tests backend PASS 100%, 223/223 backend unit tests PASS.
2. **PR 2: Frontend Components: ARIZ Stepper, Evolution Explorer & Resource Matrix (`feat(web): advanced triz components and ideation integration`)** [/] IN PROGRESS (Spec & Test-First):
   - Thêm component `ariz-stepper-panel.tsx`, `evolution-patterns-explorer.tsx`, `resource-analysis-panel.tsx`.
   - Tích hợp vào `structuring` (ARIZ stepper collapsible) và `ideation` tabs (Evolution & Resource analysis) của `session-detail.tsx`.
   - Thêm 3 client API methods trong `apps/web/lib/api-client.ts` và types trong `apps/web/lib/types.ts`.
   - 3 frontend test suites trong `apps/web/features/triz/__tests__/`.
3. **PR 3: Documentation, Runbook & Batch C34 Finalization (`docs(triz): advanced triz method guide, deployment runbook and roadmap`)** [ ] PLANNED:
   - Cập nhật sổ tay phương pháp luận `docs/DEPLOYMENT_GUIDE.md` và `docs/IMPLEMENTATION_ROADMAP.md`.
   - Chuyển `docs/ADR-015-triz-toolkit-advanced.md` sang Accepted.
   - Đóng hoàn tất Batch C34.
