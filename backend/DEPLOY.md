# Deploying the backend to the cloud

The backend splits into two workloads, hosted separately to keep cost down:

| Piece | What | Where |
|---|---|---|
| **API** (CPU, always-on) | library, docs, parsing, PDF page images, OCR, streaming + serving cached audio | a small VM / container |
| **TTS GPU worker** (bursty) | Chatterbox synthesis, only while generating | serverless GPU (Modal) |
| **Blobs** | documents, cached audio, original PDFs | S3-compatible object storage (Cloudflare R2) |

Because audio is **pre-generated and cached**, the GPU only runs during generation
and scales to zero — you pay ~ generation time, not 24/7.

## 1. Audio + document storage → Cloudflare R2 (free tier, free egress)

Create an R2 bucket + an API token, then set on the **API** service:

```
SANGYIN_R2_ACCOUNT_ID=...
SANGYIN_R2_ACCESS_KEY=...
SANGYIN_R2_SECRET_KEY=...
SANGYIN_R2_BUCKET=sangyin
```

With those set, all blobs go to R2; unset, it uses local files under `data_dir`.
R2's free egress matters — the API streams a lot of audio to phones.

## 2. GPU worker → Modal (serverless; free monthly credits)

```
pip install modal && modal setup
modal deploy backend/modal_chatterbox.py
```

Modal prints a URL; point the API at it:

```
SANGYIN_TTS_ENGINE=chatterbox
SANGYIN_CHATTERBOX_URL=https://<you>--sangyin-chatterbox-web.modal.run
```

(Leave `SANGYIN_TTS_ENGINE` unset to use fast local Kokoro instead.)

## 3. API server → DigitalOcean (student $200 credit) or any container host

The `$200` DigitalOcean student credit covers the **CPU** side (App Platform or a
Droplet) but **excludes GPUs** — which is exactly why the GPU lives on Modal.

```
# build/run the FastAPI app (uvicorn main:app), with the env vars above.
# expose it over HTTPS; point the app's Settings → Backend URL at it.
```

Also handy from the Student Pack: **Clerk** (auth) for multi-user, **Doppler**
(secrets) for the env vars above, **Neon/Supabase or MongoDB** if you outgrow the
file/R2 metadata store.

## Cost shape
- API + R2: a few $/mo (or free tiers) — carried by the DO credit for ~a year.
- GPU: ~$0.50–$2 per hour of audio generated (one-time, cached), on Modal's
  per-second billing; the free monthly credits cover building + light use.
