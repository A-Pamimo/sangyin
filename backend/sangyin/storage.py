"""Persistence for parsed documents and generated audio.

Everything is stored as keyed blobs (see ``blobs.py``): documents as JSON, audio
clips per (document, chapter, voice, sentence index) so repeat/offline playback
doesn't re-run the model, plus original PDFs and OCR word boxes. The blob backend
is local files by default (trivially self-hostable) or Cloudflare R2 for cloud
deploys — this class doesn't care which.
"""

from __future__ import annotations

import json

from .blobs import BlobStore, make_blob_store, read_json
from .config import get_settings
from .models import Document, DocumentSummary


class DocumentStore:
    def __init__(self, blobs: BlobStore) -> None:
        self.blobs = blobs

    # ---- keys ---------------------------------------------------------------

    @staticmethod
    def _doc_key(doc_id: str) -> str:
        return f"documents/{doc_id}.json"

    @staticmethod
    def _audio_key(doc_id: str, chapter_id: str, voice: str, index: int, ext: str = "wav") -> str:
        return f"audio/{doc_id}/{chapter_id}/{voice}/{index}.{ext}"

    @staticmethod
    def _original_key(doc_id: str) -> str:
        return f"originals/{doc_id}.pdf"

    @staticmethod
    def _ocr_words_key(doc_id: str) -> str:
        return f"originals/{doc_id}.words.json"

    # ---- documents ----------------------------------------------------------

    def save(self, doc: Document) -> None:
        self.blobs.write(self._doc_key(doc.id), doc.model_dump_json().encode("utf-8"))

    def get(self, doc_id: str) -> Document | None:
        data = self.blobs.read(self._doc_key(doc_id))
        if data is None:
            return None
        try:
            return Document.model_validate_json(data)
        except Exception:
            return None

    def list(self) -> list[DocumentSummary]:
        summaries: list[DocumentSummary] = []
        for key in self.blobs.list("documents/"):
            if not key.endswith(".json"):
                continue
            data = self.blobs.read(key)
            if data is None:
                continue
            try:
                doc = Document.model_validate_json(data)
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
        existed = self.blobs.exists(self._doc_key(doc_id))
        self.blobs.delete(self._doc_key(doc_id))
        self.blobs.delete_prefix(f"audio/{doc_id}/")
        self.blobs.delete(self._original_key(doc_id))
        self.blobs.delete(self._ocr_words_key(doc_id))
        return existed

    # ---- original files (for the reader's PDF view) -------------------------

    def save_original_pdf(self, doc_id: str, content: bytes) -> None:
        self.blobs.write(self._original_key(doc_id), content)

    def read_original_pdf(self, doc_id: str) -> bytes | None:
        return self.blobs.read(self._original_key(doc_id))

    # Per-page OCR word boxes (for on-page sentence highlighting of scanned PDFs).
    def write_ocr_words(self, doc_id: str, data: dict) -> None:
        self.blobs.write(self._ocr_words_key(doc_id), json.dumps(data).encode("utf-8"))

    def read_ocr_words(self, doc_id: str) -> dict | None:
        return read_json(self.blobs, self._ocr_words_key(doc_id))

    # ---- audio cache --------------------------------------------------------

    def read_cached_chunk(self, doc_id: str, chapter_id: str, voice: str, index: int) -> bytes | None:
        return self.blobs.read(self._audio_key(doc_id, chapter_id, voice, index))

    def write_cached_chunk(
        self, doc_id: str, chapter_id: str, voice: str, index: int, wav_bytes: bytes
    ) -> None:
        self.blobs.write(self._audio_key(doc_id, chapter_id, voice, index), wav_bytes)

    # Sidecar JSON holding per-sentence timing for a cached phrase clip, so replays
    # keep the accurate (word-timestamp-derived) highlight offsets without re-synth.
    def read_cached_meta(
        self, doc_id: str, chapter_id: str, voice: str, index: int
    ) -> dict | None:
        return read_json(self.blobs, self._audio_key(doc_id, chapter_id, voice, index, "json"))

    def write_cached_meta(
        self, doc_id: str, chapter_id: str, voice: str, index: int, meta: dict
    ) -> None:
        self.blobs.write(
            self._audio_key(doc_id, chapter_id, voice, index, "json"),
            json.dumps(meta).encode("utf-8"),
        )


_store: DocumentStore | None = None


def get_store() -> DocumentStore:
    global _store
    if _store is None:
        _store = DocumentStore(make_blob_store(get_settings()))
    return _store
