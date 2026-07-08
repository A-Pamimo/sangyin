"""Engine registry: maps an engine id to a cached singleton, and a voice id to the
engine that serves it (so the free CPU voice and the paid GPU voice can coexist)."""

from __future__ import annotations

from functools import lru_cache

from ..config import get_settings
from .base import TTSEngine


@lru_cache
def _make_engine(name: str) -> TTSEngine:
    if name == "kokoro":
        from .kokoro_engine import KokoroEngine

        return KokoroEngine()
    if name == "chatterbox":
        # Natural neural voice via the GPU worker (backend/tts_sidecar.py or Modal).
        from .chatterbox_engine import ChatterboxEngine

        return ChatterboxEngine(get_settings().chatterbox_url)
    raise ValueError(f"Unknown TTS engine: {name!r}")


def get_engine(name: str | None = None) -> TTSEngine:
    """Return the engine by id; defaults to the configured default engine (Kokoro)."""
    return _make_engine((name or get_settings().tts_engine).lower())


def engine_name_for_voice(voice: str | None) -> str:
    """Which engine serves this voice. The one distinguished `natural_voice_id` maps to
    the paid GPU engine; everything else uses the default (free CPU) engine."""
    settings = get_settings()
    if voice and voice == settings.natural_voice_id:
        return settings.natural_engine
    return settings.tts_engine


def get_engine_for_voice(voice: str | None) -> TTSEngine:
    return get_engine(engine_name_for_voice(voice))
