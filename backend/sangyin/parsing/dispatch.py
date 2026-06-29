"""Route an upload / paste / URL to the right format parser."""

from __future__ import annotations

import os

from ..models import Document
from .docx import parse_docx_bytes
from .epub import parse_epub_bytes
from .pdf import parse_pdf_bytes
from .txt import parse_pasted_text, parse_txt_bytes
from .url import parse_article_url


def parse_upload(filename: str, content: bytes) -> Document:
    ext = os.path.splitext(filename)[1].lower().lstrip(".")
    title = os.path.splitext(os.path.basename(filename))[0] or "Untitled"

    if ext == "pdf":
        return parse_pdf_bytes(content, title)
    if ext == "epub":
        return parse_epub_bytes(content, title)
    if ext == "docx":
        return parse_docx_bytes(content, title)
    if ext in ("txt", "md", "text"):
        return parse_txt_bytes(content, title)
    raise ValueError(f"Unsupported file type: .{ext}")


def parse_text(text: str, title: str | None = None) -> Document:
    return parse_pasted_text(text, title)


def parse_url(url: str) -> Document:
    return parse_article_url(url)
