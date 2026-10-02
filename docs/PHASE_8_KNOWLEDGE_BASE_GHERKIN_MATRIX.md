---
title: "PHASE 8 GHERKIN TEST MATRIX — Knowledge Base Management"
topic: "knowledge-base"
source_type: "test-matrix"
language: "vi"
tags: ["phase-8", "gherkin", "bdd", "documents-api", "knowledge-page", "test-first"]
phase: "8"
status: "draft"
golden: false
created: "2026-10-02"
---

# PHASE 8 GHERKIN TEST MATRIX — Knowledge Base Management

> **Mục tiêu:** Ma trận kịch bản BDD (Given-When-Then) kiểm thử cho Vertical Slice của Phase 8, bao gồm Backend Integration Tests, Frontend API Client Contract Tests, và Frontend Component Tests.

---

## 1. Backend Integration Scenarios (`backend/tests/integration/test_documents_api.py`)

### Scenario 1.1: Liệt kê danh sách tài liệu có phân trang và bộ lọc (Maps to AC-1)
- **Given:** Cơ sở dữ liệu chứa 10 Golden Documents và 2 tài liệu thông thường thuộc các topic `architecture`, `triz`, `domain-model`.
- **When:** Gửi request `GET /api/v1/documents?topic=architecture&limit=10&offset=0`.
- **Then:**
  - Response status code là 200.
  - Body chứa mảng `data` với các documents có `topic == "architecture"`.
  - Mỗi phần tử có đủ các trường: `id`, `filename`, `title`, `topic`, `status`, `golden`, `chunks_count`.
  - Object `meta` chứa `total`, `limit`, `offset`.

### Scenario 1.2: Lấy chi tiết tài liệu và danh sách chunks (Maps to AC-2)
- **Given:** Document có id `doc-123` chứa 3 chunks trong database.
- **When:** Gửi request `GET /api/v1/documents/doc-123`.
- **Then:**
  - Response status code là 200.
  - Body trả về metadata đầy đủ của document.
  - Mảng `data.chunks` chứa đúng 3 phần tử có `chunk_index`, `token_count`, `content`.

### Scenario 1.3: Upload file Markdown mới hợp lệ (Maps to AC-3)
- **Given:** File `case-study-01.md` có YAML frontmatter hợp lệ (`title: "Case Study Xe Điện"`, `topic: "automotive"`).
- **When:** Gửi request `POST /api/v1/documents/upload` dạng `multipart/form-data` kèm file.
- **Then:**
  - Response status code là 200.
  - Body trả về `data.status == "success"`.
  - Bảng `documents` tạo mới 1 record có `title == "Case Study Xe Điện"`.
  - Bảng `chunks` tạo các chunks tương ứng có embedding vector hợp lệ.

### Scenario 1.4: Upload file trùng lặp nội dung SHA-256 (Maps to AC-4)
- **Given:** File `case-study-01.md` đã được upload thành công trước đó (ID `doc-01`).
- **When:** Người dùng tiếp tục gửi `POST /api/v1/documents/upload` với file có cùng nội dung bytes.
- **Then:**
  - Response status code là 200 OK.
  - Body trả về `data.status == "already_exists"` và `data.document_id == "doc-01"`.
  - Không tạo thêm bất kỳ document hay chunk mới nào trong database.

### Scenario 1.5: Xóa tài liệu thông thường thành công (Maps to AC-5)
- **Given:** Document `doc-temp` có `golden = False` và 2 chunks trong DB.
- **When:** Gửi request `DELETE /api/v1/documents/doc-temp`.
- **Then:**
  - Response status code là 200 OK với `status: "deleted"`.
  - Query trong DB không còn tìm thấy `doc-temp`.
  - Toàn bộ 2 chunks của `doc-temp` bị cascade xóa sạch khỏi bảng `chunks`.

### Scenario 1.6: Chặn xóa tài liệu Golden Document (Maps to AC-6)
- **Given:** Document `doc-golden` có `golden = True` (ví dụ: Golden Document TRIZ).
- **When:** Gửi request `DELETE /api/v1/documents/doc-golden`.
- **Then:**
  - Response status code là 403 Forbidden.
  - Body chứa `detail: "Không được phép xóa tài liệu Golden chuẩn."`.
  - Document `doc-golden` và các chunks của nó vẫn được bảo toàn nguyên vẹn trong DB.

---

## 2. Frontend Contract Scenarios (`apps/web/lib/__tests__/api-client.test.ts`)

### Scenario 2.1: `listDocuments` unwrap đúng `{ data, meta }` (Maps to AC-1)
- **Given:** Backend trả về danh sách tài liệu mẫu.
- **When:** Gọi `listDocuments({ topic: 'triz', limit: 20 })`.
- **Then:** Client gửi đúng GET request kèm params và deserialize mảng `DocumentItem[]`.

### Scenario 2.2: `uploadDocument` gửi multipart request (Maps to AC-3 & AC-4)
- **Given:** Một file `File` object trong trình duyệt.
- **When:** Gọi `uploadDocument(file)`.
- **Then:** Client gửi FormData POST tới `/api/v1/documents/upload` và trả về `DocumentUploadResponse`.

### Scenario 2.3: `deleteDocument` xử lý response xóa (Maps to AC-5 & AC-6)
- **Given:** Document ID cần xóa.
- **When:** Gọi `deleteDocument('doc-123')`.
- **Then:** Client gửi DELETE request và unwrap status response.

---

## 3. Frontend Knowledge Page Scenarios (`apps/web/features/knowledge/__tests__/knowledge-page.test.tsx`)

### Scenario 3.1: Hiển thị bảng danh sách tài liệu kèm Golden Badges (Maps to AC-7)
- **Given:** API trả về danh sách gồm tài liệu Golden và tài liệu thường.
- **When:** Người dùng truy cập trang `/knowledge`.
- **Then:**
  - Bảng tài liệu hiển thị tên file, tiêu đề, topic, số chunks.
  - Tài liệu Golden hiển thị badge vàng `Golden Doc` nổi bật.
  - Nút Xóa của tài liệu Golden bị disabled hoặc có tooltip cảnh báo.

### Scenario 3.2: Lọc tài liệu theo Topic và Golden Status (Maps to AC-7)
- **Given:** Danh sách tài liệu có nhiều chủ đề khác nhau.
- **When:** Người dùng chọn filter `Topic = "architecture"` hoặc tick chọn `Chỉ hiện Golden Documents`.
- **Then:** Bảng danh sách cập nhật chỉ hiển thị các tài liệu thỏa mãn điều kiện lọc.

### Scenario 3.3: Kéo-thả upload file và hiển thị thông báo (Maps to AC-3, AC-4, AC-7)
- **Given:** Người dùng mở Modal Upload tài liệu trên trang `/knowledge`.
- **When:** Người dùng chọn 1 file `.md` và bấm "Bắt đầu nạp".
- **Then:**
  - Hiển thị spinner loading "Đang xử lý & tạo vector...".
  - Khi hoàn tất thành công: hiển thị thông báo "Nạp tài liệu thành công (3 chunks)", đóng modal và refresh bảng tài liệu.
  - Nếu file đã tồn tại (`already_exists`): hiển thị thông báo "Tài liệu này đã tồn tại trong Knowledge Base".

### Scenario 3.4: Xem chi tiết tài liệu và phân đoạn chunks (Maps to AC-2, AC-7)
- **Given:** Người dùng click nút "Xem chi tiết" của một tài liệu trên bảng.
- **When:** Modal/Drawer chi tiết mở ra.
- **Then:**
  - Hiển thị metadata đầy đủ (Title, Topic, Tags, Source Type, Language, Content Hash).
  - Hiển thị danh sách từng đoạn chunks kèm số lượng token.
