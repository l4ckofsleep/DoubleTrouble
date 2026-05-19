@echo off
setlocal enabledelayedexpansion

set "root=%~dp0"
cd /d "%root%"

:: 1) Python venv
if not exist ".venv" (
    echo ==> Creating Python venv at .venv
    python -m venv .venv
)

echo ==> Activating venv
call .venv\Scripts\activate.bat

echo ==> Installing backend requirements
python -m pip install --disable-pip-version-check -q -r backend\requirements.txt

:: 3) Frontend deps + build
echo ==> Installing frontend dependencies
pushd frontend
call npm install --silent
echo ==> Building frontend
call npm run build
popd

:: 4) Start server
echo ==> Starting DoubleTrouble at http://127.0.0.1:8017  (Ctrl+C to stop)
python run.py
