import re
from datetime import date, datetime, timedelta
from typing import Any

_DEVA_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

DIGIT_WORDS = {
    "zero": 0, "shunya": 0, "शून्य": 0, "ज़ीरो": 0, "जीरो": 0,
    "one": 1, "ek": 1, "एक": 1,
    "two": 2, "do": 2, "दो": 2,
    "three": 3, "teen": 3, "तीन": 3,
    "four": 4, "char": 4, "chaar": 4, "चार": 4,
    "five": 5, "paanch": 5, "panch": 5, "पांच": 5, "पाँच": 5,
    "six": 6, "chhe": 6, "chhah": 6, "cheh": 6, "छह": 6, "छः": 6, "छे": 6,
    "seven": 7, "saat": 7, "सात": 7,
    "eight": 8, "aath": 8, "आठ": 8,
    "nine": 9, "nau": 9, "नौ": 9,
}

MULTIPLIERS = {
    "crore": 1e7, "cr": 1e7, "करोड़": 1e7, "करोड": 1e7,
    "lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "lacs": 1e5, "लाख": 1e5,
    "thousand": 1e3, "k": 1e3, "hazaar": 1e3, "hazar": 1e3,
    "हज़ार": 1e3, "हजार": 1e3,
}

YES_WORDS = {
    "हाँ", "हां", "हा", "जी", "haan", "han", "haa", "ha", "ji", "yes", "yeah",
    "yep", "yup", "correct", "sahi", "सही", "bilkul", "बिल्कुल",
}
NO_WORDS = {"नहीं", "नही", "नहि", "nahi", "nahin", "no", "nope", "nah", "na", "ना"}

_UNKNOWN = re.compile(
    r"(पता\s*(नहीं|नही)|(नहीं|नही)\s*पता|याद\s*(नहीं|नही)|(नहीं|नही)\s*याद|"
    r"मालूम\s*(नहीं|नही)|pata\s*nahi|nahi\s*pata|yaad\s*nahi|malum\s*nahi|"
    r"don'?t\s*know|do\s*not\s*know|not\s*sure|no\s*idea|dunno|पक्का\s*नहीं|pakka\s*nahi)",
    re.I,
)
_DONT_KNOW = re.compile(
    r"(skip|छोड़ो|छोड़िए|छोड़ दो|chhodo|chhodiye|can'?t\s*find|cannot\s*find|"
    r"don'?t\s*have|नहीं\s*मिल|nahi\s*mil|नहीं\s*है|nahi\s*hai|नहीं\s*बताना|"
    r"nahi\s*batana|prefer\s*not|don'?t\s*want)",
    re.I,
)

PLACEHOLDERS = {
    "unknown", "none", "null", "n/a", "na", "nil", "-", "not provided",
    "not sure", "dont know", "don't know", "no idea",
}


def tokens(text: str) -> list[str]:
    return [t for t in re.split(r"[\s,.;:!?।\-\"'()]+", text.lower()) if t]


def is_placeholder(value: Any) -> bool:
    return isinstance(value, str) and value.strip().lower() in PLACEHOLDERS


# ---------------------------------------------------------------------------
# Fast parsers (no model call)
# ---------------------------------------------------------------------------


def parse_yes_no(text: str) -> str | None:
    if _UNKNOWN.search(text):
        return "unknown"

    for tok in tokens(text):
        if tok in YES_WORDS:
            return "yes"
        if tok in NO_WORDS:
            return "no"

    return None


def is_dont_know(text: str) -> bool:
    return bool(_UNKNOWN.search(text) or _DONT_KNOW.search(text))


def digits_from_speech(text: str) -> str:
    out: list[str] = []

    for tok in tokens(text.translate(_DEVA_DIGITS)):
        if tok.isdigit():
            out.append(tok)
        elif tok in DIGIT_WORDS:
            out.append(str(DIGIT_WORDS[tok]))

    return "".join(out)


def parse_amount(text: str) -> float | None:
    t = text.translate(_DEVA_DIGITS).lower().replace("₹", " ")
    t = re.sub(r"(?<=\d),(?=\d)", "", t)

    # "4 se 5", "5 to 6": a range is not one amount, let the model or the review screen decide.
    if re.search(r"\d\s*(?:से|to|या|ya|or|-|–)\s*\d", t):
        return None

    m = re.search(r"\d+(?:\.\d+)?", t)
    if not m:
        return None

    rest = tokens(t[m.end():])
    mult = MULTIPLIERS.get(rest[0], 1) if rest else 1

    return round(float(m.group()) * mult, 2)


def parse_last4(text: str) -> str | None:
    digits = digits_from_speech(text)

    if len(digits) == 4:
        return digits
    if len(digits) >= 10:
        return digits[-4:]
    return None


def parse_reference(text: str) -> str | None:
    digits = digits_from_speech(text)

    if len(digits) >= 8:
        return digits

    m = re.search(
        r"\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{8,32}\b", text
    )
    return m.group().upper() if m else None


# ---------------------------------------------------------------------------
# Normalizers: one fixed format per field. None means "not valid".
# ---------------------------------------------------------------------------

BANKS = {
    "phonepe": "PhonePe", "phone pe": "PhonePe", "paytm": "Paytm",
    "gpay": "Google Pay", "google pay": "Google Pay", "googlepay": "Google Pay",
    "bhim": "BHIM UPI", "amazon pay": "Amazon Pay",
    "sbi": "State Bank of India (SBI)",
    "state bank of india": "State Bank of India (SBI)",
    "state bank": "State Bank of India (SBI)",
    "hdfc": "HDFC Bank", "icici": "ICICI Bank", "axis": "Axis Bank",
    "kotak": "Kotak Mahindra Bank", "pnb": "Punjab National Bank (PNB)",
    "punjab national": "Punjab National Bank (PNB)",
    "bob": "Bank of Baroda", "baroda": "Bank of Baroda",
    "canara": "Canara Bank", "union": "Union Bank of India",
    "idfc": "IDFC FIRST Bank", "yes": "YES Bank", "indusind": "IndusInd Bank",
}


def normalize_bank(value: str) -> str:
    key = re.sub(r"\s+", " ", value.lower().strip())

    for candidate in (key, re.sub(r"\s*bank$", "", key)):
        if candidate in BANKS:
            return BANKS[candidate]

    if re.search(r"[\u0900-\u097F]", value):
        return value.strip()[:80]

    words = [
        w if any(c.isupper() for c in w[1:]) else w.capitalize()
        for w in value.split()
    ]
    return " ".join(words)[:80]


def normalize_name(value: str) -> str | None:
    cleaned = re.sub(r"[^A-Za-z .'-]", "", value)
    name = " ".join(w.capitalize() for w in cleaned.split())[:60]
    return name or None


def normalize_date(value: str) -> str | None:
    parsed = None

    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y", "%d %b %Y", "%d %B %Y"):
        try:
            parsed = datetime.strptime(value.strip(), fmt).date()
            break
        except ValueError:
            continue

    if parsed is None:
        return None

    today = date.today()
    if parsed > today + timedelta(days=1) or parsed < today - timedelta(days=365 * 5):
        return None

    return parsed.isoformat()


def normalize_time(value: str) -> str | None:
    m = re.fullmatch(
        r"(\d{1,2})[:.]?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?",
        value.strip().lower(),
    )
    if not m:
        return None

    hour, minute, meridiem = int(m[1]), int(m[2] or 0), m[3]

    if minute > 59:
        return None

    if meridiem:
        if not 1 <= hour <= 12:
            return None
        hour = hour % 12 + (12 if meridiem.startswith("p") else 0)
    elif hour > 23:
        return None

    return f"{hour:02d}:{minute:02d}"


YES_NO_FIELDS = {"otp_or_pin_shared", "contacted_bank"}


def normalize_field(field: str, value: Any) -> Any:
    """Return the value in its fixed format, or None if it is not valid."""
    if value is None:
        return None

    if field == "amount_inr":
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        return round(number, 2) if 0 < number <= 1e9 else None

    if field in YES_NO_FIELDS:
        v = str(value).strip().lower()
        return v if v in {"yes", "no", "unknown"} else None

    s = str(value).strip()
    if not s or is_placeholder(s):
        return None

    if field == "registered_phone_last4":
        return s if re.fullmatch(r"\d{4}", s) else None

    if field == "transaction_reference":
        compact = re.sub(r"[\s\-_/]", "", s).upper()
        return compact if re.fullmatch(r"[A-Z0-9]{8,32}", compact) else None

    if field == "incident_date":
        return normalize_date(s)

    if field == "incident_time":
        return normalize_time(s)

    if field == "bank_or_payment_app":
        return normalize_bank(s)

    if field == "caller_name":
        return normalize_name(s)

    if field == "fraud_type":
        s = s.rstrip(".")[:160]
        return s[0].upper() + s[1:]

    return None