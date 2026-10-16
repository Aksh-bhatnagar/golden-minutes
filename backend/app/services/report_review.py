
from typing import Any, Literal

from pydantic import BaseModel, ValidationError

from app.models.report import FraudReport
from app.services.conversation import (
    FIELD_LABELS,
    QUESTIONS,
    get_missing_fields,
)
from app.services.llm import redact_sensitive_secrets


ReviewMode = Literal["all", "field"]


class ReviewRequest(BaseModel):
    mode: ReviewMode
    field: str | None = None


class FieldCorrection(BaseModel):
    field: str
    value: Any


def format_field_value(field: str, value: Any) -> str:
    """Format a report value for a spoken read-back."""
    if value is None or value == "":
        return "not provided"

    if field == "amount_inr":
        return f"{value} rupees"

    if field == "otp_or_pin_shared":
        return {
            "yes": "Yes, an OTP or PIN was shared",
            "no": "No OTP or PIN was shared",
            "unknown": "Not sure whether an OTP or PIN was shared",
        }.get(value, "not provided")

    if field == "contacted_bank":
        return {
            "yes": "The bank or payment app was contacted",
            "no": "The bank or payment app was not contacted",
            "unknown": "Not sure whether the bank was contacted",
        }.get(value, "not provided")

    # Never read out a full account/card number or a secret.
    return redact_sensitive_secrets(str(value))


def build_readback(
    report: FraudReport,
    mode: ReviewMode,
    field: str | None = None,
) -> dict[str, Any]:
    """Create a read-back for one field or all report fields."""
    data = report.model_dump()

    if mode == "field":
        if field not in FIELD_LABELS:
            raise ValueError("Choose a valid report field.")

        fields = [field]
    else:
        fields = [item["field"] for item in QUESTIONS]

    details = [
        {
            "field": item,
            "label": FIELD_LABELS[item],
            "value": format_field_value(item, data.get(item)),
        }
        for item in fields
    ]

    if mode == "field":
        spoken_text = (
            f"{details[0]['label']}: {details[0]['value']}. "
            "Is this correct, or would you like to change it?"
        )
    else:
        spoken_text = "Here is a summary of your report. " + " ".join(
            f"{item['label']}: {item['value']}."
            for item in details
        ) + " Would you like to correct any field, or confirm these details?"

    return {
        "mode": mode,
        "fields": details,
        "spoken_text": redact_sensitive_secrets(spoken_text),
        "missing_fields": get_missing_fields(report),
        "ready_for_confirmation": not get_missing_fields(report),
    }


def correct_report_field(
    report: FraudReport,
    field: str,
    value: Any,
) -> FraudReport:
    """Validate a correction using the existing Pydantic report schema."""
    if field not in FIELD_LABELS:
        raise ValueError("Choose a valid report field.")

    if field in {"confirmed_by_user", "consent_to_save", "missing_fields"}:
        raise ValueError("This field cannot be edited directly.")

    safe_value = value

    if isinstance(value, str):
        safe_value = redact_sensitive_secrets(value.strip())

    data = report.model_dump()
    data[field] = safe_value

    # A correction invalidates any earlier confirmation and consent.
    data["confirmed_by_user"] = False
    data["consent_to_save"] = False

    try:
        updated = FraudReport.model_validate(data)
    except ValidationError as exc:
        raise ValueError(
            "The correction is invalid for this report field."
        ) from exc

    if isinstance(safe_value, str) and "[REDACTED]" in safe_value:
        raise ValueError(
            "Please do not enter secret codes or credentials. "
            "Provide the non-sensitive information only."
        )

    return updated
