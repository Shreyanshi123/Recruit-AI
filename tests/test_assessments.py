"""
End-to-end test of the B2B assessment flow:
recruiter signup -> create assessment from JD -> candidate takes it -> hidden-test grading
-> integrity signals (paste + copied code) -> ranked report -> audited decision -> tenant isolation.

Run:  python -m pytest tests/test_assessments.py -q     (or)     python tests/test_assessments.py
"""

import os
import sys
import tempfile

_root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_tmp_dir = os.path.join(_root_dir, ".sandbox_tmp")
os.makedirs(_tmp_dir, exist_ok=True)
_tmp_db = os.path.join(tempfile.mkdtemp(dir=_tmp_dir), "test_ledger.db")
os.environ["RECRUITAI_DB_PATH"] = _tmp_db
sys.path.insert(0, _root_dir)

from fastapi.testclient import TestClient  # noqa: E402

from backend.main import app  # noqa: E402
from backend.repositories.assessment_repository import init_assessment_schema  # noqa: E402
from backend.repositories.session_repository import init_ledger_schema  # noqa: E402
from ai_engine.integrity.similarity import code_similarity  # noqa: E402

JD = (
    "We're Hiring - AI Engineer @ Euler Motors\n"
    "- Build LLM-powered features and retrieval systems in Python/FastAPI microservices.\n"
    "- Deploy containerized workloads using Docker, Kubernetes, AWS/GCP.\n"
    "- Use Redis caching for low latency."
)


def _client() -> TestClient:
    init_ledger_schema()
    init_assessment_schema()
    return TestClient(app)


def test_similarity_detects_renamed_copy():
    a = "def f(nums, t):\n    seen = {}\n    for i, x in enumerate(nums):\n        if t - x in seen:\n            return [seen[t - x], i]\n        seen[x] = i\n    return []\n"
    b = "def f(arr, goal):\n    # my own work\n    lookup = {}\n    for idx, val in enumerate(arr):\n        if goal - val in lookup:\n            return [lookup[goal - val], idx]\n        lookup[val] = idx\n    return []\n"
    c = "def f(nums, t):\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            if nums[i] + nums[j] == t:\n                return [i, j]\n    return []\n"
    assert code_similarity(a, b) > 0.97, "renamed copy should look identical"
    assert code_similarity(a, c) < 0.9, "different algorithm should not be flagged"


def test_full_assessment_flow():
    client = _client()

    # 1. Recruiter workspace signup
    org = client.post("/api/orgs", json={"name": "Euler Motors"}).json()
    hdr = {"X-Org-Key": org["api_key"]}
    assert client.get("/api/assessments").status_code == 401

    # 2. Create assessment from JD
    res = client.post("/api/assessments", headers=hdr, json={"jd_text": JD, "max_questions": 3, "time_limit_min": 30})
    assert res.status_code == 200, res.text
    asm = res.json()
    assert asm["company_name"].lower().startswith("euler")
    assert 1 <= len(asm["questions"]) <= 3
    assert "Kubernetes" in asm["skills"]
    assert "System Design" not in [q["skill"] for q in asm["questions"]]
    token = asm["public_token"]

    # 3. Candidate view must not leak hidden tests or reference solution
    pub = client.get(f"/api/public/assessments/{token}").json()
    assert pub["question_count"] == len(asm["questions"])

    a1 = client.post(f"/api/public/assessments/{token}/attempts", json={"name": "Asha", "email": "asha@example.com"}).json()
    a2 = client.post(f"/api/public/assessments/{token}/attempts", json={"name": "Ravi", "email": "ravi@example.com"}).json()
    again = client.post(f"/api/public/assessments/{token}/attempts", json={"name": "Asha", "email": "ASHA@example.com"}).json()
    assert again["attempt_token"] == a1["attempt_token"] and again["resumed"], "re-opening resumes the same clock"

    view = client.get(f"/api/public/attempts/{a1['attempt_token']}").json()
    q0 = view["questions"][0]
    assert "reference_solution" not in q0 and "test_code" not in q0
    assert q0["sample_tests"].count("assert ") == 1

    # 4. Grade: Asha submits the real reference solution; Ravi copies it with renamed whitespace/comments
    full_q = asm["questions"][0]
    good_code = full_q["reference_solution"]
    run = client.post(f"/api/public/attempts/{a1['attempt_token']}/run", json={"question_id": q0["id"], "code": good_code}).json()
    assert run["passed"], run
    sub = client.post(f"/api/public/attempts/{a1['attempt_token']}/submit", json={"question_id": q0["id"], "code": good_code}).json()
    assert sub["tests_passed"] == sub["tests_total"] and "score" not in sub

    copied = "# totally my own solution\n" + good_code
    client.post(f"/api/public/attempts/{a2['attempt_token']}/submit", json={"question_id": q0["id"], "code": copied})
    client.post(f"/api/public/attempts/{a2['attempt_token']}/events", json={"event_type": "paste", "question_id": q0["id"], "detail": {"chars": 420}})
    client.post(f"/api/public/attempts/{a2['attempt_token']}/events", json={"event_type": "tab_hidden"})

    # Stub submission should fail hidden tests
    stub = client.post(f"/api/public/attempts/{a2['attempt_token']}/submit", json={"question_id": view["questions"][-1]["id"], "code": view["questions"][-1]["starter_code"]}).json()
    assert stub["tests_passed"] == 0

    client.post(f"/api/public/attempts/{a1['attempt_token']}/finish")
    client.post(f"/api/public/attempts/{a2['attempt_token']}/finish")
    late = client.post(f"/api/public/attempts/{a1['attempt_token']}/submit", json={"question_id": q0["id"], "code": good_code})
    assert late.status_code == 409, "submitted attempts are closed"

    # 5. Recruiter report: ranking + integrity
    report = client.get(f"/api/assessments/{asm['id']}/report", headers=hdr).json()
    assert report["summary"]["completed"] == 2
    by_name = {c["name"]: c for c in report["candidates"]}
    assert by_name["Ravi"]["integrity"]["similarity_flags"], "copied solution must be flagged"
    assert by_name["Ravi"]["integrity"]["risk"] == "high"
    assert by_name["Ravi"]["integrity"]["large_pastes"] == 1

    # 6. Decision is audited
    d = client.post(
        f"/api/assessments/{asm['id']}/attempts/{by_name['Asha']['attempt_id']}/decision",
        headers=hdr, json={"decision": "advance", "note": "Strong, clean solution."},
    )
    assert d.status_code == 200
    report = client.get(f"/api/assessments/{asm['id']}/report", headers=hdr).json()
    assert any(e["action"] == "candidate.advance" for e in report["audit_log"])

    # 7. Tenant isolation: another org cannot read this assessment
    other = client.post("/api/orgs", json={"name": "Other Co"}).json()
    assert client.get(f"/api/assessments/{asm['id']}/report", headers={"X-Org-Key": other["api_key"]}).status_code == 404


if __name__ == "__main__":
    test_similarity_detects_renamed_copy()
    test_full_assessment_flow()
    print("ASSESSMENT_FLOW_TESTS_PASSED")

