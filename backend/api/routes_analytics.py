import os
from typing import List, Dict, Any
from fastapi import APIRouter
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel

from backend.core.config import settings
from backend.core.logger import utc_now_iso
from backend.repositories.session_repository import fetch_dashboard_telemetry
from ai_engine.rag.vector_store import list_all_rubrics
from ai_engine.rag.hybrid_retriever import hybrid_retrieve_rubrics
from ai_engine.guardrails.defense import run_guardrail_pipeline
from ai_engine.evals.run_evals import run_golden_eval_suite

router = APIRouter(prefix="/api", tags=["Telemetry, Hybrid RAG, Guardrails & CI Evals"])

# Append-only in-memory + audit ledger for RBAC / HITL signoffs
AUDIT_LOG_LEDGER: List[Dict[str, Any]] = [
    {
        "id": 1,
        "timestamp": utc_now_iso(),
        "org_id": "org_acme_enterprise",
        "actor_role": "SYSTEM_BOOT",
        "action": "RLS_TENANT_POLICY_INITIALIZED",
        "detail": "Row-Level Security & Presidio PII Scrubber active for tenant 'org_acme_enterprise'.",
    }
]


class HybridQueryRequest(BaseModel):
    query: str
    top_k: int = 3


class GuardrailScanRequest(BaseModel):
    text: str
    field_name: str = "untrusted_input"


class HumanOverrideRequest(BaseModel):
    turn_id: int
    org_id: str = "org_acme_enterprise"
    reviewer_role: str = "Recruiter"
    decision: str = "APPROVED_RECOMMENDATION"
    override_score: int = 9
    notes: str = "Verified candidate's O(1) dictionary lookup and system design rationale."


@router.get("/health")
def health_check_endpoint():
    rubrics = list_all_rubrics()
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "llm_configured": settings.is_llm_configured,
        "rubrics_indexed": len(rubrics),
    }


@router.get("/rubrics")
def list_rubrics_endpoint():
    return {"rubrics": list_all_rubrics()}


@router.post("/hybrid-rag")
def hybrid_rag_endpoint(req: HybridQueryRequest):
    return hybrid_retrieve_rubrics(req.query, top_k=req.top_k)


@router.post("/guardrails-scan")
def guardrails_scan_endpoint(req: GuardrailScanRequest):
    return run_guardrail_pipeline(req.text, req.field_name)


@router.get("/run-eval-gate")
def run_eval_gate_endpoint():
    return run_golden_eval_suite()


@router.post("/human-override")
def human_override_endpoint(req: HumanOverrideRequest):
    entry = {
        "id": len(AUDIT_LOG_LEDGER) + 1,
        "timestamp": utc_now_iso(),
        "org_id": req.org_id,
        "actor_role": req.reviewer_role,
        "action": f"HITL_{req.decision}",
        "detail": f"Turn #{req.turn_id} signed off with score {req.override_score}/10: {req.notes}",
    }
    AUDIT_LOG_LEDGER.insert(0, entry)
    return {"status": "recorded", "audit_entry": entry, "audit_logs": AUDIT_LOG_LEDGER[:20]}


@router.get("/audit-logs")
def get_audit_logs_endpoint():
    return {"audit_logs": AUDIT_LOG_LEDGER[:25]}


@router.get("/telemetry")
def get_telemetry_endpoint():
    data = fetch_dashboard_telemetry()
    data["audit_logs"] = AUDIT_LOG_LEDGER[:15]
    return data


@router.get("/export-jsonl")
def export_jsonl_endpoint():
    if not os.path.exists(settings.jsonl_path):
        return PlainTextResponse(
            content="",
            media_type="application/jsonl",
            headers={"Content-Disposition": "attachment; filename=fine_tuning_dataset.jsonl"},
        )
    return FileResponse(
        path=settings.jsonl_path,
        media_type="application/jsonl",
        filename="fine_tuning_dataset.jsonl",
    )
