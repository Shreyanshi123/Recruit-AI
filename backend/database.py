import sqlite3
import json
import os
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "hireroom_ledger.db")
JSONL_PATH = os.path.join(BASE_DIR, "fine_tuning_dataset.jsonl")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes SQLite tables for interview sessions and evaluation turn telemetry."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS interview_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            match_percentage INTEGER NOT NULL,
            matched_skills TEXT NOT NULL,
            missing_skills TEXT NOT NULL,
            radar_scores TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS evaluation_turns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            created_at TEXT NOT NULL,
            topic TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            question_text TEXT NOT NULL,
            user_code TEXT NOT NULL,
            user_explanation TEXT,
            sandbox_passed INTEGER NOT NULL,
            sandbox_runtime_ms INTEGER NOT NULL,
            sandbox_output TEXT,
            technical_score INTEGER NOT NULL,
            rubric_faithfulness INTEGER NOT NULL,
            feedback TEXT NOT NULL,
            hint TEXT,
            golden_answer TEXT NOT NULL,
            next_action TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def save_gap_session(gap_result: dict) -> int:
    """Persists a Resume vs. JD Gap Analysis session and returns session_id."""
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute(
        """
        INSERT INTO interview_sessions (
            created_at, match_percentage, matched_skills, missing_skills, radar_scores
        ) VALUES (?, ?, ?, ?, ?)
        """,
        (
            now_iso,
            gap_result.get("match_percentage", 0),
            json.dumps(gap_result.get("matched_skills", [])),
            json.dumps(gap_result.get("missing_skills", [])),
            json.dumps(gap_result.get("radar_scores", {})),
        ),
    )
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return session_id


def save_evaluation_turn(session_id: int, state: dict) -> dict:
    """Persists an interview turn in SQLite and appends to the LoRA/SFT .jsonl flywheel."""
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    question = state.get("question", {})
    sandbox = state.get("sandbox_result", {})
    evaluation = state.get("evaluation", {})

    cursor.execute(
        """
        INSERT INTO evaluation_turns (
            session_id, created_at, topic, difficulty, question_text,
            user_code, user_explanation, sandbox_passed, sandbox_runtime_ms,
            sandbox_output, technical_score, rubric_faithfulness,
            feedback, hint, golden_answer, next_action
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            session_id,
            now_iso,
            state.get("topic", question.get("topic", "General")),
            state.get("difficulty", question.get("difficulty", "Medium")),
            question.get("question_text", ""),
            state.get("user_code", ""),
            state.get("user_explanation", ""),
            1 if sandbox.get("passed") else 0,
            sandbox.get("runtime_ms", 0),
            sandbox.get("output", ""),
            evaluation.get("technical_score", 0),
            evaluation.get("rubric_faithfulness", 0),
            evaluation.get("feedback", ""),
            evaluation.get("hint", ""),
            evaluation.get("golden_answer", ""),
            state.get("next_action", "ADVANCE_ROUND"),
        ),
    )
    turn_id = cursor.lastrowid
    conn.commit()
    conn.close()

    # Log triplet (Prompt, Candidate Weak Attempt, Ideal Gold Answer) into .jsonl file
    flywheel_entry = {
        "turn_id": turn_id,
        "timestamp": now_iso,
        "topic": state.get("topic", question.get("topic", "General")),
        "difficulty": state.get("difficulty", question.get("difficulty", "Medium")),
        "candidate_score": evaluation.get("technical_score", 0),
        "rubric_faithfulness": evaluation.get("rubric_faithfulness", 0),
        "prompt": question.get("question_text", ""),
        "candidate_attempt": state.get("user_code", ""),
        "golden_answer": evaluation.get("golden_answer", ""),
        "messages": [
            {
                "role": "system",
                "content": f"You are a Principal Engineer following {state.get('rubric_used', 'company engineering rubrics')}.",
            },
            {
                "role": "user",
                "content": question.get("question_text", ""),
            },
            {
                "role": "assistant",
                "content": evaluation.get("golden_answer", ""),
            },
        ],
    }

    with open(JSONL_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(flywheel_entry) + "\n")

    return {"turn_id": turn_id, "flywheel_logged": True, "jsonl_path": "fine_tuning_dataset.jsonl"}


def get_telemetry_summary() -> dict:
    """Returns SQLite session history and Fine-Tuning Flywheel metrics for the dashboard."""
    init_db()
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM evaluation_turns ORDER BY id DESC LIMIT 15")
    rows = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT COUNT(*) as total, AVG(technical_score) as avg_score, AVG(rubric_faithfulness) as avg_faithfulness FROM evaluation_turns")
    stats_row = dict(cursor.fetchone() or {})
    conn.close()

    jsonl_entries = []
    if os.path.exists(JSONL_PATH):
        with open(JSONL_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    try:
                        jsonl_entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

    return {
        "total_turns": stats_row.get("total") or 0,
        "avg_technical_score": round(stats_row.get("avg_score") or 0.0, 1),
        "avg_faithfulness": round(stats_row.get("avg_faithfulness") or 0.0, 1),
        "recent_turns": rows,
        "finetuning_count": len(jsonl_entries),
        "finetuning_samples": list(reversed(jsonl_entries[-10:])),
    }

