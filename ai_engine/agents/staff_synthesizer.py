from backend.schemas import InterviewQuestion


def synthesize_gold_standard_solution(question: dict, rubric_text: str, ast_report: dict) -> str:
    """
    Agent 4 (Principal Staff Synthesizer):
    Produces a verified 10/10 Principal-Engineer reference implementation with domain notes
    for the Coach panel and SFT Training Data Flywheel (.jsonl).
    """
    topic = question.get("topic", "Production Engineering")
    ref_code = (question.get("reference_solution") or question.get("starter_code") or "").strip()
    domain = question.get("domain_category") or "Engineering"
    focus = question.get("evaluation_focus") or "Functional correctness and production safety"

    return (
        f"# =====================================================================\n"
        f"# REFERENCE IMPLEMENTATION — {topic.upper()}\n"
        f"# Domain: {domain} | Evaluation Focus: {focus}\n"
        f"# Rubric: {rubric_text.splitlines()[0]}\n"
        f"# =====================================================================\n\n"
        f"{ref_code}\n"
    )
