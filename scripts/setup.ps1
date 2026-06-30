<#
.SYNOPSIS
  Sangyin getting-started script for Windows (PowerShell).

.DESCRIPTION
  Sets up the backend (venv + dependencies), checks for espeak-ng, and starts the
  server so you can test text -> audio without running install commands by hand.
  This is the Windows equivalent of scripts/setup.sh.

.EXAMPLE
  .\scripts\setup.ps1            # set up and start the backend

.EXAMPLE
  .\scripts\setup.ps1 -NoRun     # set up only, don't start the server
#>
[CmdletBinding()]
param(
    [switch]$NoRun
)

$ErrorActionPreference = 'Stop'

function Write-Bold($msg) { Write-Host $msg -ForegroundColor White }
function Write-Info($msg) { Write-Host "  $msg" }
function Write-Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }

$RepoRoot   = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot 'backend'

Write-Bold "Sangyin 聲音 - backend setup"

# --- 1. Pick a compatible Python (Kokoro needs >=3.10,<3.13) ------------------
$PythonCmd = $null

# Prefer the 'py' launcher with an explicit compatible version.
if (Get-Command py -ErrorAction SilentlyContinue) {
    foreach ($ver in '3.12', '3.11', '3.10') {
        & py "-$ver" -c "import sys" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $PythonCmd = @('py', "-$ver")
            break
        }
    }
}

# Fall back to a 'python' / 'python3' on PATH that reports a compatible version.
if (-not $PythonCmd) {
    foreach ($cand in 'python', 'python3') {
        if (Get-Command $cand -ErrorAction SilentlyContinue) {
            $ver = & $cand -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
            if ($ver -in @('3.10', '3.11', '3.12')) {
                $PythonCmd = @($cand)
                break
            }
        }
    }
}

if (-not $PythonCmd) {
    Write-Warn "No Python 3.10-3.12 found. Kokoro requires Python >=3.10,<3.13."
    Write-Warn "Install one from https://www.python.org/downloads/ and re-run."
    exit 1
}

$pyVersion = & $PythonCmd[0] $PythonCmd[1..($PythonCmd.Length - 1)] --version 2>&1
Write-Info "Using $($PythonCmd -join ' ') ($pyVersion)"

# --- 2. espeak-ng check -------------------------------------------------------
$espeak = Get-Command espeak-ng -ErrorAction SilentlyContinue
if (-not $espeak) {
    # espeak-ng often installs without landing on PATH; check the default location.
    $espeakDefault = Join-Path $env:ProgramFiles 'eSpeak NG\espeak-ng.exe'
    if (Test-Path $espeakDefault) { $espeak = $espeakDefault }
}
if ($espeak) {
    Write-Info "espeak-ng found."
} else {
    Write-Warn "espeak-ng not found (Kokoro needs it for some pronunciations)."
    Write-Warn "Install the .msi from https://github.com/espeak-ng/espeak-ng/releases"
}

# --- 3. venv + dependencies ---------------------------------------------------
Set-Location $BackendDir
$VenvDir = Join-Path $BackendDir '.venv'
if (-not (Test-Path $VenvDir)) {
    Write-Bold "Creating virtual environment (backend\.venv)..."
    & $PythonCmd[0] $PythonCmd[1..($PythonCmd.Length - 1)] -m venv .venv
}

$VenvPython = Join-Path $VenvDir 'Scripts\python.exe'

Write-Bold "Installing backend dependencies..."
& $VenvPython -m pip install --quiet --upgrade pip
& $VenvPython -m pip install --quiet -r requirements.txt
Write-Info "Dependencies installed."

# --- 4. First run -------------------------------------------------------------
if (-not $NoRun) {
    Write-Bold "Starting the Sangyin backend on http://localhost:8000 ..."
    Write-Info "First TTS request downloads the Kokoro model (~330 MB) once."
    Write-Info "Open http://localhost:8000/docs for the interactive API."
    Write-Info "Press Ctrl+C to stop."
    Write-Host ""
    & $VenvPython main.py
} else {
    Write-Bold "Backend ready."
    Write-Info "Start it with:  cd backend; .\.venv\Scripts\Activate.ps1; python main.py"
    Write-Info "Quick text->audio check:  python scripts\smoke_test.py `"Hello from Sangyin.`" out.wav"
}
