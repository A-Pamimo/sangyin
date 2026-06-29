"""Sangyin backend entrypoint.

Run directly (``python main.py``) or via uvicorn (``uvicorn main:app``).
"""

from __future__ import annotations

import uvicorn

from sangyin.api import create_app
from sangyin.config import get_settings

app = create_app()


def main() -> None:
    settings = get_settings()
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=False)


if __name__ == "__main__":
    main()
