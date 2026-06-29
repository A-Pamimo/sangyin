"""Health check."""

from __future__ import annotations

from fastapi import APIRouter

from .. import __version__
from ..config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "model": settings.tts_engine,
        "version": __version__,
    }
