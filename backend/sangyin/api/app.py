"""FastAPI application factory."""

from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .. import __version__
from ..config import get_settings
from ..security import require_api_key
from .routes_documents import router as documents_router
from .routes_health import router as health_router
from .routes_tts import router as tts_router
from .routes_voices import router as voices_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Sangyin Backend", version=__version__)

    origins = settings.cors_origin_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        # Credentialed requests can't be combined with a wildcard origin per the CORS
        # spec; only enable credentials when origins are explicitly listed.
        allow_credentials=origins != ["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # /health stays open; everything else is gated by the (optional) API key.
    protected = [Depends(require_api_key)]
    app.include_router(health_router)
    app.include_router(voices_router, dependencies=protected)
    app.include_router(documents_router, dependencies=protected)
    app.include_router(tts_router, dependencies=protected)
    return app
