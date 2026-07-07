"""Chatterbox TTS on Modal — the same sidecar, but serverless on a cloud GPU.

Modal spins a GPU up only while synthesizing and scales to zero when idle, which
fits pre-generation (a bursty batch job) and keeps cost ~ generation time. It's
also the practical *free* GPU path: Modal's starter tier includes monthly credits,
whereas the DigitalOcean student credit excludes GPUs.

Deploy (needs a Modal account — `pip install modal`, `modal setup`):
    modal deploy backend/modal_chatterbox.py

Modal prints a URL like https://<you>--sangyin-chatterbox-web.modal.run — point the
main backend at it:
    SANGYIN_TTS_ENGINE=chatterbox
    SANGYIN_CHATTERBOX_URL=https://<you>--sangyin-chatterbox-web.modal.run
"""

from __future__ import annotations

import modal

# The image is a fresh Linux env, so Chatterbox's pinned torch/numpy don't clash
# with anything; PyPI's linux torch wheel is CUDA-enabled.
image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "chatterbox-tts",
    "fastapi[standard]",
    "soundfile",
)

app = modal.App("sangyin-chatterbox", image=image)

# Persist the downloaded model across cold starts so they stay fast.
hf_cache = modal.Volume.from_name("sangyin-hf-cache", create_if_missing=True)


@app.function(
    gpu="L4",  # 24 GB, cheap; Chatterbox (~0.5B) fits with room to spare
    volumes={"/root/.cache/huggingface": hf_cache},
    scaledown_window=300,  # keep the GPU warm 5 min after the last request, then to zero
    timeout=600,
)
@modal.asgi_app()
def web():
    import io

    import numpy as np
    import soundfile as sf
    import torch
    from fastapi import FastAPI, Response
    from pydantic import BaseModel

    fapp = FastAPI(title="Chatterbox (Modal)")
    _state: dict = {}

    def model():
        if "m" not in _state:
            from chatterbox.tts import ChatterboxTTS

            _state["m"] = ChatterboxTTS.from_pretrained(
                device="cuda" if torch.cuda.is_available() else "cpu"
            )
        return _state["m"]

    class SynthRequest(BaseModel):
        text: str
        exaggeration: float = 0.5
        cfg_weight: float = 0.5
        temperature: float = 0.8

    @fapp.get("/health")
    def health() -> dict:
        return {"status": "ok", "cuda": torch.cuda.is_available()}

    @fapp.get("/info")
    def info() -> dict:
        return {"sample_rate": int(model().sr)}

    @fapp.post("/synthesize")
    def synthesize(req: SynthRequest) -> Response:
        m = model()
        text = req.text.strip()
        if not text:
            return Response(content=b"", media_type="audio/wav")
        with torch.inference_mode():
            wav = m.generate(
                text,
                exaggeration=req.exaggeration,
                cfg_weight=req.cfg_weight,
                temperature=req.temperature,
            )
        arr = wav.squeeze().detach().cpu().numpy().astype(np.float32)
        buf = io.BytesIO()
        sf.write(buf, arr, int(m.sr), format="WAV", subtype="FLOAT")
        return Response(content=buf.getvalue(), media_type="audio/wav")

    return fapp
