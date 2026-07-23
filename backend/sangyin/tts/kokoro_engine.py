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

# The full English voice set from Kokoro v1.0. The model ships ~54 voices across 8
# languages; these are the English ones (lang codes "a" = American, "b" = British),
# which need no extra dependencies. ids must match Kokoro's voice files
# (see hf.co/hexgrad/Kokoro-82M/blob/main/VOICES.md). Other-language voices need
# their misaki language extras installed before being added here.
KOKORO_VOICES: list[Voice] = [
    # American female
    Voice(id="af_heart", name="Heart (US, female)", lang_code="a", gender="female"),
    Voice(id="af_bella", name="Bella (US, female)", lang_code="a", gender="female"),
    Voice(id="af_nicole", name="Nicole (US, female)", lang_code="a", gender="female"),
    Voice(id="af_aoede", name="Aoede (US, female)", lang_code="a", gender="female"),
    Voice(id="af_kore", name="Kore (US, female)", lang_code="a", gender="female"),
    Voice(id="af_sarah", name="Sarah (US, female)", lang_code="a", gender="female"),
    Voice(id="af_nova", name="Nova (US, female)", lang_code="a", gender="female"),
    Voice(id="af_sky", name="Sky (US, female)", lang_code="a", gender="female"),
    Voice(id="af_alloy", name="Alloy (US, female)", lang_code="a", gender="female"),
    Voice(id="af_jessica", name="Jessica (US, female)", lang_code="a", gender="female"),
    Voice(id="af_river", name="River (US, female)", lang_code="a", gender="female"),
    # American male
    Voice(id="am_michael", name="Michael (US, male)", lang_code="a", gender="male"),
    Voice(id="am_fenrir", name="Fenrir (US, male)", lang_code="a", gender="male"),
    Voice(id="am_puck", name="Puck (US, male)", lang_code="a", gender="male"),
    Voice(id="am_adam", name="Adam (US, male)", lang_code="a", gender="male"),
    Voice(id="am_echo", name="Echo (US, male)", lang_code="a", gender="male"),
    Voice(id="am_eric", name="Eric (US, male)", lang_code="a", gender="male"),
    Voice(id="am_liam", name="Liam (US, male)", lang_code="a", gender="male"),
    Voice(id="am_onyx", name="Onyx (US, male)", lang_code="a", gender="male"),
    Voice(id="am_santa", name="Santa (US, male)", lang_code="a", gender="male"),
    # British female
    Voice(id="bf_emma", name="Emma (UK, female)", lang_code="b", gender="female"),
    Voice(id="bf_isabella", name="Isabella (UK, female)", lang_code="b", gender="female"),
    Voice(id="bf_alice", name="Alice (UK, female)", lang_code="b", gender="female"),
    Voice(id="bf_lily", name="Lily (UK, female)", lang_code="b", gender="female"),
    # British male
    Voice(id="bm_george", name="George (UK, male)", lang_code="b", gender="male"),
    Voice(id="bm_lewis", name="Lewis (UK, male)", lang_code="b", gender="male"),
    Voice(id="bm_daniel", name="Daniel (UK, male)", lang_code="b", gender="male"),
    Voice(id="bm_fable", name="Fable (UK, male)", lang_code="b", gender="male"),
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
        return self.synthesize_timed(text, voice, lang_code)[0]

    def synthesize_timed(
        self, text: str, voice: str, lang_code: str
    ) -> tuple[np.ndarray, list[dict]]:
        """Synthesize ``text`` and return ``(audio, words)``.

        ``words`` is a flat list of ``{text, start, end}`` (seconds, absolute within
        the returned audio) from Kokoro's per-token timestamps — used to align the
        per-sentence highlight to the real spoken audio instead of estimating it.
        Timestamps may be absent on some runtimes; callers fall back gracefully.
        """
        text = text.strip()
        if not text:
            return np.zeros(0, dtype=np.float32), []

        with self._lock:
            pipeline = self._pipeline(lang_code)
            chunks: list[np.ndarray] = []
            words: list[dict] = []
            elapsed = 0.0  # start of the current segment within the concatenated audio
            for result in pipeline(text, voice=voice):
                audio = _to_numpy(result.audio)
                for tok in getattr(result, "tokens", None) or []:
                    start = getattr(tok, "start_ts", None)
                    end = getattr(tok, "end_ts", None)
                    ttext = (getattr(tok, "text", "") or "").strip()
                    if start is None or end is None or not ttext:
                        continue
                    words.append(
                        {"text": ttext, "start": elapsed + float(start), "end": elapsed + float(end)}
                    )
                chunks.append(audio)
                elapsed += len(audio) / self.sample_rate

        if not chunks:
            return np.zeros(0, dtype=np.float32), []
        return np.concatenate(chunks).astype(np.float32), words


def _to_numpy(audio) -> np.ndarray:
    # Kokoro may return a torch tensor or a numpy array depending on version.
    if hasattr(audio, "detach"):
        audio = audio.detach().cpu().numpy()
    return np.asarray(audio, dtype=np.float32)
