from typing import Literal
from pydantic import BaseModel, Field


class FraudReport(BaseModel):
    fraud_type: str | None = None
    bank_or_payment_app: str | None = None
    amount_inr: float | None = Field(default=None, ge=0)
    transaction_reference: str | None = None
    incident_date: str | None = None
    incident_time: str | None = None
    registered_phone_last4: str | None = Field(
        default=None,
        pattern=r"^\d{4}$",
    )
    otp_or_pin_shared: Literal["yes", "no", "unknown"] = "unknown"
    missing_fields: list[str] = Field(default_factory=list)
    confirmed_by_user: bool = False,
    contacted_bank: Literal["yes", "no", "unknown"] = "unknown"
