
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from app.models.report import FraudReport


BACKEND_DIR = Path(__file__).resolve().parents[2]
DRAFTS_DIR = BACKEND_DIR / "data" / "drafts"

WorkflowStatus = Literal[
    "reviewing",
    "awaiting_confirmation",
    "awaiting_consent",
    "saved",
    "declined",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _draft_path(workflow_id: str) -> Path:
    if (
        not workflow_id
        or len(workflow_id) > 100
        or not workflow_id.startswith("g15draft_")
        or not all(
            character.isalnum() or character in "_-"
            for character in workflow_id
        )
    ):
        raise ValueError("Invalid workflow ID.")

    return DRAFTS_DIR / f"{workflow_id}.json"


def _read_state(workflow_id: str) -> dict[str, Any]:
    path = _draft_path(workflow_id)

    if not path.is_file():
        raise ValueError("Workflow not found.")

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("Unable to read workflow state.") from exc


def _write_state(state: dict[str, Any]) -> None:
    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)

    workflow_id = state.get("workflow_id", "")
    path = _draft_path(workflow_id)
    temporary_path = path.with_suffix(".tmp")

    state["updated_at"] = _now()

    try:
        temporary_path.write_text(
            json.dumps(state, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temporary_path.replace(path)
    except OSError as exc:
        try:
            temporary_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise RuntimeError("Unable to save workflow state.") from exc


def verify_workflow_access(
    workflow_id: str,
    access_token: str,
) -> None:
    """Verify that the caller possesses the workflow's access token."""
    if not access_token or len(access_token) > 200:
        raise PermissionError("Invalid workflow access token.")

    state = _read_state(workflow_id)
    expected_hash = state.get("access_token_hash", "")
    supplied_hash = _token_hash(access_token)

    if not expected_hash or not hmac.compare_digest(
        expected_hash,
        supplied_hash,
    ):
        raise PermissionError("Invalid workflow access token.")


def _require_status(
    state: dict[str, Any],
    allowed: set[str],
) -> None:
    if state.get("status") not in allowed:
        raise ValueError(
            f"This action is not allowed while the workflow is "
            f"{state.get('status', 'unknown')}."
        )


def create_workflow(report: FraudReport) -> dict[str, Any]:
    """Create a draft and return its ID and one-time access token."""
    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)

    workflow_id = f"g15draft_{secrets.token_urlsafe(18)}"
    access_token = secrets.token_urlsafe(32)

    safe_report = report.model_copy(
        update={
            "confirmed_by_user": False,
            "consent_to_save": False,
        }
    )

    state = {
        "workflow_id": workflow_id,
        "access_token_hash": _token_hash(access_token),
        "status": "reviewing",
        "report": safe_report.model_dump(mode="json"),
        "user_confirmed": False,
        "consent_granted": False,
        "reference": None,
        "review_completed": False,
        "created_at": _now(),
        "updated_at": _now(),
    }

    _write_state(state)

    return {
        "workflow_id": workflow_id,
        "access_token": access_token,
        "status": state["status"],
        "report": state["report"],
    }


def get_workflow(
    workflow_id: str,
    access_token: str,
) -> dict[str, Any]:
    verify_workflow_access(workflow_id, access_token)
    state = _read_state(workflow_id)

    # Never expose the stored access-token hash.
    return {
        key: value
        for key, value in state.items()
        if key != "access_token_hash"
    }


def set_review(
    workflow_id: str,
    access_token: str,
    mode: Literal["all", "field"],
    field: str | None = None,
) -> dict[str, Any]:
    verify_workflow_access(workflow_id, access_token)
    state = _read_state(workflow_id)

    _require_status(state, {"reviewing", "awaiting_confirmation"})

    if mode == "field":
        from app.services.conversation import REPORT_FIELDS

        if not field or field not in REPORT_FIELDS:
            raise ValueError("Select a valid report field.")
    elif mode == "all":
        field = None

    state["status"] = "reviewing"
    state["review_mode"] = mode
    state["review_field"] = field
    state["user_confirmed"] = False
    state["consent_granted"] = False
    state["report"]["confirmed_by_user"] = False
    state["report"]["consent_to_save"] = False
    state["review_completed"] = True

    _write_state(state)

    from app.services.report_review import build_readback

    report = FraudReport.model_validate(state["report"])

    return {
        "status": state["status"],
        "mode": mode,
        "field": field,
        "readback": build_readback(report, mode, field),
    }


def correct_field(
    workflow_id: str,
    access_token: str,
    field: str,
    value: Any,
) -> dict[str, Any]:
    verify_workflow_access(workflow_id, access_token)
    state = _read_state(workflow_id)

    _require_status(
        state,
        {"reviewing", "awaiting_confirmation"},
    )

    from app.services.report_review import correct_report_field

    report = FraudReport.model_validate(state["report"])
    updated_report = correct_report_field(report, field, value)

    state["report"] = updated_report.model_dump(mode="json")
    state["status"] = "reviewing"
    state["user_confirmed"] = False
    state["consent_granted"] = False
    state["reference"] = None
    state["report"]["confirmed_by_user"] = False
    state["report"]["consent_to_save"] = False

    _write_state(state)

    return {
        "status": state["status"],
        "report": state["report"],
        "message": "Correction recorded. Please review the details again.",
    }



def confirm_report(
    workflow_id: str,
    access_token: str,
) -> dict[str, Any]:
    """Confirm only after review and completion of required fields."""
    verify_workflow_access(workflow_id, access_token)
    state = _read_state(workflow_id)

    _require_status(state, {"reviewing"})

    if not state.get("review_completed"):
        raise ValueError("Review the report before confirming it.")

    from app.services.conversation import get_missing_fields

    report = FraudReport.model_validate(state["report"])
    missing_fields = get_missing_fields(report)

    if missing_fields:
        labels = {
            "fraud_type": "Fraud type",
            "bank_or_payment_app": "Bank or payment app",
            "amount_inr": "Amount",
            "transaction_reference": "Transaction reference",
            "incident_date": "Incident date",
            "incident_time": "Incident time",
            "registered_phone_last4": "Registered phone last four digits",
            "otp_or_pin_shared": "Whether an OTP or PIN was shared",
            "contacted_bank": "Whether the bank was contacted",
        }
        missing_labels = [
            labels.get(field, field) for field in missing_fields
        ]
        raise ValueError(
            "Complete or explicitly resolve these fields before "
            "confirmation: " + ", ".join(missing_labels)
        )

    state["user_confirmed"] = True
    state["consent_granted"] = False
    state["status"] = "awaiting_consent"
    state["report"]["confirmed_by_user"] = True
    state["report"]["consent_to_save"] = False

    _write_state(state)

    return {
        "status": state["status"],
        "message": (
            "Details confirmed. Ask the user separately whether "
            "they consent to saving the report."
        ),
    }



def record_consent(
    workflow_id: str,
    access_token: str,
    consent: bool,
) -> dict[str, Any]:
    """Record explicit consent or decline without saving a report."""
    verify_workflow_access(workflow_id, access_token)
    state = _read_state(workflow_id)

    _require_status(state, {"awaiting_consent"})

    if not state.get("user_confirmed"):
        raise ValueError("The report must be confirmed first.")

    if consent is not True:
        state["consent_granted"] = False
        state["report"]["consent_to_save"] = False
        state["status"] = "declined"
        _write_state(state)

        return {
            "status": "declined",
            "message": "The report was not saved.",
        }

    state["consent_granted"] = True
    state["report"]["consent_to_save"] = True

    _write_state(state)

    return {
        "status": "awaiting_consent",
        "message": (
            "Consent recorded. The report may now be saved "
            "by the protected save endpoint."
        ),
    }


def get_save_payload(
    workflow_id: str,
    access_token: str,
) -> dict[str, Any]:
    """Return save authorization derived from server-side state."""
    verify_workflow_access(workflow_id, access_token)
    state = _read_state(workflow_id)

    _require_status(state, {"awaiting_consent"})

    if not state.get("user_confirmed"):
        raise ValueError("The report has not been confirmed.")

    if not state.get("consent_granted"):
        raise ValueError("Explicit consent to save is required.")

    report = FraudReport.model_validate(state["report"])

    return {
        "report": report,
        "user_confirmed": True,
        "consent_granted": True,
    }


def mark_saved(
    workflow_id: str,
    access_token: str,
    reference: str,
) -> dict[str, Any]:
    """Mark a workflow saved only after the PDF save succeeds."""
    verify_workflow_access(workflow_id, access_token)
    state = _read_state(workflow_id)

    _require_status(state, {"awaiting_consent"})

    if not state.get("user_confirmed"):
        raise ValueError("The report has not been confirmed.")

    if not state.get("consent_granted"):
        raise ValueError("Explicit consent to save is required.")

    if not reference or not reference.startswith("G15-"):
        raise ValueError("Invalid report reference.")

    state["status"] = "saved"
    state["reference"] = reference

    _write_state(state)

    return {
        "status": "saved",
        "reference": reference,
        "message": (
            "The report was saved. This reference is for retrieving "
            "the saved report and is not an official complaint number."
        ),
    }
