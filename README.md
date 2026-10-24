# RecruitAI

RecruitAI is an AI-powered technical hiring platform for evaluating software engineering candidates in a secure, structured, and auditable way.

It combines:
- a FastAPI backend for interviews, assessments, analytics, authentication, and sandbox execution
- a React + TypeScript frontend for recruiter and candidate experiences
- an AI evaluation pipeline under `ai_engine/` for rubric retrieval, guardrails, scoring, and integrity checks
- SQLite-backed persistence for sessions, assessments, and telemetry
- Docker support for local deployment and production-style packaging

## Overview

RecruitAI is designed to help engineering teams move beyond generic chat-based LLMs and run structured technical evaluation workflows. The platform supports:
- resume and job description gap analysis
- interview and question generation
- candidate coding tasks and live evaluation
- security and integrity checks for candidate submissions
- recruiter-facing assessment creation and candidate review
- analytics and audit trails for hiring decisions

## Architecture

### Backend
The backend is built with FastAPI and lives in `backend/`.

Key components:
- `backend/api/` — auth, interviews, assessments, analytics, and sandbox routes
- `backend/core/` — shared configuration and app settings
- `backend/repositories/` — data access and SQLite repository logic
- `backend/services/` — service layer logic
- `backend/main.py` — application startup and static asset serving

### AI engine
The AI evaluation stack is organized under `ai_engine/` and includes:
- guardrails and prompt defense
- rubric retrieval and scoring workflows
- sandbox analysis and execution logic
- integrity checks and validation flows

### Frontend
The frontend is a Vite + React + TypeScript app under `frontend/` and provides the recruiter and candidate UI.

### Tests
The repository includes automated validation under `tests/` covering:
- assessment workflows
- enterprise pipeline checks
- guardrails and scoring behavior
- code-analysis and security expectations

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
├── requirements.txt
├── fine_tuning_dataset.jsonl
├── hireroom_ledger.db
├── README.md
├── .gitignore
└── ...
```

## Tech stack

### Backend
- Python
- FastAPI
- Uvicorn
- SQLite
- LangGraph
- ChromaDB
- Pydantic
- Google GenAI

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React

## Prerequisites

Before running the project, make sure you have:

- Python 3.11+
- Node.js 18+
- npm
- Docker (optional, for containerized deployment)

## Local development setup

### 1. Clone the repository

```bash
git clone https://github.com/Shreyanshi123/Recruit-AI.git
cd Recruit-AI
```

### 2. Create a virtual environment and install Python dependencies

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
ENVIRONMENT=development
GEMINI_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

### 4. Start the backend

```bash
uvicorn backend.main:app --reload --port 8000
```

The API will be available at:
- http://localhost:8000
- Swagger docs: http://localhost:8000/docs

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at:
- http://localhost:5173

## Main application routes

- `/` — app entry or status page
- `/hire` — recruiter console
- `/a/{public_token}` — candidate assessment page
- `/docs` — FastAPI OpenAPI documentation

## Docker deployment

Build and run the app with Docker Compose:

```bash
docker compose up --build
```

This uses the included `Dockerfile` and exposes the application on port `8000`.

## Testing

Run the automated integration and evaluation suite:

```bash
pytest tests/test_enterprise_pipeline.py
```

Run assessment-focused checks:

```bash
python tests/test_assessments.py
```

## Notes

- The backend initializes SQLite schema and app persistence on startup.
- The app includes code analysis and sandbox logic for secure technical evaluation.
- The frontend is served from the FastAPI app when built assets are present.
- Some functionality depends on valid AI credentials and model configuration.

## License

This repository does not currently include a root-level license file. If you plan to reuse or redistribute this project, confirm the license terms with the repository owner before public or commercial use.
