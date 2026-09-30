# PHASE 5.9 SPECIFICATION — Session Lifecycle & Safe Deletion (Archive & Restore)

> **Document Status**: Canonical Spec  
> **Target Release**: Phase 5.9  
> **Author**: Antigravity Pair Programmer  
> **References**: [`docs/DOMAIN_SCHEMA.md`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/docs/DOMAIN_SCHEMA.md), [`docs/API_CONTRACTS.md`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/docs/API_CONTRACTS.md), [`backend/src/app/domain/models.py`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/domain/models.py)

---

## 1. Executive Summary & Goals

Hiện tại, người dùng khi hoàn tất bài toán hoặc muốn dọn dẹp không gian nghiên cứu chưa có phương thức xóa hoặc lưu trữ Research Session. 
Vì dữ liệu nghiên cứu TRIZ (ProblemFrames, Contradictions, Solutions) có giá trị tri thức cao, việc thực hiện Hard Delete (xóa vật lý khỏi DB) ngay lập tức sẽ mang lại rủi ro mất mát dữ liệu không thể phục hồi (Unrecoverable Data Loss) do thao tác nhầm hoặc CASCADE delete.

**Mục tiêu Phase 5.9**:
1. Thiết lập cơ chế **Safe Deletion qua Soft Delete (Archive)** và **Phục hồi (Restore)**.
2. Tách biệt danh sách hiển thị mặc định (Active/Draft/Completed) khỏi danh sách lưu trữ (Archived).
3. Đảm bảo toàn vẹn dữ liệu: Không xóa vật lý bất kỳ bản ghi nào trong `research_sessions`, `problem_frames`, `contradictions`.
4. Cung cấp trải nghiệm người dùng (UX) trực quan: Modal xác nhận trước khi archive, tab/bộ lọc xem danh sách Archived, và nút Restore một chạm.

---

## 2. Technical Decisions & Trade-off Analysis

### 2.1. Quyết định: Sử dụng `SessionStatus.archived`
- **Hiện trạng Schema**: Trong [`backend/src/app/domain/models.py`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/domain/models.py#L56-L61), enum `SessionStatus` đã định nghĩa sẵn 4 giá trị: `active`, `paused`, `completed`, `archived`.
- **Lựa chọn**: Sử dụng `status = SessionStatus.archived`.
- **Lý do**:
  - Không làm thay đổi cấu trúc bảng SQL (Zero DDL Migration Risk).
  - Tương thích 100% với các index hiện có (`ix_sessions_status`).
  - `updated_at` tự động ghi nhận thời điểm session chuyển trạng thái sang `archived`.

### 2.2. So sánh Trade-off: Archive (Soft Delete) vs Hard Delete

| Tiêu chí | Phương án A: Archive & Restore (Được chọn) | Phương án B: Hard Delete (Loại trừ ở Phase 5.9) |
| :--- | :--- | :--- |
| **Bảo vệ dữ liệu** | **Tuyệt đối an toàn**: Mọi bài toán, mâu thuẫn TRIZ đều được giữ nguyên. | **Rủi ro cao**: CASCADE delete xóa sạch toàn bộ cây tri thức. |
| **Khả năng phục hồi** | Người dùng có thể Restore lại bất cứ lúc nào. | Không thể phục hồi nếu không có backup DB riêng. |
| **Tác động Blast Radius** | Cực nhỏ: Chỉ lọc query và cập nhật trường `status`. | Lớn: Phải xử lý foreign keys, ràng buộc và orphan records. |
| **Trải nghiệm người dùng** | Tự tin thao tác dọn dẹp, không sợ mất việc đang làm. | Gây tâm lý lo lắng cho người dùng khi bấm nút xóa. |
| **Lộ trình tương lai** | Có thể bổ sung Hard Delete ở Phase quản trị nâng cao (với 2-factor confirm). | Dễ gây lỗi hồi quy trong các dịch vụ liên quan. |

---

## 3. Data Integrity & Cascade Behavior

- Khi `ResearchSession` chuyển sang trạng thái `archived`:
  - Bản ghi trong bảng `research_sessions` được cập nhật `status = 'archived'`.
  - Các bản ghi liên kết trong `problem_frames` và `contradictions` **GIỮ NGUYÊN HOÀN TOÀN** (không xóa, không sửa foreign key).
- Khi `ResearchSession` được `restore`:
  - `status` chuyển về `active` (hoặc `draft`/`completed`).
  - Mọi dữ liệu ProblemFrame và lịch sử TRIZ tự động hiển thị đầy đủ trên Canvas View.

---

## 4. API Contract Specifications

### 4.1. `POST /api/v1/sessions/{session_id}/archive`
- **Mục đích**: Chuyển trạng thái session sang `archived`.
- **Request Parameters**:
  - `session_id` (Path, UUID, required)
- **Response `200 OK`**:
  ```json
  {
    "id": "ef340f52-d0bd-4b39-8252-0e621318fc02",
    "title": "Thiết kế hệ thống giảm ma sát động cơ",
    "status": "archived",
    "workflow_state": "idle",
    "updated_at": "2026-09-30T04:30:00.000000Z",
    "message": "Research session archived successfully",
    "data": { ... }
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Session không tồn tại.
  - `400 Bad Request`: Session đã ở trạng thái `archived`.

---

### 4.2. `POST /api/v1/sessions/{session_id}/restore`
- **Mục đích**: Khôi phục session từ `archived` về `active`.
- **Request Parameters**:
  - `session_id` (Path, UUID, required)
- **Response `200 OK`**:
  ```json
  {
    "id": "ef340f52-d0bd-4b39-8252-0e621318fc02",
    "title": "Thiết kế hệ thống giảm ma sát động cơ",
    "status": "active",
    "workflow_state": "idle",
    "updated_at": "2026-09-30T04:31:00.000000Z",
    "message": "Research session restored successfully",
    "data": { ... }
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Session không tồn tại.
  - `400 Bad Request`: Session không ở trạng thái `archived`.

---

### 4.3. `GET /api/v1/sessions` (Cập nhật Logic Lọc Mặc định)
- **Tham số Query mới**:
  - `include_archived: bool = False` (Optional): Nếu `true`, bao gồm cả sessions đã lưu trữ.
  - `status: Optional[str] = None`:
    - Nếu `status="archived"` -> Chỉ trả về sessions đã lưu trữ.
    - Nếu `status="active"` -> Chỉ trả về sessions active.
    - Nếu `status=None` (mặc định) -> **Tự động LOẠI BỎ các session có `status == 'archived'`**.

---

## 5. UI & Frontend UX Design

1. **Session Card Action Menu**:
   - Trên mỗi Session Card tại [`apps/web/features/session/session-list.tsx`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/apps/web/features/session/session-list.tsx):
     - Session Active: Hiển thị nút biểu tượng Hộp lưu trữ (**Archive**).
     - Session Archived: Hiển thị nút Khôi phục (**Restore**).
2. **Confirmation Modal / Dialog**:
   - Khi bấm Archive, hiển thị Dialog:
     - Tiêu đề: *“Lưu trữ Research Session?”*
     - Nội dung: *“Session này sẽ được chuyển vào mục Đã lưu trữ và ẩn khỏi màn hình chính. Bạn có thể khôi phục lại bất kỳ lúc nào.”*
     - Nút: `Hủy` (Ghost button) và `Xác nhận lưu trữ` (Amber/Warning button).
3. **Tab/Filter Chuyển đổi Trạng thái**:
   - Bổ sung bộ lọc trạng thái phía trên danh sách:
     - `Hoạt động` (Active & khác Archived - Mặc định)
     - `Đã lưu trữ` (Archived)
4. **State Feedback**:
   - Hiển thị spinner/loading indicator khi đang thực hiện request.
   - Khi archive/restore thành công: Tự động invalidate `['sessions']` qua React Query để cập nhật giao diện tức thì.
