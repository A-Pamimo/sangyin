"""URL article extraction via trafilatura (strips nav/ads/boilerplate)."""

from __future__ import annotations

from ..models import Document
from .base import build_document


def parse_article_url(url: str) -> Document:
    import trafilatura

    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise ValueError(f"Could not fetch URL: {url}")

    text = trafilatura.extract(
        downloaded,
        include_comments=False,
        include_tables=False,
        favor_precision=True,
    )
    if not text or not text.strip():
        raise ValueError(f"Could not extract readable article text from: {url}")

    title = url
    try:
        meta = trafilatura.extract_metadata(downloaded)
        if meta and meta.title:
            title = meta.title.strip()
    except Exception:
        pass

    return build_document(title=title, source_type="url", raw_chapters=[(title, text)])
