# Sangyin 聲音

**A free, open-source audio reader.** Sangyin reads your documents aloud using
open-source TTS models — no paid APIs, no subscriptions. It runs on the **web**,
**desktop**, **iOS**, and **Android** from a single client, backed by a
self-hostable Python server that does the parsing and speech synthesis.

> 聲音 (*shēngyīn*) — "voice / sound" in Chinese.

- **Default voice model:** [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)
  (CPU-friendly, natural, Apache-licensed weights)
- **Inputs:** PDF, EPUB, DOCX, `.txt`, pasted text, and article URLs
- **Player:** play/pause, skip, 0.5×–2× speed, sentence highlighting synced to audio,
  voice selection, resume-where-you-left-off, document library, offline playback on mobile

---

## Why client–server?

Good neural TTS is too heavy to run on a phone. So Sangyin splits in two:

```
┌─────────────────────────────┐         REST / NDJSON        ┌──────────────────────────┐
│  sangyin-app (Expo)         │  ───────────────────────────▶│  sangyin-backend (FastAPI)│
│  web · iOS · Android        │   parse docs, stream audio    │  parsing · TTS · API      │
│  player, library, UI        │◀───────────────────────────  │  Kokoro-82M (swappable)   │
└─────────────────────────────┘                              └──────────────────────────┘
```

The client points at a **configurable backend URL**, so you can run the backend on
your own machine or a server and connect any client to it.

```
sangyin/
├── backend/     Python / FastAPI — parsing, TTS, REST API   (see backend/README.md)
├── app/         Expo / React Native — web, iOS, Android      (see app/README.md)
├── scripts/
│   └── setup.sh Getting-started: backend setup + first run
└── README.md
```

---

## Quick start

### 1. Backend (the easy way)

```bash
git clone <your-fork-url> sangyin
cd sangyin
./scripts/setup.sh
```

That picks a compatible Python (3.10–3.12), creates a virtualenv, installs
dependencies, checks for **espeak-ng**, and starts the API on
**http://localhost:8000**. The first synthesis downloads the Kokoro model (~330 MB)
once.

> **System dependency:** Kokoro needs `espeak-ng`.
> Linux `sudo apt-get install espeak-ng` · macOS `brew install espeak-ng` ·
> Windows: install the `.msi` from the
> [espeak-ng releases](https://github.com/espeak-ng/espeak-ng/releases).
> The setup script tells you if it's missing.

Verify it works without the UI:

```bash
cd backend && source .venv/bin/activate
python scripts/smoke_test.py "Hello from Sangyin." out.wav   # writes a playable WAV
# or hit the streaming endpoint:
curl -N -X POST http://localhost:8000/tts/stream \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hello from Sangyin.","voice":"af_heart","lang_code":"a"}'
```

(See [`backend/README.md`](backend/README.md) for the manual steps, configuration,
and the full API reference.)

### 2. App (web)

```bash
cd app
npm install
npm run web        # opens the app in your browser
```

Open **Settings** in the app and point **Backend URL** at your backend (default
`http://localhost:8000`), then **Import** a document or paste text and press play.

(See [`app/README.md`](app/README.md) for iOS/Android.)

---

## Self-hosting the backend

The backend is a standard FastAPI app — host it however you like.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# bind publicly and serve with multiple workers behind your reverse proxy:
SANGYIN_HOST=0.0.0.0 SANGYIN_PORT=8000 python main.py
```

Configuration is via `SANGYIN_*` environment variables (host, port, CORS origins,
default voice/language, data directory, TTS engine) — see
[`backend/README.md`](backend/README.md). Put it behind nginx/Caddy with TLS, then set
the app's **Backend URL** (Settings) to your public URL.

Documents and generated audio are cached on disk under `~/.sangyin` (override with
`SANGYIN_DATA_DIR`); no database required.

---

## How streaming + highlighting works

`POST /tts/stream` returns **NDJSON — one JSON object per sentence**, so playback can
start after the first sentence instead of waiting for the whole document. Each line
carries the sentence's `index` (from the parsed document) and base64 WAV audio. The
client plays chunks back-to-back and highlights the sentence whose `index` is
currently playing. Speed control is applied as a client-side playback rate, so it
never needs a server round-trip.

## Swapping the TTS model

TTS lives behind a tiny interface (`backend/sangyin/tts/base.py`):

```python
class TTSEngine(Protocol):
    sample_rate: int
    def voices(self) -> list[Voice]: ...
    def synthesize(self, text: str, voice: str, lang_code: str) -> np.ndarray: ...
```

Implement it for a new model (Chatterbox, Orpheus, …), register it in
`backend/sangyin/tts/registry.py`, and set `SANGYIN_TTS_ENGINE=<id>`. Nothing in the
API, parsing, or client changes.

---

## Building order (how this repo was built)

An end-to-end **text → audio** slice came first so it could be tested early, then
features were layered on:

1. Backend: paste text → Kokoro → streamed audio (`/tts/stream`)
2. Web client: paste text → player with sentence highlighting
3. PDF + EPUB parsing (chapters where structure exists)
4. Document library + resume position
5. URL article extraction, then DOCX
6. Mobile build + offline playback

---

## License

Open-source and free to self-host. Sangyin uses only permissively-licensed
components (Kokoro weights are Apache-2.0). See individual dependencies for their
terms.
