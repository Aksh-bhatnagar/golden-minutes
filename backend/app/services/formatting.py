import re
from datetime import datetime
from typing import Any

PDF_LABELS = {
    "caller_name": "Caller name",
    "fraud_type": "What happened",
    "bank_or_payment_app": "Bank or payment app",
    "amount_inr": "Amount lost",
    "transaction_reference": "Transaction ID",
    "incident_date": "Incident date",
    "incident_time": "Incident time",
    "registered_phone_last4": "Registered phone (last 4 digits)",
    "otp_or_pin_shared": "OTP or PIN shared",
    "contacted_bank": "Bank contacted",
}


def format_inr(amount: Any) -> str:
    number = float(amount)
    whole = int(number)
    digits = str(whole)

    if len(digits) > 3:
        head = re.sub(r"(\d)(?=(\d\d)+$)", r"\1,", digits[:-3])
        digits = f"{head},{digits[-3:]}"

    cents = round(number - whole, 2)
    suffix = f".{int(round(cents * 100)):02d}" if cents else ""

    return f"INR {digits}{suffix}"


def format_date(value: str) -> str:
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%d %b %Y")
    except ValueError:
        return value


def format_time(value: str) -> str:
    try:
        hour, minute = (int(x) for x in value.split(":"))
    except ValueError:
        return value

    return f"{(hour % 12) or 12}:{minute:02d} {'AM' if hour < 12 else 'PM'}"


def display_value(field: str, value: Any) -> str:
    if value is None or value == "":
        return "Not provided"

    if field == "amount_inr":
        return format_inr(value)
    if field == "incident_date":
        return format_date(str(value))
    if field == "incident_time":
        return format_time(str(value))
    if field in {"otp_or_pin_shared", "contacted_bank"}:
        return {"yes": "Yes", "no": "No", "unknown": "Not sure"}.get(
            str(value), "Not provided"
        )

    return str(value)


def display_report(data: dict[str, Any]) -> dict[str, str]:
    return {f: display_value(f, data.get(f)) for f in PDF_LABELS}