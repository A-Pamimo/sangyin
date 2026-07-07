"""Chatterbox TTS sidecar.

Chatterbox (Resemble AI, MIT) is a ~0.5B open model that rivals ElevenLabs, but
it pins torch/numpy/transformers versions that clash with the main backend. So it
runs here in its own environment (.venv-chatterbox) as a small GPU service, and
the main backend calls it over HTTP — no dependency clash, backend untouched.

Run it in the isolated venv:
  backend/.venv-chatterbox/Scripts/python.exe backend/tts_sidecar.py
(honours CHATTERBOX_PORT, default 8091).
"""

from __future__ import annotations

import io
import os

import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, Response
from pydantic import BaseModel

app = FastAPI(title="Chatterbox TTS sidecar")
_model = None


def _get_model():
    global _model
    if _model is None:
        from chatterbox.tts import ChatterboxTTS

        device = "cuda" if torch.cuda.is_available() else "cpu"
        _model = ChatterboxTTS.from_pretrained(device=device)
    return _model


class SynthRequest(BaseModel):
    text: str
    # Chatterbox expressivity knobs — defaults match the model's recommended values.
    exaggeration: float = 0.5
    cfg_weight: float = 0.5
    temperature: float = 0.8


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "cuda": torch.cuda.is_available()}


@app.get("/info")
def info() -> dict:
    return {"sample_rate": int(_get_model().sr)}


@app.post("/synthesize")
def synthesize(req: SynthRequest) -> Response:
    model = _get_model()
    text = req.text.strip()
    if not text:
        return Response(content=b"", media_type="audio/wav")
    with torch.inference_mode():
        wav = model.generate(
            text,
            exaggeration=req.exaggeration,
            cfg_weight=req.cfg_weight,
            temperature=req.temperature,
        )
    arr = wav.squeeze().detach().cpu().numpy().astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, arr, int(model.sr), format="WAV", subtype="FLOAT")
    return Response(content=buf.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn

    # Warm the model up front so the first request isn't slow and GPU issues fail fast.
    _get_model()
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("CHATTERBOX_PORT", "8091")))
