"""Kokoro-82M engine (the default).

Kokoro's ``KPipeline`` is heavy to construct, so we build one lazily per language code
and cache it. ``pipeline(text, voice=...)`` yields ``(graphemes, phonemes, audio)`` per
internal segment; we concatenate those into one waveform for the requested text.
"""

from __future__ import annotations

import logging
import threading

import numpy as np

from ..models import Voice

logger = logging.getLogger(__name__)

# A curated subset of Kokoro v1.0 voices. The model ships ~54 voices across 8 languages;
# these are the most natural English ones. Add more here as needed — ids must match
# Kokoro's voice files (see hf.co/hexgrad/Kokoro-82M/tree/main/voices).
KOKORO_VOICES: list[Voice] = [
    Voice(id="af_heart", name="Heart (US, female)", lang_code="a", gender="female"),
    Voice(id="af_bella", name="Bella (US, female)", lang_code="a", gender="female"),
    Voice(id="af_nicole", name="Nicole (US, female)", lang_code="a", gender="female"),
    Voice(id="af_sarah", name="Sarah (US, female)", lang_code="a", gender="female"),
    Voice(id="am_michael", name="Michael (US, male)", lang_code="a", gender="male"),
    Voice(id="am_adam", name="Adam (US, male)", lang_code="a", gender="male"),
    Voice(id="am_fenrir", name="Fenrir (US, male)", lang_code="a", gender="male"),
    Voice(id="bf_emma", name="Emma (UK, female)", lang_code="b", gender="female"),
    Voice(id="bf_isabella", name="Isabella (UK, female)", lang_code="b", gender="female"),
    Voice(id="bm_george", name="George (UK, male)", lang_code="b", gender="male"),
    Voice(id="bm_lewis", name="Lewis (UK, male)", lang_code="b", gender="male"),
]


class KokoroEngine:
    sample_rate = 24000

    def __init__(self) -> None:
        self._pipelines: dict[str, object] = {}
        # KPipeline isn't safe to call concurrently; serialize synthesis. Streams run in
        # a threadpool, so concurrent requests would otherwise share one pipeline.
        self._lock = threading.Lock()

    def _pipeline(self, lang_code: str):
        if lang_code not in self._pipelines:
            # Imported lazily so the rest of the app (parsing, API wiring) works without
            # torch/kokoro installed, and so model load happens on first use.
            from kokoro import KPipeline

            logger.info("Initializing Kokoro KPipeline for lang_code=%s", lang_code)
            self._pipelines[lang_code] = KPipeline(lang_code=lang_code)
        return self._pipelines[lang_code]

    def voices(self) -> list[Voice]:
        return KOKORO_VOICES

    def synthesize(self, text: str, voice: str, lang_code: str) -> np.ndarray:
        text = text.strip()
        if not text:
            return np.zeros(0, dtype=np.float32)

        with self._lock:
            pipeline = self._pipeline(lang_code)
            chunks: list[np.ndarray] = []
            for _graphemes, _phonemes, audio in pipeline(text, voice=voice):
                chunks.append(_to_numpy(audio))

        if not chunks:
            return np.zeros(0, dtype=np.float32)
        return np.concatenate(chunks).astype(np.float32)


def _to_numpy(audio) -> np.ndarray:
    # Kokoro may return a torch tensor or a numpy array depending on version.
    if hasattr(audio, "detach"):
        audio = audio.detach().cpu().numpy()
    return np.asarray(audio, dtype=np.float32)
