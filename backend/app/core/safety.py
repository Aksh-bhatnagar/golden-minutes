
URGENT_NOTICE = (
    "If money has been lost to cyber fraud in India, call 1930 immediately. "
    "Do not delay reporting to use this prototype."
)

FORBIDDEN_SECRETS = (
    "OTP",
    "PIN",
    "PASSWORD",
    "PASSCODE",
    "CVV",
    "FULL CARD NUMBER",
)


def get_safety_notice() -> str:
    return URGENT_NOTICE


def is_sensitive_request(text: str) -> bool:
    normalized = text.upper()
    return any(secret in normalized for secret in FORBIDDEN_SECRETS)


def should_handoff(
    distressed: bool = False,
    requests_human: bool = False,
    safeguarding_concern: bool = False,
) -> bool:
    return distressed or requests_human or safeguarding_concern
