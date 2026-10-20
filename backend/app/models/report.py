from typing import Literal

from pydantic import BaseModel, Field


class FraudReport(BaseModel):
    caller_name: str | None = None
    fraud_type: str | None = None
    bank_or_payment_app: str | None = None

    amount_inr: float | None = Field(default=None, ge=0)

    transaction_reference: str | None = None
    incident_date: str | None = None
    incident_time: str | None = None

    registered_phone_last4: str | None = Field(default=None, pattern=r"^\d{4}$")

    otp_or_pin_shared: Literal["yes", "no", "unknown"] | None = None
    contacted_bank: Literal["yes", "no", "unknown"] | None = None

    missing_fields: list[str] = Field(default_factory=list)
    skipped_fields: list[str] = Field(default_factory=list)
    field_attempts: dict[str, int] = Field(default_factory=dict)

    # The user has reviewed and confirmed the report details.
    confirmed_by_user: bool = False

    # The user has explicitly consented to saving the report.
    consent_to_save: bool = False