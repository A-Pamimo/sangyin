"""Engine registry: maps an engine id (from config) to a singleton instance."""

from __future__ import annotations

from functools import lru_cache

from ..config import get_settings
from .base import TTSEngine


@lru_cache
def get_engine() -> TTSEngine:
    name = get_settings().tts_engine.lower()
    if name == "kokoro":
        from .kokoro_engine import KokoroEngine

        return KokoroEngine()
    if name == "chatterbox":
        # Natural neural voice via the GPU sidecar (backend/tts_sidecar.py).
        from .chatterbox_engine import ChatterboxEngine

        return ChatterboxEngine(get_settings().chatterbox_url)
    raise ValueError(f"Unknown TTS engine: {name!r}")
