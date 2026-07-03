# IMPLEMENTATION ROADMAP — Creative Research Workbench

## Phase 0 — Discovery
- [ ] Kiểm kê và gắn nhãn toàn bộ kho markdown.
- [ ] Chuẩn hóa taxonomy: contradiction, function, evolution, business, case-study, learning.
- [ ] Chọn 10 tài liệu vàng để làm benchmark retrieval.

## Phase 1 — Domain & Spec ✅
- [x] Chốt PRODUCT SPEC.
- [x] Chốt ADR-001.
- [x] Chốt domain model.
- [x] Chốt Gherkin scenarios.

## Phase 2 — Ingestion & Retrieval
- [ ] Xây pipeline parse markdown.
- [ ] Chunk theo section.
- [ ] Tạo metadata và index full-text.
- [ ] Tạo vector index (pgvector).
- [ ] Viết benchmark retrieval offline.

## Phase 3 — Problem Structuring
- [ ] Schema cho ProblemFrame.
- [ ] Contradiction extractor.
- [ ] Cause-effect builder.
- [ ] Function model representation.

## Phase 4 — Reasoning Workflow
- [ ] Workflow stages và state machine.
- [ ] Method recommender.
- [ ] Idea studio.
- [ ] Evaluation matrix.

## Phase 5 — UI Workspace
- [ ] Session list.
- [ ] Session detail + workspace layout.
- [ ] Problem framing canvas.
- [ ] Source panel + citations.
- [ ] Idea comparison board.
- [ ] Research notebook timeline.

## Phase 6 — Verification
- [ ] Integration tests theo Gherkin.
- [ ] Golden-set evaluation cho retrieval.
- [ ] QA với 5 bài toán thật.
- [ ] Đo citation accuracy và task completion.
