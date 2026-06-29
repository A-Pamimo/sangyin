"""Voice listing."""

from __future__ import annotations

from fastapi import APIRouter

from ..models import Voice
from ..tts import get_engine

router = APIRouter(tags=["voices"])


@router.get("/voices", response_model=list[Voice])
def list_voices() -> list[Voice]:
    return get_engine().voices()
