from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END

from ai_engine.code_sandbox import run_code_in_sandbox
from ai_engine.rag_rubric import retrieve_rubric
from ai_engine.judge_evaluator import evaluate_submission, generate_interview_question


class InterviewState(TypedDict):
    """Shared state ledger across the 5-member autonomous hiring committee."""
    topic: str
    difficulty: str
    question: dict
    user_code: str
    user_explanation: str
    rubric_used: str
    sandbox_result: dict
    evaluation: dict
    next_action: str
    next_difficulty: str
    next_topic: str
    committee_summary: str
    followup_question: Optional[dict]


def rubric_rag_node(state: InterviewState) -> dict:
    """Member 1 (Rubric RAG Specialist): Retrieves company grading rubric from ChromaDB."""
    topic = state.get("topic") or state.get("question", {}).get("topic", "Python Core")
    rubric = retrieve_rubric(topic)
    return {"rubric_used": rubric}


def sandbox_harness_node(state: InterviewState) -> dict:
    """Member 2 (Execution Safety Box): Runs candidate code against unit tests in a 3s subprocess."""
    user_code = state.get("user_code", "")
    test_code = state.get("question", {}).get("test_code", "")
    sandbox_res = run_code_in_sandbox(user_code, test_code)
    return {"sandbox_result": sandbox_res}


def silent_judge_node(state: InterviewState) -> dict:
    """Member 3 (Silent Judge): Deterministic rubric-based grading using sandbox telemetry."""
    eval_res = evaluate_submission(
        question=state.get("question", {}),
        user_code=state.get("user_code", ""),
        user_explanation=state.get("user_explanation", ""),
        sandbox_result=state.get("sandbox_result", {}),
    )
    return {"evaluation": eval_res.model_dump()}


def route_by_score(state: InterviewState) -> str:
    """Member 4 (LangGraph Traffic Controller): Routes interview flow based on deterministic score."""
    score = state.get("evaluation", {}).get("technical_score", 0)
    if score < 6:
        return "hint_retry"
    elif score >= 8:
        return "escalate_system_design"
    return "standard_advance"


def hint_retry_node(state: InterviewState) -> dict:
    """Triggered when score < 6: Keeps topic active, provides targeted hint, and logs Gold Answer."""
    current_diff = state.get("difficulty", "Medium")
    next_diff = "Easy" if current_diff == "Medium" else current_diff
    topic = state.get("topic", "APIs")
    return {
        "next_action": "HINT_AND_RETRY",
        "next_difficulty": next_diff,
        "next_topic": topic,
        "committee_summary": (
            "Score < 6/10 detected. The LangGraph Traffic Controller activated the Hint & Retry Loop. "
            "Review the Judge's coaching hint and re-run your code, or load a foundational warmup."
        ),
        "followup_question": None,
    }


def standard_advance_node(state: InterviewState) -> dict:
    """Triggered when 6 <= score < 8: Advances candidate to next competency at Medium/Hard difficulty."""
    current_diff = state.get("difficulty", "Medium")
    next_diff = "Hard" if current_diff == "Medium" else "Medium"
    topic = state.get("topic", "APIs")
    followup = generate_interview_question(topic=topic, difficulty=next_diff)
    return {
        "next_action": "ADVANCE_ROUND",
        "next_difficulty": next_diff,
        "next_topic": topic,
        "committee_summary": (
            "Solid pass (6-7/10). The committee verified functional correctness and is advancing "
            f"you to the next {next_diff} challenge."
        ),
        "followup_question": followup.model_dump(),
    }


def system_design_escalation_node(state: InterviewState) -> dict:
    """Triggered when score >= 8: Levels up difficulty to Hard and escalates to System Design Mode."""
    next_topic = "Caching Redis System Design Scalability"
    followup = generate_interview_question(topic=next_topic, difficulty="Hard")
    return {
        "next_action": "ESCALATE_SYSTEM_DESIGN",
        "next_difficulty": "Hard",
        "next_topic": next_topic,
        "committee_summary": (
            "Score >= 8/10! High-bar engineering signal confirmed. The LangGraph Traffic Controller "
            "has leveled up difficulty to Hard and escalated the session to System Design & Scalability Mode."
        ),
        "followup_question": followup.model_dump(),
    }


# Construct the LangGraph State Machine
workflow = StateGraph(InterviewState)

workflow.add_node("rubric_rag", rubric_rag_node)
workflow.add_node("sandbox_harness", sandbox_harness_node)
workflow.add_node("silent_judge", silent_judge_node)
workflow.add_node("hint_retry", hint_retry_node)
workflow.add_node("standard_advance", standard_advance_node)
workflow.add_node("escalate_system_design", system_design_escalation_node)

workflow.set_entry_point("rubric_rag")
workflow.add_edge("rubric_rag", "sandbox_harness")
workflow.add_edge("sandbox_harness", "silent_judge")

workflow.add_conditional_edges(
    "silent_judge",
    route_by_score,
    {
        "hint_retry": "hint_retry",
        "standard_advance": "standard_advance",
        "escalate_system_design": "escalate_system_design",
    },
)

workflow.add_edge("hint_retry", END)
workflow.add_edge("standard_advance", END)
workflow.add_edge("escalate_system_design", END)

interview_graph_app = workflow.compile()


def execute_interview_turn(
    question: dict,
    user_code: str,
    user_explanation: str = "",
) -> InterviewState:
    """Executes a full autonomous turn through the compiled LangGraph state machine."""
    initial_state: InterviewState = {
        "topic": question.get("topic", "APIs"),
        "difficulty": question.get("difficulty", "Medium"),
        "question": question,
        "user_code": user_code,
        "user_explanation": user_explanation,
        "rubric_used": "",
        "sandbox_result": {},
        "evaluation": {},
        "next_action": "",
        "next_difficulty": question.get("difficulty", "Medium"),
        "next_topic": question.get("topic", "APIs"),
        "committee_summary": "",
        "followup_question": None,
    }
    final_state = interview_graph_app.invoke(initial_state)
    return final_state

