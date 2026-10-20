from typing import Any

from app.models.report import FraudReport
from app.services import parsers as P
from app.services.llm import (
    contains_sensitive_disclosure,
    generate_turn,
    redact_sensitive_secrets,
)
from app.services.questions import (
    ALERT,
    HANDOFF,
    QUESTION_TEXT,
    REDIRECT,
    SECRET_NOTICE,
    SORRY,
    TEMPLATE_LANGS,
    WRAPUP,
    pick,
)

FIELD_ORDER = [
    "fraud_type",
    "bank_or_payment_app",
    "amount_inr",
    "transaction_reference",
    "incident_date",
    "incident_time",
    "registered_phone_last4",
    "otp_or_pin_shared",
    "contacted_bank",
    "caller_name",
]
OPTIONAL = {"caller_name"}
YES_NO = P.YES_NO_FIELDS
MAX_ASKS = 2

# Names other modules import.
QUESTIONS = [
    {"field": f, "question": QUESTION_TEXT[f]["en"][0]} for f in FIELD_ORDER
]
FIELD_LABELS = {f: f.replace("_", " ").title() for f in FIELD_ORDER}
REPORT_FIELDS = set(FIELD_ORDER)


def is_missing_value(field: str, value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if field in YES_NO:
        return value not in {"yes", "no", "unknown"}
    return False


def get_missing_fields(report: FraudReport) -> list[str]:
    """Required fields still empty. Used by the review and confirm steps."""
    data = report.model_dump()
    skipped = set(report.skipped_fields)

    return [
        f for f in FIELD_ORDER
        if f not in OPTIONAL
        and f not in skipped
        and is_missing_value(f, data.get(f))
    ]


def _fast_path(
    asked: str | None, text: str, lang: str
) -> tuple[dict[str, Any], list[str]] | None:
    """Understand short answers in code. None means ask the model."""
    if not asked or lang not in TEMPLATE_LANGS:
        return None

    limit = 30 if asked in {"transaction_reference", "registered_phone_last4"} else 7
    if len(P.tokens(text)) > limit:
        return None

    if asked in YES_NO:
        value = P.parse_yes_no(text)
        return ({asked: value}, []) if value else None

    if asked != "fraud_type" and P.is_dont_know(text):
        return ({}, [asked])

    parser = {
        "amount_inr": P.parse_amount,
        "registered_phone_last4": P.parse_last4,
        "transaction_reference": P.parse_reference,
    }.get(asked)

    if parser:
        value = parser(text)
        if value is not None:
            return ({asked: value}, [])

    return None


async def process_conversation_answer(
    report: FraudReport,
    transcript: str,
    current_field: str | None = None,
    language: str = "en",
    knowledge: str = "",
    conversation_history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    lang = "en" if language == "auto" else language
    safe = redact_sensitive_secrets(transcript.strip())

    if not safe:
        raise ValueError("Transcript cannot be empty.")

    sensitive = contains_sensitive_disclosure(transcript)

    data = report.model_dump()
    attempts = {k: int(v) for k, v in (data.get("field_attempts") or {}).items()}
    skipped = set(data.get("skipped_fields") or [])
    asked = current_field if current_field in REPORT_FIELDS else None

    if asked == "fraud_type":
        attempts.setdefault("fraud_type", 1)  # the opening line asked it

    extracted: dict[str, Any] = {}
    skip_now: list[str] = []
    reaction = question_llm = ""
    off_topic = False
    alert = None
    needs_review = sensitive
    model = None
    path = "secret" if sensitive else "fast"

    fast = None if sensitive else _fast_path(asked, safe, lang)

    if fast:
        extracted, skip_now = fast
    elif not sensitive:
        path = "llm"
        remaining = [
            f for f in FIELD_ORDER
            if f not in skipped and is_missing_value(f, data.get(f))
        ]
        result = await generate_turn(
            transcript=safe,
            language=lang,
            asked_field=asked,
            report=data,
            history=conversation_history,
            remaining=remaining,
            compose_question=lang not in TEMPLATE_LANGS,
        )
        extracted = result["extracted"]
        skip_now = result["skipped"]
        reaction = result["reaction"]
        question_llm = result["question"]
        off_topic = result["off_topic"]
        alert = result["alert"]
        needs_review = needs_review or result["needs_review"]
        model = result["model"]

    def build(spoken: str, action: str, next_field: str | None, invalid: list[str]):
        data["skipped_fields"] = sorted(skipped)
        data["field_attempts"] = attempts
        updated = FraudReport.model_validate(data)

        return {
            "report": updated,
            "response": redact_sensitive_secrets(spoken.strip()),
            "action": action,
            "current_field": next_field,
            "needs_review": needs_review or bool(invalid),
            "review_fields": sorted(set(invalid)),
            "summary": build_report_summary(updated),
            "transcript": safe,
            "model": model,
            "language": lang,
            "path": path,
        }

    if alert:
        attempts["_offtopic"] = 0
        return build(pick(ALERT[alert], lang), "handoff", asked, [])

    strikes = attempts.get("_offtopic", 0) + 1 if off_topic else 0
    attempts["_offtopic"] = strikes

    if off_topic:
        extracted, skip_now = {}, []

    # Merge what was understood, each value in its fixed format.
    invalid: list[str] = []
    changed = False

    for field in FIELD_ORDER:
        value = extracted.get(field)

        if value is None:
            continue
        if field not in YES_NO and P.is_placeholder(value):
            continue

        normalized = P.normalize_field(field, value)

        if normalized is None:
            invalid.append(field)
            continue

        changed = changed or data.get(field) != normalized
        data[field] = normalized

    for field in skip_now:
        if field in REPORT_FIELDS and is_missing_value(field, data.get(field)):
            skipped.add(field)

    # Give up on a field after two asks.
    if (
        asked
        and not off_topic
        and not sensitive
        and is_missing_value(asked, data.get(asked))
        and attempts.get(asked, 0) >= MAX_ASKS
    ):
        skipped.add(asked)

    skipped = {f for f in skipped if is_missing_value(f, data.get(f))}

    if changed or skip_now:
        data["confirmed_by_user"] = False
        data["consent_to_save"] = False

    if off_topic and strikes >= 3:
        return build(pick(HANDOFF, lang), "handoff", asked, [])

    to_ask = [
        f for f in FIELD_ORDER
        if f not in skipped and is_missing_value(f, data.get(f))
    ]

    if not to_ask:
        return build(pick(WRAPUP, lang), "confirm", None, invalid)

    nxt = to_ask[0]
    counted = not (off_topic or sensitive)
    used = attempts.get(nxt, 0)
    variant = 1 if (used >= 1 and counted) or used >= MAX_ASKS else 0

    if counted:
        attempts[nxt] = used + 1

    if lang in TEMPLATE_LANGS:
        question = QUESTION_TEXT[nxt][lang][variant]
    else:
        question = question_llm or QUESTION_TEXT[nxt]["en"][variant]

    lead = ""
    if sensitive:
        lead = pick(SECRET_NOTICE, lang)
    elif off_topic:
        lead = pick(REDIRECT, lang)
    elif asked in invalid:
        lead = pick(SORRY, lang)
    elif reaction:
        lead = reaction

    return build(f"{lead} {question}".strip(), "ask", nxt, invalid)


def build_report_summary(report: FraudReport) -> dict:
    missing = get_missing_fields(report)

    return {
        "report": report.model_dump(),
        "missing_fields": missing,
        "missing_labels": [FIELD_LABELS[field] for field in missing],
        "ready_for_confirmation": len(missing) == 0,
        "confirmed_by_user": report.confirmed_by_user,
        "consent_to_save": report.consent_to_save,
    }