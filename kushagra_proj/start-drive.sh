#!/usr/bin/env bash
# Axis Drive - one-click local launcher (Linux and macOS).
# First run: creates a private Python environment in .venv and installs the requirements.
# Later runs: starts straight away. Your files are kept in data_store/.
set -e
cd "$(dirname "$0")"

PORT="${PORT:-8000}"

# Find a Python 3 interpreter
PY=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' 2>/dev/null; then
    PY="$candidate"
    break
  fi
done
if [ -z "$PY" ]; then
  echo "Python 3.9 or newer is needed. Install it from https://www.python.org/downloads/ and run this again."
  read -r -p "Press Enter to close..." _ || true
  exit 1
fi

if [ ! -x ".venv/bin/python" ]; then
  echo "Setting up Axis Drive for the first time (this takes a minute)..."
  "$PY" -m venv .venv
  .venv/bin/python -m pip install --quiet --upgrade pip
  .venv/bin/python -m pip install --quiet -r requirements.txt
fi

echo ""
echo "Axis Drive is starting at http://localhost:${PORT}"
echo "Keep this window open while you use the app. Press Ctrl+C to stop."
echo ""

# Open the browser (best effort)
( sleep 2
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:${PORT}" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then open "http://localhost:${PORT}" >/dev/null 2>&1 || true
  fi ) &

PORT="$PORT" exec .venv/bin/python app.py
