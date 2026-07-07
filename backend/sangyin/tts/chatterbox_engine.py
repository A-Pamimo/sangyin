"""Chatterbox engine — a thin HTTP client for the GPU sidecar (backend/tts_sidecar.py).

The heavy model runs in its own process/venv on the GPU; here we just POST text and
decode the returned WAV, so this conforms to the same TTSEngine protocol as Kokoro
with none of Chatterbox's conflicting dependencies in the main backend.
"""

from __future__ import annotations

import io
import json
import urllib.request

import numpy as np
import soundfile as sf

from ..models import Voice


class ChatterboxEngine:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.sample_rate = self._fetch_sample_rate()

    def _fetch_sample_rate(self) -> int:
        try:
            with urllib.request.urlopen(self.base_url + "/info", timeout=180) as r:
                return int(json.loads(r.read()).get("sample_rate", 24000))
        except Exception:
            return 24000

    def voices(self) -> list[Voice]:
        # Chatterbox uses one built-in voice (cloning from a reference is a later add).
        return [Voice(id="default", name="Chatterbox — natural", lang_code="a", gender="female")]

    def synthesize(self, text: str, voice: str, lang_code: str) -> np.ndarray:
        text = text.strip()
        if not text:
            return np.zeros(0, dtype=np.float32)
        payload = json.dumps({"text": text}).encode("utf-8")
        req = urllib.request.Request(
            self.base_url + "/synthesize",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=600) as r:
            wav_bytes = r.read()
        arr, _sr = sf.read(io.BytesIO(wav_bytes), dtype="float32")
        if arr.ndim > 1:
            arr = arr.mean(axis=1)
        return np.asarray(arr, dtype=np.float32)
