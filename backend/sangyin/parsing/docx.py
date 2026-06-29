"""DOCX parsing via python-docx.

Word documents often use "Heading 1" styles to mark sections, so we split chapters on
top-level headings when they exist; otherwise the whole document is one chapter.
"""

from __future__ import annotations

import io

from ..models import Document
from .base import build_document


def parse_docx_bytes(content: bytes, title: str) -> Document:
    import docx

    document = docx.Document(io.BytesIO(content))

    raw_chapters: list[tuple[str, str]] = []
    current_title = title
    current_lines: list[str] = []

    def flush() -> None:
        if current_lines:
            raw_chapters.append((current_title, "\n".join(current_lines)))

    for para in document.paragraphs:
        text = para.text.strip()
        style = (para.style.name or "").lower() if para.style else ""
        if style.startswith("heading 1") and text:
            flush()
            current_title = text
            current_lines = []
        elif text:
            current_lines.append(text)

    flush()

    if not raw_chapters:
        raw_chapters = [(title, "")]

    return build_document(title=title, source_type="docx", raw_chapters=raw_chapters)
