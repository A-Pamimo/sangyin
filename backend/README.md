# Sangyin Backend (`sangyin-backend`)

FastAPI service that parses documents and synthesizes speech with open-source TTS
(Kokoro-82M by default). No paid APIs. Self-hostable.

## Requirements

- **Python 3.10–3.12** (Kokoro requires `>=3.10,<3.13`)
- **espeak-ng** system package (used by Kokoro for some pronunciations)
  - Linux: `sudo apt-get install espeak-ng`
  - macOS: `brew install espeak-ng`
  - Windows: install the `.msi` from the [espeak-ng releases](https://github.com/espeak-ng/espeak-ng/releases)

## Quick start

The repo ships a getting-started script that does everything below for you:

```bash
# from the repo root
./scripts/setup.sh
```

Or manually:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py                     # serves on http://0.0.0.0:8000
```

On the **first** TTS request, Kokoro downloads its ~330 MB model weights from
Hugging Face (`hexgrad/Kokoro-82M`). This is a one-time download.

## Configuration

Settings come from environment variables prefixed `SANGYIN_` (or a `backend/.env`):

| Variable | Default | Meaning |
|---|---|---|
| `SANGYIN_HOST` | `0.0.0.0` | Bind host |
| `SANGYIN_PORT` | `8000` | Bind port |
| `SANGYIN_CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `SANGYIN_TTS_ENGINE` | `kokoro` | TTS engine id |
| `SANGYIN_DEFAULT_VOICE` | `af_heart` | Default voice |
| `SANGYIN_DEFAULT_LANG_CODE` | `a` | Default Kokoro language code |
| `SANGYIN_DATA_DIR` | `~/.sangyin` | Documents + audio cache location |

## API

Base URL: `http://localhost:8000`. Interactive docs at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness + active engine |
| `GET` | `/voices` | Available voices |
| `POST` | `/documents/text` | Import pasted text `{text, title?}` |
| `POST` | `/documents/url` | Import an article `{url}` (strips nav/ads) |
| `POST` | `/documents/file` | Import a `.pdf/.epub/.docx/.txt` upload (multipart) |
| `GET` | `/documents` | Library list |
| `GET` | `/documents/{id}` | Full parsed document (chapters + sentences) |
| `DELETE` | `/documents/{id}` | Delete document + cached audio |
| `POST` | `/tts/stream` | **Streaming synthesis** (see below) |

### Streaming synthesis

`POST /tts/stream` with either a stored document or raw text:

```jsonc
{ "document_id": "...", "chapter_id": "...", "voice": "af_heart", "lang_code": "a" }
// or
{ "text": "Hello from Sangyin.", "voice": "af_heart", "lang_code": "a" }
```

Returns `application/x-ndjson` — **one JSON object per line, per sentence**, so the
client can start playback before the whole document is synthesized:

```jsonc
{"index": 0, "text": "Hello from Sangyin.", "sample_rate": 24000, "duration_sec": 1.21, "audio_b64": "<wav>"}
{"index": 1, "text": "This is open source.",  "sample_rate": 24000, "duration_sec": 0.98, "audio_b64": "<wav>"}
```

`index` matches the sentence index from the parsed document, which is how the client
keeps sentence highlighting in sync with audio. Audio is 16-bit PCM WAV at 24 kHz,
base64-encoded. Chunks for stored documents are cached on disk (powering instant
replays and mobile offline playback).

> **Speed control** (0.5×–2×) is applied client-side as a playback rate — no
> server round-trip — so the API stays simple.

## Swapping the TTS model

Implement the small `TTSEngine` protocol (`sangyin/tts/base.py`):

```python
class TTSEngine(Protocol):
    sample_rate: int
    def voices(self) -> list[Voice]: ...
    def synthesize(self, text: str, voice: str, lang_code: str) -> np.ndarray: ...
```

Add your engine to the registry in `sangyin/tts/registry.py` and set
`SANGYIN_TTS_ENGINE=<id>`. Nothing in `api/` or `parsing/` needs to change — that's
how Chatterbox/Orpheus can be dropped in later.

## Verify the text→audio slice without the API

```bash
cd backend && source .venv/bin/activate
python scripts/smoke_test.py "Hello from Sangyin." out.wav
```

Synthesizes per-sentence and writes a playable `out.wav` — the fastest way to confirm
Kokoro + espeak-ng are working.

## Project layout

```
backend/sangyin/
  api/        FastAPI app + routers (health, voices, documents, tts)
  parsing/    pdf, epub, docx, txt, url extractors -> normalized Document
  tts/        TTSEngine interface + KokoroEngine + registry
  models.py   pydantic schemas
  storage.py  on-disk document + audio cache
  config.py   settings
```
