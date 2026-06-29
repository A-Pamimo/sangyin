"""Plain text and pasted-text parsing."""

from __future__ import annotations

from ..models import Document
from .base import build_document


def parse_txt_bytes(content: bytes, title: str) -> Document:
    text = _decode(content)
    return build_document(title=title, source_type="txt", raw_chapters=[(title, text)])


def parse_pasted_text(text: str, title: str | None) -> Document:
    title = title or _first_line_title(text)
    return build_document(title=title, source_type="text", raw_chapters=[(title, text)])


def _decode(content: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def _first_line_title(text: str) -> str:
    for line in text.splitlines():
        line = line.strip()
        if line:
            return line[:80]
    return "Pasted text"
