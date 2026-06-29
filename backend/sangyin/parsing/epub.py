"""EPUB parsing via ebooklib + BeautifulSoup.

EPUBs do carry real structure, so we walk the spine (reading order) and emit one chapter
per document item, using the first heading (or the spine title) as the chapter title.
"""

from __future__ import annotations

import io

from ..models import Document
from .base import build_document


def parse_epub_bytes(content: bytes, title: str) -> Document:
    import ebooklib
    from bs4 import BeautifulSoup
    from ebooklib import epub

    book = epub.read_epub(io.BytesIO(content))

    meta_title = title
    try:
        dc_title = book.get_metadata("DC", "title")
        if dc_title and dc_title[0] and dc_title[0][0].strip():
            meta_title = dc_title[0][0].strip()
    except Exception:
        pass

    raw_chapters: list[tuple[str, str]] = []
    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_content(), "html.parser")

        for tag in soup(["script", "style", "nav"]):
            tag.decompose()

        heading = soup.find(["h1", "h2", "h3"])
        ch_title = heading.get_text(strip=True) if heading else ""

        text = soup.get_text(separator="\n")
        if text.strip():
            raw_chapters.append((ch_title or f"Chapter {len(raw_chapters) + 1}", text))

    return build_document(title=meta_title, source_type="epub", raw_chapters=raw_chapters)
