---
title: "MULTI-FILE KNOWLEDGE UPLOAD SPEC — Frontend Sequential Queue & Error Retry"
topic: "knowledge-base"
source_type: "execution-spec"
language: "vi"
tags: ["phase-8", "knowledge-base", "multi-file-upload", "frontend-queue", "spec", "gherkin"]
phase: "8"
status: "draft"
golden: false
created: "2026-11-09"
revision: "3"
---

# MULTI-FILE KNOWLEDGE UPLOAD SPEC — Frontend Sequential Queue & Error Retry (Revision 3)

> **Bối cảnh & Giới hạn Ranh giới (Scope Boundaries):**
> Tính năng nạp tài liệu vào Knowledge Base (`apps/web/features/knowledge/knowledge-view.tsx`) được nâng cấp từ nạp đơn tệp sang nạp nhiều tệp thông qua cơ chế **Frontend Sequential Queue (Hàng đợi tuần tự phía client)**.
> Giữ nguyên API Backend hiện có (`POST /api/v1/documents/upload`), không thay đổi database transaction, schema hay backend router.

---

## 1. Đối chiếu Hiện trạng Backend & Hợp đồng Tối thiểu (Contract Alignment)

Dựa trên việc đối chiếu trực tiếp mã nguồn backend (`documents.py`, `ingestion_service.py`, `models.py`) và client wrapper (`api-client.ts`):

### 1.1 Ranh giới Xử lý Phản hồi (Client-side Unwrapped Response Boundary)
- Hàm `uploadDocument(file: File)` trong `apps/web/lib/api-client.ts` đã unwrap dữ liệu: `return response.data.data ?? response.data`.
- Component `KnowledgeView` nhận trực tiếp object đã unwrap kiểu `DocumentUploadResponse`, **không** trực tiếp đọc HTTP status và **không** tự bóc tách thêm một lớp `data` nào nữa.
- **Hợp đồng tối thiểu (Minimal Contract) hợp lệ cho một queue item:**
  1. Payload là một `object` khác `null` và khác `undefined`.
  2. Trường `status` bắt buộc phải có giá trị chính xác là `'success'` hoặc `'already_exists'`.
  3. Trường `document_id` bắt buộc là `string` không rỗng (`typeof document_id === 'string' && document_id.trim().length > 0`). Không bắt buộc phải đúng định dạng UUID vì shared type `DocumentUploadResponse` trong `apps/web/lib/types.ts` định nghĩa `document_id: string`.
  4. Trường `filename` bắt buộc là `string` không rỗng (`typeof filename === 'string' && filename.trim().length > 0`).
  5. Các trường khác (`title`, `chunks_created`, `embeddings_created`, `message`) là tùy chọn (optional) và không bắt buộc để phân loại hợp đồng.
- **Xử lý vi phạm hợp đồng (`invalid_contract`):**
  - Mọi payload trả về từ hàm upload không thỏa mãn 4 điều kiện trên (ví dụ: `null`, `undefined`, thiếu `status`, `status` lạ, hoặc `document_id`/`filename` rỗng) đều bị phân loại là `error` với mã lỗi `errorType: 'invalid_contract'`.
  - Tệp bị lỗi hợp đồng **không được tính là thành công** và **nằm trong diện được phép thử lại (retry)**.

### 1.2 Dung lượng, Định dạng & Quy tắc Biên
- Định dạng cho phép: `.md`, `.markdown`, `.txt` (so sánh không phân biệt hoa thường theo `ext.lower()`).
- Giới hạn kích thước: `MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024` (10 MiB = 10,485,760 bytes).
- Quy tắc biên: Kích thước bằng đúng `10 * 1024 * 1024` bytes là **hợp lệ** (`len(raw_bytes) > MAX_UPLOAD_SIZE_BYTES` mới bị backend từ chối).
- Tệp rỗng (0 bytes): Backend cho phép và fallback tạo chunk tượng trưng; frontend không tự ý thêm luật cấm empty file.
- Không tự ý đặt giới hạn cứng về số lượng tệp trong batch (batch count) hoặc tổng dung lượng cả batch (total batch bytes).

### 1.3 Hiệu chỉnh Phát biểu Kỹ thuật (Evidentiary Calibration)
- **Giới hạn của hàng đợi tuần tự:** Việc nạp tuần tự từng tệp (concurrency = 1) giúp giảm tải đồng thời của hàng đợi này tại browser client, nhưng **không** bảo đảm loại trừ mọi nguy cơ nghẽn mạng, lỗi hạ tầng, rate-limit của nhà cung cấp embedding (ví dụ OpenAI) hoặc tranh chấp khóa database độc lập ở phía hạ tầng.
- **Không có rollback hàng đợi:** Mỗi tệp được persist trong một transaction DB độc lập phía backend. Không có cơ chế transaction rollback chung cho toàn bộ batch nếu có tệp bị lỗi giữa chừng.
- **Không khẳng định lỗi request đồng nghĩa chưa ghi DB:** Khi gặp lỗi mạng (network error) hoặc lỗi 500, client không thể khẳng định chắc chắn rằng bản ghi chưa được tạo trên DB (vì có thể server đã commit nhưng đứt kết nối phản hồi). Thông báo hiển thị phải trung tính, có kiểm soát tiếng Việt (ví dụ: *"Lỗi kết nối mạng trong lúc nạp. Vui lòng kiểm tra lại."*), tuyệt đối không render nguyên raw error object hoặc `detail` không rõ kiểu từ backend ra UI.
- **Phân biệt hai loại Hash:**
  - `content_hash` backend: Là mã băm `SHA-256(raw_bytes)` của nội dung file dùng để chống trùng lặp dữ liệu trong database.
  - Snapshot hash (trong báo cáo spec/test): Là mã băm SHA-256 của các file tài liệu và mã nguồn nhằm đối chiếu tính toàn vẹn qua các thời điểm phát triển.
- **Giới hạn phiên lưu trữ (In-memory Queue):** Hàng đợi được duy trì thuần túy trong memory của browser tab; không bảo đảm tiếp tục hoặc phục hồi nếu người dùng reload trang hoặc rời trang.

---

## 2. Mô hình Hàng đợi & Trạng thái Frontend (Queue Architecture)

### 2.1 Cấu trúc Item trong Hàng đợi (Queue Item)

Mỗi mục trong hàng đợi sở hữu một định danh duy nhất (kết hợp timestamp, index và random id), tuyệt đối **không** dùng `filename` làm key duy nhất vì người dùng có thể chọn các tệp trùng tên từ các đường dẫn khác nhau hoặc chọn cùng tệp nhiều lần.

```typescript
export type QueueItemStatus = 'idle' | 'uploading' | 'success' | 'already_exists' | 'error'
export type QueueItemErrorType = 'validation' | 'network_or_server' | 'invalid_contract'

export interface UploadQueueItem {
  id: string                      // Unique queue ID (tuyệt đối không dùng filename)
  file: File                      // Web File object
  status: QueueItemStatus         // 'idle' | 'uploading' | 'success' | 'already_exists' | 'error'
  errorType?: QueueItemErrorType  // 'validation' | 'network_or_server' | 'invalid_contract'
  errorMessage?: string           // Thông báo lỗi tiếng Việt kiểm soát được
  documentId?: string             // ID tài liệu từ backend
  title?: string                  // Tiêu đề tài liệu từ backend
}
```

### 2.2 Máy trạng thái (FSM) và Phân định Retry

```
[Chọn file] ──> IDLE (Chờ nạp)
                  │
          [Bắt đầu nạp]
                  │
                  ▼
              UPLOADING (Đang nạp)
                  │
        ┌─────────┼───────────────┬────────────────────────┐
        ▼         ▼               ▼                        ▼
     SUCCESS   ALREADY_EXISTS   ERROR (Request/Contract) ERROR (Validation)*
                                  │
                           [Thử lại tệp lỗi]
                                  │
                                  ▼
                              UPLOADING
```

- **Quy tắc kích hoạt "Bắt đầu nạp" (Start):**
  - Chỉ xử lý các item đang ở trạng thái chờ (`idle`).
  - Tuyệt đối **không** gửi lại các item đã có kết quả kết thúc thành công (`success` hoặc `already_exists`).
- **Quy tắc kích hoạt "Thử lại tệp lỗi" (Retry):**
  - **Không tự động retry:** Hệ thống không bao giờ tự động gửi lại request ngầm khi gặp lỗi; retry chỉ xảy ra khi người dùng chủ động nhấn nút.
  - Chỉ xử lý các item có `status === 'error'` VÀ có `errorType` thuộc nhóm request/server (`network_or_server` hoặc `invalid_contract`).
  - **Lỗi validation (`validation`):** Các tệp bị lỗi định dạng hoặc vượt quá 10 MiB bị đánh dấu lỗi ngay tại client. Item này **tuyệt đối không được gửi lên API** và **không nằm trong diện retry**, kể cả khi trong cùng hàng đợi có các tệp lỗi request khác đang được retry.

---

## 3. Quy tắc Vận hành Chi tiết

### 3.1 Chọn tệp, Bỏ tệp & Quản lý Danh sách chờ
- Thẻ file input hỗ trợ chọn nhiều tệp (`multiple accept=".md,.txt,.markdown"`).
- Khi chọn tệp mới trong lúc **không nạp** (kể cả trước khi nạp lần đầu hoặc sau khi một lượt nạp/retry đã kết thúc): Thay thế toàn bộ danh sách hàng đợi hiện tại bằng danh sách tệp mới được chọn.
- Thao tác bỏ từng tệp khỏi hàng đợi được phép khi **không nạp** (kể cả sau khi một lượt đã hoàn tất).
- Khi người dùng kích hoạt file picker nhưng nhấn **Cancel** (danh sách tệp trả về rỗng `files.length === 0`): Giữ nguyên danh sách hàng đợi hiện tại.
- Reset giá trị của file input (`e.target.value = ''`) sau mỗi lần chọn để trình duyệt có thể phát sự kiện `change` khi chọn lại cùng một tệp.
- Hai `File` objects riêng biệt có cùng `filename`: Được khởi tạo thành 2 queue items độc lập với 2 `id` riêng, không tự ý gộp hay lọc bỏ.

### 3.2 Khóa Giao diện & Programmatic Guard
- Trong suốt quá trình nạp (kể cả lượt nạp đầu tiên và lượt retry):
  - Khóa (disable) việc chọn thêm tệp, xóa tệp khỏi hàng đợi, nhấn bắt đầu nạp, nhấn retry.
  - Khóa (disable) cả hai nút đóng modal: nút '✕' ở header modal và nút 'Đóng' ở footer modal.
- **Guard chống kích hoạt lặp:** Guard chỉ có phạm vi ngăn chặn kích hoạt trùng lặp trong nội bộ component/queue này (chống double-click UI khi request đang pending); không đại diện cho việc loại bỏ hoàn toàn race-condition ở các tầng hệ thống khác.

### 3.3 Tiến độ (Progress) & Tổng kết (Summary)
- **Định nghĩa Tiến độ:** Tiến độ hiển thị là `số mục đã xử lý / tổng số mục cần xử lý của lượt hiện tại` (ví dụ: lượt đầu là *"Đang nạp 2/3 tệp..."*, lượt retry 1 tệp là *"Đang nạp lại 0/1 tệp lỗi..."* -> *"Đang nạp lại 1/1 tệp lỗi..."*). Tuyệt đối không nhầm lẫn giữa chỉ số của tệp đang nạp với số lượng tệp đã xử lý xong.
- **Bảng tổng kết (Summary):** Hiển thị trạng thái của **toàn bộ hàng đợi hiện tại** sau khi hoàn tất mỗi lượt xử lý (ví dụ: sau khi retry thành công mục lỗi, summary cập nhật số thành công tăng lên và số lỗi giảm về 0).

### 3.4 Đồng bộ Dữ liệu với TanStack Query
- Gọi `queryClient.invalidateQueries({ queryKey: ['documents'] })` **đúng 1 lần** sau khi mỗi lượt xử lý (lượt nạp ban đầu hoặc lượt retry) đã hoàn tất toàn bộ; **tuyệt đối không gọi sau từng tệp**.
- Giữ nguyên toàn bộ giá trị bộ lọc (`q`, `topic`, `status`, `golden`) và query configuration hiện tại của người dùng sau mỗi lần refetch.

### 3.5 Reset Modal trên Cả Hai Điểm Vào (Entry Points)
- Cả nút **"➕ Nạp tài liệu"** ở Header và nút ở Empty State đều mở modal với hàng đợi sạch (`queue = []`) và xóa toàn bộ thông báo cũ.

---

## 4. Ma trận Kịch bản Kiểm thử Gherkin (Gherkin Acceptance Matrix)

### Scenario 9: Multi-file selection displays queue rows without triggering upload
```gherkin
Given người dùng đang ở trang Quản lý Cơ sở Tri thức
And modal nạp tài liệu đang mở
When người dùng chọn 3 tệp ("doc1.md", "doc2.txt", "doc3.markdown")
Then hàng đợi hiển thị đủ 3 hàng (queue rows) tương ứng
And API uploadDocument CHƯA được gọi lần nào
And nút "Bắt đầu nạp" ở trạng thái enabled
```

### Scenario 10: Single-file upload continues to work seamlessly via queue
```gherkin
Given người dùng mở modal nạp tài liệu
When người dùng chọn 1 tệp "single.md" và nhấn "Bắt đầu nạp"
Then uploadDocument được gọi đúng 1 lần với đúng đối tượng File "single.md"
And hàng đợi hiển thị kết quả thành công cho tệp đó
```

### Scenario 11: Strict sequential upload verified by File identity and Deferred Promises
```gherkin
Given người dùng đã chọn 2 tệp ("first.md", "second.md")
And backend uploadDocument được kiểm soát bằng Deferred Promises
When người dùng nhấn "Bắt đầu nạp"
Then uploadDocument được gọi ngay với tệp đầu: call[0][0] chính là first.md
And call[1] CHƯA hề diễn ra trong khi first.md còn pending
When promise của first.md được resolve thành công
Then uploadDocument mới được gọi tiếp: call[1][0] chính là second.md
```

### Scenario 12: Mixed results fault isolation (success, error, already_exists)
```gherkin
Given người dùng đã chọn 3 tệp ("doc1.md", "doc2.md", "doc3.md")
And backend mock: doc1 trả về success, doc2 trả về lỗi mạng 500, doc3 trả về already_exists
When người dùng nhấn "Bắt đầu nạp"
Then hệ thống nạp tuần tự cả 3 tệp không dừng lại khi doc2 gặp lỗi
And từng hàng hiển thị trạng thái riêng: doc1 thành công, doc2 lỗi, doc3 đã tồn tại
And phần tổng kết toàn queue hiển thị: 1 thành công, 1 đã tồn tại, 1 lỗi
```

### Scenario 13: Retry only failed request items, preserving others and locking controls while pending
```gherkin
Given hàng đợi gồm 4 tệp: doc-ok (success), doc-dup (already_exists), doc-oversized (validation error), doc-fail (request error)
When lượt nạp đầu kết thúc
Then chỉ có doc-ok, doc-dup, doc-fail được gọi tới API; doc-oversized bị chặn ở client
When người dùng nhấn nút "Thử lại tệp lỗi"
Then uploadDocument CHỈ được gọi lại đúng 1 lần cho doc-fail (call[3][0] === doc-fail)
And trong lúc retry đang pending:
  - Bấm retry liên tiếp không làm tăng số lần gọi
  - Thẻ input chọn file bị disabled
  - Toàn bộ nút bỏ tệp bị khóa hoặc ẩn
  - Cả hai nút đóng modal bị disabled
When promise retry được resolve thành công
Then summary cập nhật: 2 thành công, 1 đã tồn tại, 1 lỗi (validation)
```

### Scenario 14: Client-side validation boundaries for extension and size
```gherkin
Given modal nạp tài liệu đang mở
When người dùng chọn các tệp:
  | Filename      | Size              | Hợp lệ? |
  | valid.MD      | 1024 bytes        | Có      |
  | exact.txt     | 10485760 bytes    | Có      |
  | empty.md      | 0 bytes           | Có      |
  | oversized.md  | 10485761 bytes    | Không   |
  | invalid.pdf   | 1024 bytes        | Không   |
Then "oversized.md" hiển thị thông báo lỗi vượt quá 10MB
And "invalid.pdf" hiển thị thông báo lỗi định dạng không hỗ trợ
When nhấn "Bắt đầu nạp"
Then uploadDocument CHỈ được gọi 3 lần cho 3 tệp hợp lệ
And 2 tệp lỗi validation KHÔNG được retry
```

### Scenario 15: Two files with identical filename are preserved as distinct queue items
```gherkin
Given người dùng chọn 2 đối tượng File riêng biệt nhưng có cùng tên "notes.md"
When đưa vào hàng đợi
Then giao diện hiển thị 2 hàng riêng biệt với id độc lập
When nhấn "Bắt đầu nạp"
Then cả 2 đối tượng File được gửi tuần tự theo đúng identity: call[0][0] === fileA, call[1][0] === fileB
```

### Scenario 16: Guard against duplicate start clicks while active
```gherkin
Given hàng đợi có tệp và request uploadDocument đang pending
When người dùng kích hoạt liên tiếp nút "Bắt đầu nạp"
Then không có request song song nào được gửi thêm
And uploadDocument vẫn chỉ được gọi đúng 1 lần
```

### Scenario 17: Lock modal close buttons and queue interactions during active upload
```gherkin
Given hàng đợi đang trong trạng thái nạp (uploading)
Then nút đóng '✕' ở header modal bị disabled
And nút "Đóng" ở footer modal bị disabled
And các nút xóa từng item bị disabled hoặc ẩn
```

### Scenario 18: File removal, cancel picker, and same-file re-selection via input reset
```gherkin
Given danh sách chờ có 2 tệp ("fileA.md", "fileB.md")
When người dùng xóa tệp "fileA.md"
Then danh sách chỉ còn "fileB.md"
When người dùng kích hoạt file input với danh sách rỗng (Cancel picker)
Then danh sách vẫn giữ nguyên "fileB.md"
When người dùng chọn lại cùng tệp "fileB.md" khi idle
Then danh sách được làm mới chính xác
```

### Scenario 19: Consistent modal reset across both Header and Empty State entry points
```gherkin
Given component KnowledgeView đang hoạt động
When mở modal từ Header, chọn tệp, đóng modal, rồi mở lại từ Header
Then hàng đợi mở ra hoàn toàn sạch
When mở modal từ Empty State, chọn tệp, đóng modal, rồi mở lại từ Empty State
Then hàng đợi mở ra cũng hoàn toàn sạch
```

### Scenario 20: TanStack Query Cache Invalidation timing and filter preservation across whole batch
```gherkin
Given người dùng đã thiết lập filter q="ADR", topic="architecture", status="canonical", golden=true
When nạp 2 tệp với 2 deferred promises
Then khi tệp 1 pending => chưa invalidate
And khi tệp 1 kết thúc nhưng tệp 2 pending => vẫn CHƯA invalidate
When tệp 2 kết thúc với lỗi
Then queryClient.invalidateQueries được gọi đúng 1 lần
And listDocuments được refetch với đúng đầy đủ params filter
When tiến hành retry và retry kết thúc
Then queryClient.invalidateQueries được gọi thêm đúng 1 lần (tổng 2)
And các giá trị filter trên controls tiếp tục được bảo toàn
```

### Scenario 21: Comprehensive malformed API response rejection matrix
```gherkin
Given người dùng nạp các tệp lần lượt nhận các phản hồi malformed:
  | Test Case | Payload phản hồi                         |
  | Case 1    | null hoặc undefined                      |
  | Case 2    | {} (thiếu status)                        |
  | Case 3    | { status: 'unknown_type' }               |
  | Case 4    | { status: 'success', document_id: '' }   |
  | Case 5    | { status: 'success', filename: '' }      |
When xử lý từng phản hồi
Then mục đó đều bị phân loại là lỗi hợp đồng (invalid_contract)
And KHÔNG được ghi nhận là thành công
And mục đó nằm trong diện được phép bấm "Thử lại tệp lỗi"
```
