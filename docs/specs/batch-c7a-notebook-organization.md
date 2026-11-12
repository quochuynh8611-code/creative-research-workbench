# Batch C7a — Notebook Organization Tối Thiểu: Client-Side Filter & Search

## 1. Mục tiêu (Purpose)
Cung cấp khả năng tổ chức, phân loại và tra cứu nhanh các ghi chú nghiên cứu (`ResearchNote`) trong `ResearchNotebook` thông qua bộ lọc phân loại (`note_type`) và tìm kiếm từ khóa nội dung (`content`) thuần túy tại client-side, giúp người dùng dễ dàng định vị lại các tri thức đã lưu trong phiên làm việc mà không làm thay đổi bất kỳ hành vi tạo/xóa note hiện có.

## 2. Quyết định Thiết kế (Design Decisions)
1. **Bộ lọc theo `note_type`**:
   - Các tùy chọn bộ lọc: `all` (Tất cả), `insight` (Phát hiện), `hypothesis` (Giả thuyết), `decision` (Quyết định), `question` (Câu hỏi), `action` (Hành động).
   - Mặc định: `all`.
   - Mỗi nút/tab bộ lọc hiển thị nhãn và **bộ đếm (counter)** phản ánh chính xác số lượng ghi chú thuộc loại đó trong toàn bộ danh sách notes đã tải về của phiên.
   - Các bộ đếm (counters) luôn giữ cố định theo tổng số notes của phiên, không bị giảm khi người dùng nhập từ khóa tìm kiếm.
2. **Tìm kiếm nội dung (`search`)**:
   - Ô nhập tìm kiếm cho phép lọc theo trường `content`.
   - Không phân biệt chữ hoa / chữ thường (`case-insensitive`).
   - Có nút xóa tìm kiếm khi ô nhập có nội dung.
3. **Kết hợp Logic AND giữa Filter và Search**:
   - Ghi chú được hiển thị phải thỏa mãn đồng thời:
     - Khớp với `note_type` đã chọn (nếu chọn khác `all`).
     - Nội dung `content` chứa chuỗi tìm kiếm (nếu chuỗi tìm kiếm không rỗng).
4. **Trạng thái Trống khi Lọc (Empty Filter State)**:
   - Khi có ít nhất một ghi chú trong phiên nhưng không có ghi chú nào thỏa mãn điều kiện lọc/tìm kiếm:
     - Hiển thị thông báo: `"Không tìm thấy ghi chú phù hợp với bộ lọc"`.
     - Hiển thị nút hành động: `"Xóa bộ lọc"`.
   - Khi bấm `"Xóa bộ lọc"`, hệ thống tự động:
     - Reset bộ lọc loại về `"all"`.
     - Xóa rỗng ô tìm kiếm nội dung (`searchQuery = ''`).
     - Khôi phục danh sách hiển thị đầy đủ ban đầu.
5. **Bảo tồn Tuyệt đối Hành vi Hiện có**:
   - Form tạo ghi chú mới (`createResearchNote`), validation rỗng, draft active banner, mutation xóa ghi chú (`deleteResearchNote`), và các controlled props (`content`, `noteType`, `onContentChange`, `onNoteTypeChange`, `onClearDraft`, `onNoteCreated`) giữ nguyên 100%.

## 3. Ranh giới & Ràng buộc Kỹ thuật (Technical Boundaries)
- **Frontend-only**: Tuyệt đối không thay đổi backend, API client, cơ sở dữ liệu, Alembic migration, hay FSM engine.
- **Không persistence**: Không lưu trạng thái filter hay search vào `localStorage`, `sessionStorage`, hay `IndexedDB`. Trạng thái chỉ tồn tại trong vòng đời component.
- **Không can thiệp ngoài phạm vi C7a**:
  - KHÔNG thêm source badge / provenance detection (dành cho phase sau nếu duyệt).
  - KHÔNG thêm copy to clipboard.
  - KHÔNG thêm edit note.
  - KHÔNG thêm pagination hay virtualization.
  - KHÔNG thêm AI classification, summarization, hay auto-tagging.
  - KHÔNG thay đổi giao diện hoặc logic của `SessionDetail` hay các feature khác.

## 4. Đặc tả Gherkin (Gherkin Scenarios)

```gherkin
Feature: Tổ chức ghi chú nghiên cứu bằng bộ lọc và tìm kiếm

  Scenario: Người dùng lọc ghi chú theo loại
    Given Sổ tay có 2 insight, 2 hypothesis và 1 decision
    When Người dùng chọn bộ lọc "Hypothesis"
    Then Chỉ 2 ghi chú hypothesis được hiển thị
    And Counter của "Hypothesis" là 2
    When Người dùng chọn "Tất cả"
    Then Cả 5 ghi chú được hiển thị

  Scenario: Người dùng tìm ghi chú theo nội dung
    Given Sổ tay có ghi chú chứa "phân tán nhiệt qua cấu trúc tổ ong"
    When Người dùng nhập "TỔ ONG" vào ô tìm kiếm
    Then Chỉ ghi chú chứa "tổ ong" được hiển thị
    When Người dùng nhấn "Xóa bộ lọc"
    Then Ô tìm kiếm trở về rỗng
    And Toàn bộ ghi chú được hiển thị trở lại

  Scenario: Bộ lọc và tìm kiếm không có kết quả
    Given Người dùng đang chọn bộ lọc "Decision"
    When Người dùng nhập từ khóa không tồn tại trong các decision note
    Then Hệ thống hiển thị "Không tìm thấy ghi chú phù hợp với bộ lọc"
    And Hiển thị nút "Xóa bộ lọc"
    When Người dùng nhấn "Xóa bộ lọc"
    Then Bộ lọc trở về "Tất cả"
    And Ô tìm kiếm trở về rỗng
    And Toàn bộ ghi chú được hiển thị trở lại
```
