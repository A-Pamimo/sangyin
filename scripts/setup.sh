#!/usr/bin/env bash
#
# Sangyin getting-started script.
# Sets up the backend (venv + dependencies), checks for espeak-ng, and starts the
# server so you can test text -> audio without running install commands by hand.
#
# Usage:
#   ./scripts/setup.sh            # set up and start the backend
#   ./scripts/setup.sh --no-run   # set up only, don't start the server
#
set -euo pipefail

RUN_SERVER=1
[[ "${1:-}" == "--no-run" ]] && RUN_SERVER=0

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
info() { printf "  %s\n" "$1"; }
warn() { printf "\033[33m  ! %s\033[0m\n" "$1"; }

bold "Sangyin 聲音 — backend setup"

# --- 1. Pick a compatible Python (Kokoro needs >=3.10,<3.13) ------------------
PYTHON=""
for cand in python3.12 python3.11 python3.10 python3 python; do
  if command -v "$cand" >/dev/null 2>&1; then
    ver="$("$cand" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || echo "")"
    case "$ver" in
      3.10|3.11|3.12) PYTHON="$cand"; break ;;
    esac
  fi
done

if [[ -z "$PYTHON" ]]; then
  warn "No Python 3.10–3.12 found. Kokoro requires Python >=3.10,<3.13."
  warn "Install one (e.g. 'brew install python@3.12' or your distro's package) and re-run."
  exit 1
fi
info "Using $(command -v "$PYTHON") ($("$PYTHON" --version 2>&1))"

# --- 2. espeak-ng check -------------------------------------------------------
if command -v espeak-ng >/dev/null 2>&1; then
  info "espeak-ng found."
else
  warn "espeak-ng not found (Kokoro needs it for some pronunciations)."
  case "$(uname -s)" in
    Linux)  warn "Install it:  sudo apt-get install espeak-ng" ;;
    Darwin) warn "Install it:  brew install espeak-ng" ;;
    *)      warn "Install espeak-ng from https://github.com/espeak-ng/espeak-ng/releases" ;;
  esac
fi

# --- 3. venv + dependencies ---------------------------------------------------
cd "$BACKEND_DIR"
if [[ ! -d .venv ]]; then
  bold "Creating virtual environment (backend/.venv)…"
  "$PYTHON" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

bold "Installing backend dependencies…"
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
info "Dependencies installed."

# --- 4. First run -------------------------------------------------------------
if [[ "$RUN_SERVER" -eq 1 ]]; then
  bold "Starting the Sangyin backend on http://localhost:8000 …"
  info "First TTS request downloads the Kokoro model (~330 MB) once."
  info "Open http://localhost:8000/docs for the interactive API."
  info "Press Ctrl+C to stop."
  echo
  exec python main.py
else
  bold "Backend ready."
  info "Start it with:  cd backend && source .venv/bin/activate && python main.py"
  info "Quick text→audio check:  python scripts/smoke_test.py \"Hello from Sangyin.\" out.wav"
fi
