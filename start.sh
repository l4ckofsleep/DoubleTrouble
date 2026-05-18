#!/usr/bin/env bash
# One-command launch for DoubleTrouble on Linux / macOS / Termux.
#
# Creates the Python venv if missing, installs backend requirements,
# installs and (re)builds the frontend, then starts the server.
#
# Usage from the repo root:
#     ./start.sh

set -euo pipefail

cd "$(dirname "$0")"

step() { printf '\n==> %s\n' "$*"; }

# 1) Python venv
if [ ! -d ".venv" ]; then
    step "Creating Python venv at .venv"
    python3 -m venv .venv
fi

step "Activating venv"
# shellcheck disable=SC1091
. .venv/bin/activate

# 2) Backend deps
step "Installing backend requirements"
python -m pip install --disable-pip-version-check -q -r backend/requirements.txt

# 3) Frontend deps + build
step "Installing frontend dependencies"
( cd frontend && npm install --silent && step "Building frontend" && npm run build )

# 4) Start server
step "Starting DoubleTrouble at http://127.0.0.1:8017  (Ctrl+C to stop)"
exec python run.py
