---
title: "UI MODULE BREAKDOWN — Creative Research Workbench"
topic: frontend
source_type: design
language: vi
tags: [react, components, screens, workspace, nextjs, typescript]
golden: true
phase: 0
created_at: 2026-07-03
---

# UI MODULE BREAKDOWN — Creative Research Workbench

## Product Surface
Single Page App với 2 màn hình chính và 6 stage module trong workspace.

## Screen 1 — Session List
- **Header**: app name, quick search, nút tạo session mới
- **Left filter**: domain, tags, status
- **Session cards**: title, domain, updated_at, progress stage badge
- **Empty state**: CTA "Tạo session đầu tiên" + minh họa

## Screen 2 — Session Workspace
- **Left sidebar**: workflow stages (intake → synthesis), stage progress indicator
- **Center canvas**: module theo stage hiện tại (xem Stage Modules)
- **Right panel**: source excerpts + citations từ retrieval
- **Top bar**: session title, save state indicator, status badge

## Stage Modules (Center Canvas)

### Stage 1 — Intake
- Raw problem input (textarea lớn)
- Clarifying questions (LLM-generated, user answers)
- Structured preview của ProblemFrame

### Stage 2 — Structuring
- ProblemFrame card: goal, constraints, affected_entities, failure_signals
- Contradiction board: technical vs physical
- Function map (basic)

### Stage 3 — Retrieval
- Search box
- Results list với excerpt preview
- Source reference chips

### Stage 4 — Methods
- Method suggestion cards
- Rationale text
- Citation chips trỏ về tài liệu nguồn

### Stage 5 — Ideation
- Candidate solution board
- Compare mode (side-by-side)
- Provenance indicator

### Stage 6 — Evaluation
- Multi-axis scoring matrix (feasibility, impact, originality, resource_cost)
- Score visualization (radar chart)

## Supporting Surfaces
- **Evidence Panel** (right): persistent, shows excerpts từ bất kỳ stage nào
- **History Panel**: version history của ProblemFrame
- **Export**: synthesis report (Markdown)

## Tech Stack
- React 18 + TypeScript
- Next.js 14 (App Router)
- TailwindCSS + shadcn/ui
- Zustand (state management)
- TanStack Query (API calls)
