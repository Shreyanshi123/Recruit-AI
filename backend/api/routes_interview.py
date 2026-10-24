from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.pdf_parser import parse_uploaded_document
from ai_engine.agents.gap_detective import (
    run_gap_detective_agent,
    build_evidence_heatmap,
    extract_role_title,
    build_company_interview_intelligence,
)
from ai_engine.agents.challenge_architect import (
    run_challenge_architect_agent,
    build_company_past_question_bank,
    generate_adaptive_followup_question,
)
from ai_engine.rag.hybrid_retriever import hybrid_retrieve_rubrics
from ai_engine.guardrails.defense import run_guardrail_pipeline
from ai_engine.workflows.committee_graph import run_committee_workflow
from backend.repositories.session_repository import (
    create_gap_session,
    record_committee_turn,
    fetch_dashboard_telemetry,
)

router = APIRouter(prefix="/api", tags=["Interview & LangGraph Committee"])


class DocumentUploadRequest(BaseModel):
    filename: str
    content_base64: str


class GapAnalysisRequest(BaseModel):
    resume_text: str
    jd_text: str
    role_title: Optional[str] = ""
    org_id: Optional[str] = "org_acme_enterprise"


class QuestionRequest(BaseModel):
    topic: str
    difficulty: str = "Medium"
    previous_topic: Optional[str] = ""
    feedback: Optional[str] = ""
    user_code: Optional[str] = ""
    passed: Optional[bool] = False
    drill_number: Optional[int] = 0


class SubmitTurnRequest(BaseModel):
    session_id: Optional[int] = 1
    thread_id: Optional[str] = ""
    org_id: Optional[str] = "org_acme_enterprise"
    question: dict
    user_code: str
    user_explanation: Optional[str] = ""
    skill: Optional[str] = ""
    drill_number: Optional[int] = 4


@router.post("/extract-document")
def extract_document_endpoint(req: DocumentUploadRequest):
    if not req.content_base64:
        raise HTTPException(status_code=400, detail="Empty document payload.")
    return parse_uploaded_document(req.filename, req.content_base64)


@router.post("/analyze-gap")
def analyze_gap_endpoint(req: GapAnalysisRequest):
    if not req.resume_text.strip() or not req.jd_text.strip():
        raise HTTPException(status_code=400, detail="Both Resume and Job Description are required.")

    resume_guard = run_guardrail_pipeline(req.resume_text, "candidate_resume")
    jd_guard = run_guardrail_pipeline(req.jd_text, "target_job_description")

    detected_role = req.role_title.strip() if req.role_title else extract_role_title(req.jd_text)
    gap_result = run_gap_detective_agent(req.resume_text, req.jd_text)
    gap_dict = gap_result.model_dump()
    evidence_heatmap = build_evidence_heatmap(resume_guard["clean_text"], jd_guard["clean_text"])
    company_intel = build_company_interview_intelligence(
        resume_text=req.resume_text,
        jd_text=req.jd_text,
        matched_skills=gap_dict.get("matched_skills", []),
        missing_skills=gap_dict.get("missing_skills", []),
    )
    session_id = create_gap_session(gap_dict)

    first_topic = (
        gap_dict["missing_skills"][0]
        if gap_dict.get("missing_skills")
        else (gap_dict["matched_skills"][0] if gap_dict.get("matched_skills") else "Two Sum")
    )
    first_question = run_challenge_architect_agent(topic=first_topic, difficulty="Medium")
    hybrid = hybrid_retrieve_rubrics(first_topic, top_k=3)
    top_rubric = hybrid["top_rubric"]

    company_question_bank = build_company_past_question_bank(
        company_name=company_intel["company_name"],
        role_title=company_intel["role_title"] or detected_role,
        missing_skills=gap_dict.get("missing_skills", []),
        matched_skills=gap_dict.get("matched_skills", []),
    )

    return {
        "session_id": session_id,
        "role_title": company_intel["role_title"] or detected_role,
        "company_name": company_intel["company_name"],
        "company_intel": company_intel,
        "company_question_bank": company_question_bank,
        "org_id": req.org_id,
        "gap_analysis": gap_dict,
        "evidence_heatmap": evidence_heatmap,
        "guardrail_summary": {
            "injection_passed": resume_guard["injection_passed"] and jd_guard["injection_passed"],
            "pii_redacted_count": resume_guard["pii_count"] + jd_guard["pii_count"],
            "pii_entities": resume_guard["pii_entities_removed"] + jd_guard["pii_entities_removed"],
            "detected_threats": resume_guard["detected_threats"] + jd_guard["detected_threats"],
        },
        "initial_question": first_question.model_dump(),
        "active_rubric": top_rubric["rules"],
        "rubric_telemetry": top_rubric,
        "hybrid_rag_report": hybrid,
    }


@router.post("/generate-question")
def generate_question_endpoint(req: QuestionRequest):
    if req.feedback or (req.drill_number and req.drill_number > 0):
        question = generate_adaptive_followup_question(
            skill=req.topic,
            previous_topic=req.previous_topic or req.topic,
            user_code=req.user_code or "",
            feedback=req.feedback or "",
            passed=bool(req.passed),
            drill_number=req.drill_number or 4,
        )
    else:
        question = run_challenge_architect_agent(topic=req.topic, difficulty=req.difficulty)
    hybrid = hybrid_retrieve_rubrics(req.topic, top_k=3)
    top_rubric = hybrid["top_rubric"]
    return {
        "question": question.model_dump(),
        "active_rubric": top_rubric["rules"],
        "rubric_telemetry": top_rubric,
        "hybrid_rag_report": hybrid,
    }


@router.post("/submit-turn")
def submit_turn_endpoint(req: SubmitTurnRequest):
    state = run_committee_workflow(
        question=req.question,
        user_code=req.user_code,
        user_explanation=req.user_explanation or "",
        thread_id=req.thread_id or "",
    )
    ledger_meta = record_committee_turn(req.session_id or 1, state)
    telemetry = fetch_dashboard_telemetry()

    sandbox_res = state.get("sandbox_result") or {}
    eval_res = state.get("evaluation") or {}
    passed = bool(sandbox_res.get("passed"))
    score = float(eval_res.get("technical_score") or 0.0)
    feedback = str(eval_res.get("feedback") or "")
    q_topic = str((req.question or {}).get("topic") or "Engineering")
    skill_name = req.skill or q_topic.split("—")[0].strip()

    # Automatically synthesize an adaptive follow-up question based on the candidate's performance & feedback
    adaptive_q = generate_adaptive_followup_question(
        skill=skill_name,
        previous_topic=q_topic,
        user_code=req.user_code,
        feedback=feedback,
        passed=(passed and score >= 7.0),
        drill_number=req.drill_number or 4,
    )

    return {
        "state": state,
        "ledger": ledger_meta,
        "telemetry": telemetry,
        "adaptive_followup": {
            "mode": "remedial" if (not passed or score < 7.0) else "escalation",
            "skill": skill_name,
            "reason": (
                f"You missed assertions on {skill_name}. We dynamically generated a remedial question targeting this exact gap so you can practice until you master it."
                if (not passed or score < 7.0)
                else f"You passed {skill_name}! Here is a harder adaptive follow-up question generated from your code feedback."
            ),
            "question_payload": adaptive_q.model_dump(),
        },
    }
