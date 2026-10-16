
import hmac
import os

from fastapi import Header, HTTPException


def require_admin(
    authorization: str | None = Header(default=None),
) -> None:
    configured_token = os.getenv("ADMIN_API_TOKEN", "").strip()

    if not configured_token:
        raise HTTPException(
            status_code=503,
            detail="Admin access is not configured.",
        )

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Admin authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    supplied_token = authorization.removeprefix("Bearer ").strip()

    if not hmac.compare_digest(supplied_token, configured_token):
        raise HTTPException(
            status_code=401,
            detail="Invalid admin token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
