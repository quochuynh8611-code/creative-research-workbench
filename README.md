# Creative Research Workbench

Một workspace nghiên cứu sáng tạo kết hợp tri thức TRIZ với AI workflow — giúp biến vấn đề phức tạp thành phương án hành động rõ ràng.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 + FastAPI + Pydantic v2 |
| Database | PostgreSQL 16 + pgvector |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui |
| AI Layer | OpenAI API / Ollama (local) |
| Infra | Docker Compose |
| Testing | pytest + pytest-asyncio |

## Canonical Architecture (Sources of Truth)

Dự án tuân thủ nghiêm ngặt nguyên tắc **Single Source of Truth**:

```
creative-research-workbench/
├── backend/              # [CANONICAL BACKEND] Python 3.11 + FastAPI + SQLAlchemy + pgvector
│   ├── src/app/
│   │   ├── api/v1/       # REST API endpoints (sessions, search, problem-frames)
│   │   ├── domain/       # Core Domain Entities (ResearchSession, ProblemFrame, Contradiction, Chunk)
│   │   ├── services/     # Core Services (Ingestion, Hybrid Retrieval, Structuring, Recommender, FSM)
│   │   └── core/         # Config & Database Session Management
│   └── tests/            # Pytest test suites (Unit, Integration, Performance)
│
├── apps/web/             # [CANONICAL FRONTEND] Next.js 14 + TypeScript + Tailwind CSS + TanStack Query
│   ├── app/              # Next.js App Router (pages & layouts)
│   ├── features/         # Modular Feature Components
│   │   ├── session/      # Session list, detail & TRIZ Workflow Stepper
│   │   ├── intake/       # Problem Intake Form
│   │   ├── structuring/  # Normalized View & Contradiction Badge
│   │   ├── retrieval/    # Evidence Panel (10 Golden Documents citations)
│   │   ├── ideation/     # Principle Suggestions (40 TRIZ Inventive Principles)
│   │   └── search/       # Global Search Overlay (Cmd+K / Ctrl+K)
│   └── lib/              # API Client (Axios) & TypeScript Domain Types
│
├── docs/                 # Specifications, ADRs, Contracts, Implementation Checklists
├── docker-compose.yml    # Local multi-container orchestration (DB + Backend + Frontend)
│
├── apps/api/             # ⚠️ [DEPRECATED / LEGACY] Không phát triển thêm tại đây
└── frontend/             # ⚠️ [DEPRECATED / LEGACY] Không phát triển thêm tại đây
```

## Quick Start

### 1. Khởi động Database (PostgreSQL + pgvector)
```bash
docker compose up -d db
```

### 2. Chạy Backend (FastAPI)
```bash
cd backend
PYTHONPATH=src uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
# Kiểm tra Health: curl http://127.0.0.1:8000/health
```

### 3. Chạy Frontend (Next.js)
```bash
cd apps/web
npm install
npm run dev -- --port 3011
# Truy cập UI tại: http://localhost:3011/sessions
```

### 4. Chạy Kiểm thử (Testing)
- **Frontend Tests (Jest + TypeScript + ESLint):**
  ```bash
  cd apps/web
  npm test
  npm run type-check
  npm run lint
  ```
- **Backend Tests (Pytest):**
  ```bash
  cd backend
  PYTHONPATH=src uv run pytest tests/ -v
  ```

## Documentation

| File | Nội dung |
|---|---|
| [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | Mục tiêu sản phẩm |
| [ADR-001-architecture.md](docs/ADR-001-architecture.md) | Quyết định kiến trúc |
| [DOMAIN_SCHEMA.md](docs/DOMAIN_SCHEMA.md) | Schema domain |
| [IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md) | Roadmap thực thi |
| [GHERKIN_SCENARIOS.md](docs/GHERKIN_SCENARIOS.md) | Test scenarios |
| [UI_MODULE_BREAKDOWN.md](docs/UI_MODULE_BREAKDOWN.md) | UI modules |
| [TEST_PLAN.md](docs/TEST_PLAN.md) | Kế hoạch test |

## Workflow Stages

```
Intake → Structuring → Retrieval → Ideation → Evaluation → Synthesis
```

## License
Private repository — all rights reserved.
