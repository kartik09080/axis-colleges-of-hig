#!/usr/bin/env bash
# ==========================================================================
#  AXIS COLLEGES WEBSITE - ONE-CLICK START (macOS)
#  Double-click this file in Finder. A Terminal window opens, the website
#  starts and the browser opens http://localhost:8000
#  First time only: if macOS says it cannot be opened, right-click the file
#  and choose "Open". Needs Python 3 (install from python.org or Xcode tools).
#  Close the Terminal window (or press Ctrl + C) to stop the website.
# ==========================================================================

# Run the shared launcher that lives in the same folder
cd "$(dirname "$0")" || exit 1
exec ./start-website.sh
