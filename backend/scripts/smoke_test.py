"""Standalone Phase-1 smoke test: paste text -> Kokoro -> playable WAV.

Verifies the text->audio slice without the API or the frontend. Run from backend/:

    python scripts/smoke_test.py "Hello from Sangyin." out.wav

Writes a WAV you can play, and prints per-sentence timing.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running as `python scripts/smoke_test.py` from the backend/ directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import soundfile as sf

from sangyin.parsing.base import clean_text, segment_sentences
from sangyin.tts import get_engine


def main() -> None:
    text = sys.argv[1] if len(sys.argv) > 1 else "Hello from Sangyin. This is open source text to speech."
    out_path = sys.argv[2] if len(sys.argv) > 2 else "out.wav"

    engine = get_engine()
    sentences = segment_sentences(clean_text(text))
    print(f"Segmented into {len(sentences)} sentence(s).")

    pieces = []
    for i, sentence in enumerate(sentences):
        audio = engine.synthesize(sentence, voice="af_heart", lang_code="a")
        dur = len(audio) / engine.sample_rate
        print(f"  [{i}] {dur:5.2f}s  {sentence[:60]!r}")
        pieces.append(audio)

    full = np.concatenate(pieces) if pieces else np.zeros(0, dtype=np.float32)
    sf.write(out_path, full, engine.sample_rate, subtype="PCM_16")
    print(f"Wrote {out_path} ({len(full) / engine.sample_rate:.2f}s @ {engine.sample_rate} Hz).")


if __name__ == "__main__":
    main()
