# PHASE 12.1 — ALEMBIC REVISION 003: PGVECTOR COSINE INDEX SPECIFICATION
- **Tài liệu:** Đặc tả kỹ thuật & Quyết định Kiến trúc Phase 12.1
- **Dự án:** Creative Research Workbench
- **Trạng thái:** 🟡 SPEC & RED PHASE (Chờ phê duyệt triển khai Migration)
- **Kỷ luật áp dụng:** Spec-first, Test-first, Read-before-write, Non-destructive Rollback

---

## 1. Problem Statement & Mục tiêu

Trong hệ thống hiện tại:
- Bảng `chunks` lưu trữ vector nhúng 1536 chiều (`embedding: Vector(1536)`).
- Tính năng Hybrid Search (`RetrievalService._vector_search`) thực hiện truy vấn tương đồng cosine thông qua toán tử `<=>` của `pgvector`.
- Tuy nhiên, cột `chunks.embedding` hiện chưa có index vector (chỉ có btree index trên `document_id` và `chunk_index`), khiến các truy vấn vector phải thực hiện quét tuần tự toàn bảng (Sequential Scan).

**Mục tiêu Phase 12.1:**
- Tạo migration chính quy `003` trong chuỗi Alembic để thiết lập index vector cosine cho bảng `chunks`.
- Đảm bảo cơ chế rollback sạch (`drop index only`), hoàn toàn không làm biến đổi cấu trúc bảng hoặc mất mát dữ liệu.

---

## 2. Scope & Out-of-Scope

### Trong phạm vi (In-Scope):
1. Quản lý Alembic Revision `003` nối tiếp sau revision `002_add_research_notes_and_candidate_solutions.py`.
2. Tạo index cosine trên cột `chunks.embedding` với tên chuẩn: `ix_chunks_embedding_cosine`.
3. Hàm `downgrade()` thực hiện gỡ bỏ index an toàn qua `op.drop_index`.
4. Bộ integration tests kiểm thử độc lập chu trình `upgrade` -> `downgrade` và bảo toàn dữ liệu trên PostgreSQL testcontainer.

### Ngoài phạm vi (Out-of-Scope):
1. Không thay đổi schema các bảng `documents`, `chunks`, `research_sessions` hay các bảng khác.
2. Không thay đổi logic truy vấn trong `RetrievalService` hay `IngestionService`.
3. Không can thiệp `uv.lock` hoặc thêm dependency mới.

---

## 3. Lựa chọn Chiến lược Index & Decision Note

### 3.1 Chiến lược Index: IVFFlat Cosine
Bám sát **Architectural Intent** đã được định nghĩa trong codebase:
- Tại `backend/src/app/domain/models.py` (dòng 171-173), model `Chunk` ghi chú:
  > `# IVFFlat cosine index — tạo AFTER ingest đủ dữ liệu (min ~1000 rows).`
  > `# Không tạo trong metadata.create_all — sẽ tạo qua Alembic migration riêng.`
- Cú pháp DDL:
  ```sql
  CREATE INDEX IF NOT EXISTS ix_chunks_embedding_cosine
  ON chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);
  ```

### 3.2 Decision Note về Tham số `lists` & Định hướng So sánh
- **Cấu hình `lists = 10`**: Phù hợp cho môi trường kiểm thử tích hợp và giai đoạn đầu của hệ thống. Khi số lượng chunk tăng trưởng quy mô lớn trong production (>= 10,000 chunks), giá trị `lists` có thể được tinh chỉnh tương ứng theo công thức khuyến nghị `lists = sqrt(rows)` hoặc `rows / 1000`.
- **Định hướng so sánh với HNSW**: HNSW có ưu điểm xây dựng đồ thị liên tục không phụ thuộc số lượng mẫu ban đầu, nhưng tiêu tốn bộ nhớ RAM lớn hơn. Việc giữ IVFFlat đảm bảo tính nhất quán tuyệt đối với thiết kế ban đầu của repository và tối ưu tài nguyên cho môi trường nghiên cứu cục bộ.
- **Tuyên bố về Hiệu năng**: Index vector hỗ trợ cơ chế Approximate Nearest Neighbor (ANN) giúp tăng tốc độ định vị các vector gần nhất so với quét tuần tự; tài liệu này không đưa ra các khẳng định lý thuyết chưa qua benchmark đo lường thực tế trên khối lượng dữ liệu cụ thể.

---

## 4. Discrepancy Note (Đối chiếu Roadmap và Mã nguồn Thực tế)

- **Ghi chú trong Roadmap cũ**: Mục 12.4 trong `docs/PROFESSIONAL_UPGRADE_ROADMAP.md` từng ghi nhận *"Không có Alembic setup, schema tạo qua metadata.create_all"*.
- **Thực tế trong Mã nguồn**: Alembic **đã được cấu hình đầy đủ** trong thư mục `backend/alembic/` với 2 bản migration `001_baseline_schema` và `002_add_research_notes_and_candidate_solutions`. Do đó, Phase 12.1 tiếp tục phát triển bản migration `003` trực tiếp trên nền tảng sẵn có.

---

## 5. Rollback Plan

Quy trình Rollback được thiết kế 100% an toàn:
1. Khi thực thi `alembic downgrade 002` hoặc `alembic downgrade -1`:
   - Lệnh hạ cấp chỉ thực hiện:
     ```python
     op.drop_index("ix_chunks_embedding_cosine", table_name="chunks")
     ```
   - Không thực hiện bất kỳ lệnh `DROP TABLE`, `ALTER TABLE`, hoặc thao tác xóa/sửa dữ liệu nào.
2. Dữ liệu văn bản, metadata tài liệu và mảng vector `embedding` trong bảng `chunks` được bảo toàn nguyên vẹn 100%.

---

## 6. Gherkin Scenarios cho Phase 12.1

```gherkin
Feature: pgvector Cosine Index Migration (Alembic Revision 003)

  Scenario: Upgrade database to revision 003 creates ivfflat cosine index
    Given cơ sở dữ liệu đang ở revision "002"
    When thực thi lệnh "alembic upgrade head"
    Then revision hiện tại của database là "003"
    And bảng "chunks" xuất hiện index "ix_chunks_embedding_cosine"
    And index sử dụng access method "ivfflat" với operator class "vector_cosine_ops"

  Scenario: Downgrade database to revision 002 drops vector index safely
    Given cơ sở dữ liệu đang ở revision "003" có index "ix_chunks_embedding_cosine"
    When thực thi lệnh "alembic downgrade 002"
    Then revision hiện tại của database chuyển về "002"
    And index "ix_chunks_embedding_cosine" không còn tồn tại trên bảng "chunks"

  Scenario: Downgrade preserves all documents and chunks data
    Given cơ sở dữ liệu ở revision "003" có chứa tài liệu và chunks kèm vector nhúng
    When thực thi lệnh "alembic downgrade 002"
    Then số lượng bản ghi trong bảng "documents" và "chunks" không đổi
    And giá trị "embedding" của các chunks vẫn được lưu trữ nguyên vẹn
```
