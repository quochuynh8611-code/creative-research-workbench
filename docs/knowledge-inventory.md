# Knowledge Inventory — Creative Research Workbench

> Phase 0 — Discovery: Kiểm kê và chuẩn hóa toàn bộ kho tài liệu dự án (vault Sang-Tao).
> Cập nhật: 2026-07-03

---

## Tổng quan

| Tổng số file | Canonical docs | Draft / note | Golden set |
|---|---|---|---|
| 21 | 10 | 11 | 10 |

---

## 1. Canonical Documents (dùng làm nguồn chính)

| # | Filename | Title | Topic | Source Type | Language | Tags | Ghi chú |
|---|---|---|---|---|---|---|---|
| 1 | `ADR-001-architecture.md` | ADR-001 — Kiến trúc cho Creative Research Workbench | `architecture` | `decision-record` | vi | adr, workflow-engine, retrieval, reasoning | **⭐ GOLDEN** |
| 2 | `API_CONTRACTS.md` | API CONTRACTS — Creative Research Workbench MVP | `api` | `contract` | vi | rest-api, endpoints, json, versioned | **⭐ GOLDEN** |
| 3 | `DOMAIN_SCHEMA.md` | DOMAIN SCHEMA — Creative Research Workbench | `domain-model` | `schema` | vi | entity, pydantic, yaml, uuid | **⭐ GOLDEN** |
| 4 | `PRODUCT_SPEC.md` | PRODUCT SPEC — Creative Research Workbench | `product` | `spec` | vi | triz, problem-framing, mvp, user-story | **⭐ GOLDEN** |
| 5 | `IMPLEMENTATION_ROADMAP.md` | IMPLEMENTATION ROADMAP CHECKLIST | `roadmap` | `planning` | vi | sprint, phase, checklist, milestone | **⭐ GOLDEN** |
| 6 | `UI_MODULE_BREAKDOWN.md` | UI MODULE BREAKDOWN — Creative Research Workbench | `frontend` | `design` | vi | react, components, screens, workspace | **⭐ GOLDEN** |
| 7 | `TEST_PLAN.md` | TEST PLAN — Creative Research Workbench MVP | `testing` | `plan` | vi | pytest, acceptance, integration, unit | **⭐ GOLDEN** |
| 8 | `GHERKIN_SCENARIOS.md` | GHERKIN SCENARIOS — Creative Research Workbench | `testing` | `bdd` | vi | gherkin, scenario, feature, bdd | **⭐ GOLDEN** |
| 9 | `FAILING_INTEGRATION_TEST_SPEC.md` | FAILING INTEGRATION TEST SPEC — MVP | `testing` | `spec` | vi | integration-test, failing, tdd, red-green | **⭐ GOLDEN** |
| 10 | `Definition of Done — Creative Research Workbench.md` | Definition of Done — Creative Research Workbench | `process` | `definition` | vi | dod, acceptance-criteria, quality-gate | **⭐ GOLDEN** |

---

## 2. Extended / Draft Documents

| # | Filename | Title | Topic | Source Type | Ghi chú |
|---|---|---|---|---|---|
| 11 | `ADR-001 — Architecture for Creative Research Workbench.md` | ADR-001 — Architecture (EN version) | `architecture` | `decision-record` | Bản tiếng Anh của ADR-001 — dùng làm tham khảo phụ |
| 12 | `API_CONTRACTS.md theo kiểu tối giản.md` | API Contracts (tối giản) | `api` | `note` | Bản rút gọn API, có thể dùng để tạo mock server |
| 13 | `DOMAIN_SCHEMA.md.md` | Domain Schema (bản xuất thêm) | `domain-model` | `note` | Bản mở rộng thêm một số entity, review sau |
| 14 | `GHERKIN SCENARIOS.md` | GHERKIN SCENARIOS (bản đầy đủ) | `testing` | `bdd` | Bản dài hơn GHERKIN_SCENARIOS.md, chứa thêm edge cases |
| 15 | `IMPLEMENTATION_ROADMAP — Creative Research Workbench.md` | IMPLEMENTATION_ROADMAP (bản chi tiết) | `roadmap` | `planning` | Bản mô tả tường minh hơn — dùng để tham chiếu phase narrative |
| 16 | `Implementation Roadmap Checklist.md` | Implementation Roadmap Checklist | `roadmap` | `planning` | Bản checklist chi tiết theo sprint/tuần |
| 17 | `Tiếp tục xuất bản TEST_PLAN.md tối giản với các ac.md` | TEST_PLAN tối giản + acceptance gates | `testing` | `note` | Bản TEST_PLAN rút gọn kèm acceptance gate rõ ràng |
| 18 | `bắt đầu luôn với stack đề xuất + cấu trúc thư mục.md` | Stack đề xuất + cấu trúc thư mục dự án | `infrastructure` | `note` | Ghi chú khởi tạo: tech stack, file tree, bước đầu |
| 19 | `chuyển ngay roadmap hiện tại thành bảng sprint theo tuần.md` | Roadmap → bảng sprint theo tuần | `roadmap` | `note` | Chuyển đổi roadmap thành bảng sprint weekly |
| 20 | `làm luôn "starter file list": file nào tạo trước.md` | Starter file list — thứ tự tạo file | `infrastructure` | `note` | Thứ tự tạo file và bắt đầu sprint 1 |
| 21 | `xuất luôn file tree khởi tạo chi tiết dưới dạng Markdown.md` | File tree khởi tạo chi tiết | `infrastructure` | `note` | File tree dạng Markdown để dùng làm checklist tạo file thật |

---

## 3. Taxonomy

```yaml
topic:
  - architecture      # Quyết định kiến trúc hệ thống
  - api               # API contract, endpoint definitions
  - domain-model      # Entity schema, data model
  - product           # Product spec, user story, MVP scope
  - roadmap           # Sprint plan, milestone, checklist
  - frontend          # UI design, component breakdown
  - testing           # Test plan, BDD, integration spec
  - process           # Definition of Done, workflow process
  - infrastructure    # Tech stack, file structure, setup

source_type:
  - decision-record   # ADR — Architecture Decision Record
  - contract          # API contract, interface spec
  - schema            # Data/domain schema
  - spec              # Product or test spec
  - plan              # Roadmap, test plan, sprint plan
  - design            # UI/UX design breakdown
  - bdd               # Gherkin / BDD scenarios
  - definition        # Definition of Done
  - note              # Draft, extended, or supplementary notes
```

---

## 4. Golden Set — 10 tài liệu benchmark retrieval

Các tài liệu này được chọn vì độ bao phủ domain cao nhất, nội dung canonical không trùng lặp. Dùng làm benchmark cho retrieval pipeline (Recall@5, Precision@5).

| # | File | Lý do chọn | Query benchmark mẫu |
|---|---|---|---|
| 1 | `ADR-001-architecture.md` | Quyết định kiến trúc cốt lõi — workflow engine, retrieval layer | "Tại sao chọn workflow engine thay vì RAG thuần?" |
| 2 | `PRODUCT_SPEC.md` | Định nghĩa sản phẩm, user stories, MVP scope | "Phần mềm giải quyết bài toán gì cho người dùng?" |
| 3 | `DOMAIN_SCHEMA.md` | Schema entity: ResearchSession, ProblemFrame, Contradiction | "ProblemFrame có những trường nào?" |
| 4 | `API_CONTRACTS.md` | Endpoint và payload shape cho toàn bộ MVP | "API endpoint nào dùng để tạo session mới?" |
| 5 | `IMPLEMENTATION_ROADMAP.md` | Thứ tự ưu tiên và milestone theo phase | "Phase 2 bao gồm những task gì?" |
| 6 | `UI_MODULE_BREAKDOWN.md` | Breakdown UI theo screen và stage module | "Screen Workspace Canvas có những component gì?" |
| 7 | `TEST_PLAN.md` | Chiến lược test và acceptance criteria | "Acceptance gate cho Phase 2 là gì?" |
| 8 | `GHERKIN_SCENARIOS.md` | BDD scenario cho các user flow quan trọng | "Scenario nào test việc tạo ProblemFrame?" |
| 9 | `FAILING_INTEGRATION_TEST_SPEC.md` | TDD red-green spec cho integration tests | "Integration test nào cần viết đầu tiên?" |
| 10 | `Definition of Done — Creative Research Workbench.md` | Quality gate và DoD cho mọi feature | "Definition of Done cho một feature backend là gì?" |

---

## 5. Trạng thái Phase 0

- [x] Kiểm kê 21 file markdown trong vault Sang-Tao
- [x] Phân loại canonical (10) vs draft (11)
- [x] Gắn nhãn `topic` và `source_type` cho từng file
- [x] Xác định 10 Golden Documents với lý do và benchmark query
- [ ] Thêm YAML frontmatter vào từng file (Phase 1 pre-task)
- [ ] Chạy benchmark retrieval offline trên golden set (Phase 2 task)

---

*Tạo bởi: Phase 0 — Discovery | 2026-07-03 | vault: Sang-Tao*
