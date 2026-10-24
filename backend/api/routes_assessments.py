"""
B2B assessment API.

Recruiter endpoints  (/api/orgs, /api/assessments/...)   -> require `X-Org-Key`, scoped to that org
Candidate endpoints  (/api/public/...)                    -> public link token + per-attempt secret token
"""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from backend.repositories import assessment_repository as repo
from backend.services import assessment_service as svc

router = APIRouter(tags=["B2B Assessments"])


# ---------------------------------------------------------------------------
# Auth dependencies
# ---------------------------------------------------------------------------
def require_org(x_org_key: str = Header(default="", alias="X-Org-Key")) -> Dict[str, Any]:
    org = repo.get_org_by_key(x_org_key)
    if not org:
        raise HTTPException(status_code=401, detail="Missing or invalid X-Org-Key header.")
    return org


def _load_open_attempt(attempt_token: str) -> Dict[str, Any]:
    attempt = repo.get_attempt_by_token(attempt_token)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")
    return attempt


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class CreateOrgRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)


class CreateAssessmentRequest(BaseModel):
    jd_text: str = Field(min_length=30, max_length=20000)
    title: Optional[str] = None
    company_name: Optional[str] = None
    role_title: Optional[str] = None
    time_limit_min: int = Field(default=60, ge=10, le=240)
    max_questions: int = Field(default=3, ge=1, le=8)
    include_system_design: bool = False


class DecisionRequest(BaseModel):
    decision: Literal["advance", "hold", "reject"]
    note: str = Field(default="", max_length=1000)


class StartAttemptRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=120)


class CodeRequest(BaseModel):
    question_id: str
    code: str = Field(max_length=20000)


class ProctorEventRequest(BaseModel):
    event_type: Literal["paste", "tab_hidden", "window_blur", "copy", "fullscreen_exit"]
    question_id: Optional[str] = None
    detail: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Recruiter endpoints
# ---------------------------------------------------------------------------
@router.post("/api/orgs")
def create_org(req: CreateOrgRequest):
    """Self-serve workspace signup. The API key is shown exactly once; only its hash is stored."""
    return repo.create_org(req.name.strip())


@router.get("/api/orgs/me")
def get_me(org=Depends(require_org)):
    return org


@router.post("/api/assessments")
def create_assessment(req: CreateAssessmentRequest, org=Depends(require_org)):
    assessment = svc.build_assessment(
        org_id=org["id"],
        jd_text=req.jd_text,
        title=req.title,
        company_name=req.company_name,
        role_title=req.role_title,
        time_limit_min=req.time_limit_min,
        max_questions=req.max_questions,
        include_system_design=req.include_system_design,
    )
    repo.append_audit(org["id"], "recruiter", "assessment.created", assessment["id"], {
        "role_title": assessment["role_title"], "questions": len(assessment["questions"]),
    })
    return assessment


@router.get("/api/assessments")
def list_assessments(org=Depends(require_org)):
    return {"assessments": repo.list_assessments(org["id"])}


@router.get("/api/assessments/{assessment_id}")
def get_assessment(assessment_id: str, org=Depends(require_org)):
    a = repo.get_assessment(org["id"], assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    return a


@router.get("/api/assessments/{assessment_id}/report")
def get_report(assessment_id: str, org=Depends(require_org)):
    a = repo.get_assessment(org["id"], assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    report = svc.build_report(a)
    report["audit_log"] = repo.list_audit(org["id"], limit=50)
    return report


@router.post("/api/assessments/{assessment_id}/attempts/{attempt_id}/decision")
def record_decision(assessment_id: str, attempt_id: str, req: DecisionRequest, org=Depends(require_org)):
    a = repo.get_assessment(org["id"], assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    if not any(att["id"] == attempt_id for att in repo.list_attempts(assessment_id)):
        raise HTTPException(status_code=404, detail="Candidate attempt not found.")
    repo.set_attempt_decision(attempt_id, req.decision)
    repo.append_audit(org["id"], "recruiter", f"candidate.{req.decision}", attempt_id, {
        "assessment_id": assessment_id, "note": req.note,
    })
    return {"ok": True, "decision": req.decision}


@router.post("/api/assessments/{assessment_id}/simulate-cohort")
def simulate_cohort(assessment_id: str, org=Depends(require_org)):
    """
    Populates an assessment with 3 realistic candidate submissions to demonstrate:
    1) Clean optimal solution (low risk)
    2) Structurally identical AST-plagiarized copy with renamed comments + large paste + tab switches (high risk)
    3) Incomplete stub/partial solution (low risk)
    """
    a = repo.get_assessment(org["id"], assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    questions = a.get("questions") or []
    if not questions:
        raise HTTPException(status_code=400, detail="Assessment has no questions.")

    # Candidate 1: Asha Verma — strong clean solutions across questions, zero suspicious events
    c1 = svc.start_attempt(a, "Asha Verma", "asha.verma@candidate.dev")
    att1 = repo.get_attempt_by_token(c1["attempt_token"])
    for q in questions:
        ref_code = q.get("reference_solution") or q.get("starter_code") or "pass"
        svc.grade_submission(att1, q, ref_code)
    repo.mark_attempt_submitted(att1["id"])

    # Candidate 2: Ravi Nair — copies Asha's Q1 solution with extra comments + 460-char paste + 4 tab switches
    c2 = svc.start_attempt(a, "Ravi Nair", "ravi.nair@candidate.dev")
    att2 = repo.get_attempt_by_token(c2["attempt_token"])
    q0 = questions[0]
    copied_q0 = "# My custom implementation for production\n" + (q0.get("reference_solution") or "pass")
    svc.grade_submission(att2, q0, copied_q0)
    repo.add_proctor_event(att2["id"], "paste", q0["id"], {"chars": 460, "lines": 14})
    repo.add_proctor_event(att2["id"], "tab_hidden", q0["id"], {})
    repo.add_proctor_event(att2["id"], "window_blur", q0["id"], {})
    repo.add_proctor_event(att2["id"], "tab_hidden", q0["id"], {})
    for q in questions[1:]:
        svc.grade_submission(att2, q, q.get("starter_code") or "pass")
    repo.mark_attempt_submitted(att2["id"])

    # Candidate 3: Kabir Mehta — solves Q1 cleanly, leaves remaining as starter stubs
    c3 = svc.start_attempt(a, "Kabir Mehta", "kabir.mehta@candidate.dev")
    att3 = repo.get_attempt_by_token(c3["attempt_token"])
    if len(questions) > 1:
        svc.grade_submission(att3, questions[-1], questions[-1].get("reference_solution") or "pass")
    for q in questions[:-1]:
        svc.grade_submission(att3, q, q.get("starter_code") or "pass")
    repo.mark_attempt_submitted(att3["id"])

    repo.append_audit(org["id"], "recruiter", "cohort.simulated", assessment_id, {"candidates": 3})
    report = svc.build_report(a)
    report["audit_log"] = repo.list_audit(org["id"], limit=50)
    return report


# ---------------------------------------------------------------------------
# Candidate endpoints
# ---------------------------------------------------------------------------
@router.get("/api/public/assessments/{public_token}")
def public_assessment(public_token: str):
    a = repo.get_assessment_by_token(public_token)
    if not a or a["status"] != "open":
        raise HTTPException(status_code=404, detail="This assessment link is invalid or closed.")
    return {
        "title": a["title"],
        "company_name": a["company_name"],
        "role_title": a["role_title"],
        "time_limit_min": a["time_limit_min"],
        "question_count": len(a["questions"]),
        "skills": a["skills"],
    }


@router.post("/api/public/assessments/{public_token}/attempts")
def start_attempt(public_token: str, req: StartAttemptRequest):
    a = repo.get_assessment_by_token(public_token)
    if not a or a["status"] != "open":
        raise HTTPException(status_code=404, detail="This assessment link is invalid or closed.")
    return svc.start_attempt(a, req.name.strip(), str(req.email))


@router.get("/api/public/attempts/{attempt_token}")
def get_attempt(attempt_token: str):
    attempt = _load_open_attempt(attempt_token)
    a = repo.get_assessment_by_id_unscoped(attempt["assessment_id"])
    subs = {s["question_id"]: s for s in repo.list_submissions([attempt["id"]])}
    return {
        "candidate_name": attempt["candidate_name"],
        "status": attempt["status"],
        "started_at": attempt["started_at"],
        "deadline_at": attempt["deadline_at"],
        "company_name": a["company_name"],
        "role_title": a["role_title"],
        "questions": [
            {
                **svc.candidate_safe_question(q),
                "saved_code": subs[q["id"]]["code"] if q["id"] in subs else None,
                "last_result": (
                    {"tests_passed": subs[q["id"]]["tests_passed"], "tests_total": subs[q["id"]]["tests_total"]}
                    if q["id"] in subs else None
                ),
            }
            for q in a["questions"]
        ],
    }


@router.post("/api/public/attempts/{attempt_token}/run")
def run_sample(attempt_token: str, req: CodeRequest):
    attempt = _load_open_attempt(attempt_token)
    if not svc.attempt_is_open(attempt):
        raise HTTPException(status_code=409, detail="Time is up — this attempt is closed.")
    a = repo.get_assessment_by_id_unscoped(attempt["assessment_id"])
    q = svc.find_question(a, req.question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    return svc.run_sample_tests(q, req.code)


@router.post("/api/public/attempts/{attempt_token}/submit")
def submit_answer(attempt_token: str, req: CodeRequest):
    attempt = _load_open_attempt(attempt_token)
    if not svc.attempt_is_open(attempt):
        raise HTTPException(status_code=409, detail="Time is up — this attempt is closed.")
    a = repo.get_assessment_by_id_unscoped(attempt["assessment_id"])
    q = svc.find_question(a, req.question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    return svc.grade_submission(attempt, q, req.code)


@router.post("/api/public/attempts/{attempt_token}/events")
def log_event(attempt_token: str, req: ProctorEventRequest):
    attempt = _load_open_attempt(attempt_token)
    if attempt["status"] == "submitted":
        return {"ok": True}
    detail = {k: v for k, v in (req.detail or {}).items() if k in ("chars", "lines", "duration_ms")}
    repo.add_proctor_event(attempt["id"], req.event_type, req.question_id, detail)
    return {"ok": True}


@router.post("/api/public/attempts/{attempt_token}/finish")
def finish_attempt(attempt_token: str):
    attempt = _load_open_attempt(attempt_token)
    repo.mark_attempt_submitted(attempt["id"])
    return {"ok": True, "status": "submitted"}
