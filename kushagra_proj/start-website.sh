#!/usr/bin/env bash
# ==========================================================================
#  AXIS COLLEGES WEBSITE - ONE-CLICK START (Linux / Raspberry Pi)
#  Run:  ./start-website.sh      (or double-click in a file manager)
#  Starts a small local server in this folder and opens the website at
#  http://localhost:8000  (change the port with:  PORT=9000 ./start-website.sh)
#  Needs Python 3. If Python is missing, index.html is opened directly.
# ==========================================================================

# Always run from the folder where this script lives
cd "$(dirname "$0")" || exit 1

PORT="${PORT:-8000}"
URL="http://localhost:${PORT}"

# Find Python 3
PY=""
if command -v python3 >/dev/null 2>&1; then
  PY="python3"
elif command -v python >/dev/null 2>&1; then
  PY="python"
fi

# Helper: open a file or address in the default browser (if one is available)
open_url() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$1" >/dev/null 2>&1 &
  else
    echo "Please open this address in your browser: $1"
  fi
}

if [ -z "$PY" ]; then
  echo "Python 3 was not found. Opening index.html directly..."
  open_url "$(pwd)/index.html"
  exit 0
fi

echo ""
echo "============================================================"
echo " Axis Colleges Website is starting..."
echo " Website:      ${URL}"
echo " Admin panel:  ${URL}/admin.html   (password: axis@2026)"
echo " To STOP the website press Ctrl + C in this window."
echo "============================================================"
echo ""

# Open the browser after 2 seconds, in the background
( sleep 2; open_url "$URL" ) &

# Run the server in the foreground (Ctrl+C stops it)
exec "$PY" -m http.server "$PORT" --bind 127.0.0.1
