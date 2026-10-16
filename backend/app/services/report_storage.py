
import json
import os
import re
import secrets
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from app.models.report import FraudReport
from app.services.llm import redact_sensitive_secrets


BACKEND_DIR = Path(__file__).resolve().parents[2]
REPORTS_DIR = BACKEND_DIR / "data" / "reports"

# These are internal storage names, never paths supplied by a user.
REFERENCE_PATTERN = re.compile(r"^G15-[A-F0-9]{8}$")


def _safe_text(value: Any) -> str:
    """Escape report values before placing them into PDF paragraphs."""
    if value is None or value == "":
        return "Not provided"

    cleaned = redact_sensitive_secrets(str(value))
    return escape(cleaned).replace("\n", "<br/>")


def _new_reference() -> str:
    return f"G15-{secrets.token_hex(4).upper()}"


def _build_pdf(report: FraudReport, pdf_path: Path, reference: str) -> None:
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            parent=styles["Title"],
            alignment=TA_CENTER,
            textColor=colors.HexColor("#17365D"),
            spaceAfter=8 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SmallNote",
            parent=styles["BodyText"],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#555555"),
        )
    )

    document = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Golden 15 Report {reference}",
        author="Golden 15",
    )

    labels = {
        "fraud_type": "Fraud type",
        "bank_or_payment_app": "Bank or payment app",
        "amount_inr": "Reported amount (INR)",
        "transaction_reference": "Transaction reference",
        "incident_date": "Incident date",
        "incident_time": "Incident time",
        "registered_phone_last4": "Registered phone (last 4 digits)",
        "otp_or_pin_shared": "OTP or PIN shared",
        "contacted_bank": "Bank contacted",
    }

    data = report.model_dump()
    rows = [[
        Paragraph("<b>Field</b>", styles["BodyText"]),
        Paragraph("<b>Reported information</b>", styles["BodyText"]),
    ]]

    for field, label in labels.items():
        value = data.get(field)

        if field == "amount_inr" and value is not None:
            value = f"₹{value}"

        rows.append([
            Paragraph(_safe_text(label), styles["BodyText"]),
            Paragraph(_safe_text(value), styles["BodyText"]),
        ])

    table = Table(rows, colWidths=[57 * mm, 112 * mm], repeatRows=1)
    table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF5")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#17365D")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#C8D0D9")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])
    )

    story = [
        Paragraph("Golden 15 — Fraud Incident Report", styles["ReportTitle"]),
        Paragraph(f"<b>Reference:</b> {_safe_text(reference)}", styles["BodyText"]),
        Paragraph(
            f"<b>Created (UTC):</b> "
            f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}",
            styles["BodyText"],
        ),
        Spacer(1, 5 * mm),
        table,
        Spacer(1, 8 * mm),
        Paragraph(
            "<b>Important:</b> This document records information provided "
            "during an intake session. It is not an official cybercrime "
            "complaint, police report, bank claim, or confirmation that "
            "a complaint has been filed.",
            styles["BodyText"],
        ),
        Spacer(1, 4 * mm),
        Paragraph(
            "Handle this document as confidential personal information. "
            "Share it only with authorized personnel.",
            styles["SmallNote"],
        ),
    ]

    document.build(story)


def save_confirmed_report(
    report: FraudReport,
    *,
    user_confirmed: bool,
    consent_granted: bool,
) -> dict[str, Any]:
    """
    Save a report only when confirmation and consent have been validated
    by the server-side workflow.

    IMPORTANT: Do not pass client-supplied confirmation or consent flags
    directly into these arguments.
    """
    if user_confirmed is not True:
        raise PermissionError("The user must confirm the report first.")

    if consent_granted is not True:
        raise PermissionError("Explicit consent to save is required.")

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # Avoid persisting workflow flags as report information.
    report_data = report.model_dump(
        exclude={"confirmed_by_user", "consent_to_save"}
    )

    for field, value in report_data.items():
        if isinstance(value, str):
            safe_value = redact_sensitive_secrets(value)
            if "[REDACTED]" in safe_value:
                raise ValueError(
                    f"Sensitive information detected in field '{field}'. "
                    "Remove it before saving the report."
                )
            report_data[field] = safe_value

    safe_report = FraudReport.model_validate(report_data)

    # Retry in the extremely unlikely event of a reference collision.
    for _ in range(5):
        reference = _new_reference()
        if not (REPORTS_DIR / f"{reference}.pdf").exists():
            break
    else:
        raise RuntimeError("Could not allocate a unique report reference.")

    pdf_path = REPORTS_DIR / f"{reference}.pdf"
    metadata_path = REPORTS_DIR / f"{reference}.json"
    temp_pdf = REPORTS_DIR / f".{reference}.tmp.pdf"
    temp_metadata = REPORTS_DIR / f".{reference}.tmp.json"

    created_at = datetime.now(timezone.utc).isoformat()

    try:
        _build_pdf(safe_report, temp_pdf, reference)

        if not temp_pdf.is_file() or temp_pdf.stat().st_size == 0:
            raise RuntimeError("PDF generation did not produce a valid file.")

        metadata = {
            "reference": reference,
            "created_at": created_at,
            "pdf_filename": f"{reference}.pdf",
            "report": safe_report.model_dump(),
        }

        temp_metadata.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        # Finalize the files only after PDF generation succeeds.
        os.replace(temp_pdf, pdf_path)
        os.replace(temp_metadata, metadata_path)

    except Exception:
        for path in (temp_pdf, temp_metadata, pdf_path, metadata_path):
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
        raise

    # The reference is returned only after both files have been finalized.
    return {
        "reference": reference,
        "created_at": created_at,
        "pdf_filename": pdf_path.name,
        "saved": True,
    }
