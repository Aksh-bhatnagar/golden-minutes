import json
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.admin_auth import require_admin
from app.services.report_storage import REFERENCE_PATTERN, REPORTS_DIR

router = APIRouter(
    prefix="/api/admin",
    tags=["Handler console"],
    dependencies=[Depends(require_admin)],
)


class StatusUpdate(BaseModel):
    status: Literal["new", "in_progress", "resolved"]


def _priority(report: dict) -> str:
    amount = report.get("amount_inr") or 0
    if amount >= 100000:
        return "high"
    if amount >= 10000:
        return "medium"
    return "low"


def _load(path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    data.setdefault("status", "new")
    data["priority"] = _priority(data.get("report", {}))
    from app.services.formatting import display_report

    data["display"] = display_report(data.get("report", {}))
    return data


@router.get("/reports")
def list_reports():
    if not REPORTS_DIR.is_dir():
        return []

    items = [d for p in REPORTS_DIR.glob("G15-*.json") if (d := _load(p))]
    items.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return items


@router.post("/reports/{reference}/status")
def set_status(reference: str, payload: StatusUpdate):
    if not REFERENCE_PATTERN.fullmatch(reference):
        raise HTTPException(status_code=400, detail="Invalid report reference.")

    path = REPORTS_DIR / f"{reference}.json"
    data = _load(path) if path.is_file() else None

    if data is None:
        raise HTTPException(status_code=404, detail="Report not found.")

    data.pop("priority", None)
    data["status"] = payload.status
    data["status_updated_at"] = datetime.now(timezone.utc).isoformat()

    tmp = path.with_name(f".{reference}.status.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)

    return {"reference": reference, "status": payload.status}