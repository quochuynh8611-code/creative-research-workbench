---
title: "PRODUCT SPEC — Creative Research Workbench"
topic: "product"
source_type: "spec"
language: "vi"
tags: ["triz", "problem-framing", "mvp", "user-story", "research-tool"]
phase: "1"
status: "canonical"
golden: true
created: "2026-07-03"
---

# PRODUCT SPEC — Creative Research Workbench

## Tầm nhìn sản phẩm

Một công cụ hỗ trợ tư duy sáng tạo dựa trên phương pháp luận TRIZ, giúp người dùng:
1. Cấu trúc hóa bài toán phức tạp
2. Xác định mâu thuẫn kỹ thuật và vật lý
3. Tìm kiếm nguyên tắc sáng tạo phù hợp từ kho tài liệu
4. Lưu trữ và quản lý các phiên nghiên cứu

## Người dùng mục tiêu

- **Primary:** Kỹ sư, nhà nghiên cứu, product manager cần giải quyết bài toán có mâu thuẫn
- **Secondary:** Giảng viên/học viên học phương pháp TRIZ

## MVP Scope (Phase 1-3)

### Phải có (Must Have)
- [ ] Tạo và quản lý Research Session
- [ ] Nhập bài toán dạng văn bản tự do
- [ ] Normalize + cấu trúc hóa problem statement
- [ ] Phát hiện contradiction type (technical/physical)
- [ ] Tìm kiếm tài liệu liên quan (hybrid search)
- [ ] Gợi ý inventive principles từ TRIZ matrix

### Nên có (Should Have)
- [ ] Cause-Effect analysis (5-Why / Fishbone)
- [ ] Export session thành PDF/Markdown
- [ ] History + versioning cho problem frame

### Không có trong MVP (Out of Scope)
- Multi-user collaboration
- Real-time co-editing
- Mobile app

## User Stories

```
US-01: Là kỹ sư cơ khí, tôi muốn nhập mô tả bài toán bằng tiếng Việt
       để hệ thống giúp tôi xác định loại mâu thuẫn.

US-02: Là người dùng, tôi muốn xem danh sách các nguyên tắc sáng tạo
       phù hợp với mâu thuẫn của tôi, kèm ví dụ minh họa.

US-03: Là nhà nghiên cứu, tôi muốn tìm kiếm trong kho tài liệu TRIZ
       bằng câu hỏi tự nhiên và nhận được đoạn trích có liên quan.

US-04: Là người dùng, tôi muốn lưu phiên làm việc và tiếp tục sau.
```

## Acceptance Criteria tổng quát

- Latency search < 200ms (p95)
- Problem normalization accuracy > 80% (human eval)
- Recall@5 trên golden set >= 0.75
- Session persistence 100% (không mất data khi reload)
