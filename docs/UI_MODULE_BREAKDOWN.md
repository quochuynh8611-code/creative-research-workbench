---
title: "UI MODULE BREAKDOWN — Creative Research Workbench"
topic: "frontend"
source_type: "design"
language: "vi"
tags: ["react", "components", "screens", "workspace", "nextjs", "shadcn"]
phase: "1"
status: "canonical"
golden: true
created: "2026-07-03"
---

# UI MODULE BREAKDOWN — Creative Research Workbench

> Stack: Next.js 14 + TypeScript + TailwindCSS + shadcn/ui + Zustand + TanStack Query

---

## Screen 1 — Session List (`/`)

**Mục đích:** Trang chủ — hiển thị danh sách phiên nghiên cứu

| Component | Mô tả |
|---|---|
| `SessionCard` | Hiển thị title, status badge, last updated |
| `NewSessionButton` | Mở modal tạo session mới |
| `SessionFilter` | Lọc theo status: active / paused / completed |
| `EmptyState` | UI khi chưa có session nào |

---

## Screen 2 — Problem Canvas (`/sessions/[id]`)

**Mục đích:** Màn hình làm việc chính — nhập và phân tích bài toán

| Component | Mô tả |
|---|---|
| `ProblemInputArea` | Textarea nhập problem statement tự do |
| `NormalizedView` | Hiển thị kết quả normalize từ backend |
| `ContradictionBadge` | Badge hiển thị loại contradiction phát hiện được |
| `WorkflowStepper` | Progress bar các bước TRIZ (step 1/5, 2/5...) |
| `PrincipleSuggestions` | Grid các inventive principles được gợi ý |
| `EvidencePanel` | Panel bên phải — kết quả search liên quan |

---

## Screen 3 — Search Overlay

**Mục đích:** Tìm kiếm trong kho tài liệu

| Component | Mô tả |
|---|---|
| `SearchInput` | Command palette style (Cmd+K) |
| `SearchResultItem` | Excerpt + source_ref + relevance score |
| `FilterChips` | Lọc theo topic, phase, status |

---

## State Management (Zustand)

```typescript
interface AppStore {
  sessions: Session[]
  activeSession: Session | null
  problemFrame: ProblemFrame | null
  searchResults: SearchResult[]
  workflowStep: number
  // actions
  setActiveSession: (s: Session) => void
  updateProblemFrame: (pf: ProblemFrame) => void
  setSearchResults: (r: SearchResult[]) => void
}
```

---

## Data Fetching (TanStack Query)

```typescript
// Key conventions
useQuery({ queryKey: ['sessions'] })
useQuery({ queryKey: ['session', id] })
useQuery({ queryKey: ['search', query, filters] })
useMutation({ mutationFn: createSession })
useMutation({ mutationFn: updateProblemFrame })
```
