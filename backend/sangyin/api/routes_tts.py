"""Streaming TTS endpoint — the core of the app.

``POST /tts/stream`` returns ``application/x-ndjson``: one JSON line per synthesized
*phrase* (a short group of consecutive sentences), so the client can start playback
after the first phrase instead of waiting for the whole document. Synthesizing a whole
phrase at once (rather than one sentence at a time) lets Kokoro carry intonation across
the phrase and avoids the stop-start gaps between per-sentence clips.

Each line still resolves to individual sentence indices for highlighting: the payload
carries a ``sentences`` array with each sentence's ``offset_sec`` into the phrase's
audio, so the client advances the highlight sub-clip as playback time crosses each
offset.
"""

from __future__ import annotations

import base64
import json
import re
from typing import Iterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..config import get_settings
from ..models import Sentence, TTSRequest
from ..parsing.base import segment_sentences, clean_text, group_sentences
from ..storage import get_store
from ..tts import encode_wav_bytes, get_engine

router = APIRouter(prefix="/tts", tags=["tts"])

_NORM_RE = re.compile(r"[^a-z0-9]+")


def _norm(s: str) -> str:
    return _NORM_RE.sub("", s.lower())


def _spans_from_words(
    group: list[Sentence], words: list[dict]
) -> list[tuple[float, float]] | None:
    """Derive (offset, duration) per sentence from Kokoro word timestamps.

    Walks the ordered word tokens, assigning them to each sentence by matching
    normalized characters, so a sentence's end time is the end of its last word.
    Returns None if there are no usable timings, so the caller can fall back to the
    character-proportional estimate.
    """
    if not words:
        return None
    spans: list[tuple[float, float]] = []
    wi = 0
    n = len(words)
    prev_end = 0.0
    for s in group:
        target = _norm(s.text)
        if not target:
            spans.append((round(prev_end, 3), 0.0))
            continue
        acc = ""
        seg_end = prev_end
        while wi < n and len(acc) < len(target):
            acc += _norm(words[wi]["text"])
            seg_end = float(words[wi]["end"])
            wi += 1
        dur = max(0.0, seg_end - prev_end)
        spans.append((round(prev_end, 3), round(dur, 3)))
        prev_end = seg_end
    return spans


def _synthesize(engine, text: str, voice: str, lang_code: str):
    """Return (audio, words). Uses the engine's timed API when present (Kokoro),
    otherwise falls back to plain synthesis with no word timings."""
    timed = getattr(engine, "synthesize_timed", None)
    if timed is not None:
        return timed(text, voice=voice, lang_code=lang_code)
    return engine.synthesize(text, voice=voice, lang_code=lang_code), []


def _sentence_spans(group: list[Sentence], words: list[dict], total: float) -> list[dict]:
    """Per-sentence highlight spans: real word timings when available, else an
    estimate apportioned by text length."""
    tuples = _spans_from_words(group, words)
    if tuples is None:
        char_lens = [max(1, len(s.text.strip())) for s in group]
        total_chars = sum(char_lens)
        acc = 0.0
        tuples = []
        for clen in char_lens:
            dur = total * clen / total_chars
            tuples.append((round(acc, 3), round(dur, 3)))
            acc += dur
    return [
        {"index": s.index, "text": s.text, "offset_sec": off, "duration_sec": dur}
        for s, (off, dur) in zip(group, tuples)
    ]


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

    # Group into phrases over the *full* sentence list so group boundaries (and thus
    # cache keys) don't shift with the resume point.
    groups = group_sentences(sentences)

    # Resume: drop whole phrases that end before the resume point. Playback restarts at
    # the phrase containing start_index (at most a sentence or two of replay).
    if req.start_index is not None:
        groups = [g for g in groups if g[-1].index >= req.start_index]

    def generate() -> Iterator[str]:
        for group in groups:
            text = " ".join(s.text.strip() for s in group if s.text.strip())
            if not text:
                continue

            first_index = group[0].index
            wav_bytes: bytes | None = None
            sentence_spans: list[dict] | None = None
            # Reuse cached audio + timing when available (also powers offline playback).
            # Keyed by the phrase's first sentence index.
            if doc_id and chapter_id:
                wav_bytes = store.read_cached_chunk(doc_id, chapter_id, voice, first_index)
                if wav_bytes is not None:
                    meta = store.read_cached_meta(doc_id, chapter_id, voice, first_index)
                    if meta:
                        sentence_spans = meta.get("sentences")

            if wav_bytes is None:
                audio, words = _synthesize(engine, text, voice, lang_code)
                wav_bytes = encode_wav_bytes(audio, engine.sample_rate)
                total = max(0.0, (len(wav_bytes) - 44) / 2 / engine.sample_rate)
                sentence_spans = _sentence_spans(group, words, total)
                if doc_id and chapter_id:
                    store.write_cached_chunk(doc_id, chapter_id, voice, first_index, wav_bytes)
                    store.write_cached_meta(
                        doc_id, chapter_id, voice, first_index, {"sentences": sentence_spans}
                    )

            # Duration from PCM byte count: (bytes - 44 header) / 2 bytes-per-sample / rate.
            total = max(0.0, (len(wav_bytes) - 44) / 2 / engine.sample_rate)
            if sentence_spans is None:  # cache hit without a sidecar (older cache)
                sentence_spans = _sentence_spans(group, [], total)

            payload = {
                "index": first_index,
                "sentences": sentence_spans,
                "sample_rate": engine.sample_rate,
                "duration_sec": round(total, 3),
                "audio_b64": base64.b64encode(wav_bytes).decode("ascii"),
            }
            yield json.dumps(payload) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
