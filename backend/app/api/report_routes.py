
import re
from typing import Literal

from fastapi import APIRouter, Header, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel, StrictBool

from app.core.admin_auth import require_admin
from app.models.report import FraudReport
from app.services.report_review import ReviewRequest, FieldCorrection
from app.services.report_storage import REPORTS_DIR, save_confirmed_report
from app.services.report_workflow import (
    confirm_report,
    correct_field,
    create_workflow,
    get_save_payload,
    get_workflow,
    mark_saved,
    record_consent,
    set_review,
    verify_workflow_access,
)


router = APIRouter(tags=["Report Workflow"])

REFERENCE_PATTERN = re.compile(r"^G15-[A-F0-9]{8}$")


class CreateDraftRequest(BaseModel):
    report: FraudReport


class ConsentRequest(BaseModel):
    consent: StrictBool


def _authorize_workflow(
    workflow_id: str,
    authorization: str | None,
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Workflow access token required.",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        verify_workflow_access(workflow_id, token)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to access workflow.",
        ) from exc

    return token


def _workflow_error(exc: Exception) -> HTTPException:
    if isinstance(exc, PermissionError):
        return HTTPException(status_code=403, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(
        status_code=500,
        detail="The report workflow operation failed.",
    )


@router.post("/api/report-workflow/drafts", status_code=201)
def create_draft(payload: CreateDraftRequest):
    """Start a report draft. The access token is returned only at creation."""
    try:
        return create_workflow(payload.report)
    except Exception as exc:
        raise _workflow_error(exc) from exc


@router.get("/api/report-workflow/drafts/{workflow_id}")
def read_draft(
    workflow_id: str,
    authorization: str | None = Header(default=None),
):
    token = _authorize_workflow(workflow_id, authorization)

    try:
        return get_workflow(workflow_id, token)
    except Exception as exc:
        raise _workflow_error(exc) from exc


@router.post("/api/report-workflow/drafts/{workflow_id}/review")
def review_draft(
    workflow_id: str,
    payload: ReviewRequest,
    authorization: str | None = Header(default=None),
):
    token = _authorize_workflow(workflow_id, authorization)

    try:
        return set_review(
            workflow_id,
            token,
            mode=payload.mode,
            field=payload.field,
        )
    except Exception as exc:
        raise _workflow_error(exc) from exc


@router.post("/api/report-workflow/drafts/{workflow_id}/correct")
def correct_draft_field(
    workflow_id: str,
    payload: FieldCorrection,
    authorization: str | None = Header(default=None),
):
    token = _authorize_workflow(workflow_id, authorization)

    try:
        return correct_field(
            workflow_id,
            token,
            field=payload.field,
            value=payload.value,
        )
    except Exception as exc:
        raise _workflow_error(exc) from exc


@router.post("/api/report-workflow/drafts/{workflow_id}/confirm")
def confirm_draft(
    workflow_id: str,
    authorization: str | None = Header(default=None),
):
    token = _authorize_workflow(workflow_id, authorization)

    try:
        return confirm_report(workflow_id, token)
    except Exception as exc:
        raise _workflow_error(exc) from exc


@router.post("/api/report-workflow/drafts/{workflow_id}/consent")
def consent_to_save(
    workflow_id: str,
    payload: ConsentRequest,
    authorization: str | None = Header(default=None),
):
    token = _authorize_workflow(workflow_id, authorization)

    try:
        return record_consent(
            workflow_id,
            token,
            consent=payload.consent,
        )
    except Exception as exc:
        raise _workflow_error(exc) from exc


@router.post("/api/report-workflow/drafts/{workflow_id}/save")
def save_draft_report(
    workflow_id: str,
    authorization: str | None = Header(default=None),
):
    token = _authorize_workflow(workflow_id, authorization)

    try:
        save_payload = get_save_payload(workflow_id, token)

        # These flags come from server-side workflow state, not the request.
        result = save_confirmed_report(
            save_payload["report"],
            user_confirmed=save_payload["user_confirmed"],
            consent_granted=save_payload["consent_granted"],
        )

        try:
            workflow_result = mark_saved(
                workflow_id,
                token,
                result["reference"],
            )
        except Exception:
            # Avoid leaving an untracked report if workflow finalization fails.
            pdf_path = REPORTS_DIR / result["pdf_filename"]
            metadata_path = REPORTS_DIR / f'{result["reference"]}.json'
            pdf_path.unlink(missing_ok=True)
            metadata_path.unlink(missing_ok=True)
            raise

        return {
            "status": "saved",
            "reference": workflow_result["reference"],
            "message": (
                "Your report has been saved. Keep this reference for "
                "authorized retrieval. It is not an official complaint number."
            ),
        }
    except Exception as exc:
        raise _workflow_error(exc) from exc


@router.get(
    "/api/admin/reports/{reference}/pdf",
    dependencies=[Depends(require_admin)],
)
def download_report_pdf(reference: str):
    """Admin-only retrieval of a locally saved report PDF."""
    if not REFERENCE_PATTERN.fullmatch(reference):
        raise HTTPException(status_code=400, detail="Invalid report reference.")

    pdf_path = REPORTS_DIR / f"{reference}.pdf"

    if not pdf_path.is_file():
        raise HTTPException(status_code=404, detail="Report PDF not found.")

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"{reference}.pdf",
        headers={"Cache-Control": "no-store"},
    )
