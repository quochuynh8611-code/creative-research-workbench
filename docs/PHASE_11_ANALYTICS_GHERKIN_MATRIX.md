# PHASE 11 — ANALYTICS GHERKIN TEST MATRIX & COVERAGE REPORT
- **Dự án:** Creative Research Workbench
- **Module:** Phase 11 — Analytics & Research Intelligence
- **Trạng thái:** ✅ 100% COVERED & PASSING (31/31 Scenarios)
- **File kiểm thử liên quan:**
- Frontend: `apps/web/features/analytics/__tests__/analytics-dashboard.test.tsx` (27 tests)
- Backend: `backend/tests/integration/test_analytics_overview_api.py` (4 tests)

---

## 1. Bảng Ma trận Kiểm thử Gherkin (Frontend - 27 Scenarios)

| STT | Test Name trong `analytics-dashboard.test.tsx` | Phase | Gherkin Feature & Scenario Tương ứng | Trạng thái |
| :---: | :--- | :---: | :--- | :---: |
| 1 | `renders_loading_state_while_fetching_analytics` | 11.1B | **Feature: Lifecycle Loading**<br>Given trang Analytics đang tải dữ liệu lần đầu<br>Then hiển thị skeleton loading với data-testid="analytics-loading-skeleton" | ✅ PASS |
| 2 | `renders_error_state_and_retries_on_button_click` | 11.1B | **Feature: Error Handling & Retry**<br>Given API Analytics trả về lỗi 500<br>Then hiển thị thông báo lỗi và nút "Thử lại"<br>When bấm "Thử lại" then gọi lại query refetch | ✅ PASS |
| 3 | `renders_zero_state_for_empty_analytics_payload` | 11.1B | **Feature: Zero Metric Display**<br>Given API trả về payload rỗng (mọi count = 0)<br>Then 4 KPI cards hiển thị giá trị số 0 an toàn | ✅ PASS |
| 4 | `renders_populated_dashboard_sections_from_analytics_response` | 11.1B | **Feature: Populated Distribution Rendering**<br>Given API trả về dữ liệu nghiên cứu đầy đủ<br>Then hiển thị đúng 4 giá trị KPI và các chips phân bố chi tiết | ✅ PASS |
| 5 | `renders_refresh_action_for_manual_reload` | 11.1B | **Feature: Manual Refresh**<br>Given dashboard đang ở trạng thái hiển thị dữ liệu<br>When người dùng nhấn nút "Làm mới"<br>Then hệ thống gọi API getAnalyticsOverview lần thứ 2 | ✅ PASS |
| 6 | `renders_header_contextual_links_to_core_workspaces` | 11.3 | **Feature: Header Contextual Navigation**<br>Given người dùng xem header của Analytics<br>Then có các liên kết nhanh trỏ về `/sessions`, `/knowledge`, `/search` | ✅ PASS |
| 7 | `renders_contextual_link_in_research_sessions_kpi_card` | 11.7 | **Feature: Sessions KPI Drilldown**<br>Given KPI Card 1 (Research Sessions)<br>Then chân thẻ có link "Xem danh sách" trỏ đến `/sessions` | ✅ PASS |
| 8 | `renders_contextual_link_in_knowledge_base_kpi_card` | 11.7 | **Feature: Knowledge Base KPI Drilldown**<br>Given KPI Card 3 (Knowledge Base)<br>Then chân thẻ có link "Quản lý tri thức" trỏ đến `/knowledge` | ✅ PASS |
| 9 | `renders_actionable_empty_state_guidance_when_all_analytics_metrics_are_zero` | 11.5 | **Feature: Global Actionable Empty State**<br>Given toàn bộ hệ thống chưa có dữ liệu nghiên cứu<br>Then hiển thị panel empty-state với 3 nút CTA khởi tạo | ✅ PASS |
| 10 | `does_not_render_global_empty_state_guidance_when_dashboard_has_data` | 11.5 | **Feature: Empty State Suppression**<br>Given hệ thống đã có ít nhất một session hoặc tài liệu<br>Then ẩn hoàn toàn banner empty-state toàn cục | ✅ PASS |
| 11 | `renders_contextual_link_in_sessions_breakdown_section_header` | 11.4 | **Feature: Sessions Section Header Link**<br>Given Section Phân tích Sessions<br>Then tiêu đề section có link "Quản lý Sessions" trỏ về `/sessions` | ✅ PASS |
| 12 | `renders_contextual_link_in_content_and_solutions_section_header` | 11.4 | **Feature: Content Section Header Link**<br>Given Section Nội dung & Giải pháp<br>Then tiêu đề section có link "Xem phiên làm việc" trỏ về `/sessions` | ✅ PASS |
| 13 | `renders_contextual_links_in_knowledge_and_triz_section_header` | 11.4 | **Feature: Knowledge & TRIZ Section Header Links**<br>Given Section Tri thức & Mâu thuẫn TRIZ<br>Then tiêu đề có 2 links trỏ về `/knowledge` và `/search` | ✅ PASS |
| 14 | `renders_section_local_empty_guidance_when_sessions_breakdown_is_empty` | 11.6 | **Feature: Sessions Local Empty State**<br>Given dữ liệu phân bố giai đoạn nghiên cứu rỗng<br>Then hiển thị hướng dẫn cục bộ "Chưa ghi nhận phiên làm việc theo giai đoạn" | ✅ PASS |
| 15 | `renders_section_local_empty_guidance_when_solutions_breakdown_is_empty` | 11.6 | **Feature: Solutions Local Empty State**<br>Given dữ liệu phân bố giải pháp rỗng<br>Then hiển thị hướng dẫn cục bộ "Chưa có đề xuất giải pháp" | ✅ PASS |
| 16 | `renders_section_local_empty_guidance_when_triz_breakdown_is_empty` | 11.6 | **Feature: TRIZ Local Empty State**<br>Given dữ liệu phân bố mâu thuẫn TRIZ rỗng<br>Then hiển thị hướng dẫn cục bộ "Chưa phát hiện mâu thuẫn TRIZ" | ✅ PASS |
| 17 | `preserves_populated_breakdown_chips_and_hides_global_empty_state_in_mixed_data` | 11.6 | **Feature: Mixed Partial Data Resilience**<br>Given dữ liệu chỉ có một phần (ví dụ có session nhưng chưa có TRIZ)<br>Then giữ nguyên chip đã có, hiện empty cục bộ cho phần thiếu và không bật global empty | ✅ PASS |
| 18 | `renders_contextual_link_in_candidate_solutions_kpi_card` | 11.7 | **Feature: Solutions KPI Drilldown**<br>Given KPI Card 2 (Candidate Solutions)<br>Then chân thẻ có link "Xem giải pháp" trỏ đến `/sessions` | ✅ PASS |
| 19 | `renders_contextual_link_in_triz_contradictions_kpi_card` | 11.7 | **Feature: TRIZ KPI Drilldown**<br>Given KPI Card 4 (Mâu thuẫn TRIZ)<br>Then chân thẻ có link "Tra cứu TRIZ" trỏ đến `/search` | ✅ PASS |
| 20 | `renders_section_local_empty_guidance_for_golden_documents_when_knowledge_base_is_empty` | 11.8 | **Feature: Golden Documents Empty Guidance**<br>Given tổng số tài liệu tri thức = 0<br>Then KPI Card 3 hiển thị "Chưa nạp tài liệu" | ✅ PASS |
| 21 | `renders_golden_documents_ratio_badge_when_knowledge_base_has_documents` | 11.8 | **Feature: Golden Documents Quality Ratio Badge**<br>Given tổng số tài liệu = 24 và golden = 10<br>Then KPI Card 3 hiển thị badge "10/24 chuẩn tắc (42%)" | ✅ PASS |
| 22 | `renders_accessible_landmark_regions_and_testids_for_detailed_sections` | 11.9 | **Feature: Semantic Section Landmarks**<br>Given 3 breakdown sections trong dashboard<br>Then mỗi section là thẻ `<section aria-labelledby="...">` với testid tương ứng | ✅ PASS |
| 23 | `renders_analytics_empty_state_testid_when_all_metrics_are_zero` | 11.9 | **Feature: Empty State Test Selector**<br>Given dashboard toàn bộ rỗng<br>Then container rỗng có data-testid="analytics-empty-state" | ✅ PASS |
| 24 | `renders_dynamic_contradiction_breakdown_subtitle_in_triz_kpi_card_when_populated` | 11.10 | **Feature: Populated TRIZ Subtitle Symmetry**<br>Given total_contradictions = 6 (4 technical, 2 physical)<br>Then Card 4 hiển thị subtitle "4 kỹ thuật & 2 vật lý" | ✅ PASS |
| 25 | `renders_empty_subtitle_in_triz_kpi_card_when_no_contradictions` | 11.10 | **Feature: Empty TRIZ Subtitle**<br>Given total_contradictions = 0<br>Then Card 4 hiển thị subtitle "Chưa ghi nhận mâu thuẫn" | ✅ PASS |
| 26 | `renders_idle_refresh_button_with_aria_attributes_and_testid` | 11.11 | **Feature: Idle Refresh Button A11y**<br>Given dashboard đã tải xong<br>Then nút làm mới có text "Làm mới", aria-busy="false", aria-label="Làm mới dữ liệu phân tích" | ✅ PASS |
| 27 | `renders_fetching_refresh_button_state_with_dynamic_label_and_busy_attributes` | 11.11 | **Feature: Fetching Refresh Button Feedback**<br>When người dùng click làm mới và API đang fetch<br>Then nút bị disabled, text đổi thành "Đang làm mới...", aria-busy="true", aria-label="Đang làm mới dữ liệu phân tích" | ✅ PASS |

---

## 2. Bảng Ma trận Kiểm thử Backend (4 Scenarios)

| STT | Test Name trong `test_analytics_overview_api.py` | Gherkin Feature & Scenario | Trạng thái |
| :---: | :--- | :--- | :---: |
| 1 | `test_analytics_overview_returns_200_with_expected_top_level_shape` | **Feature: Top-level API Schema**<br>Given backend khởi chạy với PostgreSQL testcontainer<br>When gửi GET `/api/v1/analytics/overview`<br>Then status code là 200 và response chứa đủ cấu trúc { data: { sessions, content, knowledge_base, triz }, generated_at } | ✅ PASS |
| 2 | `test_analytics_overview_aggregates_dynamic_maps_correctly` | **Feature: Dynamic Breakdown Maps Aggregation**<br>Given database có sẵn 3 sessions, 2 problem frames, 3 notes, 2 solutions, 2 docs, 1 contradiction<br>When gửi GET `/api/v1/analytics/overview`<br>Then các chỉ số đếm và dynamic breakdown maps khớp chính xác với DB | ✅ PASS |
| 3 | `test_analytics_overview_returns_zero_counts_for_empty_database` | **Feature: Empty Database Aggregation**<br>Given cơ sở dữ liệu hoàn toàn trống (0 bản ghi)<br>When gửi GET `/api/v1/analytics/overview`<br>Then trả về status 200, tất cả total = 0 và các breakdown map là {} | ✅ PASS |
| 4 | `test_analytics_overview_is_read_only_and_does_not_mutate_data` | **Feature: Pure Read-Only Guarantee**<br>Given dữ liệu mẫu đã có trong DB<br>When gọi GET `/api/v1/analytics/overview` liên tiếp 3 lần<br>Then không có bản ghi nào bị thay đổi, số lượng entity và updated_at giữ nguyên 100% | ✅ PASS |

---

## 3. Tổng kết Chất lượng
- **Tổng số Scenarios đã tự động hóa:** 31/31 (100%).
- **Tỷ lệ Pass:** 100% (Frontend 27/27, Backend 4/4).
- **Mức độ sẵn sàng sản xuất:** Sẵn sàng cho triển khai và tích hợp Phase 12.
