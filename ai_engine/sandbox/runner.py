import json
import os
import subprocess
import tempfile
import time
from typing import List, Dict, Any

from ai_engine.sandbox.ast_analyzer import analyze_code_ast


def _safe_child_env() -> Dict[str, str]:
    """Copy host OS environment so Windows DLLs initialize normally, but strip secret keys."""
    env = dict(os.environ)
    for secret_key in ("GEMINI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"):
        env.pop(secret_key, None)
    return env


def _build_granular_test_harness(user_code: str, test_code: str) -> str:
    """
    Constructs an isolated test runner script that executes both setup lines and
    individual `assert` statements so the UI gets per-test pass/fail telemetry.
    """
    lines = [line for line in test_code.splitlines() if line.strip() and not line.strip().startswith("#")]

    harness_lines = [
        "import json, time",
        "# --- Candidate Code ---",
        user_code,
        "",
        "# --- Granular Unit Test Harness ---",
        "__results = []",
    ]

    test_idx = 0
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("assert "):
            test_idx += 1
            escaped_expr = json.dumps(stripped)
            harness_lines.extend([
                "__t0 = time.perf_counter()",
                "try:",
                f"    {stripped}",
                f"    __results.append({{'id': {test_idx}, 'assertion': {escaped_expr}, 'passed': True, 'error': '', 'duration_ms': round((time.perf_counter() - __t0) * 1000, 2)}})",
                "except Exception as __e:",
                f"    __results.append({{'id': {test_idx}, 'assertion': {escaped_expr}, 'passed': False, 'error': f'{{type(__e).__name__}}: {{str(__e) or \"Assertion failed\"}}', 'duration_ms': round((time.perf_counter() - __t0) * 1000, 2)}})",
            ])
        else:
            harness_lines.append(stripped)

    harness_lines.extend([
        "print('__SANDBOX_JSON_START__')",
        "print(json.dumps(__results))",
        "print('__SANDBOX_JSON_END__')",
        "if all(r['passed'] for r in __results):",
        "    print('ALL_TESTS_PASSED')",
        "else:",
        "    raise AssertionError(f\"{sum(1 for r in __results if not r['passed'])} of {len(__results)} unit tests failed.\")",
    ])
    return "\n".join(harness_lines)


def execute_sandbox_suite(user_code: str, test_code: str, timeout_sec: int = 3) -> Dict[str, Any]:
    """
    Executes candidate Python code inside a 3-second isolated subprocess with:
    1. Static AST complexity & security analysis
    2. Per-assertion unit test execution report
    3. Full stdout/stderr & millisecond latency telemetry
    """
    ast_report = analyze_code_ast(user_code).to_dict()

    if not user_code or not user_code.strip():
        return {
            "passed": False,
            "output": "No code submitted.",
            "runtime_ms": 0,
            "test_cases": [],
            "ast_analysis": ast_report,
        }

    if not ast_report["syntax_valid"]:
        return {
            "passed": False,
            "output": f"SyntaxError: {ast_report['syntax_error_detail']}",
            "runtime_ms": 0,
            "test_cases": [],
            "ast_analysis": ast_report,
        }

    if not ast_report["security_passed"]:
        return {
            "passed": False,
            "output": "Sandbox Security Violation: " + "; ".join(ast_report["security_warnings"]),
            "runtime_ms": 0,
            "test_cases": [],
            "ast_analysis": ast_report,
        }

    script_content = _build_granular_test_harness(user_code, test_code)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as temp_file:
        temp_file.write(script_content)
        temp_path = temp_file.name

    start_time = time.perf_counter()
    try:
        result = subprocess.run(
            ["python", temp_path],
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            env=_safe_child_env(),
        )
        runtime_ms = int((time.perf_counter() - start_time) * 1000)

        raw_stdout = result.stdout or ""
        raw_stderr = result.stderr or ""

        test_cases: List[Dict[str, Any]] = []
        clean_stdout = raw_stdout
        if "__SANDBOX_JSON_START__" in raw_stdout and "__SANDBOX_JSON_END__" in raw_stdout:
            before, rest = raw_stdout.split("__SANDBOX_JSON_START__", 1)
            json_part, after = rest.split("__SANDBOX_JSON_END__", 1)
            clean_stdout = (before + after).strip()
            try:
                test_cases = json.loads(json_part.strip())
            except Exception:
                test_cases = []

        passed = result.returncode == 0 and "ALL_TESTS_PASSED" in raw_stdout
        output = clean_stdout if passed else (raw_stderr.strip() or clean_stdout.strip())

        return {
            "passed": passed,
            "output": output,
            "runtime_ms": runtime_ms,
            "test_cases": test_cases,
            "ast_analysis": ast_report,
        }
    except subprocess.TimeoutExpired:
        return {
            "passed": False,
            "output": f"TimeoutError: Execution exceeded {timeout_sec}-second guardrail (infinite loop protection triggered).",
            "runtime_ms": timeout_sec * 1000,
            "test_cases": [],
            "ast_analysis": ast_report,
        }
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
