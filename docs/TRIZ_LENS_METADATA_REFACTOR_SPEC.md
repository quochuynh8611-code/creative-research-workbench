# Đặc Tả Kiến Trúc: TrizLensMetadataSection (Batch B1.1)

## 1. Bối cảnh & Mục tiêu

- **Bối cảnh**: Hiện tại `apps/web/features/triz/triz-matrix-lookup.tsx` hiển thị cả lăng kính Kinh doanh (Business) và Đời sống (Everyday) bằng cách truyền props vào `EverydayMetadataSection`. Điều này khiến khi người dùng chọn lăng kính Kinh doanh, các nội dung kinh doanh lại nằm dưới nhãn "Chi tiết đời sống & Câu hỏi gợi mở" và "Cách áp dụng trong đời sống". Đồng thời `apps/web/features/ideation/principle-suggestions.tsx` cũng đang phụ thuộc trực tiếp vào `EverydayMetadataSection`.
- **Mục tiêu**:
  1. Tạo component chuyên biệt `TrizLensMetadataSection` thống nhất hiển thị metadata của 3 lăng kính (`engineering`, `business`, `everyday`).
  2. Phân tách rõ ràng ngữ cảnh, nhãn hiển thị, icon và fallback giữa Kinh doanh và Đời sống.
  3. Duy trì `EverydayMetadataSection` dưới dạng thin adapter tương thích ngược 100% cho `features/ideation/principle-suggestions.tsx`.
  4. Đảm bảo tính độc lập và duy nhất của DOM ID / ARIA attributes giữa các instance qua `useId()`.

---

## 2. Interface Contract

```typescript
export type TrizLensType = 'engineering' | 'business' | 'everyday'

export interface TrizLensMetadataSectionProps {
  lens: TrizLensType
  principle: TrizPrinciple
  className?: string
}
```

Trong đó `TrizPrinciple` tuân thủ interface chuẩn tại `apps/web/lib/types.ts`:
- Kỹ thuật: `name_vi`, `description`, `explanation`
- Đời sống: `everyday_title`, `daily_application`, `daily_examples`, `action_prompt`
- Kinh doanh: `business_title`, `business_application`, `business_examples`, `business_action_prompt`

---

## 3. Đặc tả Hành vi bằng Gherkin (Gherkin Scenarios)

### Feature: Hiển thị Metadata theo Lăng Kính TRIZ (TrizLensMetadataSection)

```gherkin
Feature: TrizLensMetadataSection Component
  As a user exploring TRIZ principles
  I want to view principle metadata adapted to my selected lens (engineering, business, everyday)
  So that I can understand and apply creative principles in the right domain context

  Scenario: 1. Render đầy đủ 4 trường metadata ở lăng kính Đời sống (Everyday)
    Given một nguyên tắc TRIZ có đầy đủ thông số đời sống
    When render TrizLensMetadataSection với lens="everyday"
    Then hiển thị tên kỹ thuật gốc và mô tả kỹ thuật
    And hiển thị accordion với nhãn đời sống "Chi tiết đời sống & Câu hỏi gợi mở"
    And hiển thị đầy đủ: everyday_title, daily_application, daily_examples, action_prompt

  Scenario: 2. Render đầy đủ 4 trường metadata ở lăng kính Kinh doanh (Business)
    Given một nguyên tắc TRIZ có đầy đủ thông số kinh doanh
    When render TrizLensMetadataSection với lens="business"
    Then hiển thị tên kỹ thuật gốc và mô tả kỹ thuật
    And hiển thị accordion với nhãn kinh doanh "Diễn giải & Ứng dụng kinh doanh"
    And hiển thị đầy đủ: business_title, business_application, business_examples, business_action_prompt
    And không chứa nhãn chữ "đời sống" trong khối kinh doanh

  Scenario: 3. Fallback có kiểm soát khi thiếu dữ liệu ở lăng kính Kinh doanh
    Given một nguyên tắc TRIZ không có trường business_*
    When render TrizLensMetadataSection với lens="business"
    Then hiển thị thông báo có kiểm soát "Đang cập nhật diễn giải kinh doanh..."
    And không bị crash hoặc hiển thị "undefined" hay "null"

  Scenario: 4. Lăng kính Kỹ thuật (Engineering) không render accordion lăng kính
    Given một nguyên tắc TRIZ bất kỳ
    When render TrizLensMetadataSection với lens="engineering"
    Then chỉ hiển thị tên kỹ thuật, mô tả kỹ thuật và giải thích chuyên sâu (nếu có)
    And KHÔNG render khối accordion mở rộng của đời sống hay kinh doanh

  Scenario: 5. Bảo đảm tính duy nhất của DOM ID và cô lập ARIA controls giữa nhiều instance
    Given hai instance TrizLensMetadataSection render cùng một principleId trên cùng trang
    When kiểm tra thuộc tính aria-controls và ID vùng nội dung accordion
    Then aria-controls của hai nút bấm phải khác nhau
    And ID của hai khối accordion phải khớp với aria-controls tương ứng
    And click toggle instance 1 không làm thay đổi trạng thái aria-expanded của instance 2

  Scenario: 6. Tương thích ngược của Adapter EverydayMetadataSection cho luồng Ideation
    Given component EverydayMetadataSection nhận props theo hợp đồng cũ từ RecommendedMethod
    When render trong luồng gợi ý nguyên tắc của Ideation
    Then tiếp tục hiển thị chính xác tên kỹ thuật, mô tả và 4 trường đời sống mà không cần đổi caller
```

---

## 4. Kế hoạch Kiểm thử & Quy tắc Tương thích Ngược

1. **Test RED mới**: `apps/web/features/triz/__tests__/triz-lens-metadata-section.test.tsx` bao phủ chính xác 6 kịch bản Gherkin trên.
2. **Test hồi quy Adapter**: Bổ sung test case xác nhận `EverydayMetadataSection` giữ nguyên hành vi khi nhận props kiểu cũ từ `features/ideation`.
3. **Ràng buộc cứng**:
   - Không sửa đổi mã nguồn production trong giai đoạn RED.
   - Mọi test hiện có (24 test suites / 332 tests) không được bị sửa đổi để ép pass.
