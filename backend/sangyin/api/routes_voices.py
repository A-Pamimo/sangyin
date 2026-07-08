"""Voice listing: the default engine's voices, plus the opt-in natural voice."""

from __future__ import annotations

from fastapi import APIRouter

from ..config import get_settings
from ..models import Voice
from ..tts import get_engine

router = APIRouter(tags=["voices"])


@router.get("/voices", response_model=list[Voice])
def list_voices() -> list[Voice]:
    settings = get_settings()
    voices = list(get_engine().voices())  # default engine (Kokoro) — free, live
    # Advertise the natural (GPU) voice as an explicit, prepare-first option.
    if not any(v.id == settings.natural_voice_id for v in voices):
        voices.append(
            Voice(
                id=settings.natural_voice_id,
                name="Natural — prepare first",
                lang_code=settings.default_lang_code,
                gender="female",
            )
        )
    return voices
