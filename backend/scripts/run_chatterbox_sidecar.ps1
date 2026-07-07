# Starts the Chatterbox GPU TTS sidecar in its isolated venv (.venv-chatterbox).
# The main backend reaches it at http://127.0.0.1:8091 when SANGYIN_TTS_ENGINE=chatterbox.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root ".venv-chatterbox\Scripts\python.exe"
if (-not (Test-Path $py)) {
  Write-Error "Isolated venv not found. Create it and install chatterbox-tts first."
  exit 1
}
Write-Host "Starting Chatterbox sidecar on http://127.0.0.1:8091 (first run downloads the model)..."
& $py (Join-Path $root "tts_sidecar.py")
