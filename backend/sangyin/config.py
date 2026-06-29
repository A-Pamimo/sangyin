"""Runtime configuration for the Sangyin backend.

All settings can be overridden with environment variables prefixed ``SANGYIN_``,
e.g. ``SANGYIN_TTS_ENGINE=kokoro`` or ``SANGYIN_PORT=9000``.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SANGYIN_", env_file=".env")

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    # Comma-separated list, or "*" for any origin (default is permissive for self-host).
    cors_origins: str = "*"

    # TTS
    tts_engine: str = "kokoro"
    default_voice: str = "af_heart"
    default_lang_code: str = "a"

    # Storage / cache (documents + generated audio)
    data_dir: Path = Path.home() / ".sangyin"

    @property
    def documents_dir(self) -> Path:
        return self.data_dir / "documents"

    @property
    def audio_cache_dir(self) -> Path:
        return self.data_dir / "audio"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
