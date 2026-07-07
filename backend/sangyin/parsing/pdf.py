"""PDF parsing via pypdf (BSD-licensed, fully permissive).

When the PDF carries a document outline (bookmarks / table of contents), we split it
into chapters by mapping each outline entry to its page range. PDFs without an outline
fall back to a single chapter, since page text alone has no reliable structure.
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

    pages: list[str] = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")

    # pypdf can't read every PDF's text; fall back to pdfminer, which handles more
    # font/encoding cases. (Truly image-only/scanned PDFs have no text either way.)
    if sum(len(p) for p in pages) < 40:
        mined = _pdfminer_pages(content, len(pages))
        if mined:
            pages = mined

    doc_title = meta_title or title
    chapters = _outline_chapters(reader, pages)
    if not chapters:
        text = "\n\n".join(p for p in pages if p.strip())
        chapters = [(doc_title, text)]

    return build_document(title=doc_title, source_type="pdf", raw_chapters=chapters)


def _pdfminer_pages(content: bytes, n_pages: int) -> list[str] | None:
    """Re-extract page text with pdfminer.six (more robust than pypdf on some PDFs).
    Returns per-page text aligned to ``n_pages``, or None if nothing usable."""
    try:
        from pdfminer.high_level import extract_text
    except Exception:
        return None
    try:
        text = extract_text(io.BytesIO(content)) or ""
    except Exception:
        return None
    if not text.strip():
        return None
    # pdfminer separates pages with a form-feed (\x0c).
    pages = text.split("\x0c")
    if n_pages and len(pages) > n_pages:
        pages = pages[:n_pages]
    return pages


def _outline_chapters(reader, pages: list[str]) -> list[tuple[str, str]] | None:
    """Build (title, text) chapters from the PDF outline, or None if unusable."""
    try:
        outline = reader.outline
    except Exception:
        return None

    entries: list[tuple[str, int]] = []

    def walk(items) -> None:
        for item in items:
            if isinstance(item, list):
                walk(item)  # nested sub-bookmarks
                continue
            title = getattr(item, "title", None)
            try:
                page = reader.get_destination_page_number(item)
            except Exception:
                page = None
            if title and page is not None and 0 <= page < len(pages):
                entries.append((str(title).strip(), int(page)))

    try:
        walk(outline or [])
    except Exception:
        return None

    # Need at least two anchors to be worth splitting.
    if len(entries) < 2:
        return None

    entries.sort(key=lambda e: e[1])

    chapters: list[tuple[str, str]] = []
    # Any front matter before the first bookmark.
    first_page = entries[0][1]
    if first_page > 0:
        front = "\n\n".join(p for p in pages[:first_page] if p.strip())
        if front.strip():
            chapters.append(("Front matter", front))

    for i, (ch_title, start) in enumerate(entries):
        end = entries[i + 1][1] if i + 1 < len(entries) else len(pages)
        text = "\n\n".join(p for p in pages[start:end] if p.strip())
        if text.strip():
            chapters.append((ch_title, text))

    return chapters or None
