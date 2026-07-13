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
import logging
import re
import struct
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Iterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..config import get_settings
from ..models import Sentence, TTSRequest
from ..parsing.base import segment_sentences, clean_text, group_sentences
from ..storage import get_store
from ..tts import encode_wav_bytes, engine_name_for_voice, get_engine, get_engine_for_voice

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tts", tags=["tts"])

_NORM_RE = re.compile(r"[^a-z0-9]+")


def _norm(s: str) -> str:
    return _NORM_RE.sub("", s.lower())


def _wav_rate(wav_bytes: bytes, default: int = 24000) -> int:
    """Sample rate from a WAV header (bytes 24-28). Deriving duration from the clip
    itself means we never touch an engine's ``sample_rate`` on a cache-hit — which for
    the GPU engine would otherwise wake it just to serve already-cached audio."""
    if len(wav_bytes) >= 28:
        try:
            rate = struct.unpack("<I", wav_bytes[24:28])[0]
            if rate:
                return rate
        except Exception:
            pass
    return default


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


def _read_cached_group(store, doc_id, chapter_id, voice, group):
    """Return (wav_bytes, sentence_spans, duration) from the cache, or None on a miss.
    Never synthesizes — safe to call for the GPU voice without waking the GPU."""
    if not (doc_id and chapter_id):
        return None
    first_index = group[0].index
    wav_bytes = store.read_cached_chunk(doc_id, chapter_id, voice, first_index)
    if wav_bytes is None:
        return None
    meta = store.read_cached_meta(doc_id, chapter_id, voice, first_index)
    spans = meta.get("sentences") if meta else None
    total = max(0.0, (len(wav_bytes) - 44) / 2 / _wav_rate(wav_bytes))
    if not spans:  # cache hit without a sidecar (older cache)
        spans = _sentence_spans(group, [], total)
    return wav_bytes, spans, total


def _render_group(engine, store, doc_id, chapter_id, voice, lang_code, group):
    """Return (wav_bytes, sentence_spans, duration) for one phrase group, using the
    cache when present and populating it (audio + timing sidecar) otherwise. Shared
    by live streaming and background pre-generation."""
    cached = _read_cached_group(store, doc_id, chapter_id, voice, group)
    if cached is not None:
        return cached

    text = " ".join(s.text.strip() for s in group if s.text.strip())
    audio, words = _synthesize(engine, text, voice, lang_code)
    wav_bytes = encode_wav_bytes(audio, engine.sample_rate)
    total = max(0.0, (len(wav_bytes) - 44) / 2 / _wav_rate(wav_bytes))
    sentence_spans = _sentence_spans(group, words, total)
    if doc_id and chapter_id:
        first_index = group[0].index
        store.write_cached_chunk(doc_id, chapter_id, voice, first_index, wav_bytes)
        store.write_cached_meta(
            doc_id, chapter_id, voice, first_index, {"sentences": sentence_spans}
        )
    return wav_bytes, sentence_spans, total


@router.post("/stream")
def stream_tts(req: TTSRequest) -> StreamingResponse:
    settings = get_settings()
    store = get_store()

    voice = req.voice or settings.default_voice
    lang_code = req.lang_code or settings.default_lang_code
    engine_name = engine_name_for_voice(voice)
    is_natural = engine_name == settings.natural_engine
    engine = get_engine(engine_name)

    sentences, doc_id, chapter_id = _resolve_sentences(req)

    # The natural voice is the paid GPU: it never synthesizes live, only replays what
    # pre-generation has cached — which needs a stored document + chapter.
    if is_natural and not (doc_id and chapter_id):
        raise HTTPException(
            status_code=422,
            detail="The natural voice must be prepared per chapter before it can play.",
        )

    # Group into phrases over the *full* sentence list so group boundaries (and thus
    # cache keys) don't shift with the resume point.
    groups = group_sentences(sentences)

    # Resume: drop whole phrases that end before the resume point. Playback restarts at
    # the phrase containing start_index (at most a sentence or two of replay).
    if req.start_index is not None:
        groups = [g for g in groups if g[-1].index >= req.start_index]

    def generate() -> Iterator[str]:
        needs_prepare = False
        for group in groups:
            if not any(s.text.strip() for s in group):
                continue
            if is_natural:
                # Prepare-only: serve cached phrases; never call the GPU from /stream.
                cached = _read_cached_group(store, doc_id, chapter_id, voice, group)
                if cached is None:
                    needs_prepare = True
                    continue
                wav_bytes, sentence_spans, total = cached
            else:
                wav_bytes, sentence_spans, total = _render_group(
                    engine, store, doc_id, chapter_id, voice, lang_code, group
                )
            payload = {
                "index": group[0].index,
                "sentences": sentence_spans,
                "sample_rate": _wav_rate(wav_bytes),
                "duration_sec": round(total, 3),
                "audio_b64": base64.b64encode(wav_bytes).decode("ascii"),
            }
            yield json.dumps(payload) + "\n"
        if needs_prepare:
            # Some phrases aren't cached yet — signal the client to run "prepare".
            yield json.dumps({"needs_prepare": True}) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


# ---------------------------------------------------------------------------
# Background pre-generation: synthesize + cache a whole chapter up front, so slow
# but natural engines (e.g. Chatterbox) play back smoothly from cache instead of
# stalling live. Progress is tracked per (document, chapter, voice).
# ---------------------------------------------------------------------------

_pregen_exec = ThreadPoolExecutor(max_workers=1, thread_name_prefix="pregen")
_pregen: dict[str, dict] = {}
_pregen_lock = threading.Lock()


def _pregen_key(doc_id: str, chapter_id: str, voice: str) -> str:
    return f"{doc_id}|{chapter_id or ''}|{voice}"


def _groups_for(doc, chapter_id):
    chapter = next((c for c in doc.chapters if c.id == chapter_id), None) if chapter_id else None
    sentences = chapter.sentences if chapter else [s for c in doc.chapters for s in c.sentences]
    return group_sentences(sentences)


def _cached_count(store, doc_id, chapter_id, voice, groups) -> int:
    if not chapter_id:
        return 0
    return sum(
        1
        for g in groups
        if store.read_cached_chunk(doc_id, chapter_id, voice, g[0].index) is not None
    )


def _run_pregenerate(doc_id: str, chapter_id: str, voice: str, lang_code: str) -> None:
    key = _pregen_key(doc_id, chapter_id, voice)
    try:
        engine = get_engine_for_voice(voice)
        store = get_store()
        doc = store.get(doc_id)
        if doc is None:
            with _pregen_lock:
                _pregen[key] = {"total": 0, "done": 0, "status": "failed"}
            return
        groups = [g for g in _groups_for(doc, chapter_id) if any(s.text.strip() for s in g)]
        with _pregen_lock:
            _pregen[key] = {"total": len(groups), "done": 0, "status": "generating"}

        errors = 0

        def render_one(group) -> None:
            nonlocal errors
            ok = True
            try:
                _render_group(engine, store, doc_id, chapter_id, voice, lang_code, group)
            except Exception:
                logger.exception("pre-generate failed for %s group %s", doc_id, group[0].index)
                ok = False
            with _pregen_lock:
                if ok:
                    _pregen[key]["done"] += 1
                else:
                    errors += 1

        # One phrase at a time by default (pregen_concurrency=1) so a paid GPU can't
        # fan out into several billed containers from a single prepare.
        concurrency = max(1, get_settings().pregen_concurrency)
        if concurrency == 1 or len(groups) <= 1:
            for g in groups:
                render_one(g)
        else:
            with ThreadPoolExecutor(max_workers=concurrency, thread_name_prefix="pregen-w") as pool:
                list(pool.map(render_one, groups))

        # Report the true outcome: done only if everything cached; failed if any phrase
        # errored (e.g. the GPU is unavailable / spend-capped); else partial.
        with _pregen_lock:
            done = _cached_count(store, doc_id, chapter_id, voice, groups)
            _pregen[key]["done"] = done
            if done >= len(groups) and len(groups) > 0:
                _pregen[key]["status"] = "done"
            elif errors:
                _pregen[key]["status"] = "failed"
            else:
                _pregen[key]["status"] = "partial"
    except Exception:
        logger.exception("pre-generate crashed for %s", doc_id)
        with _pregen_lock:
            _pregen.setdefault(key, {"total": 0, "done": 0})["status"] = "failed"


def _cache_status(store, document_id: str, chapter_id: str, voice: str) -> dict:
    """Progress derived from the cache — the source of truth that survives restarts.
    `idle` only when nothing is cached; `partial` mid-way; `done` when complete. It is
    never `idle` for a partly-cached chapter, so a client can't be fooled into
    re-triggering a job that's already made progress."""
    doc = store.get(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    groups = [g for g in _groups_for(doc, chapter_id) if any(s.text.strip() for s in g)]
    total = len(groups)
    done = _cached_count(store, document_id, chapter_id, voice, groups)
    if total and done >= total:
        status = "done"
    elif done > 0:
        status = "partial"
    else:
        status = "idle"
    return {"total": total, "done": done, "status": status}


@router.post("/pregenerate")
def pregenerate(req: TTSRequest) -> dict:
    settings = get_settings()
    if not req.document_id:
        raise HTTPException(status_code=422, detail="document_id is required")
    store = get_store()
    voice = req.voice or settings.default_voice
    lang_code = req.lang_code or settings.default_lang_code
    key = _pregen_key(req.document_id, req.chapter_id or "", voice)
    with _pregen_lock:
        cur = _pregen.get(key)
        if cur and cur["status"] == "generating":
            return cur
    # Idempotent: if the chapter is already fully cached, never spin up the GPU.
    cache = _cache_status(store, req.document_id, req.chapter_id or "", voice)
    if cache["status"] == "done":
        with _pregen_lock:
            _pregen[key] = cache
        return cache
    with _pregen_lock:
        _pregen[key] = {"total": cache["total"], "done": cache["done"], "status": "generating"}
    _pregen_exec.submit(_run_pregenerate, req.document_id, req.chapter_id, voice, lang_code)
    return _pregen[key]


@router.get("/pregenerate/status")
def pregenerate_status(document_id: str, chapter_id: str = "", voice: str = "") -> dict:
    settings = get_settings()
    store = get_store()
    voice = voice or settings.default_voice
    key = _pregen_key(document_id, chapter_id, voice)
    with _pregen_lock:
        state = _pregen.get(key)
    if state and state["status"] == "generating":
        return state
    # No active job: report from the on-disk cache (survives restarts / redeploys).
    cache = _cache_status(store, document_id, chapter_id, voice)
    # Surface a failed job (e.g. the GPU is unavailable / spend-capped) so the client
    # can show a clear message instead of silently offering "prepare" again.
    if cache["status"] != "done" and state and state.get("status") == "failed":
        return {**cache, "status": "failed"}
    return cache
