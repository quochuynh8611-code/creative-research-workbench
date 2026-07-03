---
title: "Definition of Done — Creative Research Workbench"
topic: "process"
source_type: "definition"
language: "vi"
tags: ["dod", "acceptance-criteria", "quality-gate", "checklist", "phase"]
phase: "1"
status: "canonical"
golden: true
created: "2026-07-03"
---

# Definition of Done — Creative Research Workbench

> Một feature/task chỉ được coi là **DONE** khi đáp ứng TẤT CẢ tiêu chí bên dưới tương ứng với layer của nó.

---

## Backend Feature

- [ ] Code đã được review (tự review hoặc PR review)
- [ ] Unit tests viết và pass (coverage >= 80% cho module mới)
- [ ] Integration test liên quan pass (GREEN)
- [ ] Không có linting error (`ruff check`)
- [ ] Không có type error (`mypy`)
- [ ] API endpoint có request/response validation (Pydantic)
- [ ] Không có N+1 query (kiểm tra với `sqlalchemy-utils` hoặc log)
- [ ] Migration script tạo nếu có thay đổi schema
- [ ] Documented trong `API_CONTRACTS.md` nếu là endpoint mới

---

## Frontend Feature

- [ ] Component render đúng trên Chrome + Firefox
- [ ] Không có TypeScript error
- [ ] Unit test với Vitest (coverage >= 70%)
- [ ] Loading state và error state được xử lý
- [ ] Responsive: mobile (375px) và desktop (1280px)
- [ ] Không có console error khi chạy bình thường

---

## Database / Schema Change

- [ ] Alembic migration tạo và test rollback
- [ ] Constraints (NOT NULL, UNIQUE, FK) đúng theo DOMAIN_SCHEMA.md
- [ ] Index tạo cho các trường query thường xuyên
- [ ] Seed data hoặc fixture test data có sẵn

---

## Phase Completion Gate

| Phase | Gate |
|---|---|
| Phase 0 | `knowledge-inventory.md` hoàn chỉnh, 10 golden docs có frontmatter |
| Phase 1 | Tất cả spec docs reviewed và approved |
| Phase 2 | Search pipeline GREEN, Recall@5 >= 0.75 |
| Phase 3 | Gherkin Phase 3 pass 100%, contradiction detection >= 80% |
| Phase 4 | E2E workflow problem → principles hoạt động |
| Phase 5 | Playwright happy path pass, Lighthouse >= 80 |
