import os
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.core.config import settings, BASE_DIR
from backend.repositories.session_repository import init_ledger_schema
from backend.repositories.assessment_repository import init_assessment_schema
from backend.api import interview_router, sandbox_router, analytics_router, assessments_router, auth_router
from backend.api.routes_auth import init_auth_schema
from backend.api.routes_interview import (
    analyze_gap_endpoint as api_analyze_gap,
    generate_question_endpoint as api_generate_question,
    submit_turn_endpoint as api_submit_turn,
    GapAnalysisRequest,
    QuestionRequest,
    SubmitTurnRequest,
)
from backend.api.routes_sandbox import (
    run_sandbox_endpoint as api_run_sandbox,
    SandboxRunRequest,
)
from backend.api.routes_analytics import (
    get_telemetry_endpoint as api_get_telemetry,
)

app = FastAPI(
    title="RecruitAI — Agentic AI Technical Interview Copilot",
    description=(
        "Enterprise Agentic AI Interview Platform: Company & JD Intelligence Agent, "
        "Hybrid BM25 + ChromaDB Vector Rubric RAG with RRF Reranking, "
        "Static AST + Isolated Subprocess Execution Sandbox, Deterministic LLM-as-a-Judge, "
        "LangGraph 5-Agent State Machine, and SFT/LoRA Training Flywheel."
    ),
    version=settings.app_version,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(elapsed_ms)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response


@app.on_event("startup")
def on_startup() -> None:
    init_ledger_schema()
    init_assessment_schema()
    init_auth_schema()


# Register Modular API Routers
app.include_router(auth_router)
app.include_router(interview_router)
app.include_router(sandbox_router)
app.include_router(analytics_router)
app.include_router(assessments_router)

# Mount React TypeScript Production Build (frontend/dist)
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")
FRONTEND_ASSETS = os.path.join(FRONTEND_DIST, "assets")

if os.path.exists(FRONTEND_ASSETS):
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS), name="assets")


@app.get("/hire")
def serve_recruiter_console():
    """Recruiter console: create assessments from a JD, share links, review ranked candidates."""
    dist_index = os.path.join(FRONTEND_DIST, "index.html")
    return FileResponse(dist_index)


@app.get("/a/{public_token}")
def serve_candidate_assessment(public_token: str):
    """Candidate-facing assessment page (the token is read client-side from the URL)."""
    dist_index = os.path.join(FRONTEND_DIST, "index.html")
    return FileResponse(dist_index)


@app.get("/")
def serve_react_spa():
    dist_index = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(dist_index):
        return FileResponse(dist_index)
    fallback_index = os.path.join(BASE_DIR, "frontend", "index.html")
    if os.path.exists(fallback_index):
        return FileResponse(fallback_index)
    return {"status": "RecruitAI API Gateway Active", "docs": "/docs"}
