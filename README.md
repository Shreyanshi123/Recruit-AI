# RecruitAI

RecruitAI is an AI-powered technical hiring platform for evaluating engineering candidates in a secure, structured, and auditable way.

The project combines:
- a FastAPI backend for interview orchestration, assessment management, analytics, and authentication
- a React + TypeScript frontend for recruiter and candidate experiences
- an AI evaluation pipeline under `ai_engine/` for rubric retrieval, guardrails, sandbox execution, and scoring
- SQLite-backed persistence for sessions, assessments, and telemetry
- Docker-based deployment support for local and production setups

## Product overview

RecruitAI supports the full hiring workflow:
- resume and job description gap analysis
- interview/question generation
- candidate coding tasks and live evaluation
- security and integrity checks for candidate submissions
- recruiter-facing assessment creation and candidate result review
- analytics and auditability across sessions

## Architecture

- `backend/` — FastAPI application and business logic
  - `backend/api/` — routers for auth, interviews, assessments, analytics, and sandbox execution
  - `backend/core/` — application config and shared settings
  - `backend/repositories/` — SQLite repository logic
  - `backend/services/` — backend service layer
  - `backend/main.py` — app bootstrap and static asset serving
- `ai_engine/` — AI and evaluation modules
  - guardrails, sandbox analysis, hybrid retrieval, and scoring workflows
- `frontend/` — Vite + React + TypeScript UI
- `tests/` — pipeline and assessment validation tests
- `requirements.txt` — Python dependencies
- `Dockerfile` and `docker-compose.yml` — containerized deployment

## Repository structure

```text
Recruit-AI/
├── ai_engine/
│   ├── evals/
│   ├── guardrails/
│   ├── rag/
│   ├── sandbox/
│   ├── workflows/
│   └── integrity/
├── backend/
│   ├── api/
│   ├── core/
│   ├── repositories/
│   ├── services/
│   ├── __init__.py
│   ├── database.py
│   ├── main.py
│   ├── schemas.py
│   └── ...
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── index.html
├── tests/
│   ├── test_assessments.py
│   └── test_enterprise_pipeline.py
├── Dockerfile
├── docker-compose.yml
├── fine_tuning_dataset.jsonl
├── hireroom_ledger.db
├── requirements.txt
├── README.md
└── .gitignore
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm
- Optional: Docker and Docker Compose

## Local setup

1. Clone the repository

```bash
git clone https://github.com/Shreyanshi123/Recruit-AI.git
cd Recruit-AI
```

2. Create a virtual environment and install Python dependencies

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

3. Add environment variables in a `.env` file

```env
ENVIRONMENT=development
GEMINI_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

4. Start the backend

```bash
uvicorn backend.main:app --reload --port 8000
```

The API will be available at:
- http://localhost:8000
- Swagger docs: http://localhost:8000/docs

5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on:
- http://localhost:5173

## Main application routes

- `/` — serves the app or API status page
- `/hire` — recruiter console
- `/a/{public_token}` — candidate assessment page
- `/docs` — FastAPI OpenAPI docs

## Docker

Build and run the application in a container:

```bash
docker compose up --build
```

This uses the included `Dockerfile` and exposes the app on port `8000`.

## Testing

Run the automated validation suite:

```bash
pytest tests/test_enterprise_pipeline.py
```

You can also run the assessment-focused checks directly:

```bash
python tests/test_assessments.py
```

## Notes

- The backend uses SQLite for local persistence and app-ledger storage.
- The project includes sandboxing and code-analysis logic for technical evaluation integrity.
- The frontend is built with Vite and can be served via the FastAPI app when production assets are present.

## License

This project is currently distributed without an explicit license file in the repository root. If you plan to reuse or redistribute it, confirm the licensing terms with the repository owner before publishing or deploying externally.
