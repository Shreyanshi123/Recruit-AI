import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from backend.core.config import settings
from backend.repositories.assessment_repository import create_org

router = APIRouter(prefix="/api/auth", tags=["Authentication & Role Registration"])

_AUTH_SCHEMA_INITIALIZED = False


def _connect() -> sqlite3.Connection:
    global _AUTH_SCHEMA_INITIALIZED
    conn = sqlite3.connect(settings.db_path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    if not _AUTH_SCHEMA_INITIALIZED:
        _ensure_schema(conn)
        _AUTH_SCHEMA_INITIALIZED = True
    return conn


def _ensure_schema(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            organization_name TEXT DEFAULT '',
            target_role TEXT DEFAULT '',
            org_id TEXT DEFAULT '',
            org_api_key TEXT DEFAULT '',
            auth_token TEXT NOT NULL,
            created_at REAL NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS candidate_history (
            id TEXT PRIMARY KEY,
            user_email TEXT NOT NULL,
            company_name TEXT NOT NULL,
            role_title TEXT NOT NULL,
            before_match_pct INTEGER DEFAULT 60,
            after_match_pct INTEGER DEFAULT 95,
            avg_score REAL DEFAULT 8.0,
            completed_rounds_json TEXT DEFAULT '[]',
            missing_skills_json TEXT DEFAULT '[]',
            verified_skills_json TEXT DEFAULT '[]',
            created_at REAL NOT NULL
        )
        """
    )
    conn.commit()


def init_auth_schema() -> None:
    global _AUTH_SCHEMA_INITIALIZED
    conn = sqlite3.connect(settings.db_path, timeout=10.0)
    try:
        _ensure_schema(conn)
        _AUTH_SCHEMA_INITIALIZED = True
    finally:
        conn.close()


def _hash_password(password: str, salt: Optional[str] = None) -> str:
    salt_val = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_val.encode("utf-8"), 100_000)
    return f"{salt_val}${dk.hex()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    if "$" not in stored_hash:
        return False
    salt_val, expected_hex = stored_hash.split("$", 1)
    candidate_hash = _hash_password(password, salt_val)
    return hmac.compare_digest(candidate_hash, stored_hash)


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=3, max_length=180)
    password: str = Field(..., min_length=4, max_length=128)
    role: Literal["candidate", "interviewer"] = "candidate"
    organization_name: Optional[str] = Field(default="", max_length=120)
    target_role: Optional[str] = Field(default="AI Full-Stack Engineer", max_length=120)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=180)
    password: str = Field(..., min_length=1, max_length=128)


class DemoSwitchRequest(BaseModel):
    role: Literal["candidate", "interviewer"] = "candidate"


def _serialize_user(row: sqlite3.Row) -> dict:
    return {
        "user_id": row["user_id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "role": row["role"],
        "organization_name": row["organization_name"] or "",
        "target_role": row["target_role"] or "",
        "org_id": row["org_id"] or "",
        "org_api_key": row["org_api_key"] or "",
        "auth_token": row["auth_token"],
        "created_at": row["created_at"],
    }


@router.post("/register")
def register_user_endpoint(req: RegisterRequest):
    email_clean = req.email.strip().lower()
    full_name_clean = req.full_name.strip()
    if "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    org_name = (req.organization_name or "").strip()
    target_role = (req.target_role or "").strip()

    if req.role == "interviewer" and not org_name:
        org_name = f"{full_name_clean}'s Hiring Team"
    if req.role == "candidate" and not target_role:
        target_role = "AI Full-Stack Engineer"

    org_id = ""
    org_api_key = ""
    if req.role == "interviewer":
        org_info = create_org(org_name)
        org_id = org_info["org_id"]
        org_api_key = org_info["api_key"]

    conn = _connect()
    try:
        existing = conn.execute("SELECT * FROM users WHERE email = ?", (email_clean,)).fetchone()
        auth_token = f"tok_{secrets.token_urlsafe(24)}"
        pw_hash = _hash_password(req.password)

        if existing:
            # Allow seamless re-registration / role update for smooth UX
            if req.role == "interviewer" and not org_api_key:
                org_info = create_org(org_name)
                org_id = org_info["org_id"]
                org_api_key = org_info["api_key"]
            conn.execute(
                """
                UPDATE users
                SET full_name = ?, password_hash = ?, role = ?, organization_name = ?,
                    target_role = ?, org_id = ?, org_api_key = ?, auth_token = ?
                WHERE email = ?
                """,
                (
                    full_name_clean,
                    pw_hash,
                    req.role,
                    org_name,
                    target_role,
                    org_id or existing["org_id"],
                    org_api_key or existing["org_api_key"],
                    auth_token,
                    email_clean,
                ),
            )
            conn.commit()
            updated = conn.execute("SELECT * FROM users WHERE email = ?", (email_clean,)).fetchone()
            return _serialize_user(updated)

        user_id = f"usr_{secrets.token_hex(6)}"
        now = time.time()
        conn.execute(
            """
            INSERT INTO users (
                user_id, full_name, email, password_hash, role,
                organization_name, target_role, org_id, org_api_key, auth_token, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                full_name_clean,
                email_clean,
                pw_hash,
                req.role,
                org_name,
                target_role,
                org_id,
                org_api_key,
                auth_token,
                now,
            ),
        )
        conn.commit()
        created = conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
        return _serialize_user(created)
    finally:
        conn.close()


@router.post("/login")
def login_user_endpoint(req: LoginRequest):
    email_clean = req.email.strip().lower()
    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email_clean,)).fetchone()
        if not row or not _verify_password(req.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        # Ensure interviewer has an active org_api_key
        org_id = row["org_id"]
        org_api_key = row["org_api_key"]
        if row["role"] == "interviewer" and not org_api_key:
            org_info = create_org(row["organization_name"] or f"{row['full_name']} Org")
            org_id = org_info["org_id"]
            org_api_key = org_info["api_key"]

        new_token = f"tok_{secrets.token_urlsafe(24)}"
        conn.execute(
            "UPDATE users SET auth_token = ?, org_id = ?, org_api_key = ? WHERE user_id = ?",
            (new_token, org_id, org_api_key, row["user_id"]),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM users WHERE user_id = ?", (row["user_id"],)).fetchone()
        return _serialize_user(updated)
    finally:
        conn.close()


@router.post("/demo")
def demo_role_endpoint(req: DemoSwitchRequest):
    """Instant 1-click role switch between Candidate (Interviewee) and Interviewer (Recruiter)."""
    if req.role == "interviewer":
        email = "interviewer@eulermotors.com"
        full_name = "Vikram Mehta (Hiring Lead)"
        org_name = "Euler Motors — Engineering"
        target_role = "Technical Interviewer & Bar Raiser"
    else:
        email = "shreyanshi@candidate.dev"
        full_name = "Shreyanshi Mishra"
        org_name = ""
        target_role = "AI Full-Stack Engineer (Candidate)"

    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            if req.role == "interviewer" and not row["org_api_key"]:
                org_info = create_org(org_name)
                conn.execute(
                    "UPDATE users SET org_id = ?, org_api_key = ? WHERE user_id = ?",
                    (org_info["org_id"], org_info["api_key"], row["user_id"]),
                )
                conn.commit()
                row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            return _serialize_user(row)
    finally:
        conn.close()

    return register_user_endpoint(
        RegisterRequest(
            full_name=full_name,
            email=email,
            password="demo-password-2026",
            role=req.role,
            organization_name=org_name,
            target_role=target_role,
        )
    )


@router.get("/me")
def get_current_user_endpoint(x_auth_token: Optional[str] = Header(default=None)):
    if not x_auth_token:
        raise HTTPException(status_code=401, detail="Missing X-Auth-Token header")
    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM users WHERE auth_token = ?", (x_auth_token,)).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Session expired or invalid token")
        return _serialize_user(row)
    finally:
        conn.close()


class SaveHistoryRequest(BaseModel):
    user_email: str = "shreyanshi@candidate.dev"
    company_name: str
    role_title: str
    before_match_pct: int = 60
    after_match_pct: int = 95
    avg_score: float = 8.0
    completed_rounds: List[Dict[str, Any]] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    verified_skills: List[str] = Field(default_factory=list)


@router.post("/history")
def save_candidate_history_endpoint(req: SaveHistoryRequest):
    conn = _connect()
    try:
        _ensure_schema(conn)
        email_clean = (req.user_email or "shreyanshi@candidate.dev").strip().lower()
        hist_id = f"hist_{secrets.token_hex(6)}"
        now = time.time()
        conn.execute(
            """
            INSERT INTO candidate_history (
                id, user_email, company_name, role_title,
                before_match_pct, after_match_pct, avg_score,
                completed_rounds_json, missing_skills_json, verified_skills_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                hist_id,
                email_clean,
                req.company_name,
                req.role_title,
                req.before_match_pct,
                req.after_match_pct,
                req.avg_score,
                json.dumps(req.completed_rounds),
                json.dumps(req.missing_skills),
                json.dumps(req.verified_skills),
                now,
            ),
        )
        conn.commit()
        return {"saved": True, "id": hist_id}
    finally:
        conn.close()


@router.get("/history")
def list_candidate_history_endpoint(email: Optional[str] = None):
    conn = _connect()
    try:
        _ensure_schema(conn)
        email_clean = (email or "shreyanshi@candidate.dev").strip().lower()
        rows = conn.execute(
            "SELECT * FROM candidate_history WHERE user_email = ? ORDER BY created_at DESC LIMIT 20",
            (email_clean,),
        ).fetchall()
        sessions = []
        skill_mastery: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            rounds = json.loads(r["completed_rounds_json"] or "[]")
            missing = json.loads(r["missing_skills_json"] or "[]")
            verified = json.loads(r["verified_skills_json"] or "[]")
            for sk in verified:
                skill_mastery.setdefault(sk, {"skill": sk, "status": "Verified", "best_score": 8.0, "sessions": 0})
                skill_mastery[sk]["sessions"] += 1
            for sk in missing:
                skill_mastery.setdefault(sk, {"skill": sk, "status": "Gap Practiced", "best_score": float(r["avg_score"] or 7.5), "sessions": 0})
                skill_mastery[sk]["sessions"] += 1
            for rd in rounds:
                sk_name = rd.get("skill") or rd.get("topic") or "Coding"
                sc = float(rd.get("technical_score") or 0)
                cur = skill_mastery.setdefault(sk_name, {"skill": sk_name, "status": "Practiced", "best_score": sc, "sessions": 0})
                cur["sessions"] += 1
                if sc >= cur["best_score"]:
                    cur["best_score"] = sc
                if sc >= 7.0:
                    cur["status"] = "Mastered ✓"
            sessions.append(
                {
                    "id": r["id"],
                    "company_name": r["company_name"],
                    "role_title": r["role_title"],
                    "before_match_pct": r["before_match_pct"],
                    "after_match_pct": r["after_match_pct"],
                    "avg_score": r["avg_score"],
                    "completed_rounds": rounds,
                    "missing_skills": missing,
                    "verified_skills": verified,
                    "created_at": r["created_at"],
                }
            )
        return {"sessions": sessions, "skill_mastery": list(skill_mastery.values())}
    finally:
        conn.close()


