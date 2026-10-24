import json
import sqlite3
from typing import Dict, Any

from backend.core.config import settings
from backend.core.logger import utc_now_iso
from backend.repositories.flywheel_repository import append_sft_triplet, read_sft_dataset


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_ledger_schema() -> None:
    """Initializes enterprise SQLite persistence tables for sessions, turns, and traces."""
    conn = _connect()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS interview_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            match_percentage INTEGER NOT NULL,
            matched_skills TEXT NOT NULL,
            missing_skills TEXT NOT NULL,
            radar_scores TEXT NOT NULL
        )
    """)

    cur.execute("""
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


def create_gap_session(gap_dict: Dict[str, Any]) -> int:
    init_ledger_schema()
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO interview_sessions (
            created_at, match_percentage, matched_skills, missing_skills, radar_scores
        ) VALUES (?, ?, ?, ?, ?)
        """,
        (
            utc_now_iso(),
            gap_dict.get("match_percentage", 0),
            json.dumps(gap_dict.get("matched_skills", [])),
            json.dumps(gap_dict.get("missing_skills", [])),
            json.dumps(gap_dict.get("radar_scores", {})),
        ),
    )
    session_id = cur.lastrowid or 1
    conn.commit()
    conn.close()
    return int(session_id)


def record_committee_turn(session_id: int, state: Dict[str, Any]) -> Dict[str, Any]:
    init_ledger_schema()
    conn = _connect()
    cur = conn.cursor()

    question = state.get("question", {})
    sandbox = state.get("sandbox_result", {})
    evaluation = state.get("evaluation", {})

    cur.execute(
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
            utc_now_iso(),
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
    turn_id = int(cur.lastrowid or 1)
    conn.commit()
    conn.close()

    append_sft_triplet(turn_id, state)
    return {
        "turn_id": turn_id,
        "flywheel_logged": True,
        "jsonl_path": "fine_tuning_dataset.jsonl",
    }


def fetch_dashboard_telemetry() -> Dict[str, Any]:
    init_ledger_schema()
    conn = _connect()
    cur = conn.cursor()

    cur.execute("SELECT * FROM evaluation_turns ORDER BY id DESC LIMIT 20")
    turns = [dict(r) for r in cur.fetchall()]

    cur.execute(
        """
        SELECT
            COUNT(*) AS total,
            AVG(technical_score) AS avg_score,
            AVG(rubric_faithfulness) AS avg_faithfulness,
            SUM(CASE WHEN sandbox_passed = 1 THEN 1 ELSE 0 END) AS passed_count,
            AVG(sandbox_runtime_ms) AS avg_runtime_ms
        FROM evaluation_turns
        """
    )
    stats = dict(cur.fetchone() or {})
    conn.close()

    sft_samples = read_sft_dataset(limit=20)
    total = int(stats.get("total") or 0)
    passed_cnt = int(stats.get("passed_count") or 0)

    return {
        "total_turns": total,
        "avg_technical_score": round(float(stats.get("avg_score") or 0.0), 1),
        "avg_faithfulness": round(float(stats.get("avg_faithfulness") or 0.0), 1),
        "pass_rate_pct": int(round((passed_cnt / total) * 100)) if total > 0 else 0,
        "avg_runtime_ms": int(round(float(stats.get("avg_runtime_ms") or 0.0))),
        "recent_turns": turns,
        "finetuning_count": len(sft_samples),
        "finetuning_samples": sft_samples,
    }

