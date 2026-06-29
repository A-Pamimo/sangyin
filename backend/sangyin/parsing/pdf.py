"""PDF parsing via pypdf (BSD-licensed, fully permissive).

PDFs rarely carry reliable chapter structure, so we extract all page text into a single
chapter. The document outline (bookmarks), when present, could later be used to split
chapters — left as a future enhancement to keep extraction predictable.
"""

from __future__ import annotations

import io

from ..models import Document
from .base import build_document


def parse_pdf_bytes(content: bytes, title: str) -> Document:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(content))

    meta_title = None
    if reader.metadata and reader.metadata.title:
        meta_title = str(reader.metadata.title).strip() or None

    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")

    text = "\n\n".join(p for p in pages if p.strip())
    return build_document(
        title=meta_title or title,
        source_type="pdf",
        raw_chapters=[(meta_title or title, text)],
    )
