# Phase 10.3 Increment 10 — Result Source Buckets & In-View Quick Segment Tabs Gherkin Matrix

## Matrix Overview

| Scenario ID | Category | Source Types in Results | User Action | Expected Output |
| :--- | :--- | :--- | :--- | :--- |
| **Scenario 28** | Segment Tabs Display | `golden_kb` (2), `case_study` (1) | Initial Search Result Load | Render Segment Tabs: "Tất cả (3)", "Golden Knowledge Base (2)", "Case Study (1)". Tab "Tất cả" active mặc định. |
| **Scenario 29** | In-View Filtering | `golden_kb` (2), `case_study` (1) | Click tab "Case Study (1)" | Chỉ hiển thị 1 kết quả `case_study`. `searchKnowledge` không bị gọi lại. |
| **Scenario 30** | Single Source Type | `golden_kb` (3) | Initial Search Result Load | Không hiển thị hàng segment tabs thừa, hiển thị trực tiếp danh sách 3 kết quả. |
| **Scenario 31** | State Preservation | `golden_kb` (2), `case_study` (1) | Expand snippet / Attach evidence on item -> Switch tab and switch back | Các tương tác cục bộ (expand, attach) trên item vẫn được bảo toàn. |

---

## Detailed Gherkin Specifications

```gherkin
Feature: Result Source Buckets & In-View Quick Segment Tabs

  Scenario 28: Render Segment Tabs với badge đếm khi có từ 2 source types trở lên
    Given API searchKnowledge trả về 3 kết quả gồm 2 items "golden_kb" và 1 item "case_study"
    When danh sách kết quả được hiển thị
    Then hiển thị hàng segment tabs phía dưới thanh summary bar
    And tab "Tất cả" có badge số lượng là 3 và đang ở trạng thái active
    And tab "Golden Knowledge Base" có badge số lượng là 2
    And tab "Case Study" có badge số lượng là 1
    And tất cả 3 kết quả đều được hiển thị trong danh sách

  Scenario 29: Click chọn tab nguồn lọc kết quả client-side mà không gọi lại API
    Given hàng segment tabs ở Scenario 28 đang hiển thị
    When người dùng click vào tab "Case Study"
    Then danh sách kết quả chỉ còn hiển thị 1 item thuộc loại "case_study"
    And hàm API "searchKnowledge" KHÔNG bị gọi lại thêm lần nào

  Scenario 30: Ẩn Segment Tabs khi tất cả kết quả cùng 1 loại nguồn
    Given API searchKnowledge trả về 3 kết quả đều thuộc loại "golden_kb"
    When danh sách kết quả được hiển thị
    Then KHÔNG hiển thị hàng segment tabs phân đoạn
    And cả 3 kết quả được hiển thị bình thường

  Scenario 31: Bảo toàn tương tác thẻ khi chuyển qua lại giữa các tab phân đoạn
    Given người dùng mở rộng đoạn trích của một item "golden_kb"
    When người dùng chuyển sang tab "Case Study" rồi chuyển lại tab "Tất cả"
    Then đoạn trích của item "golden_kb" vẫn giữ nguyên trạng thái mở rộng
```
