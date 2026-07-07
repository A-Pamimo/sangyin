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

## 3. API server → DigitalOcean App Platform (student $200 credit)

The $200 DigitalOcean student credit covers this **CPU** service (it **excludes
GPUs** — which is why the GPU lives on Modal). The image is `backend/Dockerfile`
(CPU-only torch, so it's small), and `.do/app.yaml` is the App Platform spec.

**Deploy (dashboard):** DO → Apps → Create App → connect this GitHub repo → it
detects the Dockerfile → pick a 2 GB instance (or 1 GB if Chatterbox-only) → add
the env vars below (mark the R2 keys as *encrypted*) → Deploy. App Platform gives
you an HTTPS URL — put it in the app's **Settings → Backend URL**.

**Deploy (CLI):**
```
doctl apps create --spec .do/app.yaml   # fill REPLACE values / set secrets first
```

Env vars to set (see `.do/app.yaml`):
```
SANGYIN_TTS_ENGINE=chatterbox
SANGYIN_CHATTERBOX_URL=https://<you>--sangyin-chatterbox-web.modal.run
SANGYIN_R2_ACCOUNT_ID / _ACCESS_KEY / _SECRET_KEY / _BUCKET
SANGYIN_CORS_ORIGINS=*        # or your app's origin
```

> App Platform's filesystem is **ephemeral**, so R2 (step 1) is required in the
> cloud — without it, cached audio/documents vanish on every restart/deploy.

Try the image locally first:
```
docker build -f backend/Dockerfile -t sangyin-api backend
docker run -p 8080:8080 -e SANGYIN_TTS_ENGINE=kokoro sangyin-api
curl localhost:8080/health
```

Also handy from the Student Pack: **Clerk** (auth) for multi-user, **Doppler**
(secrets) for the env vars above, **Neon/Supabase or MongoDB** if you outgrow the
file/R2 metadata store.

## Cost shape
- API + R2: a few $/mo (or free tiers) — carried by the DO credit for ~a year.
- GPU: ~$0.50–$2 per hour of audio generated (one-time, cached), on Modal's
  per-second billing; the free monthly credits cover building + light use.
