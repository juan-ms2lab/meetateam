#!/bin/bash
# One-line installer for meetateam kiosk.
# Usage: curl -fsSL https://raw.githubusercontent.com/juan-ms2lab/meetateam/main/setup.sh | URL=https://your-calendar-url bash
#   All install.sh env vars are supported (ROOM_NAME, IDLE_BLANK, etc).
set -euo pipefail
URL="${URL:-https://www.google.com}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -fsSL https://github.com/juan-ms2lab/meetateam/archive/main.tar.gz | tar xz -C "$TMP"
cd "$TMP/meetateam-main"
bash install.sh
