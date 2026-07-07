"""Background OCR for scanned / vector-outlined PDFs.

Some PDFs carry no extractable text — their pages are scanned images or the text
was flattened to vector outlines. We render each page with PyMuPDF and OCR the
image: Tesseract when it's installed (fast, ~1-2s/page), otherwise a pip-only
fallback (rapidocr, much slower). OCR runs on a background worker so import
returns immediately; the document's text is filled in when it completes.
"""

from __future__ import annotations

import logging
import shutil
from concurrent.futures import ThreadPoolExecutor

from .config import get_settings
from .parsing.base import build_document
from .storage import get_store

logger = logging.getLogger(__name__)

# A single background worker — OCR is CPU-heavy, so serialize jobs rather than
# starving the TTS engine. Bump max_workers on a bigger box if needed.
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="ocr")
_rapid_engine: object | None = None
_rapid_tried = False


def _tesseract_available() -> bool:
    if shutil.which("tesseract"):
        return True
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def _rapidocr():
    global _rapid_engine, _rapid_tried
    if not _rapid_tried:
        _rapid_tried = True
        try:
            from rapidocr_onnxruntime import RapidOCR

            _rapid_engine = RapidOCR()
        except Exception:
            _rapid_engine = None
    return _rapid_engine


def ocr_available() -> bool:
    """True when some OCR engine can be used (Tesseract or the pip fallback)."""
    return _tesseract_available() or _rapidocr() is not None


def _page_arrays(content: bytes, max_pages: int, dpi: int):
    import fitz  # pymupdf
    import numpy as np

    doc = fitz.open(stream=content, filetype="pdf")
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        pm = page.get_pixmap(dpi=dpi, colorspace=fitz.csRGB, alpha=False)
        arr = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width, 3)
        yield arr


def ocr_pdf_pages(content: bytes, max_pages: int, dpi: int) -> list[str]:
    """Return per-page OCR text for a PDF's rendered pages."""
    use_tesseract = _tesseract_available()
    rapid = None if use_tesseract else _rapidocr()
    if not use_tesseract and rapid is None:
        return []

    if use_tesseract:
        import pytesseract

    pages: list[str] = []
    for arr in _page_arrays(content, max_pages, dpi):
        if use_tesseract:
            pages.append(pytesseract.image_to_string(arr) or "")
        else:
            result, _ = rapid(arr)
            pages.append(" ".join(line[1] for line in (result or [])))
    return pages


def enqueue_ocr(doc_id: str) -> None:
    """Schedule OCR for a stored document on the background worker."""
    _executor.submit(_run_ocr, doc_id)


def _run_ocr(doc_id: str) -> None:
    settings = get_settings()
    store = get_store()
    doc = store.get(doc_id)
    data = store.read_original_pdf(doc_id)
    if doc is None or data is None:
        return
    try:
        pages = ocr_pdf_pages(data, settings.ocr_max_pages, settings.ocr_dpi)
        text = "\n\n".join(p for p in pages if p.strip())
        if text.strip():
            built = build_document(
                title=doc.title, source_type="pdf", raw_chapters=[(doc.title, text)]
            )
            doc.chapters = built.chapters
            doc.ocr_status = "done"
            logger.info("OCR done for %s: %d sentences", doc_id, doc.n_sentences)
        else:
            doc.ocr_status = "failed"
            logger.info("OCR produced no text for %s", doc_id)
    except Exception:
        logger.exception("OCR failed for %s", doc_id)
        doc.ocr_status = "failed"
    store.save(doc)
