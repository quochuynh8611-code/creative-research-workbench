---
title: "FAILING INTEGRATION TEST SPEC — BATCH C39 MULTI-SESSION EXPORT & ARCHIVE"
topic: "testing"
source_type: "spec"
language: "vi"
tags: ["c39", "integration-test", "failing", "tdd", "red-green", "jest", "pytest", "batch-export"]
status: "canonical"
test_status: "all-green"
created: "2026-11-20"
---

# FAILING INTEGRATION TEST SPEC — BATCH C39

> Tài liệu đặc tả các kịch bản kiểm thử tích hợp **phải viết trước** khi hiện thực hóa code cho từng lô trong Batch C39 (C39-FEAT-02).
> Theo kỷ luật Test-First (OODA Step 3), các test này phải ở trạng thái **RED (failing)** trước khi viết code sản phẩm, và chỉ chuyển sang **GREEN** sau khi code hoàn tất.

---

## Lô 1: Backend Batch Export Service & Streaming API

### Test 1.1: Backend Integration API Tests
- **File**: `backend/tests/integration/test_c39_batch_export_api.py`
- **Mục tiêu**: Kiểm tra endpoint `POST /api/v1/sessions/batch-export` xử lý đầy đủ các kịch bản:
  1. `test_batch_export_explicit_session_ids_zip_both_formats`: Xuất 2 session theo ID, kiểm tra file ZIP trả về có `manifest.json`, thư mục `markdown/` và `json/`, kiểm tra nội dung đúng với session gốc.
  2. `test_batch_export_filter_by_tag`: Xuất theo thẻ ghi chép `tag="pin-lithium"`, xác nhận chỉ đóng gói các session có ghi chú chứa tag đó.
  3. `test_batch_export_archive_after_export_flag`: Tùy chọn `archive_after_export=True` cập nhật `status = 'archived'` trong DB mà không làm mất dữ liệu.
  4. `test_batch_export_exceed_safety_limit_returns_422`: Tạo giả lập > 100 sessions, gửi request không filter, kiểm tra trả về HTTP 422 và header `X-Error-Code: EXCEED_BATCH_LIMIT`.
  5. `test_batch_export_zero_matching_sessions_returns_404`: Gửi request với filter không tồn tại, kiểm tra trả về HTTP 404.
  6. `test_batch_export_empty_request_returns_400`: Request không có `session_ids` và không có `filters` bị từ chối với HTTP 400.

```python
import io
import zipfile
import json
import pytest
from uuid import uuid4
from fastapi.testclient import TestClient

def test_batch_export_explicit_session_ids_zip(client: TestClient, db_session):
    # Setup 2 sessions
    s1 = create_dummy_session(db_session, title="Session Alpha", domain="business")
    s2 = create_dummy_session(db_session, title="Session Beta", domain="mechanical")
    
    payload = {
        "session_ids": [str(s1.id), str(s2.id)],
        "format": "both",
        "archive_after_export": False,
    }
    
    res = client.post("/api/v1/sessions/batch-export", json=payload)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/zip"
    assert "creative-research-archive-" in res.headers["content-disposition"]
    
    # Verify ZIP in-memory contents
    zip_bytes = io.BytesIO(res.content)
    with zipfile.ZipFile(zip_bytes, "r") as zf:
        namelist = zf.namelist()
        assert "manifest.json" in namelist
        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        assert manifest["total_sessions"] == 2
        assert len(manifest["sessions_index"]) == 2
        
        # Verify markdown and json files present
        md_files = [f for f in namelist if f.startswith("markdown/") and f.endswith(".md")]
        json_files = [f for f in namelist if f.startswith("json/") and f.endswith(".json")]
        assert len(md_files) == 2
        assert len(json_files) == 2
```

---

## Lô 2: Frontend API Client & BatchExportModal

### Test 2.1: BatchExportModal Component Tests
- **File**: `apps/web/features/session/__tests__/batch-export-modal.test.tsx`
- **Mục tiêu**: Kiểm tra giao diện modal xuất hàng loạt:
  1. Hiển thị đúng số lượng session được chọn hoặc số lượng khớp bộ lọc.
  2. Cho phép chuyển đổi qua lại giữa 3 định dạng xuất: `both`, `markdown`, `json`.
  3. Có hộp kiểm tùy chọn `Lưu trữ các phiên này sau khi xuất` kèm ghi chú an toàn.
  4. Trợ năng WCAG 2.1 AA: `role="dialog"`, `aria-modal="true"`, bấm `Escape` để hủy.
  5. Trạng thái tải: khi bấm nút xuất, hiển thị spinner và vô hiệu hóa nút submit để ngăn bấm đúp.
  6. Xử lý lỗi mạng: khi `batchExportSessions` ném lỗi `NetworkError`, hiển thị thông báo lỗi `role="alert"`, không đóng modal và cho phép bấm "Thử lại".

```typescript
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BatchExportModal } from '../batch-export-modal'
import * as apiClient from '@/lib/api-client'

jest.mock('@/lib/api-client')

describe('Lô 2: BatchExportModal Specification', () => {
  it('Hiển thị số lượng phiên đã chọn và gọi batchExportSessions khi submit', async () => {
    const mockExport = jest.spyOn(apiClient, 'batchExportSessions').mockResolvedValueOnce(new Blob(['dummy zip']))
    const handleClose = jest.fn()

    render(
      <BatchExportModal
        isOpen={true}
        onClose={handleClose}
        selectedSessionIds={['s1', 's2']}
        totalCount={2}
      />
    )

    expect(screen.getByText(/Đang xuất 2 phiên đã chọn/i)).toBeInTheDocument()

    // Bấm nút Tải xuống
    const downloadBtn = screen.getByRole('button', { name: /Tải xuống file ZIP/i })
    fireEvent.click(downloadBtn)

    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledWith(
        expect.objectContaining({
          session_ids: ['s1', 's2'],
          format: 'both',
          archive_after_export: false,
        })
      )
    })
  })
})
```

---

## Lô 3: Frontend Multi-Select & SessionList Integration

### Test 3.1: SessionList Multi-Select & Batch Toolbar Tests
- **File**: `apps/web/features/session/__tests__/session-list-batch-export-integration.test.tsx`
- **Mục tiêu**: Kiểm tra trải nghiệm người dùng tích hợp trên danh sách phiên:
  1. Checkbox xuất hiện trên từng thẻ session card kèm `aria-label`.
  2. Khi tích chọn 1 thẻ, xuất hiện Floating Batch Action Toolbar hiển thị `"Đã chọn 1 phiên"`.
  3. Master checkbox "Chọn tất cả trên trang này" chọn đồng loạt mọi session đang hiển thị.
  4. Nút "Bỏ chọn tất cả" đưa danh sách chọn về rỗng và ẩn thanh công cụ nổi.
  5. Nút "Xuất tệp nén" trên thanh công cụ mở `BatchExportModal` với đúng danh sách ID đã chọn.
  6. Khi xuất thành công với `archive_after_export = true`, invalidate query cache `['sessions']` để làm mới danh sách.

---

## Trạng Thái Kiểm Thử Sau Hiện Thực Hóa (Test-First Red → Green Verification)

| Lô | File Kiểm Thử | Trạng Thái Ban Đầu (Red) | Trạng Thái Sau Code (Green) | Bằng Chứng Kiểm Thử |
| :--- | :--- | :--- | :--- | :--- |
| **Lô 1** | `backend/tests/integration/test_c39_batch_export_api.py` | 10 FAILED | **10/10 PASSED** | Streaming ZIP, Tag filtering, Safety limit 100, Error handling |
| **Lô 1** | `backend/tests/unit/test_session_export_service.py` | 12 FAILED | **12/12 PASSED** | Slugify, Safe filenames, In-memory ZIP buffer |
| **Lô 2** | `apps/web/features/session/__tests__/batch-export-modal.test.tsx` | 10 FAILED | **10/10 PASSED** | WCAG 2.1 AA dialog, Format toggle, Direct download, Error recovery |
| **Lô 3** | `apps/web/features/session/__tests__/session-list-batch-export-integration.test.tsx` | 8 FAILED | **8/8 PASSED** | Multi-select checkboxes, Master select, FloatingBatchToolbar, Cache refresh |

**Tổng kết**: 40/40 tests mới viết cho Batch C39 đã chuyển sang **100% GREEN**. Full regression toàn hệ thống: Backend 665/665 PASS, Frontend 888/888 PASS.
