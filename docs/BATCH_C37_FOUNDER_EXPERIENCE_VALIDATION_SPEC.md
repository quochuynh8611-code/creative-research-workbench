---
title: "BATCH C37 — FOUNDER EXPERIENCE VALIDATION & UX HARDENING SPEC"
topic: "founder-experience-validation"
source_type: "spec"
language: "vi"
tags: ["c37", "ux", "qa", "feedback", "smoke-test", "test-first"]
status: "draft"
created: "2026-11-19"
---

# BATCH C37 — Founder Experience Validation & UX Hardening Spec

## 1. Mục tiêu

Batch C37 nhằm chuyển kết quả kiểm thử thủ công của Founder thành một quy trình có bằng chứng, có thể lặp lại và có khả năng xử lý an toàn:

1. Kiểm chứng các luồng sản phẩm cốt lõi trên local stack.
2. Thu thập bug, UX issue và feature request theo cấu trúc.
3. Phân loại, ưu tiên và chuyển hóa feedback thành công việc có thể kiểm chứng.
4. Sửa các lỗi nhỏ có blast radius thấp theo nguyên tắc test-first.
5. Không mở rộng tính năng TRIZ/domain/workflow mới trong C37.

## 2. Phạm vi

### In Scope

- Founder Experience Test Checklist cho frontend `http://localhost:3011`.
- API smoke checklist cho `http://localhost:8000/docs` và `GET /health`.
- Quy trình ghi nhận issue: URL, bước tái hiện, kết quả mong đợi, kết quả thực tế, severity, screenshot/console/network evidence.
- Issue triage matrix: Bug, UX, Product Gap, Technical Debt, Documentation, Deployment/Ops.
- Regression smoke test cho các luồng: tạo session, chọn domain/lens/workflow, problem frame, workflow stepper, notes/solutions, search/evidence, export/import, AI Coach mock.
- Fix nhỏ cho lỗi xác nhận, ưu tiên theo severity và blast radius.
- Cập nhật task log Obsidian và tài liệu vận hành nếu phát hiện gap.

### Out of Scope

- Thêm domain template, lens TRIZ, workflow profile hoặc AI capability mới.
- Thay đổi database schema, Alembic migration, hoặc backend runtime contract.
- Thêm dependency frontend/backend mới.
- Deploy production, thay đổi AI provider, hoặc bật real LLM/embedding.
- Xóa hoặc refactor các thư mục legacy `apps/api/` và `frontend/`.
- Tự động merge PR hoặc deploy mà không có lệnh Founder.

## 3. Nguyên tắc kỹ thuật

- **Read-Before-Write:** Mọi fix phải bắt đầu bằng đọc code, test và contract liên quan.
- **Test-First:** Mỗi bug được xác nhận phải có failing test hoặc Gherkin scenario chứng minh triệu chứng trước khi sửa.
- **Blast Radius:** Ưu tiên fix hai chiều, cô lập trong một component/service, không thay đổi public API.
- **Graceful Degradation:** UI phải xử lý rõ ràng trạng thái loading, empty, error và không mất draft người dùng.
- **Zero Secret:** Không ghi API key, token, password hay dữ liệu nhạy cảm vào issue, log, test fixture hoặc tài liệu.
- **Mock-first:** AI Coach và embedding vẫn chạy Mock mode trong C37; không phát sinh chi phí token.

## 4. Founder Test Checklist

### 4.1 Session Lifecycle

- Tạo session từ danh sách session.
- Tạo session từ domain template.
- Mở lại session sau khi reload trang.
- Đổi trạng thái workflow và kiểm tra persistence.
- Xóa hoặc hủy thao tác có confirmation modal.

### 4.2 Domain, Lens & Workflow

- Chọn từng domain template khả dụng.
- Kiểm tra domain resolver ánh xạ lens phù hợp.
- Chuyển qua 6 lens TRIZ 9-Windows.
- Chạy 3 Workflow Profiles: `standard_triz`, `rapid_prototyping`, `stakeholder_alignment`.
- Kiểm tra `WorkflowProfileGuidance` lưu và khôi phục lựa chọn qua `localStorage` key versioned `v1`.

### 4.3 Research Workspace

- Nhập problem statement và tạo problem frame.
- Kiểm tra normalized view và contradiction badge.
- Chuyển bước workflow và xem principle suggestions.
- Tạo, chỉnh sửa và lưu note/solution.
- Kiểm tra confirmation modal trước hành động có nguy cơ mất dữ liệu.

### 4.4 Search & Evidence

- Dùng Search Overlay qua `Cmd+K` / `Ctrl+K`.
- Kiểm tra debounce, kết quả, score và source reference.
- Mở Evidence Panel và kiểm tra trích đoạn tài liệu.
- Kiểm tra empty state và error state khi API lỗi.

### 4.5 Export & Import

- Export Markdown.
- Export JSON snapshot.
- Kiểm tra YAML frontmatter, domain, tags và 4 provenance sources: `triz_ariz`, `triz_evolution`, `triz_resource`, `ai_coach`.
- Import lại JSON và đối chiếu nội dung không suy hao.
- Kiểm tra error handling khi export/import thất bại.

### 4.6 AI Coach

- Gọi AI Coach trong Mock mode.
- Kiểm tra giới hạn tối đa 5 suggestions.
- Kiểm tra hard grounding và fallback rule-based.
- Chỉ lưu solution từ `solution_candidate`.
- Xác nhận không có mutation DB ngoài hành động được Founder phê duyệt.

## 5. Issue Triage Matrix

| Loại | Định nghĩa | Ưu tiên mặc định | Hành động C37 |
|---|---|---:|---|
| Blocker | Chặn Founder hoàn thành luồng cốt lõi hoặc gây mất dữ liệu | P0 | Fix ngay sau test-first |
| Critical Bug | Chức năng sai kết quả, crash, hoặc vi phạm persistence | P1 | Fix trong C37 nếu blast radius thấp |
| UX Issue | Chức năng đúng nhưng khó hiểu, khó dùng, thiếu feedback | P1/P2 | Đề xuất fix nhỏ hoặc backlog |
| Product Gap | Thiếu khả năng quan trọng nhưng chưa có spec | P2 | Đưa vào C38 Planning, không tự triển khai |
| Technical Debt | Nợ chất lượng không chặn người dùng | P2/P3 | Backlog có test bảo vệ |
| Documentation | Runbook/spec thiếu hoặc sai | P3 | Cập nhật tài liệu |
| Ops Issue | Docker, health, migration, log, backup | P1/P2 | Xử lý qua runbook, không đổi schema |

## 6. Acceptance Criteria

- [ ] Founder Experience Test Checklist hoàn chỉnh và có thể thực thi trên local stack.
- [ ] Mọi issue Founder báo cáo được ghi nhận với evidence tối thiểu.
- [ ] Mỗi P0/P1 bug có Gherkin scenario và failing test trước khi fix.
- [ ] Mọi fix nhỏ có unit/integration test tương ứng GREEN.
- [ ] Backend: `ruff check` và `mypy` không lỗi.
- [ ] Frontend: TypeScript check không lỗi; không console error trong happy path.
- [ ] Loading, empty và error state được kiểm chứng cho các luồng bị ảnh hưởng.
- [ ] Responsive kiểm tra ở 375px và 1280px cho UI bị thay đổi.
- [ ] Stability Smoke Test đạt tối thiểu 92/92 hoặc được giải trình rõ lý do thay đổi.
- [ ] Không có schema migration, dependency mới, endpoint mới, secret, hoặc deploy trong C37.

## 7. Definition of Done

Batch C37 được coi là DONE khi:

1. Founder đã thực hiện hoặc xác nhận checklist kiểm thử.
2. Tất cả issue được triage với severity, root cause hypothesis và evidence.
3. Các fix được duyệt đều có test-first artifact và test GREEN.
4. Roadmap được cập nhật trạng thái C37.
5. Task log Obsidian ghi nhận quyết định, phát hiện và kết quả kiểm chứng.
6. Founder xác nhận không còn blocker trước khi đóng batch.
