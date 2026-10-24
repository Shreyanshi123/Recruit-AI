import os
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types

from pydantic import BaseModel
from backend.schemas import GapAnalysisResult, InterviewQuestion, EvaluationResult
from ai_engine.rag_rubric import retrieve_rubric

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = "gemini-2.5-flash"


class RadarScoresSchema(BaseModel):
    Python: int
    APIs: int
    Databases: int
    System_Design: int
    AI_Agents: int


class GeminiGapSchema(BaseModel):
    match_percentage: int
    matched_skills: list[str]
    missing_skills: list[str]
    radar_scores: RadarScoresSchema


def _get_client():
    if not GEMINI_API_KEY or "your_free" in GEMINI_API_KEY:
        return None
    try:
        return genai.Client(api_key=GEMINI_API_KEY)
    except Exception:
        return None


# Curated fallback questions so the platform works deterministically even offline or when rate-limited
FALLBACK_QUESTIONS = {
    "APIs": {
        "Easy": {
            "topic": "APIs & FastAPI Rate Limiting",
            "difficulty": "Easy",
            "question_text": (
                "Implement `check_rate_limit(requests_map: dict, user_id: str, limit: int) -> dict`.\n"
                "Given a dictionary mapping `user_id` to their current request count, check if the user "
                "can make another request. Return `{'allowed': False, 'status': 400}` if `user_id` is empty "
                "or `limit <= 0`. If the user's current count is `< limit`, increment their count in `requests_map` "
                "using O(1) dictionary lookup and return `{'allowed': True, 'status': 200, 'remaining': limit - new_count}`. "
                "Otherwise return `{'allowed': False, 'status': 429, 'remaining': 0}`."
            ),
            "starter_code": (
                "def check_rate_limit(requests_map: dict, user_id: str, limit: int) -> dict:\n"
                "    # Handle edge cases (empty user_id or invalid limit)\n"
                "    if not user_id or limit <= 0:\n"
                "        return {'allowed': False, 'status': 400}\n"
                "    \n"
                "    # Use O(1) dictionary lookup to check and update rate limit\n"
                "    current = requests_map.get(user_id, 0)\n"
                "    if current < limit:\n"
                "        requests_map[user_id] = current + 1\n"
                "        return {'allowed': True, 'status': 200, 'remaining': limit - (current + 1)}\n"
                "    return {'allowed': False, 'status': 429, 'remaining': 0}\n"
            ),
            "test_code": (
                "state = {'alice': 2}\n"
                "assert check_rate_limit(state, 'alice', 3) == {'allowed': True, 'status': 200, 'remaining': 0}\n"
                "assert check_rate_limit(state, 'alice', 3) == {'allowed': False, 'status': 429, 'remaining': 0}\n"
                "assert check_rate_limit(state, '', 3) == {'allowed': False, 'status': 400}"
            ),
        },
        "Medium": {
            "topic": "APIs & FastAPI Rate Limiting",
            "difficulty": "Medium",
            "question_text": (
                "Design a sliding-window API rate limiter `allow_request(user_timestamps: dict, user_id: str, now_sec: int, window_sec: int, max_requests: int) -> dict`.\n"
                "1. If `user_id` is empty or `max_requests <= 0`, return `{'status': 400, 'allowed': False}`.\n"
                "2. Filter out timestamps for `user_id` that are less than or equal to `now_sec - window_sec`.\n"
                "3. If the remaining timestamps count is `< max_requests`, append `now_sec`, update `user_timestamps[user_id]`, and return `{'status': 200, 'allowed': True}`.\n"
                "4. Otherwise return `{'status': 429, 'allowed': False}`."
            ),
            "starter_code": (
                "def allow_request(user_timestamps: dict, user_id: str, now_sec: int, window_sec: int, max_requests: int) -> dict:\n"
                "    if not user_id or max_requests <= 0:\n"
                "        return {'status': 400, 'allowed': False}\n"
                "    history = [t for t in user_timestamps.get(user_id, []) if t > now_sec - window_sec]\n"
                "    if len(history) < max_requests:\n"
                "        history.append(now_sec)\n"
                "        user_timestamps[user_id] = history\n"
                "        return {'status': 200, 'allowed': True}\n"
                "    user_timestamps[user_id] = history\n"
                "    return {'status': 429, 'allowed': False}\n"
            ),
            "test_code": (
                "store = {'u1': [1, 2]}\n"
                "assert allow_request(store, 'u1', 5, 10, 2) == {'status': 429, 'allowed': False}\n"
                "assert allow_request(store, 'u1', 12, 10, 2) == {'status': 200, 'allowed': True}\n"
                "assert allow_request(store, '', 12, 10, 2) == {'status': 400, 'allowed': False}"
            ),
        },
        "Hard": {
            "topic": "APIs & Distributed Idempotency Gateway",
            "difficulty": "Hard",
            "question_text": (
                "System Design Coding: Implement an idempotent API gateway handler `process_payment(idempotency_store: dict, idempotency_key: str, payload: dict) -> dict`.\n"
                "1. If `idempotency_key` is empty or `payload` is missing `'amount'` or `payload['amount'] <= 0`, return `{'status': 400, 'error': 'Invalid request'}`.\n"
                "2. Check `idempotency_store` in O(1) time: if `idempotency_key` already exists, return the cached response with `'replayed': True`.\n"
                "3. Otherwise create `{'status': 201, 'tx_id': f'tx_{idempotency_key}', 'amount': payload['amount'], 'replayed': False}`, store a cached copy in `idempotency_store[idempotency_key]`, and return it."
            ),
            "starter_code": (
                "def process_payment(idempotency_store: dict, idempotency_key: str, payload: dict) -> dict:\n"
                "    if not idempotency_key or not isinstance(payload, dict) or payload.get('amount', 0) <= 0:\n"
                "        return {'status': 400, 'error': 'Invalid request'}\n"
                "    if idempotency_key in idempotency_store:\n"
                "        cached = dict(idempotency_store[idempotency_key])\n"
                "        cached['replayed'] = True\n"
                "        return cached\n"
                "    res = {'status': 201, 'tx_id': f'tx_{idempotency_key}', 'amount': payload['amount'], 'replayed': False}\n"
                "    idempotency_store[idempotency_key] = dict(res)\n"
                "    return res\n"
            ),
            "test_code": (
                "cache = {}\n"
                "assert process_payment(cache, 'k1', {'amount': 50}) == {'status': 201, 'tx_id': 'tx_k1', 'amount': 50, 'replayed': False}\n"
                "assert process_payment(cache, 'k1', {'amount': 50}) == {'status': 201, 'tx_id': 'tx_k1', 'amount': 50, 'replayed': True}\n"
                "assert process_payment(cache, '', {'amount': -5})['status'] == 400"
            ),
        },
    },
    "System_Design": {
        "Medium": {
            "topic": "Caching Redis System Design Scalability",
            "difficulty": "Medium",
            "question_text": (
                "Implement the Cache-Aside pattern in `get_user_profile(cache: dict, db: dict, user_id: str) -> dict`.\n"
                "1. If `user_id` is empty, return `{'source': 'error', 'data': None}`.\n"
                "2. Check `cache` first using O(1) lookup. If present, return `{'source': 'cache', 'data': cache[user_id]}`.\n"
                "3. On a cache miss, check `db` in O(1) time. If found, populate `cache[user_id] = db[user_id]` and return `{'source': 'db', 'data': db[user_id]}`.\n"
                "4. If missing from both, return `{'source': 'miss', 'data': None}`."
            ),
            "starter_code": (
                "def get_user_profile(cache: dict, db: dict, user_id: str) -> dict:\n"
                "    if not user_id:\n"
                "        return {'source': 'error', 'data': None}\n"
                "    if user_id in cache:\n"
                "        return {'source': 'cache', 'data': cache[user_id]}\n"
                "    if user_id in db:\n"
                "        cache[user_id] = db[user_id]\n"
                "        return {'source': 'db', 'data': db[user_id]}\n"
                "    return {'source': 'miss', 'data': None}\n"
            ),
            "test_code": (
                "c, d = {}, {'u1': {'name': 'Ada'}}\n"
                "assert get_user_profile(c, d, 'u1') == {'source': 'db', 'data': {'name': 'Ada'}}\n"
                "assert get_user_profile(c, d, 'u1') == {'source': 'cache', 'data': {'name': 'Ada'}}\n"
                "assert get_user_profile(c, d, 'unknown') == {'source': 'miss', 'data': None}"
            ),
        },
        "Hard": {
            "topic": "Caching Redis System Design Scalability",
            "difficulty": "Hard",
            "question_text": (
                "System Design Escalation: Implement a TTL-aware Cache-Aside Resolver `resolve_with_ttl(cache: dict, db: dict, key: str, now_ts: int, ttl: int) -> dict`.\n"
                "`cache` stores entries as `key: {'val': value, 'expires_at': int}`.\n"
                "1. Handle empty `key` by returning `{'hit': False, 'val': None}`.\n"
                "2. If `key` is in `cache` and `cache[key]['expires_at'] > now_ts`, return `{'hit': True, 'val': cache[key]['val']}`.\n"
                "3. Otherwise (cache miss or expired), look up `key` in `db` in O(1) time. If found, write `{'val': db[key], 'expires_at': now_ts + ttl}` to `cache[key]` and return `{'hit': False, 'val': db[key]}`.\n"
                "4. If `key` is not in `db`, remove expired `key` from `cache` if present and return `{'hit': False, 'val': None}`."
            ),
            "starter_code": (
                "def resolve_with_ttl(cache: dict, db: dict, key: str, now_ts: int, ttl: int) -> dict:\n"
                "    if not key:\n"
                "        return {'hit': False, 'val': None}\n"
                "    entry = cache.get(key)\n"
                "    if entry and entry.get('expires_at', 0) > now_ts:\n"
                "        return {'hit': True, 'val': entry['val']}\n"
                "    if key in db:\n"
                "        cache[key] = {'val': db[key], 'expires_at': now_ts + ttl}\n"
                "        return {'hit': False, 'val': db[key]}\n"
                "    cache.pop(key, None)\n"
                "    return {'hit': False, 'val': None}\n"
            ),
            "test_code": (
                "c, d = {}, {'k1': 'v1'}\n"
                "assert resolve_with_ttl(c, d, 'k1', 100, 30) == {'hit': False, 'val': 'v1'}\n"
                "assert resolve_with_ttl(c, d, 'k1', 115, 30) == {'hit': True, 'val': 'v1'}\n"
                "assert resolve_with_ttl(c, d, 'k1', 135, 30) == {'hit': False, 'val': 'v1'}"
            ),
        },
    },
    "AI_Agents": {
        "Medium": {
            "topic": "AI Agents LangGraph RAG LLM Prompting",
            "difficulty": "Medium",
            "question_text": (
                "Implement a deterministic LangGraph router `route_agent_step(state: dict) -> str`.\n"
                "The `state` dictionary contains `'context'` (list of strings), `'confidence'` (int 0-100), and `'retries'` (int).\n"
                "1. If `not state` or `'context'` not in state or len(state['context']) == 0, return `'fallback_search'`.\n"
                "2. If `state.get('confidence', 0) >= 80`, return `'finalize_answer'`.\n"
                "3. If `state.get('retries', 0) < 3`, increment `state['retries']` by 1 and return `'retry_generation'`.\n"
                "4. Otherwise return `'human_escalation'`."
            ),
            "starter_code": (
                "def route_agent_step(state: dict) -> str:\n"
                "    if not state or not state.get('context'):\n"
                "        return 'fallback_search'\n"
                "    if state.get('confidence', 0) >= 80:\n"
                "        return 'finalize_answer'\n"
                "    if state.get('retries', 0) < 3:\n"
                "        state['retries'] = state.get('retries', 0) + 1\n"
                "        return 'retry_generation'\n"
                "    return 'human_escalation'\n"
            ),
            "test_code": (
                "assert route_agent_step({'context': [], 'confidence': 90, 'retries': 0}) == 'fallback_search'\n"
                "assert route_agent_step({'context': ['doc1'], 'confidence': 85, 'retries': 0}) == 'finalize_answer'\n"
                "assert route_agent_step({'context': ['doc1'], 'confidence': 50, 'retries': 1}) == 'retry_generation'"
            ),
        },
    },
    "Python": {
        "Medium": {
            "topic": "Python Data Structures Algorithms Lists Dictionaries",
            "difficulty": "Medium",
            "question_text": (
                "Implement `find_duplicate_transactions(tx_ids: list) -> list` in O(N) time complexity using a hash set/map.\n"
                "Given a list of transaction IDs, return a list of IDs that appear more than once, preserving the order in which their second occurrence was detected. "
                "Handle empty inputs safely by returning `[]`. Do not use nested O(N^2) loops."
            ),
            "starter_code": (
                "def find_duplicate_transactions(tx_ids: list) -> list:\n"
                "    if not tx_ids:\n"
                "        return []\n"
                "    seen = set()\n"
                "    added = set()\n"
                "    duplicates = []\n"
                "    for tx in tx_ids:\n"
                "        if tx in seen and tx not in added:\n"
                "            duplicates.append(tx)\n"
                "            added.add(tx)\n"
                "        seen.add(tx)\n"
                "    return duplicates\n"
            ),
            "test_code": (
                "assert find_duplicate_transactions(['t1', 't2', 't1', 't3', 't2', 't1']) == ['t1', 't2']\n"
                "assert find_duplicate_transactions([]) == []\n"
                "assert find_duplicate_transactions(['a', 'b', 'c']) == []"
            ),
        },
    },
}


def analyze_skill_gap(resume_text: str, jd_text: str) -> GapAnalysisResult:
    """Compares candidate resume against Job Description using Gemini structured output + ChromaDB rubrics."""
    rubric_context = "\n".join([
        retrieve_rubric("APIs FastAPI"),
        retrieve_rubric("Caching Redis System Design"),
        retrieve_rubric("AI Agents LangGraph RAG"),
        retrieve_rubric("Python Data Structures"),
    ])

    client = _get_client()
    if client:
        try:
            prompt = f"""You are the Skill Gap Detective on a 5-member technical hiring committee.
Compare the candidate's Resume against the target Job Description and our internal Engineering Rubrics.

INTERNAL RUBRICS:
{rubric_context}

CANDIDATE RESUME:
{resume_text}

TARGET JOB DESCRIPTION:
{jd_text}

Return a strict JSON object matching GapAnalysisResult.
Ensure radar_scores contains integer values (0-100) for these exact 5 keys:
"Python", "APIs", "Databases", "System_Design", "AI_Agents".
"""
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GeminiGapSchema,
                    temperature=0.2,
                ),
            )
            data = json.loads(response.text)
            return GapAnalysisResult(**data)
        except Exception as e:
            print(f"[HireRoom AI] Gemini gap analysis fallback triggered: {e}")

    # Deterministic semantic keyword analysis fallback
    resume_lower = resume_text.lower()
    jd_lower = jd_text.lower()

    skill_catalog = [
        ("Python", ["python", "asyncio", "pydantic", "pytest"]),
        ("FastAPI", ["fastapi", "rest", "api", "uvicorn"]),
        ("SQLite / PostgreSQL", ["sql", "sqlite", "postgres", "database"]),
        ("Redis & Caching", ["redis", "cache", "caching", "ttl"]),
        ("System Design & Rate Limiting", ["system design", "scalability", "rate limit", "distributed", "microservices"]),
        ("LangGraph & Multi-Agent Systems", ["langgraph", "multi-agent", "agent", "state machine"]),
        ("RAG & Vector Databases (ChromaDB)", ["chromadb", "rag", "vector", "embedding"]),
        ("Docker & Sandboxing", ["docker", "sandbox", "subprocess", "kubernetes", "ci/cd"]),
    ]

    matched = []
    missing = []

    for label, keywords in skill_catalog:
        in_jd = any(k in jd_lower for k in keywords)
        in_resume = any(k in resume_lower for k in keywords)
        if in_resume:
            matched.append(label)
        elif in_jd:
            missing.append(label)

    if not matched:
        matched = ["Python", "FastAPI"]
    if not missing:
        missing = ["Redis & Caching", "LangGraph & Multi-Agent Systems", "System Design & Rate Limiting"]

    def score_category(keywords, base=50):
        hits = sum(1 for k in keywords if k in resume_lower)
        return min(95, base + hits * 15)

    radar = {
        "Python": score_category(["python", "pydantic", "asyncio", "typing"], 65),
        "APIs": score_category(["fastapi", "rest", "api", "endpoint", "rate limit"], 55),
        "Databases": score_category(["sql", "postgres", "sqlite", "redis", "chromadb"], 50),
        "System_Design": score_category(["system design", "cache", "scalability", "distributed", "microservice"], 40),
        "AI_Agents": score_category(["langgraph", "rag", "agent", "llm", "vector", "gemini"], 45),
    }

    match_pct = int(sum(radar.values()) / len(radar))
    return GapAnalysisResult(
        match_percentage=match_pct,
        matched_skills=matched,
        missing_skills=missing,
        radar_scores=radar,
    )


def generate_interview_question(topic: str, difficulty: str = "Medium") -> InterviewQuestion:
    """Generates an adaptive coding challenge anchored to the company's ChromaDB rubric."""
    rubric = retrieve_rubric(topic)
    client = _get_client()

    if client:
        try:
            prompt = f"""You are the Lead Technical Interviewer on an autonomous AI hiring committee.
Generate a realistic, self-contained Python coding challenge for the candidate.

Target Topic: {topic}
Difficulty Level: {difficulty}
Company Rubric to Test Against:
{rubric}

Requirements for the output JSON:
1. `question_text`: Clear problem specification including function name, parameters, return format, and edge cases to handle (e.g., empty inputs, O(1) dictionary lookup, or cache misses).
2. `starter_code`: A clean Python function signature with a helpful docstring and `# TODO` placeholder.
3. `test_code`: Exactly 3 standalone Python `assert` statements that deterministically verify correctness and edge-case handling. Do NOT import external third-party libraries in `test_code`.
"""
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=InterviewQuestion,
                    temperature=0.4,
                ),
            )
            data = json.loads(response.text)
            return InterviewQuestion(**data)
        except Exception as e:
            print(f"[HireRoom AI] Gemini question generation fallback triggered: {e}")

    # Select curated deterministic fallback question
    topic_lower = topic.lower()
    if "cache" in topic_lower or "redis" in topic_lower or "system" in topic_lower or "scal" in topic_lower:
        cat = FALLBACK_QUESTIONS["System_Design"]
    elif "agent" in topic_lower or "langgraph" in topic_lower or "rag" in topic_lower or "llm" in topic_lower:
        cat = FALLBACK_QUESTIONS["AI_Agents"]
    elif "api" in topic_lower or "fastapi" in topic_lower or "rate" in topic_lower:
        cat = FALLBACK_QUESTIONS["APIs"]
    else:
        cat = FALLBACK_QUESTIONS["Python"]

    q_data = cat.get(difficulty) or cat.get("Medium") or list(cat.values())[0]
    return InterviewQuestion(**q_data)


def evaluate_submission(
    question: dict,
    user_code: str,
    user_explanation: str,
    sandbox_result: dict,
) -> EvaluationResult:
    """LLM-as-a-Judge Evaluation Harness: grades candidate code + sandbox telemetry against ChromaDB rubric."""
    topic = question.get("topic", "Python Core")
    rubric = retrieve_rubric(topic)
    client = _get_client()

    if client:
        try:
            prompt = f"""You are the Silent Judge on an autonomous technical hiring committee.
Grade the candidate's code submission strictly according to the retrieved company rubric and sandbox execution metrics.

COMPANY GRADING RUBRIC (Retrieved from ChromaDB):
{rubric}

INTERVIEW QUESTION ({question.get('difficulty', 'Medium')}):
{question.get('question_text', '')}

HIDDEN UNIT TESTS:
{question.get('test_code', '')}

CANDIDATE CODE:
```python
{user_code}
```

CANDIDATE EXPLANATION:
{user_explanation or 'No explanation provided.'}

DETERMINISTIC SANDBOX TELEMETRY:
- Unit Tests Passed: {sandbox_result.get('passed')}
- Execution Runtime: {sandbox_result.get('runtime_ms')} ms
- Sandbox Output / Trace: {sandbox_result.get('output')}

Grading Rules:
1. If unit tests failed (`passed == False`), `technical_score` MUST be between 1 and 5 depending on how close the logic is.
2. If unit tests passed (`passed == True`), start at 10 and deduct points strictly per the COMPANY GRADING RUBRIC (e.g. missing edge-case guardrails, using O(N) / O(N^2) loops instead of O(1) dictionary/set lookups, or ignoring cache misses).
3. If `technical_score < 6`, provide a concrete, actionable `hint` without giving away the entire answer. Otherwise set `hint` to an empty string `""`.
4. Always synthesize a complete 10/10 `golden_answer` containing production-grade Python code and a concise architectural explanation for our LoRA/SFT Fine-Tuning Dataset.
"""
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=EvaluationResult,
                    temperature=0.1,
                ),
            )
            data = json.loads(response.text)
            return EvaluationResult(**data)
        except Exception as e:
            print(f"[HireRoom AI] Gemini judge evaluation fallback triggered: {e}")

    # Deterministic Rubric-Based Judge Fallback
    passed = sandbox_result.get("passed", False)
    output = sandbox_result.get("output", "")
    code_stripped = user_code.strip()

    has_nested_loop = "for " in code_stripped and code_stripped.count("for ") >= 2
    has_edge_check = "if not " in code_stripped or "<= 0" in code_stripped or "is None" in code_stripped
    has_dict_lookup = ".get(" in code_stripped or " in " in code_stripped

    if not passed:
        score = 3 if len(code_stripped) > 40 else 1
        feedback = (
            f"Sandbox unit tests failed ({output.splitlines()[-1] if output else 'AssertionError'}). "
            f"Per {rubric.split(':')[0]}, passing all assert tests and handling boundary conditions is mandatory."
        )
        hint = (
            "Verify your edge-case guardrails first (e.g., empty strings, None, or non-positive limits) "
            "and ensure the return dictionary keys match the assert statements."
        )
    else:
        score = 10
        deductions = []
        if has_nested_loop:
            score -= 4
            deductions.append("nested loops detected instead of O(1) hash map/set lookup (-4 pts)")
        if not has_edge_check:
            score -= 2
            deductions.append("missing explicit empty-input guardrail check (-2 pts)")
        if not has_dict_lookup:
            score -= 1
            deductions.append("could use direct O(1) dict/set membership lookup (-1 pt)")
        if len(user_explanation.strip()) < 15:
            score -= 1
            deductions.append("brief architectural explanation; add time/space complexity notes (-1 pt)")

        score = max(6, score)
        if deductions:
            feedback = f"All unit tests passed in {sandbox_result.get('runtime_ms', 0)}ms! Rubric deductions: " + "; ".join(deductions) + "."
        else:
            feedback = (
                f"Outstanding 10/10 submission! Passed all sandbox assertions in {sandbox_result.get('runtime_ms', 0)}ms "
                "with O(1) dictionary lookups and clean edge-case guardrails matching the company rubric."
            )
        hint = "" if score >= 6 else "Consider replacing linear scans with O(1) dictionary lookups."

    golden_answer = (
        f"# 10/10 Reference Implementation ({topic})\n"
        f"{question.get('starter_code', '').strip()}\n\n"
        f"# Architectural Rationale:\n"
        f"# 1. Enforces strict O(1) hash-map lookups and upfront boundary validation.\n"
        f"# 2. Complies with {rubric}"
    )

    return EvaluationResult(
        technical_score=score,
        rubric_faithfulness=96,
        feedback=feedback,
        hint=hint,
        golden_answer=golden_answer,
    )
