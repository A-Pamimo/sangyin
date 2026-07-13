"""Map each sentence to its bounding boxes on the PDF page, so the reader can
highlight the spoken sentence on the rendered page (like it does in the text).

Word positions come from PyMuPDF for text PDFs, or from the OCR pass for scanned
ones. Both are normalized to 0-1 of the page size. Sentences are aligned to the
word stream by matching characters (same approach as the audio timing), then the
matched words are grouped into per-line rectangles.
"""

from __future__ import annotations

import re

_NORM_RE = re.compile(r"[^a-z0-9]+")


def _norm(s: str) -> str:
    return _NORM_RE.sub("", s.lower())


def text_pdf_words(content: bytes) -> list[list[dict]]:
    """Per-page word boxes (normalized 0-1) for a text-based PDF, via PyMuPDF."""
    import fitz

    pages: list[list[dict]] = []
    with fitz.open(stream=content, filetype="pdf") as doc:
        for page in doc:
            w = page.rect.width or 1.0
            h = page.rect.height or 1.0
            words = [
                {"text": tup[4], "bbox": [tup[0] / w, tup[1] / h, tup[2] / w, tup[3] / h]}
                for tup in page.get_text("words")
            ]
            pages.append(words)
    return pages


def _line_rects(bboxes: list[list[float]]) -> list[list[float]]:
    """Merge word boxes that sit on the same line into one rectangle per line."""
    rects: list[list[float]] = []
    cur: list[float] | None = None
    for x0, y0, x1, y1 in bboxes:
        if cur is not None and y0 < cur[3] and y1 > cur[1]:  # vertical overlap → same line
            cur = [min(cur[0], x0), min(cur[1], y0), max(cur[2], x1), max(cur[3], y1)]
        else:
            if cur is not None:
                rects.append(cur)
            cur = [x0, y0, x1, y1]
    if cur is not None:
        rects.append(cur)
    return [[round(v, 4) for v in r] for r in rects]


def compute_highlights(sentences, pages_words: list[list[dict]]) -> dict[int, dict]:
    """Return {sentence_index: {"page": p, "rects": [[x0,y0,x1,y1], ...]}}.

    Walks the ordered word stream, assigning words to each sentence by matching
    normalized characters. A sentence is anchored to the page of its first word.
    """
    stream: list[tuple[int, str, list[float]]] = []
    for page_idx, words in enumerate(pages_words):
        for w in words:
            stream.append((page_idx, w.get("text", ""), w.get("bbox", [0, 0, 0, 0])))

    out: dict[int, dict] = {}
    wi = 0
    n = len(stream)
    for sentence in sentences:
        target = _norm(sentence.text)
        if not target:
            continue
        acc = ""
        consumed: list[tuple[int, list[float]]] = []
        while wi < n and len(acc) < len(target):
            page_idx, wtext, bbox = stream[wi]
            wn = _norm(wtext)
            if wn:
                acc += wn
                consumed.append((page_idx, bbox))
            wi += 1
        if not consumed:
            continue
        page = consumed[0][0]
        rects = _line_rects([bb for (p, bb) in consumed if p == page])
        if rects:
            out[sentence.index] = {"page": page, "rects": rects}
    return out
