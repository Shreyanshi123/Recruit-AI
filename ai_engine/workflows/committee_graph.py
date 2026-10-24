import time
import uuid
from typing import TypedDict, Optional, List, Dict, Any
from langgraph.graph import StateGraph, END

from ai_engine.guardrails.defense import run_guardrail_pipeline
from ai_engine.rag.hybrid_retriever import hybrid_retrieve_rubrics
from ai_engine.sandbox.runner import execute_sandbox_suite
from ai_engine.agents.silent_judge import run_silent_judge_agent, build_criterion_breakdown
from ai_engine.agents.challenge_architect import run_challenge_architect_agent


class CommitteeGraphState(TypedDict, total=False):
    """Enterprise state ledger shared across the 5-member LangGraph Hiring Committee."""
    thread_id: str
    state_checkpoint_id: str
    topic: str
    difficulty: str
    question: dict
    user_code: str
    user_explanation: str
    guardrail_report: dict
    rubric_used: str
    rubric_telemetry: dict
    hybrid_rag_report: dict
    sandbox_result: dict
    evaluation: dict
    criterion_breakdown: List[Dict[str, Any]]
    next_action: str
    next_difficulty: str
    next_topic: str
    committee_summary: str
    followup_question: Optional[dict]
    trace_steps: List[Dict[str, Any]]


def node_guardrail_shield(state: CommitteeGraphState) -> dict:
    """Node 0: Prompt-Injection Classifier, XML Delimiter Isolation & Presidio PII Redaction."""
    t0 = time.perf_counter()
    code_guard = run_guardrail_pipeline(state.get("user_code", ""), "candidate_code")
    exp_guard = run_guardrail_pipeline(state.get("user_explanation", ""), "candidate_explanation")
    latency_ms = max(1, int((time.perf_counter() - t0) * 1000))

    passed = code_guard["injection_passed"] and exp_guard["injection_passed"]
    pii_total = code_guard["pii_count"] + exp_guard["pii_count"]
    threats = code_guard["detected_threats"] + exp_guard["detected_threats"]

    report = {
        "injection_passed": passed,
        "risk_score": max(code_guard["risk_score"], exp_guard["risk_score"]),
        "detected_threats": threats,
        "pii_redacted_count": pii_total,
        "pii_entities": code_guard["pii_entities_removed"] + exp_guard["pii_entities_removed"],
        "sanitized_explanation": exp_guard["clean_text"],
    }

    trace = list(state.get("trace_steps") or [])
    trace.append({
        "step": 1,
        "node_id": "guardrail_shield",
        "agent_name": "Injection & PII Guardrail Shield",
        "role": "Adversarial Defense & Presidio PII Scrubber",
        "status": "passed" if passed else "blocked",
        "latency_ms": latency_ms,
        "summary": (
            f"Injection scan: {'CLEAN' if passed else 'BLOCKED (' + str(len(threats)) + ' threats)'} | "
            f"PII entities redacted: {pii_total}"
        ),
    })
    return {
        "guardrail_report": report,
        "user_explanation": exp_guard["clean_text"],
        "trace_steps": trace,
    }


def node_rubric_rag(state: CommitteeGraphState) -> dict:
    """Node 1: Hybrid BM25 + ChromaDB Vector Retrieval + RRF Cross-Encoder Reranker."""
    t0 = time.perf_counter()
    topic = state.get("topic") or state.get("question", {}).get("topic", "Python Core")
    hybrid = hybrid_retrieve_rubrics(topic, top_k=3)
    top_rubric = hybrid["top_rubric"]
    latency_ms = max(1, int((time.perf_counter() - t0) * 1000))

    trace = list(state.get("trace_steps") or [])
    trace.append({
        "step": 2,
        "node_id": "hybrid_rubric_rag",
        "agent_name": "Hybrid BM25 + Vector Reranker",
        "role": "Lexical + Dense Semantic Rubric Retrieval",
        "status": "completed",
        "latency_ms": latency_ms,
        "summary": (
            f"Selected '{top_rubric['rubric_id']}' ({top_rubric['category']}) | "
            f"BM25={top_rubric['bm25_score']} · Vector={top_rubric['vector_score']} · "
            f"Rerank={int(top_rubric['rerank_score'] * 100)}%"
        ),
    })
    return {
        "rubric_used": top_rubric["rules"],
        "rubric_telemetry": top_rubric,
        "hybrid_rag_report": hybrid,
        "trace_steps": trace,
    }


def node_sandbox_harness(state: CommitteeGraphState) -> dict:
    """Node 2: AST Static Analyzer + 3-Second Isolated Subprocess Test Runner."""
    t0 = time.perf_counter()
    user_code = state.get("user_code", "")
    test_code = state.get("question", {}).get("test_code", "")
    sandbox_res = execute_sandbox_suite(user_code, test_code, timeout_sec=3)
    latency_ms = max(1, int((time.perf_counter() - t0) * 1000))

    ast_info = sandbox_res.get("ast_analysis", {})
    tc_list = sandbox_res.get("test_cases", [])
    passed_cnt = sum(1 for tc in tc_list if tc.get("passed"))

    trace = list(state.get("trace_steps") or [])
    trace.append({
        "step": 3,
        "node_id": "sandbox_harness",
        "agent_name": "AST & Sandbox Execution Harness",
        "role": "Deterministic Code Verification",
        "status": "passed" if sandbox_res.get("passed") else "warning",
        "latency_ms": sandbox_res.get("runtime_ms", latency_ms),
        "summary": (
            f"Tests: {passed_cnt}/{len(tc_list) or 3} passed | "
            f"AST Complexity: {ast_info.get('estimated_time_complexity', 'N/A')} | "
            f"Security: {'SAFE' if ast_info.get('security_passed', True) else 'BLOCKED'}"
        ),
    })
    return {
        "sandbox_result": sandbox_res,
        "trace_steps": trace,
    }


def node_silent_judge(state: CommitteeGraphState) -> dict:
    """Node 3: Deterministic Rubric & AST-Guided LLM-as-a-Judge Evaluator + 4-Criterion Audit."""
    t0 = time.perf_counter()
    eval_res = run_silent_judge_agent(
        question=state.get("question", {}),
        user_code=state.get("user_code", ""),
        user_explanation=state.get("user_explanation", ""),
        sandbox_result=state.get("sandbox_result", {}),
    )
    eval_dict = eval_res.model_dump()
    criteria = build_criterion_breakdown(
        sandbox_result=state.get("sandbox_result", {}),
        evaluation=eval_dict,
        user_explanation=state.get("user_explanation", ""),
    )
    latency_ms = max(1, int((time.perf_counter() - t0) * 1000))

    trace = list(state.get("trace_steps") or [])
    trace.append({
        "step": 4,
        "node_id": "silent_judge",
        "agent_name": "Courtroom Silent Judge",
        "role": "Per-Criterion Auditable Grader & SFT Synthesizer",
        "status": "completed",
        "latency_ms": latency_ms,
        "summary": (
            f"Scored {eval_dict['technical_score']}/10 ({eval_dict['rubric_faithfulness']}% faithfulness) "
            f"across {len(criteria)} rubric criteria."
        ),
    })
    return {
        "evaluation": eval_dict,
        "criterion_breakdown": criteria,
        "trace_steps": trace,
    }


def conditional_edge_router(state: CommitteeGraphState) -> str:
    """Plain-Python deterministic router (never LLM-decided, 100% unit-testable)."""
    score = state.get("evaluation", {}).get("technical_score", 0)
    if score < 6:
        return "hint_retry"
    if score >= 8:
        return "escalate_system_design"
    return "standard_advance"


def node_hint_retry(state: CommitteeGraphState) -> dict:
    t0 = time.perf_counter()
    current_diff = state.get("difficulty", "Medium")
    next_diff = "Easy" if current_diff == "Medium" else current_diff
    topic = state.get("topic", "APIs")
    ckpt_id = f"ckpt_{uuid.uuid4().hex[:10]}"
    latency_ms = max(1, int((time.perf_counter() - t0) * 1000))

    trace = list(state.get("trace_steps") or [])
    trace.append({
        "step": 5,
        "node_id": "hint_retry",
        "agent_name": "LangGraph Traffic Controller",
        "role": "Deterministic Python Router (Score < 6)",
        "status": "retry",
        "latency_ms": latency_ms,
        "summary": f"Activated HINT_AND_RETRY loop. Saved resumable checkpoint '{ckpt_id}'.",
    })
    return {
        "state_checkpoint_id": ckpt_id,
        "next_action": "HINT_AND_RETRY",
        "next_difficulty": next_diff,
        "next_topic": topic,
        "committee_summary": (
            "Score < 6/10: LangGraph Traffic Controller activated the Hint & Retry Remediation Loop. "
            "Apply the Judge's coaching hint and re-run your solution."
        ),
        "followup_question": None,
        "trace_steps": trace,
    }


def node_standard_advance(state: CommitteeGraphState) -> dict:
    t0 = time.perf_counter()
    current_diff = state.get("difficulty", "Medium")
    next_diff = "Hard" if current_diff == "Medium" else "Medium"
    topic = state.get("topic", "APIs")
    followup = run_challenge_architect_agent(topic=topic, difficulty=next_diff)
    ckpt_id = f"ckpt_{uuid.uuid4().hex[:10]}"
    latency_ms = max(1, int((time.perf_counter() - t0) * 1000))

    trace = list(state.get("trace_steps") or [])
    trace.append({
        "step": 5,
        "node_id": "standard_advance",
        "agent_name": "LangGraph Traffic Controller",
        "role": "Deterministic Python Router (Score 6–7)",
        "status": "completed",
        "latency_ms": latency_ms,
        "summary": f"Routed to ADVANCE_ROUND ({next_diff}). Saved resumable checkpoint '{ckpt_id}'.",
    })
    return {
        "state_checkpoint_id": ckpt_id,
        "next_action": "ADVANCE_ROUND",
        "next_difficulty": next_diff,
        "next_topic": topic,
        "committee_summary": (
            f"Passed Round (6–7/10): Functional correctness verified. Advancing candidate to {next_diff} difficulty."
        ),
        "followup_question": followup.model_dump(),
        "trace_steps": trace,
    }


def node_escalate_system_design(state: CommitteeGraphState) -> dict:
    t0 = time.perf_counter()
    next_topic = "Caching Redis System Design Scalability"
    followup = run_challenge_architect_agent(topic=next_topic, difficulty="Hard")
    ckpt_id = f"ckpt_{uuid.uuid4().hex[:10]}"
    latency_ms = max(1, int((time.perf_counter() - t0) * 1000))

    trace = list(state.get("trace_steps") or [])
    trace.append({
        "step": 5,
        "node_id": "escalate_system_design",
        "agent_name": "LangGraph Traffic Controller",
        "role": "Deterministic Python Router (Score ≥ 8)",
        "status": "escalated",
        "latency_ms": latency_ms,
        "summary": f"Escalated to Hard System Design Mode. Saved resumable checkpoint '{ckpt_id}'.",
    })
    return {
        "state_checkpoint_id": ckpt_id,
        "next_action": "ESCALATE_SYSTEM_DESIGN",
        "next_difficulty": "Hard",
        "next_topic": next_topic,
        "committee_summary": (
            "Score ≥ 8/10! High-bar engineering signal verified. LangGraph Traffic Controller leveled up "
            "difficulty to Hard and escalated the session to System Design & Distributed Caching Mode."
        ),
        "followup_question": followup.model_dump(),
        "trace_steps": trace,
    }


builder = StateGraph(CommitteeGraphState)
builder.add_node("guardrail_shield", node_guardrail_shield)
builder.add_node("rubric_rag", node_rubric_rag)
builder.add_node("sandbox_harness", node_sandbox_harness)
builder.add_node("silent_judge", node_silent_judge)
builder.add_node("hint_retry", node_hint_retry)
builder.add_node("standard_advance", node_standard_advance)
builder.add_node("escalate_system_design", node_escalate_system_design)

builder.set_entry_point("guardrail_shield")
builder.add_edge("guardrail_shield", "rubric_rag")
builder.add_edge("rubric_rag", "sandbox_harness")
builder.add_edge("sandbox_harness", "silent_judge")
builder.add_conditional_edges(
    "silent_judge",
    conditional_edge_router,
    {
        "hint_retry": "hint_retry",
        "standard_advance": "standard_advance",
        "escalate_system_design": "escalate_system_design",
    },
)
builder.add_edge("hint_retry", END)
builder.add_edge("standard_advance", END)
builder.add_edge("escalate_system_design", END)

committee_graph_app = builder.compile()


def run_committee_workflow(
    question: dict,
    user_code: str,
    user_explanation: str = "",
    thread_id: str = "",
) -> CommitteeGraphState:
    initial_state: CommitteeGraphState = {
        "thread_id": thread_id or f"thread_{uuid.uuid4().hex[:8]}",
        "state_checkpoint_id": "",
        "topic": question.get("topic", "APIs"),
        "difficulty": question.get("difficulty", "Medium"),
        "question": question,
        "user_code": user_code,
        "user_explanation": user_explanation,
        "guardrail_report": {},
        "rubric_used": "",
        "rubric_telemetry": {},
        "hybrid_rag_report": {},
        "sandbox_result": {},
        "evaluation": {},
        "criterion_breakdown": [],
        "next_action": "",
        "next_difficulty": question.get("difficulty", "Medium"),
        "next_topic": question.get("topic", "APIs"),
        "committee_summary": "",
        "followup_question": None,
        "trace_steps": [],
    }
    return committee_graph_app.invoke(initial_state)
