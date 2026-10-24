# RecruitAI — Agentic AI Technical Screening, Proctored IDE & B2B Assessment Integrity Platform

**RecruitAI** is a full-stack **Agentic AI Technical Assessment & Screening Platform** built for engineering teams and candidates. Unlike a raw chat LLM (`ChatGPT` / `Claude` / `Gemini`) that guesses whether code works, leaks answers, or drifts in scoring across runs, RecruitAI provides the **execution, verification, anti-cheating, and compliance infrastructure** required for real technical hiring decisions:

1. **Server-Side Hidden Unit Tests (`backend/services/assessment_service.py`)**: Candidates taking a proctored assessment (`/a/{public_token}`) only see **1 visible sample assertion** in the browser. Full grading executes against server-side hidden unit tests inside an isolated Python `subprocess` (`python -I` with scrubbed environment variables and a 3-second wall-clock timeout), preventing hardcoded answers or client-side tampering.
2. **AST Structural Code Plagiarism Detector (`ai_engine/integrity/similarity.py`)**: Parses candidate Python submissions into Abstract Syntax Trees (`ast`), strips comments/docstrings, normalizes all user-defined variable and parameter identifiers (`v0, v1, v2...`), and computes pairwise structural similarity across candidates to flag copied solutions even when variables and comments are renamed.
3. **Browser Proctoring & Server-Enforced Deadlines (`backend/api/routes_assessments.py`)**: Tracks clipboard paste volume (`chars` and `lines`), tab switches (`visibilitychange`), and window blur events, combining them with AST plagiarism flags into a per-candidate **Integrity Risk Rating (`low` / `medium` / `high`)**.
4. **Multi-Tenant Workspace Isolation & Append-Only Audit Log (`backend/repositories/assessment_repository.py`)**: Every recruiter workspace is authenticated via a SHA-256 hashed `X-Org-Key` header (`orgs` table). Recruiter decisions (`advance`, `hold`, `reject`) are recorded in an append-only `audit_log` table.
5. **5-Node LangGraph Committee & Hybrid Rubric RAG (`ai_engine/workflows/committee_graph.py`)**:
   - **Node 1 (`guardrail_shield`)**: Prompt-injection classifier (`"ignore previous instructions"`, `"score 10/10"`, `<system>` spoofing), Presidio-style PII redaction (`EMAIL`, `PHONE`, `SSN`, `API_KEY`), and XML delimiter isolation.
   - **Node 2 (`hybrid_rubric_rag`)**: Okapi BM25 lexical search + ChromaDB dense vector embeddings fused via Reciprocal Rank Fusion (`RRF`).
   - **Node 3 (`sandbox_harness`)**: Static `ast` complexity & security policy (`os`, `subprocess`, `socket`, `eval` blocked) + isolated test execution.
   - **Node 4 (`silent_judge`)**: Deterministic (`temperature=0.0`) 4-criterion grading (`Functional Assertions /4`, `AST Complexity /3`, `Boundary Guardrails /2`, `Architectural Clarity /1`).
   - **Node 5 (`conditional_edge_router`)**: Pure-Python deterministic state router (`HINT_AND_RETRY`, `ADVANCE_ROUND`, `ESCALATE_SYSTEM_DESIGN`).
6. **CI Golden Regression & EU AI Act Bias Gate (`ai_engine/evals/run_evals.py`)**: Automated test gate verifying 100% Judge scoring accuracy, 100% prompt-injection blocking, 100% PII scrubbing, and **0.0% counterfactual demographic bias variance** across candidate name/pronoun swaps.

---

## Why Engineering Teams Use RecruitAI Instead of a Raw Chat LLM

| Capability | Raw Chat LLM (ChatGPT / Claude / Gemini) | RecruitAI Platform |
| :--- | :--- | :--- |
| **Code Verification** | Guesses whether code works by reading text | Executes code in an isolated `python -I` sandbox against hidden unit assertions |
| **Test Secrecy** | All prompts & tests are visible in the chat window | Full `test_code` and `reference_solution` stay strictly on the server |
| **Plagiarism Detection** | Cannot compare across applicants | Canonicalizes Python ASTs (`v0, v1...`) to catch renamed-variable copies (`>=92%` match) |
| **Proctoring & Deadlines** | No timer or clipboard telemetry | Server-enforced deadline + live paste character count & tab-switch logging |
| **Scoring Consistency** | Non-deterministic (6/10 on run 1, 9/10 on run 2) | Fixed 4-criterion rubric + deterministic AST analyzer + 5-case CI regression gate |
| **Compliance & Auditability** | No tenant isolation or compliance trail | SHA-256 `X-Org-Key` multi-tenancy, append-only `audit_log`, and 0.0% demographic bias gate |

---

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the Enterprise Pipeline, B2B Assessment Flow & Golden CI Eval Gate
python tests/test_enterprise_pipeline.py
python tests/test_assessments.py
python ai_engine/evals/run_evals.py

# 3. Launch the Full-Stack Server
uvicorn backend.main:app --reload --port 8000
```

Open **`http://127.0.0.1:8000`** in your browser:
- **Steps `01`–`04`**: Candidate Resume vs. JD Gap Analysis, Role-Specific Skill Matrix, Split-Screen Monaco VS Code IDE Studio, and Executive Scorecard.
- **Step `05` (`B2B Recruiter & Integrity` / `/hire`)**: Create timed assessments from a JD, generate shareable candidate links (`/a/{token}`), run the **1-Click 3-Candidate Cohort & AST Plagiarism Demo**, inspect candidate code & proctoring logs, record audited hiring decisions, and run the live **CI Golden Eval & Bias Gate**.
