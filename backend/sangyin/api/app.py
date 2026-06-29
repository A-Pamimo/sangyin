"""FastAPI application factory."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .. import __version__
from ..config import get_settings
from .routes_documents import router as documents_router
from .routes_health import router as health_router
from .routes_tts import router as tts_router
from .routes_voices import router as voices_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Sangyin Backend", version=__version__)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(voices_router)
    app.include_router(documents_router)
    app.include_router(tts_router)
    return app
