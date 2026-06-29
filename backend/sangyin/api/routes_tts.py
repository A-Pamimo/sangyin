"""Streaming TTS endpoint — the core of the app.

``POST /tts/stream`` returns ``application/x-ndjson``: one JSON line per synthesized
sentence, so the client can start playback after the first sentence instead of waiting
for the whole document. Each line carries the sentence ``index`` (matching the parsed
document) so the client can highlight the active sentence in sync with audio.

Synthesizing per-sentence (rather than handing the whole chapter to Kokoro at once) is
what keeps audio chunks aligned 1:1 with the sentence indices used for highlighting.
"""

from __future__ import annotations

import base64
import json
from typing import Iterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..config import get_settings
from ..models import Sentence, TTSRequest
from ..parsing.base import segment_sentences, clean_text
from ..storage import get_store
from ..tts import encode_wav_bytes, get_engine

router = APIRouter(prefix="/tts", tags=["tts"])


def _resolve_sentences(req: TTSRequest) -> tuple[list[Sentence], str | None, str | None]:
    """Return (sentences, document_id, chapter_id) for the request.

    Either a stored (document_id [+ chapter_id]) or raw ``text`` must be provided.
    """
    if req.document_id:
        doc = get_store().get(req.document_id)
        if doc is None:
            raise HTTPException(status_code=404, detail="Document not found")
        if req.chapter_id:
            chapter = next((c for c in doc.chapters if c.id == req.chapter_id), None)
            if chapter is None:
                raise HTTPException(status_code=404, detail="Chapter not found")
            return chapter.sentences, doc.id, chapter.id
        # No chapter specified: read the whole document in order.
        all_sentences = [s for c in doc.chapters for s in c.sentences]
        return all_sentences, doc.id, None

    if req.text and req.text.strip():
        sentences = [
            Sentence(index=i, text=s)
            for i, s in enumerate(segment_sentences(clean_text(req.text)))
        ]
        return sentences, None, None

    raise HTTPException(status_code=422, detail="Provide either document_id or text")


@router.post("/stream")
def stream_tts(req: TTSRequest) -> StreamingResponse:
    settings = get_settings()
    engine = get_engine()
    store = get_store()

    voice = req.voice or settings.default_voice
    lang_code = req.lang_code or settings.default_lang_code
    sentences, doc_id, chapter_id = _resolve_sentences(req)

    # Resume: start synthesizing from a given sentence index instead of the top.
    if req.start_index is not None:
        sentences = [s for s in sentences if s.index >= req.start_index]

    def generate() -> Iterator[str]:
        for sentence in sentences:
            text = sentence.text.strip()
            if not text:
                continue

            wav_bytes: bytes | None = None
            # Reuse cached audio when available (also powers offline playback).
            if doc_id and chapter_id:
                wav_bytes = store.read_cached_chunk(doc_id, chapter_id, voice, sentence.index)

            if wav_bytes is None:
                audio = engine.synthesize(text, voice=voice, lang_code=lang_code)
                wav_bytes = encode_wav_bytes(audio, engine.sample_rate)
                if doc_id and chapter_id:
                    store.write_cached_chunk(doc_id, chapter_id, voice, sentence.index, wav_bytes)

            # Duration from PCM byte count: (bytes - 44 header) / 2 bytes-per-sample / rate.
            duration_sec = max(0.0, (len(wav_bytes) - 44) / 2 / engine.sample_rate)
            payload = {
                "index": sentence.index,
                "text": sentence.text,
                "sample_rate": engine.sample_rate,
                "duration_sec": round(duration_sec, 3),
                "audio_b64": base64.b64encode(wav_bytes).decode("ascii"),
            }
            yield json.dumps(payload) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
