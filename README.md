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

## Architecture

```
creative-research-workbench/
├── apps/
│   ├── api/              # FastAPI backend
│   │   ├── domain/       # Core entities & business rules
│   │   ├── services/     # Orchestration logic
│   │   ├── api/          # Routes & controllers
│   │   ├── infrastructure/ # DB, retrieval, embeddings
│   │   └── tests/
│   └── web/              # Next.js frontend
│       ├── features/     # Session, intake, structuring, retrieval
│       └── components/
├── docs/                 # All specs, ADRs, contracts
└── docker-compose.yml
```

## Quick Start

### 1. Clone & setup environment
```bash
git clone https://github.com/quochuynh8611-code/creative-research-workbench.git
cd creative-research-workbench
cp .env.example .env
# Edit .env with your values
```

### 2. Start services
```bash
docker compose up -d db
```

### 3. Run API locally
```bash
cd apps/api
pip install uv
uv pip install -e .
uvicorn main:app --reload
```

### 4. Run tests
```bash
cd apps/api
pytest tests/ -v
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
