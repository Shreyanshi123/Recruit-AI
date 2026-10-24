"""
Persistence for the B2B assessment flow.
"""

from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
from typing import Any, Dict, List, Optional

from backend.core.config import settings
from backend.core.logger import utc_now_iso

_SCHEMA_INITIALIZED_PATH: Optional[str] = None


def _ensure_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS orgs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            api_key_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assessments (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL REFERENCES orgs(id),
            public_token TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            company_name TEXT NOT NULL,
            role_title TEXT NOT NULL,
            jd_text TEXT NOT NULL,
            skills_json TEXT NOT NULL,
            questions_json TEXT NOT NULL,
            time_limit_min INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_assessments_org ON assessments(org_id);

        CREATE TABLE IF NOT EXISTS candidate_attempts (
            id TEXT PRIMARY KEY,
            assessment_id TEXT NOT NULL REFERENCES assessments(id),
            attempt_token TEXT NOT NULL UNIQUE,
            candidate_name TEXT NOT NULL,
            candidate_email TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'in_progress',
            decision TEXT,
            started_at TEXT NOT NULL,
            deadline_at TEXT NOT NULL,
            submitted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_attempts_assessment ON candidate_attempts(assessment_id);

        CREATE TABLE IF NOT EXISTS attempt_submissions (
            attempt_id TEXT NOT NULL REFERENCES candidate_attempts(id),
            question_id TEXT NOT NULL,
            code TEXT NOT NULL,
            score REAL NOT NULL,
            tests_passed INTEGER NOT NULL,
            tests_total INTEGER NOT NULL,
            complexity TEXT,
            criteria_json TEXT,
            feedback TEXT,
            submit_count INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (attempt_id, question_id)
        );

        CREATE TABLE IF NOT EXISTS proctor_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            attempt_id TEXT NOT NULL REFERENCES candidate_attempts(id),
            event_type TEXT NOT NULL,
            question_id TEXT,
            detail_json TEXT,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_events_attempt ON proctor_events(attempt_id);

        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id TEXT NOT NULL,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            target_id TEXT NOT NULL,
            detail_json TEXT,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id);
        """
    )
    conn.commit()


def _connect() -> sqlite3.Connection:
    global _SCHEMA_INITIALIZED_PATH
    conn = sqlite3.connect(settings.db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    if _SCHEMA_INITIALIZED_PATH != settings.db_path:
        _ensure_tables(conn)
        _SCHEMA_INITIALIZED_PATH = settings.db_path
    return conn


def init_assessment_schema() -> None:
    conn = _connect()
    _ensure_tables(conn)
    conn.close()


def hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Orgs
# ---------------------------------------------------------------------------
def create_org(name: str) -> Dict[str, str]:
    org_id = f"org_{secrets.token_hex(6)}"
    raw_key = f"rk_{secrets.token_urlsafe(24)}"
    conn = _connect()
    conn.execute(
        "INSERT INTO orgs (id, name, api_key_hash, created_at) VALUES (?, ?, ?, ?)",
        (org_id, name, hash_key(raw_key), utc_now_iso()),
    )
    conn.commit()
    conn.close()
    return {"org_id": org_id, "name": name, "api_key": raw_key}


def get_org_by_key(raw_key: str) -> Optional[Dict[str, Any]]:
    if not raw_key:
        return None
    conn = _connect()
    row = conn.execute(
        "SELECT id, name, created_at FROM orgs WHERE api_key_hash = ?",
        (hash_key(raw_key),),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Assessments
# ---------------------------------------------------------------------------
def create_assessment(
    org_id: str,
    title: str,
    company_name: str,
    role_title: str,
    jd_text: str,
    skills: List[str],
    questions: List[Dict[str, Any]],
    time_limit_min: int,
) -> Dict[str, Any]:
    assessment_id = f"asm_{secrets.token_hex(6)}"
    public_token = secrets.token_urlsafe(12)
    conn = _connect()
    conn.execute(
        """
        INSERT INTO assessments (id, org_id, public_token, title, company_name, role_title, jd_text,
                                 skills_json, questions_json, time_limit_min, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            assessment_id,
            org_id,
            public_token,
            title,
            company_name,
            role_title,
            jd_text,
            json.dumps(skills),
            json.dumps(questions),
            time_limit_min,
            utc_now_iso(),
        ),
    )
    conn.commit()
    conn.close()
    return get_assessment(org_id, assessment_id)  # type: ignore[return-value]


def _row_to_assessment(row: sqlite3.Row) -> Dict[str, Any]:
    data = dict(row)
    data["skills"] = json.loads(data.pop("skills_json") or "[]")
    data["questions"] = json.loads(data.pop("questions_json") or "[]")
    return data


def get_assessment(org_id: str, assessment_id: str) -> Optional[Dict[str, Any]]:
    conn = _connect()
    row = conn.execute(
        "SELECT * FROM assessments WHERE id = ? AND org_id = ?",
        (assessment_id, org_id),
    ).fetchone()
    conn.close()
    return _row_to_assessment(row) if row else None


def get_assessment_by_token(public_token: str) -> Optional[Dict[str, Any]]:
    conn = _connect()
    row = conn.execute(
        "SELECT * FROM assessments WHERE public_token = ?", (public_token,)
    ).fetchone()
    conn.close()
    return _row_to_assessment(row) if row else None


def get_assessment_by_id_unscoped(assessment_id: str) -> Optional[Dict[str, Any]]:
    conn = _connect()
    row = conn.execute(
        "SELECT * FROM assessments WHERE id = ?", (assessment_id,)
    ).fetchone()
    conn.close()
    return _row_to_assessment(row) if row else None


def list_assessments(org_id: str) -> List[Dict[str, Any]]:
    conn = _connect()
    rows = conn.execute(
        """
        SELECT a.id, a.title, a.company_name, a.role_title, a.public_token, a.time_limit_min,
               a.status, a.created_at, a.skills_json, a.questions_json,
               COUNT(c.id) AS candidates,
               SUM(CASE WHEN c.status = 'submitted' THEN 1 ELSE 0 END) AS completed
        FROM assessments a
        LEFT JOIN candidate_attempts c ON c.assessment_id = a.id
        WHERE a.org_id = ?
        GROUP BY a.id
        ORDER BY a.created_at DESC
        """,
        (org_id,),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["skills"] = json.loads(d.pop("skills_json") or "[]")
        d["question_count"] = len(json.loads(d.pop("questions_json") or "[]"))
        d["completed"] = int(d["completed"] or 0)
        out.append(d)
    return out


# ---------------------------------------------------------------------------
# Attempts
# ---------------------------------------------------------------------------
def create_attempt(
    assessment_id: str, name: str, email: str, started_at: str, deadline_at: str
) -> Dict[str, Any]:
    attempt_id = f"att_{secrets.token_hex(6)}"
    token = secrets.token_urlsafe(24)
    conn = _connect()
    conn.execute(
        """
        INSERT INTO candidate_attempts (id, assessment_id, attempt_token, candidate_name, candidate_email,
                                        started_at, deadline_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (attempt_id, assessment_id, token, name, email, started_at, deadline_at),
    )
    conn.commit()
    conn.close()
    return {
        "attempt_id": attempt_id,
        "attempt_token": token,
        "started_at": started_at,
        "deadline_at": deadline_at,
    }


def find_attempt_by_email(assessment_id: str, email: str) -> Optional[Dict[str, Any]]:
    conn = _connect()
    row = conn.execute(
        "SELECT * FROM candidate_attempts WHERE assessment_id = ? AND lower(candidate_email) = lower(?)",
        (assessment_id, email),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_attempt_by_token(token: str) -> Optional[Dict[str, Any]]:
    conn = _connect()
    row = conn.execute(
        "SELECT * FROM candidate_attempts WHERE attempt_token = ?", (token,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def mark_attempt_submitted(attempt_id: str) -> None:
    conn = _connect()
    conn.execute(
        "UPDATE candidate_attempts SET status = 'submitted', submitted_at = ? WHERE id = ? AND status != 'submitted'",
        (utc_now_iso(), attempt_id),
    )
    conn.commit()
    conn.close()


def set_attempt_decision(attempt_id: str, decision: str) -> None:
    conn = _connect()
    conn.execute(
        "UPDATE candidate_attempts SET decision = ? WHERE id = ?",
        (decision, attempt_id),
    )
    conn.commit()
    conn.close()


def list_attempts(assessment_id: str) -> List[Dict[str, Any]]:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM candidate_attempts WHERE assessment_id = ? ORDER BY started_at DESC",
        (assessment_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Submissions & proctoring
# ---------------------------------------------------------------------------
def upsert_submission(
    attempt_id: str,
    question_id: str,
    code: str,
    score: float,
    tests_passed: int,
    tests_total: int,
    complexity: str,
    criteria: List[Dict[str, Any]],
    feedback: str,
) -> int:
    conn = _connect()
    existing = conn.execute(
        "SELECT submit_count FROM attempt_submissions WHERE attempt_id = ? AND question_id = ?",
        (attempt_id, question_id),
    ).fetchone()
    count = (existing["submit_count"] + 1) if existing else 1
    conn.execute(
        """
        INSERT INTO attempt_submissions (attempt_id, question_id, code, score, tests_passed, tests_total,
                                         complexity, criteria_json, feedback, submit_count, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(attempt_id, question_id) DO UPDATE SET
            code = excluded.code, score = excluded.score, tests_passed = excluded.tests_passed,
            tests_total = excluded.tests_total, complexity = excluded.complexity,
            criteria_json = excluded.criteria_json, feedback = excluded.feedback,
            submit_count = excluded.submit_count, updated_at = excluded.updated_at
        """,
        (
            attempt_id,
            question_id,
            code,
            score,
            tests_passed,
            tests_total,
            complexity,
            json.dumps(criteria),
            feedback,
            count,
            utc_now_iso(),
        ),
    )
    conn.commit()
    conn.close()
    return count


def list_submissions(attempt_ids: List[str]) -> List[Dict[str, Any]]:
    if not attempt_ids:
        return []
    conn = _connect()
    placeholders = ",".join("?" for _ in attempt_ids)
    rows = conn.execute(
        f"SELECT * FROM attempt_submissions WHERE attempt_id IN ({placeholders})",
        attempt_ids,
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["criteria"] = json.loads(d.pop("criteria_json") or "[]")
        out.append(d)
    return out


def add_proctor_event(
    attempt_id: str,
    event_type: str,
    question_id: Optional[str],
    detail: Dict[str, Any],
) -> None:
    conn = _connect()
    conn.execute(
        "INSERT INTO proctor_events (attempt_id, event_type, question_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?)",
        (attempt_id, event_type, question_id, json.dumps(detail or {}), utc_now_iso()),
    )
    conn.commit()
    conn.close()


def list_proctor_events(attempt_ids: List[str]) -> List[Dict[str, Any]]:
    if not attempt_ids:
        return []
    conn = _connect()
    placeholders = ",".join("?" for _ in attempt_ids)
    rows = conn.execute(
        f"SELECT * FROM proctor_events WHERE attempt_id IN ({placeholders}) ORDER BY id",
        attempt_ids,
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["detail"] = json.loads(d.pop("detail_json") or "{}")
        out.append(d)
    return out


# ---------------------------------------------------------------------------
# Audit log (append-only)
# ---------------------------------------------------------------------------
def append_audit(
    org_id: str, actor: str, action: str, target_id: str, detail: Dict[str, Any]
) -> None:
    conn = _connect()
    conn.execute(
        "INSERT INTO audit_log (org_id, actor, action, target_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (org_id, actor, action, target_id, json.dumps(detail or {}), utc_now_iso()),
    )
    conn.commit()
    conn.close()


def list_audit(
    org_id: str, target_id: Optional[str] = None, limit: int = 100
) -> List[Dict[str, Any]]:
    conn = _connect()
    if target_id:
        rows = conn.execute(
            "SELECT * FROM audit_log WHERE org_id = ? AND target_id = ? ORDER BY id DESC LIMIT ?",
            (org_id, target_id, limit),
        ).fetchone()
    rows = (
        conn.execute(
            "SELECT * FROM audit_log WHERE org_id = ? AND target_id = ? ORDER BY id DESC LIMIT ?",
            (org_id, target_id, limit),
        ).fetchall()
        if target_id
        else conn.execute(
            "SELECT * FROM audit_log WHERE org_id = ? ORDER BY id DESC LIMIT ?",
            (org_id, limit),
        ).fetchall()
    )
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["detail"] = json.loads(d.pop("detail_json") or "{}")
        out.append(d)
    return out
