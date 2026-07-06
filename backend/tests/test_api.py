"""API tests via TestClient with a fake TTS engine (offline, no model)."""

from __future__ import annotations

import base64
import json


def _ndjson(resp):
    return [json.loads(line) for line in resp.text.splitlines() if line.strip()]


def test_health_open_and_reports_engine(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_voices(client):
    r = client.get("/voices")
    assert r.status_code == 200
    assert r.json()[0]["id"] == "t_voice"


def test_document_crud(client):
    r = client.post("/documents/text", json={"text": "One. Two.", "title": "Demo"})
    assert r.status_code == 200
    doc = r.json()
    doc_id = doc["id"]
    assert doc["title"] == "Demo"

    assert any(d["id"] == doc_id for d in client.get("/documents").json())
    assert client.get(f"/documents/{doc_id}").status_code == 200

    assert client.delete(f"/documents/{doc_id}").status_code == 200
    assert client.get(f"/documents/{doc_id}").status_code == 404


def test_tts_stream_groups_sentences_into_phrases(client):
    r = client.post(
        "/tts/stream",
        json={"text": "One. Two. Three.", "voice": "t_voice", "lang_code": "a"},
    )
    assert r.status_code == 200
    chunks = _ndjson(r)
    # Short sentences are grouped into phrase clips, but every sentence index is
    # covered exactly once, in order, across the chunks' `sentences` spans.
    idxs = [s["index"] for c in chunks for s in c["sentences"]]
    assert idxs == [0, 1, 2]
    first = chunks[0]
    # audio_b64 decodes to a real WAV.
    wav = base64.b64decode(first["audio_b64"])
    assert wav[:4] == b"RIFF"
    assert first["sample_rate"] == 24000
    assert first["duration_sec"] > 0
    # Each sentence carries a non-decreasing offset within its phrase clip.
    spans = first["sentences"]
    assert spans[0]["offset_sec"] == 0.0
    assert [s["offset_sec"] for s in spans] == sorted(s["offset_sec"] for s in spans)


def test_tts_stream_start_index_resumes(client):
    # Long sentences so grouping splits into multiple phrases (phrase 0 = [0],
    # phrase 1 = [1, 2, 3]); resuming at 2 must skip phrase 0 entirely.
    sentences = [
        "This is the very first sentence and it is deliberately quite long indeed.",
        "Here is the second sentence which also runs on for a good while you see.",
        "The third sentence continues the pattern of being fairly lengthy as well.",
        "And finally the fourth sentence wraps things up in a suitably long manner.",
    ]
    r = client.post(
        "/tts/stream",
        json={"text": " ".join(sentences), "voice": "t_voice", "start_index": 2},
    )
    chunks = _ndjson(r)
    idxs = [s["index"] for c in chunks for s in c["sentences"]]
    # The resume sentence and everything after it are present; earlier phrases dropped.
    assert 2 in idxs and 3 in idxs
    assert 0 not in idxs


def test_tts_stream_requires_text_or_document(client):
    assert client.post("/tts/stream", json={}).status_code == 422


def test_api_key_enforced(make_client):
    secured = make_client(api_key="s3cret")
    # /health stays open.
    assert secured.get("/health").status_code == 200
    # Protected endpoints reject without the key.
    assert secured.get("/voices").status_code == 401
    assert secured.get("/voices", headers={"X-API-Key": "wrong"}).status_code == 401
    assert secured.get("/voices", headers={"X-API-Key": "s3cret"}).status_code == 200


def test_upload_too_large_rejected(make_client, monkeypatch):
    monkeypatch.setenv("SANGYIN_MAX_UPLOAD_MB", "0")
    client = make_client()
    files = {"file": ("big.txt", b"hello world", "text/plain")}
    assert client.post("/documents/file", files=files).status_code == 413
