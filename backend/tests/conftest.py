"""Shared test fixtures.

Tests run fully offline: a FakeEngine stands in for Kokoro (no model download, no
torch), and each test gets an isolated on-disk data directory.
"""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from sangyin.models import Voice


class FakeEngine:
    """Deterministic stand-in for a TTSEngine — 0.1s of silence per call."""

    sample_rate = 24000

    def voices(self) -> list[Voice]:
        return [Voice(id="t_voice", name="Test Voice", lang_code="a", gender="female")]

    def synthesize(self, text: str, voice: str, lang_code: str) -> np.ndarray:
        return np.zeros(self.sample_rate // 10, dtype=np.float32)


def _build_client(monkeypatch, tmp_path, api_key: str = "") -> TestClient:
    monkeypatch.setenv("SANGYIN_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SANGYIN_API_KEY", api_key)

    # Reset cached settings + storage singletons so the env vars above take effect.
    import sangyin.config as config
    import sangyin.storage as storage

    config.get_settings.cache_clear()
    storage._store = None

    # Swap the real engine for the fake in the two routers that use it.
    engine = FakeEngine()
    import sangyin.api.routes_tts as routes_tts
    import sangyin.api.routes_voices as routes_voices

    monkeypatch.setattr(routes_tts, "get_engine", lambda: engine)
    monkeypatch.setattr(routes_voices, "get_engine", lambda: engine)

    from sangyin.api import create_app

    return TestClient(create_app())


@pytest.fixture
def client(monkeypatch, tmp_path) -> TestClient:
    return _build_client(monkeypatch, tmp_path)


@pytest.fixture
def make_client(monkeypatch, tmp_path):
    """Factory for tests that need a specific configuration (e.g. an API key)."""

    def _factory(api_key: str = "") -> TestClient:
        return _build_client(monkeypatch, tmp_path, api_key=api_key)

    return _factory
