# API server image (CPU). Chatterbox runs on Modal, so no GPU/CUDA here — torch is
# the CPU build to keep the image small. Kokoro (default engine) still works on CPU.
FROM python:3.12-slim

# System deps: espeak-ng (Kokoro pronunciation), tesseract-ocr (OCR), libsndfile1
# (soundfile). PyMuPDF/pdf parsing are self-contained wheels.
RUN apt-get update && apt-get install -y --no-install-recommends \
      espeak-ng \
      tesseract-ocr \
      libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# Install CPU torch first so Kokoro's torch dep resolves to the small CPU wheel
# instead of the ~2.5 GB CUDA build.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY sangyin ./sangyin

# Cloud hosts (DO App Platform, etc.) inject $PORT; default to 8080 locally.
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
