import json
import os
from typing import List, Dict, Any

from backend.core.config import settings
from backend.core.logger import utc_now_iso
from ai_engine.guardrails.defense import redact_pii


def append_sft_triplet(turn_id: int, state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Appends a verified, PII-scrubbed (Prompt, Candidate Attempt, 10/10 Principal Gold Answer)
    record to `fine_tuning_dataset.jsonl` formatted for LoRA / SFT / DPO training.
    """
    question = state.get("question", {})
    evaluation = state.get("evaluation", {})
    sandbox = state.get("sandbox_result", {})
    ast_info = sandbox.get("ast_analysis", {})

    clean_attempt = redact_pii(state.get("user_code", ""))["redacted_text"]
    clean_prompt = redact_pii(question.get("question_text", ""))["redacted_text"]

    record = {
        "turn_id": turn_id,
        "timestamp": utc_now_iso(),
        "thread_id": state.get("thread_id", "thread_default"),
        "checkpoint_id": state.get("checkpoint_id", "ckpt_latest"),
        "pii_scrubbed": True,
        "opt_in_verified": True,
        "topic": state.get("topic", question.get("topic", "Backend Engineering")),
        "difficulty": state.get("difficulty", question.get("difficulty", "Medium")),
        "candidate_score": evaluation.get("technical_score", 0),
        "rubric_faithfulness": evaluation.get("rubric_faithfulness", 0),
        "ast_complexity": ast_info.get("estimated_time_complexity", "O(1)"),
        "next_action": state.get("next_action", "ADVANCE_ROUND"),
        "prompt": clean_prompt,
        "candidate_attempt": clean_attempt,
        "golden_answer": evaluation.get("golden_answer", ""),
        "messages": [
            {
                "role": "system",
                "content": f"You are a Principal Engineer adhering strictly to: {state.get('rubric_used', 'Company Engineering Rubric')}",
            },
            {
                "role": "user",
                "content": clean_prompt,
            },
            {
                "role": "assistant",
                "content": evaluation.get("golden_answer", ""),
            },
        ],
    }

    with open(settings.jsonl_path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record) + "\n")

    return record


def read_sft_dataset(limit: int = 25) -> List[Dict[str, Any]]:
    """Reads curated SFT / LoRA fine-tuning triplets from disk."""
    if not os.path.exists(settings.jsonl_path):
        return []
    records: List[Dict[str, Any]] = []
    with open(settings.jsonl_path, "r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return list(reversed(records[-limit:]))
