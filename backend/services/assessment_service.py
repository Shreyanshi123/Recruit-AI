"""
Business logic for recruiter-created assessments.

Key design points (these are what make this more than "a UI over an LLM"):

* Hidden tests. A question's full `test_code` and `reference_solution` stay server-side.
  Candidates only receive the first assertion as a visible sample, so they cannot hard-code
  answers or tamper with the grader (the practice mode lets the client send tests; this flow never does).
* Deterministic grading. Every submission runs through the same LangGraph committee
  (guardrails -> rubric retrieval -> sandbox -> judge) against the stored hidden tests.
* Integrity signals. Paste / tab-switch telemetry plus AST-normalised code similarity across
  every candidate who took the same assessment.
* Time limits enforced on the server, not just by a countdown in the browser.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from ai_engine.agents.challenge_architect import run_challenge_architect_agent
from ai_engine.agents.gap_detective import SKILL_TAXONOMY, _token_present, extract_company_name, extract_role_title
from ai_engine.guardrails.defense import run_guardrail_pipeline
from ai_engine.integrity.similarity import code_similarity, is_trivial
from ai_engine.sandbox.runner import execute_sandbox_suite
from ai_engine.workflows.committee_graph import run_committee_workflow
from backend.repositories import assessment_repository as repo

SUBMIT_GRACE_SEC = 60
SIMILARITY_FLAG_THRESHOLD = 0.92
LARGE_PASTE_CHARS = 150


# ---------------------------------------------------------------------------
# Question generation
# ---------------------------------------------------------------------------
def extract_jd_skills(jd_text: str) -> List[str]:
    """Skills explicitly mentioned in the JD, in taxonomy order."""
    low = (jd_text or "").lower()
    return [label for label, tokens in SKILL_TAXONOMY if any(_token_present(low, t) for t in tokens)]


def generate_questions(skills: List[str], max_questions: int, include_system_design: bool) -> List[Dict[str, Any]]:
    """
    Map JD skills onto the challenge bank, de-duplicating questions that resolve to the same
    underlying problem (e.g. "Python" and "FastAPI" may both map to the rate-limiter task).
    """
    candidates = [s for s in skills if include_system_design or s != "System Design"]
    if not candidates:
        candidates = ["Python"]

    questions: List[Dict[str, Any]] = []
    seen_problems = set()
    for skill in candidates:
        q = run_challenge_architect_agent(skill, difficulty="Medium").model_dump()
        fingerprint = (q.get("starter_code") or "").split("(")[0]
        if fingerprint in seen_problems:
            continue
        seen_problems.add(fingerprint)
        q["id"] = f"q{len(questions) + 1}"
        q["skill"] = skill
        questions.append(q)
        if len(questions) >= max_questions:
            break
    return questions


def split_tests(test_code: str) -> Tuple[str, int]:
    """
    Return (visible_sample_tests, hidden_total_assert_count).
    The sample keeps all setup lines that precede the first assert plus that one assert.
    """
    visible: List[str] = []
    total = 0
    sample_taken = False
    for line in (test_code or "").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("assert "):
            total += 1
            if not sample_taken:
                visible.append(stripped)
                sample_taken = True
        elif not sample_taken:
            visible.append(stripped)
    return "\n".join(visible), total


def candidate_safe_question(q: Dict[str, Any]) -> Dict[str, Any]:
    """Strip everything that would let a candidate game the grader."""
    sample, total = split_tests(q.get("test_code", ""))
    return {
        "id": q["id"],
        "skill": q.get("skill"),
        "topic": q.get("topic"),
        "difficulty": q.get("difficulty"),
        "domain_category": q.get("domain_category"),
        "question_text": q.get("question_text"),
        "starter_code": q.get("starter_code"),
        "sample_tests": sample,
        "hidden_test_count": max(0, total - 1),
    }


def build_assessment(
    org_id: str,
    jd_text: str,
    title: Optional[str],
    company_name: Optional[str],
    role_title: Optional[str],
    time_limit_min: int,
    max_questions: int,
    include_system_design: bool,
) -> Dict[str, Any]:
    guard = run_guardrail_pipeline(jd_text, "recruiter_job_description")
    clean_jd = guard["clean_text"]
    skills = extract_jd_skills(clean_jd)
    company = (company_name or "").strip() or extract_company_name(clean_jd) or "Your company"
    role = (role_title or "").strip() or extract_role_title(clean_jd) or "Software Engineer"
    questions = generate_questions(skills, max_questions, include_system_design)
    return repo.create_assessment(
        org_id=org_id,
        title=(title or "").strip() or f"{role} assessment",
        company_name=company,
        role_title=role,
        jd_text=clean_jd,
        skills=skills,
        questions=questions,
        time_limit_min=time_limit_min,
    )


# ---------------------------------------------------------------------------
# Candidate flow
# ---------------------------------------------------------------------------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def start_attempt(assessment: Dict[str, Any], name: str, email: str) -> Dict[str, Any]:
    """Idempotent per email: re-opening the link resumes the same attempt and the same clock."""
    existing = repo.find_attempt_by_email(assessment["id"], email)
    if existing:
        return {
            "attempt_token": existing["attempt_token"],
            "started_at": existing["started_at"],
            "deadline_at": existing["deadline_at"],
            "status": existing["status"],
            "resumed": True,
        }
    started = _now()
    deadline = started + timedelta(minutes=int(assessment["time_limit_min"]))
    created = repo.create_attempt(assessment["id"], name, email, started.isoformat(), deadline.isoformat())
    created["status"] = "in_progress"
    created["resumed"] = False
    return created


def attempt_is_open(attempt: Dict[str, Any]) -> bool:
    if attempt["status"] == "submitted":
        return False
    deadline = datetime.fromisoformat(attempt["deadline_at"])
    return _now() <= deadline + timedelta(seconds=SUBMIT_GRACE_SEC)


def find_question(assessment: Dict[str, Any], question_id: str) -> Optional[Dict[str, Any]]:
    return next((q for q in assessment["questions"] if q["id"] == question_id), None)


def run_sample_tests(question: Dict[str, Any], code: str) -> Dict[str, Any]:
    sample, _ = split_tests(question.get("test_code", ""))
    res = execute_sandbox_suite(code, sample, timeout_sec=3)
    return {
        "passed": res.get("passed", False),
        "output": res.get("output", ""),
        "runtime_ms": res.get("runtime_ms", 0),
        "test_cases": res.get("test_cases", []),
    }


def grade_submission(attempt: Dict[str, Any], question: Dict[str, Any], code: str) -> Dict[str, Any]:
    state = run_committee_workflow(question=question, user_code=code, user_explanation="")
    sandbox = state.get("sandbox_result", {}) or {}
    evaluation = state.get("evaluation", {}) or {}
    tcs = sandbox.get("test_cases", []) or []
    _, total_asserts = split_tests(question.get("test_code", ""))
    passed = sum(1 for t in tcs if t.get("passed"))
    total = len(tcs) or total_asserts
    score = float(evaluation.get("technical_score", 0))
    complexity = (sandbox.get("ast_analysis") or {}).get("estimated_time_complexity", "")
    count = repo.upsert_submission(
        attempt_id=attempt["id"],
        question_id=question["id"],
        code=code,
        score=score,
        tests_passed=passed,
        tests_total=total,
        complexity=complexity,
        criteria=state.get("criterion_breakdown", []) or [],
        feedback=evaluation.get("feedback", ""),
    )
    # Candidates see how many hidden tests passed, never the score or the tests themselves
    return {"submitted": True, "submit_count": count, "tests_passed": passed, "tests_total": total}


# ---------------------------------------------------------------------------
# Recruiter report
# ---------------------------------------------------------------------------
def _integrity_for_attempt(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    tab_switches = sum(1 for e in events if e["event_type"] in ("tab_hidden", "window_blur"))
    pastes = [e for e in events if e["event_type"] == "paste"]
    large = [p for p in pastes if int(p["detail"].get("chars", 0)) >= LARGE_PASTE_CHARS]
    return {
        "tab_switches": tab_switches,
        "paste_count": len(pastes),
        "large_pastes": len(large),
        "pasted_chars": sum(int(p["detail"].get("chars", 0)) for p in pastes),
    }


def _risk_level(integrity: Dict[str, Any], similarity_flags: List[Dict[str, Any]]) -> str:
    has_suspicious_behavior = integrity["large_pastes"] >= 1 or integrity["tab_switches"] >= 3
    if integrity["large_pastes"] >= 2 or integrity["tab_switches"] >= 6:
        return "high"
    if similarity_flags and has_suspicious_behavior:
        return "high"
    if has_suspicious_behavior:
        return "medium"
    return "low"


def build_report(assessment: Dict[str, Any]) -> Dict[str, Any]:
    attempts = repo.list_attempts(assessment["id"])
    ids = [a["id"] for a in attempts]
    subs = repo.list_submissions(ids)
    events = repo.list_proctor_events(ids)
    questions = assessment["questions"]
    n_q = max(1, len(questions))
    name_by_attempt = {a["id"]: a["candidate_name"] for a in attempts}

    subs_by_attempt: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for s in subs:
        subs_by_attempt.setdefault(s["attempt_id"], {})[s["question_id"]] = s

    # Pairwise structural similarity per question across candidates
    sim_flags: Dict[str, List[Dict[str, Any]]] = {a: [] for a in ids}
    for q in questions:
        entries = [(aid, subs_by_attempt[aid][q["id"]]["code"]) for aid in ids if q["id"] in subs_by_attempt.get(aid, {})]
        entries = [(aid, code) for aid, code in entries if not is_trivial(code)]
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                sim = code_similarity(entries[i][1], entries[j][1])
                if sim >= SIMILARITY_FLAG_THRESHOLD:
                    a, b = entries[i][0], entries[j][0]
                    sim_flags[a].append({"question_id": q["id"], "other_candidate": name_by_attempt[b], "similarity": round(sim, 3)})
                    sim_flags[b].append({"question_id": q["id"], "other_candidate": name_by_attempt[a], "similarity": round(sim, 3)})

    candidates = []
    for a in attempts:
        per_q = []
        total_score = 0.0
        for q in questions:
            s = subs_by_attempt.get(a["id"], {}).get(q["id"])
            if s:
                total_score += s["score"]
            per_q.append({
                "question_id": q["id"],
                "topic": q.get("topic"),
                "skill": q.get("skill"),
                "score": s["score"] if s else None,
                "tests_passed": s["tests_passed"] if s else 0,
                "tests_total": s["tests_total"] if s else split_tests(q.get("test_code", ""))[1],
                "complexity": s["complexity"] if s else None,
                "submit_count": s["submit_count"] if s else 0,
                "feedback": s["feedback"] if s else None,
                "criteria": s["criteria"] if s else [],
                "code": s["code"] if s else None,
            })
        a_events = [e for e in events if e["attempt_id"] == a["id"]]
        integrity = _integrity_for_attempt(a_events)
        flags = sim_flags.get(a["id"], [])
        candidates.append({
            "attempt_id": a["id"],
            "name": a["candidate_name"],
            "email": a["candidate_email"],
            "status": a["status"],
            "decision": a["decision"],
            "started_at": a["started_at"],
            "submitted_at": a["submitted_at"],
            "overall_pct": round(total_score / (10 * n_q) * 100),
            "questions": per_q,
            "integrity": {**integrity, "similarity_flags": flags, "risk": _risk_level(integrity, flags)},
            "events": a_events[-50:],
        })

    candidates.sort(key=lambda c: c["overall_pct"], reverse=True)
    for rank, c in enumerate(candidates, start=1):
        c["rank"] = rank

    completed = [c for c in candidates if c["status"] == "submitted"]
    return {
        "assessment": {k: v for k, v in assessment.items() if k != "jd_text"},
        "summary": {
            "invited": len(candidates),
            "completed": len(completed),
            "avg_pct": round(sum(c["overall_pct"] for c in completed) / len(completed)) if completed else 0,
            "flagged": sum(1 for c in candidates if c["integrity"]["risk"] == "high"),
        },
        "candidates": candidates,
    }

