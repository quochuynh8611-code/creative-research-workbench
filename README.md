# Creative Research Workbench

> Biến kho tài liệu TRIZ thành một **research copilot có workflow** — hỗ trợ phân tích vấn đề, gợi ý phương pháp sáng tạo, truy xuất case và lưu lại tiến trình tư duy.

---

## Tổng quan sản phẩm

Creative Research Workbench là phần mềm hỗ trợ nhà nghiên cứu, kỹ sư, product manager và người học áp dụng phương pháp luận sáng tạo (TRIZ, Design Thinking, ...) vào thực tiễn. Sản phẩm không chỉ là kho tài liệu mà là hệ thống workflow hỗ trợ:

- **Chuẩn hóa vấn đề** từ ngôn ngữ tự nhiên → ProblemFrame có cấu trúc
- **Phát hiện mâu thuẫn**, function map, cause-effect chain
- **Gợi ý công cụ TRIZ** phù hợp với loại bài toán
- **Semantic retrieval** trên kho tài liệu nội bộ với citation
- **Lưu reasoning trail** để tái sử dụng sau này

---

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy |
| Database | PostgreSQL + pgvector |
| AI / Retrieval | OpenAI API hoặc Ollama (local) |
| Frontend | React 18 + Vite + TailwindCSS |
| Infra (dev) | Docker Compose |
| Testing | pytest (backend), Vitest (frontend) |

---

## Cấu trúc thư mục

```
creative-research-workbench/
├── docs/                     # Tài liệu thiết kế
│   ├── PRODUCT_SPEC.md
│   ├── DOMAIN_SCHEMA.md
│   ├── API_CONTRACTS.md
│   ├── UI_MODULE_BREAKDOWN.md
│   ├── IMPLEMENTATION_ROADMAP.md
│   ├── TEST_PLAN.md
│   └── adr/
│       └── ADR-001-architecture.md
├── backend/
│   ├── pyproject.toml
│   ├── alembic/
│   └── src/app/
│       ├── api/v1/
│       ├── domain/
│       ├── services/
│       └── infra/
├── frontend/
│   ├── package.json
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── store/
│       └── api/
├── docker-compose.yml
└── .github/
    └── workflows/ci.yml
```

---

## Chạy local (dev)

### Yêu cầu
- Docker & Docker Compose
- Python 3.11+
- Node.js 20+

### Khởi động

```bash
# Clone repo
git clone https://github.com/quochuynh8611-code/creative-research-workbench.git
cd creative-research-workbench

# Khởi động toàn bộ services
docker compose up -d

# Backend chạy tại http://localhost:8000
# Frontend chạy tại http://localhost:5173
# API docs tại http://localhost:8000/docs
```

### Backend dev (không dùng Docker)

```bash
cd backend
pip install -e ".[dev]"
uvicorn src.app.main:app --reload
```

### Frontend dev

```bash
cd frontend
npm install
npm run dev
```

---

## Roadmap

Xem chi tiết tại [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md)

| Phase | Nội dung | Trạng thái |
|---|---|---|
| Phase 0 | Discovery — kiểm kê tài liệu | ⬜ |
| Phase 1 | Domain & Spec | ✅ |
| Phase 2 | Ingestion & Retrieval | ⬜ |
| Phase 3 | Problem Structuring | ⬜ |
| Phase 4 | Reasoning Workflow | ⬜ |
| Phase 5 | UI Workspace | ⬜ |
| Phase 6 | Verification | ⬜ |

---

## Tài liệu thiết kế

- [Product Spec](docs/PRODUCT_SPEC.md)
- [Domain Schema](docs/DOMAIN_SCHEMA.md)
- [API Contracts](docs/API_CONTRACTS.md)
- [UI Module Breakdown](docs/UI_MODULE_BREAKDOWN.md)
- [ADR-001 Architecture](docs/adr/ADR-001-architecture.md)

---

## License

MIT
