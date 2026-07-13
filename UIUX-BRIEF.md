# Sangyin (聲音) — UI/UX rebuild brief

> A self-contained brief for rebuilding the app's UI/UX (e.g. in Google AI Studio,
> Figma, or another codebase). Tool-agnostic: covers purpose, screens, data, flows,
> and the design language. The backend API contract below should be kept as-is.

## What it is
**A free audio reader.** Sangyin turns any document — PDF, EPUB, DOCX, `.txt`, pasted
text, or an article URL — into **spoken narration** using open-source TTS, with the
**spoken sentence highlighted** as you listen and **resume-where-you-left-off** across
devices. Tagline: *"Read slow, listen deep."* (聲音 = "voice / sound").

## Who it's for / the core job
People who'd rather **listen** to their reading (books, papers, long articles) than read
on screen — commuters, people with eye strain, multitaskers. The one job:
**import something → press play → follow along → come back later and resume.**

## Platform & architecture context (constraints for the rebuild)
- **One client for web, iOS, and Android** (currently Expo / React Native + react-native-web).
  If you rebuild web-only, keep it responsive and touch-friendly.
- **Client–server:** a backend (FastAPI) does parsing + speech synthesis; the app is a thin
  client that streams audio and renders UI. The backend URL is **user-configurable**.
- **Streaming playback:** the TTS endpoint returns **one sentence's audio at a time (NDJSON)**,
  so playback starts on the *first* sentence instead of waiting for the whole document. The
  client plays clips back-to-back and highlights the sentence currently playing.

## Screens (5 routes)

### 1. Landing / entry
Marketing-style front door. Wordmark 聲音 · Sangyin, a hero ("your library, read aloud"),
and CTAs → Library / Import. (The current redesign makes this an immersive "walk into a 3D
library room" on web; on mobile it's a calm hero.)

### 2. Library — *your shelf of documents*
- A browsable collection of imported documents. Each item shows: **title**, **source type**
  (PDF/EPUB/DOCX/TXT/PASTE/WEB), **reading progress %**, and a marker for the one you're
  **currently reading**.
- Actions: **open** (→ Reader), **remove**, **import** (→ Import), **settings**.
- States: empty ("your shelf is empty"), loading, backend-unreachable error (shows configured
  URL + retry).

### 3. Import — *one doorway, three sources*
- Tabs: **File** (pick PDF/EPUB/DOCX/TXT), **Paste text** (title + body), **Article URL**
  (fetches + cleans the page).
- Submitting shows a **processing overlay**, then navigates straight into the Reader.
- States: idle per tab, busy/processing, error ("Import failed" with reason).

### 4. Reader — *the core; treat it like an instrument, not a page of buttons*
- **Reading surface:** the document's sentences as a scrolling column; the **active sentence
  is highlighted** and everything read so far is dimmed. **Tap any sentence to jump** there.
  Auto-scrolls to keep the active line in view.
  *(Critical: the highlight must not change line height / row metrics, or auto-scroll drifts.)*
- **Transport dock (bottom):** play/pause, previous, next; **speed** cycling **0.5×–2×**
  (applied as a client playback rate, no server round-trip); **voice** selector; a
  **seek/waveform** showing position in the chapter. Chapter selector when the doc has
  multiple chapters.
- **Voices:** a list from the backend; switching re-synthesizes from the current spot.
- **"Natural voice" (GPU) special case:** one premium voice can't stream live — it needs a
  **one-time "Prepare"** pass that caches the chapter (show progress %); until prepared, Play
  becomes "Prepare." It can also be **unavailable** (spend cap) — handle gracefully ("pick a
  free voice or try later").
- **PDF view (web/desktop):** for PDFs, a toggle between the narrated **Text** and the rendered
  **PDF** pages (with the active sentence highlighted on the page).
- **Scanned PDFs / OCR:** if a PDF has no extractable text, offer **"Read aloud (run OCR)"**;
  while OCR runs, show a "reading the scanned pages…" banner and poll until text appears.
- Loading states: "warming up the voice (first play can take ~a minute)", "buffering…".

### 5. Settings
- **Theme** (three palettes, see below), **Backend URL** (with Test/Save + connection status),
  **Voice**, **Speed**, and toggles for **Sound effects** (tactile UI blips, web-only) and
  **Reduce motion** (skips intros/animations).

## Data model (what the UI binds to)
- **DocumentSummary**: `{ id, title, source_type: 'pdf'|'epub'|'docx'|'txt'|'text'|'url', n_sentences, created_at }`
- **Document (full)**: `{ id, title, source_type, chapters: [{ id, title, index, sentences: [{ index, text }] }], has_pdf?, ocr_status?: 'none'|'pending'|'done'|'failed'|'unavailable' }`
- **Voice**: `{ id, name, lang_code, gender }`
- **Resume position** (persisted, per document): `{ chapterId, sentenceIndex, updatedAt }`.
  **Progress %** = `(sentenceIndex + 1) / n_sentences`.
- **Pregen (prepare) status**: `{ total, done, status: 'idle'|'partial'|'generating'|'done'|'failed' }`
- Persisted client prefs: `backendUrl, voice, lang, speed, themeName, positions{}, sfxEnabled, reduceMotion`.

## Backend API contract (keep as-is)
- `GET /documents` → `DocumentSummary[]`
- `GET /documents/{id}` → full Document
- `DELETE /documents/{id}`
- `POST /import/text`, `/import/url`, `/import/file` → `{ id }` (then open the reader)
- `GET /voices` → `Voice[]`
- `POST /tts/stream` → **NDJSON**, one JSON object per sentence: `{ index, sentences[], sample_rate, duration_sec, audio_b64, needs_prepare? }` (supports `start_index` to resume)
- `POST /pregenerate` + `GET /pregenerate/status` → prepare the natural voice
- `POST /ocr/{id}` + poll `ocr_status` for scanned PDFs
- `GET /health` → `{ model, version }`

## Key flows
1. **Import → Reader**: pick source → process → open reader → auto-plays from the first sentence.
2. **Listen**: play → sentences highlight in sync → tap to jump → adjust speed/voice live.
3. **Resume**: reopening a doc jumps to the saved chapter/sentence.
4. **Prepare natural voice**: select it → Play becomes "Prepare" → progress → then plays instantly.

## Design language ("Fernwood")
Three themes, switchable at runtime:

| Theme | Mode | bg | surface | ink | accent |
|---|---|---|---|---|---|
| **Sage** | light | `#ECEBE0` | `#FFFFFF` | `#23271D` | olive `#5F6B44` |
| **Clay** | light | `#F3EBDD` | `#FFFDF8` | `#2B2721` | terracotta `#B15238` |
| **Loam** | dark | `#201A14` | `#2C231A` | `#EFE6D6` | amber `#CE9A4E` |

- Shared warm **brass** accent `#C79A5B`, reserved for "material" moments (shelves, the reader dock).
- **Type:** *Bricolage Grotesque* (display / headlines), *Hanken Grotesk* (body),
  *Space Mono* (labels, tags, chrome). Tight, editorial hierarchy.
- **Tone:** calm, warm, earthy, tactile — "a good tool in the hand," not a flashy SaaS dashboard.
- **Motion:** purposeful and **reduce-motion-aware**; nothing should fight the reading experience.
- **Concept direction:** *"the library is a place, the reader is an instrument"* — browsing is a
  warm bookshelf you move through; the reader is a field-recorder with a waveform scrubber.

## States & edge cases to design for
Empty library · backend unreachable · import failing · a document with **no readable text**
(scanned/DOCX) · OCR pending/unavailable · natural voice preparing/unavailable · first-play
"warming up" · buffering · offline resume (audio cached as you listen).

## Before generating in a tool
- **Scope:** rebuild *just the visual/UX* (keep the backend API contract above), or reimagine flows too?
- **Platform:** AI Studio tends to output **web** (React/Gemini apps) — if you want to keep
  iOS/Android, say so, so it doesn't produce web-only patterns.
