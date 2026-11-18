# ADR-015: Kiến Trúc Nâng Cao Chiều Sâu Phương Pháp Luận TRIZ (ARIZ, Evolution Patterns & Resource Analysis)

- **Trạng thái:** Proposed
- **Ngày:** 2026-11-18
- **Tác giả:** Senior Product Engineer / TRIZ Methodologist
- **Ngữ cảnh:** Creative Research Workbench (CRW) — Batch C34

---

## 1. Ngữ Cảnh Và Đặt Vấn Đề (Context & Problem Statement)

Creative Research Workbench đã hoàn thiện các công cụ TRIZ nền tảng (Ma trận Mâu thuẫn 39x39, 40 Nguyên tắc Sáng tạo, 4 Chiến lược Phân tách cho mâu thuẫn vật lý, Sơ đồ 9 Màn hình đa lăng kính) và cơ chế AI Solution Coach.

Tuy nhiên, trong thực tế nghiên cứu và đổi mới sáng tạo kỹ thuật/sản phẩm:
1. Nhiều bài toán phức tạp (như bài toán cấp 3, cấp 4) không thể giải quyết ngay bằng việc tra cứu ma trận 39x39 mà đòi hỏi một quy trình phân tích logic chặt chẽ (ARIZ - Algorithm for Inventive Problem Solving) để khoanh vùng mâu thuẫn cốt lõi và phát biểu Kết quả Lý tưởng Cuối cùng (Ideal Final Result - IFR).
2. Đổi mới mang tính chiến lược đòi hỏi việc dự báo trước hướng đi của công nghệ thông qua các Quy luật Tiến hóa Hệ thống Kỹ thuật (Trends of Engineering System Evolution - TESE).
3. Đạt được giải pháp lý tưởng cao với chi phí tối thiểu phụ thuộc vào năng lực phát hiện và khai thác các nguồn lực miễn phí sẵn có (Resource Analysis: Chất, Trường, Thời gian, Không gian, Thông tin).

Batch C34 cần tích hợp 3 phân hệ phương pháp luận nâng cao này vào sản phẩm mà **không làm thay đổi cấu trúc cơ sở dữ liệu** và bảo đảm tính tương thích ngược hoàn hảo.

---

## 2. Các Quyết Định Kiến Trúc (Architectural Decisions)

### Quyết định 1: Phân Rã & Số Hóa Dữ Liệu Tĩnh Bằng Static JSON Repositories (Chỉ Đọc Tuyệt Đối)
- **Giải pháp:** Lưu trữ danh mục 6 bước ARIZ, 8 quy luật tiến hóa và 5 nhóm tài nguyên dưới dạng các tệp JSON tĩnh trong `backend/src/app/data/`:
  - `triz_ariz_steps.json` (đúng 6 bước rút gọn)
  - `triz_evolution_trends.json` (đúng 8 quy luật Altshuller kinh điển)
  - `triz_resource_taxonomy.json` (đúng 5 nhóm nguồn lực: substance, field, time, space, information)
- **Lý do & Chấp nhận có chủ đích:**
  - Danh mục kiến thức TRIZ là chuẩn mực phương pháp luận bất biến, không đòi hỏi CRUD động qua database.
  - **Static JSON là Read-Only tuyệt đối:** Không cho phép người dùng sửa đổi trực tiếp các tệp dữ liệu tĩnh này. Đây là sự chấp nhận có chủ đích để bảo vệ tính toàn vẹn và bất biến của phương pháp luận. Mọi phát hiện, tùy biến hoặc ghi chép của người dùng được lưu trữ độc lập vào bảng `research_notes` qua trường `source_context`.
  - Tải in-memory khi server khởi động giúp độ trễ phản hồi cực thấp ($< 5\text{ms}$), không tạo gánh nặng I/O lên database.
  - Zero schema mutation: Giữ nguyên Alembic revision `006 (head)`, không cần tạo migration mới.

### Quyết định 2: Cung Cấp REST API Tất Định & Chỉ Đọc (Read-Only Deterministic Endpoints)
- **Giải pháp:** Bổ sung 3 endpoints mới trong `backend/src/app/api/v1/endpoints/triz.py`:
  - `GET /api/v1/triz/ariz-steps`
  - `GET /api/v1/triz/evolution-trends`
  - `GET /api/v1/triz/resource-taxonomy`
- **Lý do:**
  - Tuân thủ nguyên lý tách biệt trách nhiệm (SoC): Frontend tiêu thụ dữ liệu chuẩn hóa từ backend thay vì hard-code dữ liệu trong giao diện Next.js.
  - Cho phép client tương lai (mobile app, CLI, external integrations) tái sử dụng tri thức TRIZ.

### Quyết định 3: Tận Dụng Cột `source_context` Để Truy Xuất Nguồn Gốc (Provenance Tracking)
- **Giải pháp:** Mở rộng Pydantic Discriminated Union `NoteSourceContextUnion` trong `backend/src/app/schemas/note_context.py` với 3 types mới:
  - `TrizArizContext` (`source_type: "triz_ariz"`)
  - `TrizEvolutionContext` (`source_type: "triz_evolution"`)
  - `TrizResourceContext` (`source_type: "triz_resource"`)
- **Lý do:**
  - Cột `research_notes.source_context` đã được thiết kế sẵn dưới dạng `JSONB, nullable=True` từ Batch C7c-1 (Migration `006`).
  - Mọi ghi chép người dùng tạo ra từ ARIZ, Evolution Trends hoặc Resource Analysis đều được lưu vết xuất xứ chặt chẽ mà không cần thay đổi cấu trúc bảng trong PostgreSQL.

### Quyết định 4: Rút Gọn ARIZ Sang Mô Hình 6 Giai Đoạn Hướng Trải Nghiệm (UX-Oriented ARIZ)
- **Giải pháp:** Thay vì áp dụng toàn bộ 9 phần 40 bước rườm rà của phiên bản sách vở ARIZ-85C, chúng tôi chuẩn hóa thành 6 giai đoạn trọng tâm:
  1. Mô hình hóa bài toán & Phát biểu Mini-Problem
  2. Phân tích Vùng Thao Tác (OZ) & Thời Gian Thao Tác (OT)
  3. Định nghĩa Kết Quả Lý Tưởng (IFR) & Mâu Thuẫn Vật Lý (PC)
  4. Huy động Tài nguyên Chất - Trường (SFR)
  5. Áp dụng Chiến Lược Phân Tách & Hiệu Ứng Khoa Học
  6. Đánh giá Giải Pháp & Hoàn Thiện Ý Tưởng
- **Lý do:** Giảm tải gánh nặng nhận thức cho người dùng hiện đại, biến quy trình học thuật thành một "Interactive Wizard" dễ sử dụng.

### Quyết định 5: Bố Trí Trải Nghiệm Người Dùng Frontend Phân Tầng Theo Tab (UX Architecture PR 2)
- **Giải pháp:**
  - **ARIZ Stepper Panel:** Bố trí bên trong tab `structuring` (`NormalizedView`) dưới dạng **Collapsible Section** (tương tự `TrizNineWindows`). Người dùng có thể mở ra khi cần bóc tách bài toán phức tạp và thu gọn khi xem bài toán chuẩn hóa.
  - **Evolution Patterns Explorer & Resource Analysis Panel:** Bố trí trong tab `ideation` (`session-detail.tsx`). Cung cấp các công cụ kích hoạt ý tưởng sáng tạo bổ sung bên cạnh Ma trận Mâu thuẫn 39x39 và Gợi ý Nguyên tắc.
  - **Ghi chép liền mạch (1-Click Save Note):** Cả 3 components đều hỗ trợ callback `onSaveAsNote` truyền dữ liệu kèm `source_context` định danh nguồn (`triz_ariz`, `triz_evolution`, `triz_resource`), cho phép lưu giữ vết xuất xứ trọn vẹn trong `ResearchNotebook`.
- **Lý do:** Không làm xáo trộn bố cục phân chia giai đoạn (Intake -> Structuring -> Retrieval -> Ideation -> Notebook -> Synthesis), đồng thời ngăn ngừa quá tải nhận thức trên một màn hình đơn lẻ.

### Quyết định 6: Bốn Điều Chỉnh Bắt Buộc Của Founder Trước Khi Code (Founder Mandates)
Theo chỉ thị phê duyệt từ Founder, kiến trúc hệ thống khóa chặt 4 bất biến sau:
1. **ARIZ STEPPER CHỈ 6 BƯỚC, KHÔNG THÊM:**
   - Giữ đúng 6 bước như spec đã nêu.
   - Tuyệt đối KHÔNG mở rộng thành ARIZ đầy đủ 9 phần (40 bước) để tránh quá tải nhận thức người dùng.
2. **EVOLUTION EXPLORER CHỈ 8 QUY LUẬT, KHÔNG THÊM:**
   - Giữ đúng 8 quy luật Altshuller kinh điển.
   - Tuyệt đối KHÔNG thêm quy luật nào khác ngoài 8 quy luật này.
3. **RESOURCE PANEL CHỈ 5 TABS, KHÔNG THÊM:**
   - Giữ đúng 5 nhóm tài nguyên (`substance`, `field`, `time`, `space`, `information`).
   - Tuyệt đối KHÔNG thêm nhóm tài nguyên nào khác.
4. **COMPONENTS CHỈ GỌI API READ-ONLY:**
   - Toàn bộ frontend components (`ArizStepperPanel`, `EvolutionPatternsExplorer`, `ResourceAnalysisPanel`) chỉ gọi các API endpoints read-only (`GET /api/v1/triz/ariz-steps`, `GET /api/v1/triz/evolution-trends`, `GET /api/v1/triz/resource-taxonomy`).
   - Tuyệt đối KHÔNG cho phép người dùng sửa đổi trực tiếp các file static JSON. Đây là sự **chấp nhận có chủ đích (Intentional Trade-off)**. Mọi đóng góp/ghi chú người dùng được lưu vào `research_notes` thông qua trường `source_context`.

---

## 3. Các Phương Án Bị Loại Bỏ (Rejected Alternatives)

### Phương án 1: Tạo Bảng Database Mới Cho Từng Bước ARIZ và Đánh Giá Tiến Hóa
- **Lý do loại bỏ:** Làm phình to schema, phát sinh migration Alembic không cần thiết, gia tăng độ phức tạp vận hành và rủi ro rollback. Tận dụng `research_notes` hiện có qua `source_context` đạt hiệu quả tương đương với chi phí kỹ thuật thấp hơn rất nhiều.

### Phương án 2: Hard-code Dữ Liệu ARIZ Và Tiến Hóa Hoàn Toàn Trong Frontend React
- **Lý do loại bỏ:** Vi phạm kiến trúc hướng API, khiến dữ liệu bị phân mảnh giữa frontend và backend, làm mất khả năng phục vụ AI Coach và Search Engine sau này.

### Phương án 3: Bắt Buộc Người Dùng Hoàn Thành Toàn Bộ 6 Bước ARIZ Mới Cho Phép Tạo Giải Pháp
- **Lý do loại bỏ:** Làm gián đoạn trải nghiệm tự do sáng tạo. ARIZ là công cụ hỗ trợ kích hoạt tư duy (guide/assistant), không phải thủ tục hành chính bắt buộc.

---

## 4. Hệ Quả & Đánh Đổi (Consequences & Trade-offs)

### Lợi ích:
- **Nâng tầm chiều sâu phương pháp:** CRW trở thành bộ công cụ TRIZ hoàn chỉnh bậc nhất, bao quát từ nhận diện mâu thuẫn, dự báo tiến hóa, phân tích nguồn lực cho đến thuật giải ARIZ.
- **Bảo toàn tính ổn định:** Không chạm vào schema cơ sở dữ liệu, không ảnh hưởng đến benchmark, metrics hay luồng onboarding hiện tại.
- **Tính liên kết cao:** Toàn bộ phát hiện từ các công cụ mới đều có thể 1-click lưu vào Research Notebook hoặc chuyển thành Candidate Solutions.

### Đánh đổi (Trade-offs):
- **Chấp nhận có chủ đích Static JSON là Read-Only:** Người dùng không thể tạo hoặc chỉnh sửa danh mục các bước ARIZ, các quy luật tiến hóa hay nhóm tài nguyên trực tiếp trong tệp JSON. Mọi thông tin mở rộng được người dùng đóng góp thông qua ghi chép nghiên cứu trong `research_notes`.
- **Tăng số lượng component frontend trong tab `structuring` và `ideation`:** Cần thiết kế giao diện dạng Accordion/Collapsible hoặc Drawer để tránh làm rối mắt người dùng mới.

---

## 5. Chiến Lược Rollback (Rollback Strategy)

Nếu phát sinh lỗi sau khi triển khai:
1. **Frontend:** Ẩn các nút điều hướng hoặc component mở rộng bằng cờ tính năng (Feature Toggle) hoặc rollback commit giao diện.
2. **Backend:** Các endpoints mới là read-only và độc lập, hoàn toàn không làm gián đoạn các API endpoints cũ. Việc rollback commit Git không để lại bất kỳ trạng thái dữ liệu mồ côi nào trong PostgreSQL.
3. **Database:** Hoàn toàn không có migration DDL nào được chạy, do đó không cần rollback schema database.
