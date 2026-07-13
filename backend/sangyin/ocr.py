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


def ocr_pdf_pages(content: bytes, max_pages: int, dpi: int) -> tuple[list[str], list[list[dict]]]:
    """OCR a PDF's rendered pages. Returns (pages_text, pages_words) where each
    word is ``{text, bbox:[x0,y0,x1,y1]}`` normalized to 0-1 of the page image —
    the boxes drive the reader's on-page sentence highlight."""
    use_tesseract = _tesseract_available()
    rapid = None if use_tesseract else _rapidocr()
    if not use_tesseract and rapid is None:
        return [], []

    if use_tesseract:
        import pytesseract
        from pytesseract import Output

    pages_text: list[str] = []
    pages_words: list[list[dict]] = []
    for arr in _page_arrays(content, max_pages, dpi):
        h_img, w_img = int(arr.shape[0]), int(arr.shape[1])
        words: list[dict] = []
        if use_tesseract:
            data = pytesseract.image_to_data(arr, output_type=Output.DICT)
            for i in range(len(data["text"])):
                txt = (data["text"][i] or "").strip()
                try:
                    conf = float(data["conf"][i])
                except (TypeError, ValueError):
                    conf = -1.0
                if not txt or conf < 0:
                    continue
                x, y, bw, bh = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
                words.append(
                    {"text": txt, "bbox": [x / w_img, y / h_img, (x + bw) / w_img, (y + bh) / h_img]}
                )
        else:
            result, _ = rapid(arr)
            for box, txt, *_rest in result or []:
                xs = [pt[0] for pt in box]
                ys = [pt[1] for pt in box]
                words.append(
                    {
                        "text": txt,
                        "bbox": [min(xs) / w_img, min(ys) / h_img, max(xs) / w_img, max(ys) / h_img],
                    }
                )
        pages_words.append(words)
        pages_text.append(" ".join(w["text"] for w in words))
    return pages_text, pages_words


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
        pages_text, pages_words = ocr_pdf_pages(data, settings.ocr_max_pages, settings.ocr_dpi)
        text = "\n\n".join(p for p in pages_text if p.strip())
        if text.strip():
            built = build_document(
                title=doc.title, source_type="pdf", raw_chapters=[(doc.title, text)]
            )
            doc.chapters = built.chapters
            doc.ocr_status = "done"
            # Persist word boxes so the reader can highlight the spoken sentence on
            # the page image (text PDFs get boxes from PyMuPDF on demand instead).
            store.write_ocr_words(doc_id, {"pages": pages_words})
            logger.info("OCR done for %s: %d sentences", doc_id, doc.n_sentences)
        else:
            doc.ocr_status = "failed"
            logger.info("OCR produced no text for %s", doc_id)
    except Exception:
        logger.exception("OCR failed for %s", doc_id)
        doc.ocr_status = "failed"
    store.save(doc)
