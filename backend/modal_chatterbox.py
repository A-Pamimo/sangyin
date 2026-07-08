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
    # Stay warm 20 min after the last request so a listening session doesn't keep
    # re-paying the cold start; still scales to zero when genuinely idle.
    scaledown_window=1200,
    timeout=600,
    # Allow several containers so parallel pre-generation (SANGYIN_PREGEN_CONCURRENCY)
    # actually fans out instead of queueing on one GPU.
    max_containers=6,
)
@modal.asgi_app()
def web():
    import io

    import numpy as np
    import soundfile as sf
    import torch
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse, Response
    from starlette.routing import Route

    # We use Starlette directly instead of FastAPI: chatterbox-tts pins an older
    # pydantic than fastapi wants, and the clash breaks FastAPI's request-parameter
    # detection (it mis-reads the request body as a missing query field → HTTP 422).
    # Starlette has no such layer — the handler always just receives the request.
    _state: dict = {}

    def model():
        if "m" not in _state:
            # Chatterbox instantiates perth.PerthImplicitWatermarker() at init. That
            # class imports as None in this image (a missing perth sub-dependency),
            # which crashes model load. We don't need the watermark, so stub it with
            # a pass-through before importing Chatterbox.
            import perth

            if getattr(perth, "PerthImplicitWatermarker", None) is None:
                class _NoopWatermarker:
                    def apply_watermark(self, wav, sample_rate=None, **kwargs):
                        return wav

                perth.PerthImplicitWatermarker = _NoopWatermarker

            from chatterbox.tts import ChatterboxTTS

            _state["m"] = ChatterboxTTS.from_pretrained(
                device="cuda" if torch.cuda.is_available() else "cpu"
            )
        return _state["m"]

    async def health(request):
        return JSONResponse({"status": "ok", "cuda": torch.cuda.is_available()})

    async def info(request):
        return JSONResponse({"sample_rate": int(model().sr)})

    async def synthesize(request):
        body = await request.json()
        text = str(body.get("text", "")).strip()
        if not text:
            return Response(content=b"", media_type="audio/wav")
        m = model()
        with torch.inference_mode():
            wav = m.generate(
                text,
                exaggeration=float(body.get("exaggeration", 0.5)),
                cfg_weight=float(body.get("cfg_weight", 0.5)),
                temperature=float(body.get("temperature", 0.8)),
            )
        arr = wav.squeeze().detach().cpu().numpy().astype(np.float32)
        buf = io.BytesIO()
        sf.write(buf, arr, int(m.sr), format="WAV", subtype="FLOAT")
        return Response(content=buf.getvalue(), media_type="audio/wav")

    return Starlette(
        routes=[
            Route("/health", health),
            Route("/info", info),
            Route("/synthesize", synthesize, methods=["POST"]),
        ]
    )
