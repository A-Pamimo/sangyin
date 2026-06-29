"""Shared parsing helpers: text cleanup, sentence segmentation, Document assembly.

All format extractors return a list of ``(chapter_title, chapter_text)`` raw blocks;
this module is responsible for turning those into a normalized :class:`Document` with
stable, document-wide sentence indices so the client and server agree on what
"sentence 42" means (which is what keeps highlighting in sync with audio).
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from ..models import Chapter, Document, Sentence, SourceType

_WHITESPACE_RE = re.compile(r"[ \t\f\v]+")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")


def clean_text(text: str) -> str:
    """Collapse runaway whitespace while preserving paragraph breaks."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _WHITESPACE_RE.sub(" ", text)
    text = _MULTI_NEWLINE_RE.sub("\n\n", text)
    return text.strip()


_segmenter = None


def segment_sentences(text: str) -> list[str]:
    """Split text into sentences using pysbd, with a regex fallback."""
    text = text.strip()
    if not text:
        return []
    global _segmenter
    try:
        if _segmenter is None:
            import pysbd

            _segmenter = pysbd.Segmenter(language="en", clean=False)
        return [s.strip() for s in _segmenter.segment(text) if s.strip()]
    except Exception:
        # Fallback: naive split on sentence-ending punctuation followed by whitespace.
        parts = re.split(r"(?<=[.!?])\s+", text)
        return [p.strip() for p in parts if p.strip()]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_document(
    title: str,
    source_type: SourceType,
    raw_chapters: list[tuple[str, str]],
) -> Document:
    """Assemble a Document from raw (title, text) chapter blocks.

    Sentence indices are assigned globally across all chapters so a single counter
    addresses any sentence in the document.
    """
    chapters: list[Chapter] = []
    counter = 0
    for ch_index, (ch_title, ch_text) in enumerate(raw_chapters):
        sentences = [
            Sentence(index=counter + i, text=s)
            for i, s in enumerate(segment_sentences(clean_text(ch_text)))
        ]
        if not sentences:
            continue
        counter += len(sentences)
        chapters.append(
            Chapter(
                id=str(uuid.uuid4()),
                title=ch_title.strip() or f"Section {ch_index + 1}",
                index=len(chapters),
                sentences=sentences,
            )
        )

    if not chapters:
        # Always return at least an empty chapter so the client has something to show.
        chapters = [Chapter(id=str(uuid.uuid4()), title=title, index=0, sentences=[])]

    return Document(
        id=str(uuid.uuid4()),
        title=title.strip() or "Untitled",
        source_type=source_type,
        chapters=chapters,
        created_at=now_iso(),
    )
