import subprocess
import tempfile
import time
import os

def run_code_in_sandbox(user_code: str, test_code: str) -> dict:
    """Runs candidate Python code against hidden unit tests in a 3-second sandbox."""
    if not user_code.strip():
        return {"passed": False, "output": "No code submitted.", "runtime_ms": 0}

    full_script = f"{user_code}\n\n# --- Hidden Unit Tests ---\n{test_code}\nprint('ALL_TESTS_PASSED')"

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as temp_file:
        temp_file.write(full_script)
        temp_path = temp_file.name

    start_time = time.time()
    try:
        result = subprocess.run(
            ["python", temp_path],
            capture_output=True,
            text=True,
            timeout=3  # Safety guardrail: stops infinite loops after 3 seconds
        )
        runtime_ms = int((time.time() - start_time) * 1000)
        passed = result.returncode == 0 and "ALL_TESTS_PASSED" in result.stdout
        output = result.stdout.strip() if passed else (result.stderr.strip() or result.stdout.strip())
        return {"passed": passed, "output": output, "runtime_ms": runtime_ms}

    except subprocess.TimeoutExpired:
        return {"passed": False, "output": "TimeoutError: Code took longer than 3 seconds (infinite loop check).", "runtime_ms": 3000}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)