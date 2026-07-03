# IMPLEMENTATION ROADMAP — Creative Research Workbench

## Phase 0 — Discovery
- [ ] Kiểm kê và gắn nhãn toàn bộ kho markdown.
- [ ] Chuẩn hóa taxonomy: contradiction, function, evolution, business, case-study, learning.
- [ ] Chọn 10 tài liệu vàng để làm benchmark retrieval.

## Phase 1 — Domain & Spec
- [ ] Chốt PRODUCT SPEC.
- [ ] Chốt ADR-001.
- [ ] Chốt domain model.
- [ ] Chốt 10 kịch bản Gherkin đầu tiên.

## Phase 2 — Ingestion & Retrieval
- [ ] Xây pipeline parse markdown.
- [ ] Chunk theo section.
- [ ] Tạo metadata và index full-text.
- [ ] Tạo vector index.
- [ ] Viết benchmark retrieval offline.

## Phase 3 — Problem Structuring
- [ ] Thiết kế schema cho ProblemFrame.
- [ ] Thiết kế contradiction extractor.
- [ ] Thiết kế cause-effect builder.
- [ ] Thiết kế function model representation.

## Phase 4 — Reasoning Workflow
- [ ] Thiết kế workflow stages và state machine.
- [ ] Tạo method recommender.
- [ ] Tạo idea studio.
- [ ] Tạo evaluation matrix.

## Phase 5 — UI Workspace
- [ ] Session list.
- [ ] Session detail.
- [ ] Problem framing canvas.
- [ ] Source panel.
- [ ] Idea comparison board.
- [ ] Research notebook timeline.

## Phase 6 — Verification
- [ ] Viết integration tests theo Gherkin.
- [ ] Chạy golden-set evaluation cho retrieval.
- [ ] Chạy QA với 5 bài toán thật.
- [ ] Đo citation accuracy và task completion.

## Trade-off Notes
- Làm nhanh nhất: chatbot + vector search.
- Làm đúng hơn: workflow engine + structured state + hybrid retrieval.
- Hướng đề xuất: ưu tiên phương án thứ hai vì phù hợp bản chất sản phẩm nghiên cứu.
