"""TTS engine interface.

Every engine turns a piece of text into a single mono float32 waveform. Keeping the
contract this small is deliberate: swapping Kokoro for Chatterbox/Orpheus later means
implementing one ``synthesize`` method and listing ``voices`` — nothing in ``api/`` or
``parsing/`` has to change.
"""

from __future__ import annotations

import base64
import io
from typing import Protocol, runtime_checkable

import numpy as np
import soundfile as sf

from ..models import Voice


@runtime_checkable
class TTSEngine(Protocol):
    #: Output sample rate in Hz (Kokoro is 24000).
    sample_rate: int

    def voices(self) -> list[Voice]:
        """Return the voices this engine can speak."""
        ...

    def synthesize(self, text: str, voice: str, lang_code: str) -> np.ndarray:
        """Synthesize ``text`` into a mono float32 waveform at ``sample_rate``."""
        ...


def encode_wav_bytes(audio: np.ndarray, sample_rate: int) -> bytes:
    """Encode a float32 mono waveform as 16-bit PCM WAV bytes."""
    buf = io.BytesIO()
    sf.write(buf, np.asarray(audio, dtype=np.float32), sample_rate, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def encode_wav_b64(audio: np.ndarray, sample_rate: int) -> str:
    """Encode a float32 mono waveform as base64 16-bit PCM WAV."""
    return base64.b64encode(encode_wav_bytes(audio, sample_rate)).decode("ascii")
