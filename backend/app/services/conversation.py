
import re

from app.models.report import FraudReport


QUESTIONS = [
    {
        "field": "fraud_type",
        "question": "Please briefly tell me what happened.",
    },
    {
        "field": "bank_or_payment_app",
        "question": "Which bank or payment app was involved?",
    },
    {
        "field": "amount_inr",
        "question": "Approximately how much money was lost in rupees?",
    },
    {
        "field": "transaction_reference",
        "question": (
            "Do you have the transaction reference number? "
            "Never share an OTP, PIN, or password."
        ),
    },
    {
        "field": "incident_date",
        "question": "On what date did the transaction happen?",
    },
    {
        "field": "incident_time",
        "question": "Approximately what time did it happen?",
    },
    {
        "field": "registered_phone_last4",
        "question": (
            "If you are comfortable, what are the last four digits "
            "of the registered phone number?"
        ),
    },
    {
        "field": "otp_or_pin_shared",
        "question": (
            "Was an OTP or PIN shared? Say yes, no, or unsure. "
            "Do not tell me the actual code."
        ),
    },
    {
    "field": "contacted_bank",
    "question": "Have you contacted your bank or payment app about this incident? Please say yes, no, or unsure."
    },
]

FIELD_LABELS = {
    item["field"]: item["field"].replace("_", " ").title()
    for item in QUESTIONS
}


def is_missing_value(field: str, value: object) -> bool:
    if value is None:
        return True

    if isinstance(value, str) and not value.strip():
        return True

    if field == "otp_or_pin_shared" and value == "unknown":
        return True

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


def _extract_answer(
    field: str,
    transcript: str,
) -> tuple[object | None, bool]:
    """
    Returns (value, confidently_parsed).
    Does not use an LLM and intentionally leaves ambiguous values unchanged.
    """
    text = transcript.strip()
    lower = text.lower()

    if not text:
        return None, False

    # Never store a transcript that appears to disclose a secret as a
    # transaction reference or phone suffix.
    if re.search(
        r"\b(otp|one.time.password|pin|password|cvv|cvc)\b",
        lower,
    ):
        if field in {"transaction_reference", "registered_phone_last4"}:
            return None, False

    if field == "otp_or_pin_shared":
        if re.search(r"\b(unsure|not sure|don't know|unknown)\b", lower):
            return "unknown", True

        if re.search(r"\b(yes|haan|han|ji haan)\b", lower):
            return "yes", True

        if re.search(r"\b(no|nahi|nahin|never)\b", lower):
            return "no", True

        return None, False

    if field == "amount_inr":
        match = re.search(
            r"(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d{1,2})?)"
            r"|([\d,]+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr)\b",
            lower,
        )

        # Also accept a plain number when the caller is answering
        # the specific amount question.
        if not match and re.fullmatch(r"\s*[\d,]+(?:\.\d{1,2})?\s*", text):
            raw = text
        elif match:
            raw = match.group(1) or match.group(2)
        else:
            return None, False

        try:
            amount = float(raw.replace(",", ""))
            return (amount, True) if amount >= 0 else (None, False)
        except ValueError:
            return None, False

    if field == "incident_date":
        match = re.search(
            r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"
            r"|\d{4}-\d{2}-\d{2})\b",
            text,
        )
        return (match.group(1), True) if match else (None, False)

    if field == "incident_time":
        match = re.search(
            r"\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b"
            r"|\b(\d{1,2}:\d{2})\b",
            lower,
        )
        if match:
            return (match.group(1) or match.group(2)).strip(), True
        return None, False

    if field == "registered_phone_last4":
        match = re.search(
            r"(?:last\s*(?:four|4)\s*digits?\s*(?:are|is)?\s*)"
            r"(\d{4})\b",
            lower,
        )
        return (match.group(1), True) if match else (None, False)

    if field == "transaction_reference":
        match = re.search(
            r"(?:transaction\s*(?:id|reference|number)|"
            r"reference\s*number|utr|rrn)\s*(?:is|:|-)?\s*"
            r"([A-Za-z0-9-]{6,40})",
            text,
            re.IGNORECASE,
        )
        return (match.group(1), True) if match else (None, False)

    if field == "bank_or_payment_app":
        known_names = [
            "google pay", "phonepe", "paytm", "bhim",
            "amazon pay", "sbi", "hdfc", "icici",
            "axis bank", "bank of baroda", "pnb",
        ]
        for name in known_names:
            if name in lower:
                return name.title(), True

        # A short answer to the bank question can be retained as a
        # candidate, but the caller should confirm it in the UI.
        if len(text) <= 60 and not re.search(r"\d{6,}", text):
            return text, False

        return None, False

    if field == "fraud_type":
        categories = {
            "upi fraud": ["upi", "qr code", "collect request"],
            "phishing": ["phishing", "fake link", "malicious link"],
            "impersonation": ["impersonat", "pretended to be", "fake officer"],
            "investment scam": ["investment scam", "trading scam"],
            "job scam": ["job scam", "fake job", "job offer"],
            "remote access scam": ["remote access", "screen sharing app"],
            "unauthorized transaction": [
                "without my permission", "unauthorized", "unknown transaction"
            ],
        }

        matches = [
            category
            for category, keywords in categories.items()
            if any(keyword in lower for keyword in keywords)
        ]

        if len(matches) == 1:
            return matches[0], True

        # Preserve the caller's description for human review, but do
        # not claim that an automatic category was confidently identified.
        return text[:500], False

    return None, False


def update_report_from_answer(
    report: FraudReport,
    transcript: str,
    current_field: str | None = None,
) -> tuple[FraudReport, list[str]]:
    """
    Updates only the field currently being asked.
    Returns the updated report and fields that need human confirmation.
    """
    allowed_fields = {item["field"] for item in QUESTIONS}

    if current_field not in allowed_fields:
        return report, []

    value, confident = _extract_answer(current_field, transcript)

    if value is None:
        return report, [current_field]

    data = report.model_dump()
    data[current_field] = value

    # Any newly captured answer requires caller confirmation later.
    data["confirmed_by_user"] = False

    updated_report = FraudReport.model_validate(data)
    needs_review = [] if confident else [current_field]

    return updated_report, needs_review


def build_report_summary(report: FraudReport) -> dict:
    missing = get_missing_fields(report)

    return {
        "report": report.model_dump(),
        "missing_fields": missing,
        "missing_labels": [FIELD_LABELS[field] for field in missing],
        "ready_for_confirmation": len(missing) == 0,
        "confirmed_by_user": report.confirmed_by_user,
    }
