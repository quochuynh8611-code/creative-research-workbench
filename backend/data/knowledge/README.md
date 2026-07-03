# Knowledge Base — Raw Markdown Files

Thư mục này chứa **93 file markdown nguồn** cho hệ thống TRIZ Creative Research Workbench.

> ⚠️ Thư mục này **KHÔNG được commit lên GitHub** (đã gitignore).  
> Chỉ file `.gitkeep` và `README.md` này được track.

---

## Cách setup

Sau khi clone repo, copy toàn bộ file từ thư mục nguồn vào đây:

```bash
# Copy từ thư mục local (Mac)
cp -r "/Users/mr.chem/Downloads/Notebooklm/phuong-phap-luan-sang-tạo/"*.md \
  backend/data/knowledge/
```

Hoặc tổ chức theo taxonomy (khuyến nghị cho Phase 2+):

```bash
mkdir -p backend/data/knowledge/{contradiction,function,evolution,business,case-study,learning,method,theory,research,creative,imagination}
```

---

## Taxonomy (11 nhãn — Phase 0)

| Nhãn | Mô tả | Số file |
|---|---|---|
| `contradiction` | Mâu thuẫn kỹ thuật/vật lý, 40 nguyên tắc, ma trận | ~12 |
| `function` | Phân tích chức năng, Function Value | ~6 |
| `evolution` | Quy luật phát triển hệ thống | ~4 |
| `business` | TRIZ trong kinh doanh, kịch bản quản trị | ~10 |
| `case-study` | Case study thực tế kỹ thuật & kinh doanh | ~9 |
| `learning` | Giáo trình, lộ trình học, khóa học | ~8 |
| `method` | Quy trình giải bài toán, thuật toán ARIZ | ~18 |
| `theory` | Nền tảng lý thuyết, tổng quan TRIZ | ~8 |
| `research` | Báo cáo nghiên cứu, khảo sát học thuật | ~4 |
| `creative` | Tư duy sáng tạo, phản biện, kỹ năng | ~9 |
| `imagination` | Trí tưởng tượng, biến đổi mẫu | ~5 |

---

## 10 Tài liệu Vàng (Golden Set — Benchmark Retrieval)

Dùng để đánh giá chất lượng retrieval pipeline (Phase 2):

1. `Giai-Quyet-Van-De-Va-Ra-Quyet-Dinh-Tap-1-Phan-Dung.pdf.md`
2. `40_nguyên_tắc_sáng_tạo.pdf.md`
3. `Phương_pháp_luận_sáng_tạo_TRIZ.md`
4. `quytrinhsangtao.pdf.md`
5. `Case_Study_TRIZ_for_Business_Problems.md`
6. `Business-TRIZ.pdf.md`
7. `01_Contradictions_Exercises_Actual.pdf.md`
8. `Introduction_to_TRIZ.pdf.md`
9. `Oxford_TRIZ_Case_Studies.md`
10. `PRACTICE_OF_SOLVING_BUSINESS_PROBLEMS_USING_TRIZ_TOOLS_PETROV_ACTA_TECHNICA_NAPOCENSIS_-_Series_APPL.md`

---

## Định dạng Metadata (chuẩn hóa trong Phase 0)

Mỗi file markdown cần có frontmatter:

```yaml
---
title: "Tên tài liệu"
topic: contradiction          # 1 trong 11 nhãn taxonomy
source_type: book|article|exercise|case-study|course
language: vi|en
tags: [triz, contradiction, business]
golden: true                  # chỉ đánh cho 10 tài liệu vàng
---
```
