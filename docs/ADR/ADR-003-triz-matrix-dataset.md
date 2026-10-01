# ADR-003: Canonical Storage and Fail-Closed Validation for Classical TRIZ 39×39 Matrix Dataset

> **Trạng thái**: Đã phê duyệt (Accepted)
> **Ngày**: 2026-10-01
> **Tác giả**: Staff Software Engineer & Technical Architect
> **Quyết định liên quan**: ADR-001 (Overall Architecture), ADR-002 (Phase 6-7 Foundation)

---

## 1. Bối cảnh (Context)

Hệ thống Creative Research Workbench yêu cầu tích hợp ma trận mâu thuẫn kỹ thuật TRIZ Classical 39x39 đầy đủ (1,521 tọa độ) cùng với danh mục 39 thông số kỹ thuật và 40 nguyên tắc sáng tạo song ngữ.

Trước đây, hệ thống chỉ có một bộ mâu thuẫn nhỏ (sparse 10 cặp) được hardcode trong mã nguồn Python. Khi chuyển sang giai đoạn sản xuất (Phase 6.3 / QW-1):
1. Cần một nơi lưu trữ chuẩn hóa duy nhất (Single Source of Truth) cho file dữ liệu JSON thay vì hardcode trong mã nguồn.
2. Cần phân định rõ ràng vị trí đặt file: `backend/src/app/data/` (bên trong package Python) hay `backend/data/` (bên ngoài package).
3. Cần đảm bảo tính toàn vẹn của dữ liệu tại runtime: nếu dataset bị thiếu trường, sai cấu trúc, hoặc chứa ID nguyên tắc ngoài khoảng $[1..40]$, hệ thống phải phản ứng như thế nào.

---

## 2. Quyết định (Decision)

### 2.1 Vị trí lưu trữ Canonical Dataset
Chúng tôi quyết định lưu trữ canonical JSON dataset duy nhất tại:
```
backend/src/app/data/triz_matrix_39x39.json
```
**Lý do:**
- Thư mục `backend/src/app/data/` là một phần của Python package `app`.
- Khi đóng gói container Docker (`Dockerfile`), toàn bộ cây thư mục `src/app` được đưa vào image production, đảm bảo runtime luôn tìm thấy file mà không cần volume mount bổ sung.
- Không duplicate file sang `backend/data/` để tránh phân mảnh phiên bản (anti-drift).

### 2.2 Cơ chế Nạp và Xác thực Bất biến (Fail-Closed Loading)
- Dữ liệu được nạp đồng bộ một lần khi khởi động module `problem_structuring_service.py` và `method_recommender.py`.
- Hàm `validate_triz_matrix_data()` thực thi kiểm tra tính toàn vẹn nghiêm ngặt:
  - Đúng 39 parameters và 40 principles.
  - Đầy đủ 1,521 coordinates (`"1_1"` .. `"39_39"`).
  - Không chấp nhận `null` cho ô rỗng; quy ước bắt buộc là danh sách rỗng `[]`.
  - Mọi principle ID phải nằm trong dải $[1..40]$.
- **Fail-Closed**: Nếu bất kỳ điều kiện nào không thỏa mãn, ứng dụng lập tức ném `RuntimeError` và dừng khởi động, tuyệt đối không dùng fallback giả định.

### 2.3 Khả năng Phục hồi tại Tầng Recommender (Runtime Resilience)
- `MethodRecommender` lấy metadata trực tiếp từ JSON dataset đã nạp.
- Trong trường hợp bản ghi database chứa ID nguyên tắc không tìm thấy trong metadata, `MethodRecommender` kích hoạt cơ chế fallback an toàn (trả về title chuẩn hoặc tên số hiệu) thay vì làm sập HTTP request.

---

## 3. Hệ quả (Consequences)

### 3.1 Tích cực (Positive)
- **Toàn vẹn Dữ liệu 100%**: Loại bỏ hoàn toàn nguy cơ chạy trên dữ liệu rác hoặc dữ liệu giả lập.
- **Tương thích Container**: Tự động hoạt động trên Docker, Kubernetes, CI/CD mà không phụ thuộc vào đường dẫn tuyệt đối của host.
- **Hiệu năng Cao**: Ma trận và metadata được parse một lần vào memory dictionaries (`O(1)` lookup), không tốn I/O per request.

### 3.2 Tiêu cực / Ràng buộc (Negative / Trade-offs)
- Khi cập nhật dữ liệu ma trận, cần rebuild/restart service backend để nạp lại in-memory cache.
- Mọi sửa đổi vào file `triz_matrix_39x39.json` đều phải vượt qua bộ unit test kiểm toán trước khi merge.

---

## 4. Các Phương Án Đã Cân Nhắc (Alternatives Considered)

| Phương án | Đánh giá | Quyết định |
|---|---|---|
| **Hardcode ma trận trong Python** | Khó bảo trì, phình to file source code, không thể trích xuất metadata song ngữ độc lập | ❌ Bác bỏ |
| **Lưu trong Database SQL table** | Tăng độ phức tạp schema, tốn query I/O cho dữ liệu tĩnh bất biến (Altshuller 1985 không thay đổi) | ❌ Bác bỏ |
| **Lưu tại `backend/data/` ngoài source** | Gây lỗi runtime trong Docker nếu Dockerfile chỉ copy `src/` vào container | ❌ Bác bỏ |
| **Canonical JSON tại `backend/src/app/data/`** | Tự chứa trong package, dễ kiểm thử, hiệu năng tối ưu, an toàn container | ✅ **ĐÃ CHỌN** |
