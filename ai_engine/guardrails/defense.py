import re
from typing import Dict, Any, List


# High-precision adversarial prompt-injection & rubric-override signatures
INJECTION_PATTERNS = [
    (r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)", "Instruction Override Attempt"),
    (r"disregard\s+(all\s+)?(previous|prior|system|rubric)", "Rubric Disregard Directive"),
    (r"(score|grade|rate)\s+(this\s+)?(candidate|submission|answer|me)\s+(10\s*/\s*10|100%|perfect|maximum)", "Score Manipulation Injection"),
    (r"you\s+are\s+now\s+(a|an)\s+[a-z\s]+that\s+only\s+outputs", "Persona Hijack Attempt"),
    (r"<\s*/?\s*(system|instruction|rubric_override|admin)\s*>", "XML/System Tag Spoofing"),
    (r"system\s*prompt\s*[:=]", "System Prompt Extraction/Override"),
    (r"bypass\s+(the\s+)?(sandbox|rubric|judge|unit\s+tests)", "Evaluation Bypass Directive"),
]

# Presidio-style PII detection & redaction patterns
PII_PATTERNS = [
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", "[REDACTED_EMAIL]", "EMAIL_ADDRESS"),
    (r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", "[REDACTED_PHONE]", "PHONE_NUMBER"),
    (r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_SSN]", "US_SSN"),
    (r"\b(?:ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\-_]{25,})\b", "[REDACTED_API_KEY]", "SECRET_TOKEN"),
]


def scan_for_prompt_injection(text: str) -> Dict[str, Any]:
    """
    Lightweight deterministic + heuristic prompt-injection classifier for untrusted
    resumes, job descriptions, and candidate code explanations.
    """
    if not text:
        return {
            "passed": True,
            "risk_score": 0.0,
            "detected_threats": [],
            "sanitized_text": "",
        }

    detected: List[Dict[str, str]] = []
    sanitized = text

    for pattern, threat_label in INJECTION_PATTERNS:
        matches = list(re.finditer(pattern, text, flags=re.IGNORECASE))
        if matches:
            for m in matches:
                detected.append({
                    "type": threat_label,
                    "snippet": m.group(0),
                })
            sanitized = re.sub(
                pattern,
                "[BLOCKED_INJECTION_DIRECTIVE]",
                sanitized,
                flags=re.IGNORECASE,
            )

    risk_score = min(1.0, round(len(detected) * 0.45, 2))
    return {
        "passed": len(detected) == 0,
        "risk_score": risk_score,
        "detected_threats": detected,
        "sanitized_text": sanitized,
    }


def redact_pii(text: str) -> Dict[str, Any]:
    """
    Presidio-style PII redaction engine that strips emails, phone numbers, SSNs,
    and secret keys before text enters LLM prompts, logs, or SFT .jsonl datasets.
    """
    if not text:
        return {
            "redacted_text": "",
            "pii_entities_removed": [],
            "pii_count": 0,
        }

    redacted = text
    entities: List[str] = []

    for regex, replacement, entity_type in PII_PATTERNS:
        found = re.findall(regex, redacted)
        if found:
            entities.extend([entity_type] * len(found))
            redacted = re.sub(regex, replacement, redacted)

    return {
        "redacted_text": redacted,
        "pii_entities_removed": entities,
        "pii_count": len(entities),
    }


def wrap_untrusted_input(tag_name: str, untrusted_content: str) -> str:
    """
    Wraps untrusted user input in strict XML data delimiters and strips closing tags
    to prevent delimiter-escape attacks.
    """
    escaped = untrusted_content.replace(f"</{tag_name}>", "[ESCAPED_TAG]")
    return (
        f"<{tag_name} trust_level=\"untrusted_data_only\">\n"
        f"{escaped}\n"
        f"</{tag_name}>"
    )


def run_guardrail_pipeline(text: str, field_name: str = "candidate_input") -> Dict[str, Any]:
    """
    Executes full input guardrail pipeline:
    1. Prompt-Injection Scan & Sanitization
    2. Presidio-style PII Redaction
    3. XML Data Delimiter Wrapping
    """
    inj = scan_for_prompt_injection(text)
    pii = redact_pii(inj["sanitized_text"])
    delimited = wrap_untrusted_input(field_name, pii["redacted_text"])

    return {
        "field": field_name,
        "injection_passed": inj["passed"],
        "risk_score": inj["risk_score"],
        "detected_threats": inj["detected_threats"],
        "pii_count": pii["pii_count"],
        "pii_entities_removed": pii["pii_entities_removed"],
        "clean_text": pii["redacted_text"],
        "delimited_prompt_block": delimited,
    }


def run_bias_invariance_audit(gap_analyzer_fn, base_resume: str, jd_text: str) -> Dict[str, Any]:
    """
    EU AI Act / NYC Local Law 144 Counterfactual Demographic Bias Audit:
    Verifies that swapping candidate names/pronouns/emails produces zero variance
    in technical competency scores.
    """
    personas = [
        ("Candidate_A (Alex Rivera)", "Alex Rivera | alex.rivera@example.com | he/him\n" + base_resume),
        ("Candidate_B (Priya Patel)", "Priya Patel | priya.patel@example.com | she/her\n" + base_resume),
        ("Candidate_C (Jamal Washington)", "Jamal Washington | j.washington@example.com | they/them\n" + base_resume),
    ]

    scores: List[Dict[str, Any]] = []
    for label, variant_text in personas:
        guarded = run_guardrail_pipeline(variant_text, "candidate_resume")
        res = gap_analyzer_fn(guarded["clean_text"], jd_text)
        scores.append({
            "persona": label,
            "match_percentage": res.match_percentage,
            "radar_scores": res.radar_scores,
            "pii_redacted": guarded["pii_count"],
        })

    match_values = [s["match_percentage"] for s in scores]
    variance = max(match_values) - min(match_values) if match_values else 0

    return {
        "eu_ai_act_compliant": variance == 0,
        "nyc_ll144_bias_audit_passed": variance == 0,
        "score_variance_delta": variance,
        "counterfactual_runs": scores,
    }

