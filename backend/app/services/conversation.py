
import re
from typing import Any

from app.models.report import FraudReport
from app.services.llm import (
    contains_sensitive_disclosure,
    generate_turn,
    redact_sensitive_secrets,
)

QUESTIONS = [
    {"field": "fraud_type", "question": "Could you tell me what happened? Take your time."},
    {"field": "bank_or_payment_app", "question": "Which bank or payment app was involved?"},
    {"field": "amount_inr", "question": "Approximately how much money was lost?"},
    {
        "field": "transaction_reference",
        "question": "Do you have the transaction reference? Please don't share an OTP or PIN.",
    },
    {"field": "incident_date", "question": "On what date did this happen?"},
    {"field": "incident_time", "question": "Around what time did it happen?"},
    {
        "field": "registered_phone_last4",
        "question": "What are the last four digits of the registered phone number?",
    },
    {
        "field": "otp_or_pin_shared",
        "question": "Did you share an OTP or PIN with the caller? Please don't tell me the code itself.",
    },
    {
        "field": "contacted_bank",
        "question": "Have you contacted your bank or payment app about this?",
    },
]

FIELD_LABELS = {
    item["field"]: item["field"].replace("_", " ").title()
    for item in QUESTIONS
}
REPORT_FIELDS = {item["field"] for item in QUESTIONS}


def is_missing_value(field: str, value: object) -> bool:
    if value is None:
        return True

    if isinstance(value, str) and not value.strip():
        return True

    if field in {"otp_or_pin_shared", "contacted_bank"}:
        return value not in {"yes", "no", "unknown"}

    return False


def get_missing_fields(report: FraudReport) -> list[str]:
    data = report.model_dump()
    return [
        item["field"]
        for item in QUESTIONS
        if is_missing_value(item["field"], data.get(item["field"]))
    ]


def get_next_question(report: FraudReport) -> dict | None:
    missing = set(get_missing_fields(report))
    return next(
        (item for item in QUESTIONS if item["field"] in missing),
        None,
    )


def _is_valid_value(field: str, value: Any) -> bool:
    if value is None:
        return False

    if field == "amount_inr":
        return (
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and value >= 0
        )

    if field == "registered_phone_last4":
        return (
            isinstance(value, str)
            and re.fullmatch(r"\d{4}", value) is not None
        )

    if field in {"otp_or_pin_shared", "contacted_bank"}:
        return value in {"yes", "no", "unknown"}

    if field in REPORT_FIELDS:
        return isinstance(value, str) and bool(value.strip())

    return False


def update_report_from_extraction(
    report: FraudReport,
    extracted: dict[str, Any],
) -> tuple[FraudReport, list[str]]:
    data = report.model_dump()
    needs_review: list[str] = []

    for field in REPORT_FIELDS:
        value = extracted.get(field)

        # Never overwrite a value already collected with a missing value.
        if value is None:
            continue

        if not _is_valid_value(field, value):
            needs_review.append(field)
            continue

        data[field] = value

    if extracted:
        data["confirmed_by_user"] = False
        data["consent_to_save"] = False

    return FraudReport.model_validate(data), needs_review


async def process_conversation_answer(
    report: FraudReport,
    transcript: str,
    current_field: str | None = None,
    language: str = "en",
    knowledge: str = "",
    conversation_history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    safe_transcript = redact_sensitive_secrets(transcript.strip())

    if not safe_transcript:
        raise ValueError("Transcript cannot be empty.")

    sensitive_disclosure = contains_sensitive_disclosure(transcript)

    result = await generate_turn(
        transcript=safe_transcript,
        language=language,
        current_field=current_field,
        report=report.model_dump(),
        knowledge=knowledge,
        conversation_history=conversation_history,
    )

    updated_report, invalid_fields = update_report_from_extraction(
        report,
        result["extracted"],
    )

    missing_fields = get_missing_fields(updated_report)
    next_item = get_next_question(updated_report)

    needs_review = (
        result["needs_review"]
        or sensitive_disclosure
        or bool(invalid_fields)
    )

    # The model's response is now the default. Do not replace it with
    # a fixed questionnaire prompt after every user answer.
    spoken_response = redact_sensitive_secrets(
        result["response"].strip()
    )

    if sensitive_disclosure:
        spoken_response = (
            "Please don't share secret codes or PINs with me. "
            "I won't include the secret in your report. "
            "Have you already contacted your bank through an official channel?"
        )
        action = "clarify"

    elif invalid_fields:
        spoken_response = (
            "I may not have captured one of those details correctly. "
            "Let's check it before we continue."
        )
        action = "clarify"

    elif missing_fields:
        # Keep the model's empathetic acknowledgement and contextual
        # follow-up question instead of repeating a hardcoded question.
        action = "ask"

    else:
        # The model can still give a natural final transition. The UI
        # should show the collected report for user review and confirmation.
        action = "confirm"

    return {
        "report": updated_report,
        "response": spoken_response,
        "action": action,
        "current_field": next_item["field"] if next_item else None,
        "needs_review": needs_review,
        "review_fields": sorted(set(invalid_fields)),
        "summary": build_report_summary(updated_report),
        "transcript": safe_transcript,
        "model": result.get("model"),
    }


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
