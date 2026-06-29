"""Optional API-key auth.

If ``SANGYIN_API_KEY`` is set, all endpoints that depend on ``require_api_key`` reject
requests without a matching ``X-API-Key`` header. When it's empty (the default), the
dependency is a no-op so personal self-hosting needs no configuration.
"""

from __future__ import annotations

import secrets

from fastapi import Header, HTTPException, status

from .config import get_settings


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    configured = get_settings().api_key
    if not configured:
        return  # auth disabled
    if not x_api_key or not secrets.compare_digest(x_api_key, configured):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )
