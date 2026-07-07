"""On-disk persistence for parsed documents and generated audio.

Documents are stored as JSON (one file per document). Generated audio chunks are cached
per (document, chapter, voice, sentence index) so repeat playback — and mobile offline
playback — does not re-run the model. The store is intentionally file-based so the
backend stays trivially self-hostable with no external database.
"""

from __future__ import annotations

import json
from pathlib import Path

from .config import get_settings
from .models import Document, DocumentSummary


class DocumentStore:
    def __init__(self, documents_dir: Path, audio_dir: Path, originals_dir: Path) -> None:
        self.documents_dir = documents_dir
        self.audio_dir = audio_dir
        self.originals_dir = originals_dir
        self.documents_dir.mkdir(parents=True, exist_ok=True)
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self.originals_dir.mkdir(parents=True, exist_ok=True)

    # ---- documents ----------------------------------------------------------

    def _doc_path(self, doc_id: str) -> Path:
        return self.documents_dir / f"{doc_id}.json"

    def save(self, doc: Document) -> None:
        self._doc_path(doc.id).write_text(doc.model_dump_json(), encoding="utf-8")

    def get(self, doc_id: str) -> Document | None:
        path = self._doc_path(doc_id)
        if not path.exists():
            return None
        return Document.model_validate_json(path.read_text(encoding="utf-8"))

    def list(self) -> list[DocumentSummary]:
        summaries: list[DocumentSummary] = []
        for path in self.documents_dir.glob("*.json"):
            try:
                doc = Document.model_validate_json(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            summaries.append(
                DocumentSummary(
                    id=doc.id,
                    title=doc.title,
                    source_type=doc.source_type,
                    n_sentences=doc.n_sentences,
                    created_at=doc.created_at,
                )
            )
        summaries.sort(key=lambda s: s.created_at, reverse=True)
        return summaries

    def delete(self, doc_id: str) -> bool:
        path = self._doc_path(doc_id)
        existed = path.exists()
        path.unlink(missing_ok=True)
        # Drop any cached audio for this document.
        doc_audio = self.audio_dir / doc_id
        if doc_audio.exists():
            for f in doc_audio.rglob("*"):
                if f.is_file():
                    f.unlink(missing_ok=True)
        # Drop the stored original file + OCR word boxes, if any.
        self.original_pdf_path(doc_id).unlink(missing_ok=True)
        self._ocr_words_path(doc_id).unlink(missing_ok=True)
        return existed

    # ---- original files (for the reader's PDF view) -------------------------

    def original_pdf_path(self, doc_id: str) -> Path:
        return self.originals_dir / f"{doc_id}.pdf"

    def save_original_pdf(self, doc_id: str, content: bytes) -> None:
        self.original_pdf_path(doc_id).write_bytes(content)

    def read_original_pdf(self, doc_id: str) -> bytes | None:
        path = self.original_pdf_path(doc_id)
        return path.read_bytes() if path.exists() else None

    # Per-page OCR word boxes (for on-page sentence highlighting of scanned PDFs).
    def _ocr_words_path(self, doc_id: str) -> Path:
        return self.originals_dir / f"{doc_id}.words.json"

    def write_ocr_words(self, doc_id: str, data: dict) -> None:
        self._ocr_words_path(doc_id).write_text(json.dumps(data), encoding="utf-8")

    def read_ocr_words(self, doc_id: str) -> dict | None:
        path = self._ocr_words_path(doc_id)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None

    # ---- audio cache --------------------------------------------------------

    def audio_chunk_path(self, doc_id: str, chapter_id: str, voice: str, index: int) -> Path:
        return self.audio_dir / doc_id / chapter_id / voice / f"{index}.wav"

    def read_cached_chunk(self, doc_id: str, chapter_id: str, voice: str, index: int) -> bytes | None:
        path = self.audio_chunk_path(doc_id, chapter_id, voice, index)
        if path.exists():
            return path.read_bytes()
        return None

    def write_cached_chunk(
        self, doc_id: str, chapter_id: str, voice: str, index: int, wav_bytes: bytes
    ) -> None:
        path = self.audio_chunk_path(doc_id, chapter_id, voice, index)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(wav_bytes)

    # Sidecar JSON holding per-sentence timing for a cached phrase clip, so replays
    # keep the accurate (word-timestamp-derived) highlight offsets without re-synth.
    def _meta_path(self, doc_id: str, chapter_id: str, voice: str, index: int) -> Path:
        return self.audio_chunk_path(doc_id, chapter_id, voice, index).with_suffix(".json")

    def read_cached_meta(
        self, doc_id: str, chapter_id: str, voice: str, index: int
    ) -> dict | None:
        path = self._meta_path(doc_id, chapter_id, voice, index)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None

    def write_cached_meta(
        self, doc_id: str, chapter_id: str, voice: str, index: int, meta: dict
    ) -> None:
        path = self._meta_path(doc_id, chapter_id, voice, index)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(meta), encoding="utf-8")


_store: DocumentStore | None = None


def get_store() -> DocumentStore:
    global _store
    if _store is None:
        settings = get_settings()
        _store = DocumentStore(
            settings.documents_dir, settings.audio_cache_dir, settings.originals_dir
        )
    return _store
