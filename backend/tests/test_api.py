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


def test_tts_stream_yields_one_chunk_per_sentence(client):
    r = client.post(
        "/tts/stream",
        json={"text": "One. Two. Three.", "voice": "t_voice", "lang_code": "a"},
    )
    assert r.status_code == 200
    chunks = _ndjson(r)
    assert [c["index"] for c in chunks] == [0, 1, 2]
    # audio_b64 decodes to a real WAV.
    wav = base64.b64decode(chunks[0]["audio_b64"])
    assert wav[:4] == b"RIFF"
    assert chunks[0]["sample_rate"] == 24000
    assert chunks[0]["duration_sec"] > 0


def test_tts_stream_start_index_resumes(client):
    r = client.post(
        "/tts/stream",
        json={"text": "One. Two. Three. Four.", "voice": "t_voice", "start_index": 2},
    )
    chunks = _ndjson(r)
    assert [c["index"] for c in chunks] == [2, 3]
    assert chunks[0]["text"] == "Three."


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
