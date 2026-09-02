#!/usr/bin/env bash
# ============================================================
# render-og-card.sh
#
#   ./scripts/render-og-card.sh
#
# Renders scripts/og-card.html to assets/og-card.png at 1200x630 — the
# image every link preview shows.
#
# It has to go through a browser: the forecast on the card is drawn by
# js/glass.js on a canvas, and nothing but a browser can execute that.
# That is also why the PNG is committed rather than generated on the
# fly — unfurl crawlers never run JavaScript, so they can only ever be
# handed a static file.
#
# Re-run it after changing the palette, the hero model, or the card
# copy, then commit the new PNG.
#
# Chrome is found in the usual places; override with CHROME=/path/to/it.
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/assets/og-card.png"
SRC="$ROOT/scripts/og-card.html"

find_chrome() {
  if [ -n "${CHROME:-}" ]; then printf '%s' "$CHROME"; return; fi
  local c
  for c in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$(command -v google-chrome || true)" \
    "$(command -v chromium || true)" \
    "$(command -v chromium-browser || true)"
  do
    [ -n "$c" ] && [ -x "$c" ] && { printf '%s' "$c"; return; }
  done
  echo "No Chrome or Chromium found. Set CHROME=/path/to/chrome and retry." >&2
  exit 1
}

CHROME_BIN="$(find_chrome)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --virtual-time-budget lets the animation advance a fixed number of
# virtual milliseconds before the shot, so the same source always
# produces the same frame rather than whatever the clock happened to
# land on.
"$CHROME_BIN" \
  --headless --disable-gpu --no-sandbox \
  --force-device-scale-factor=1 \
  --window-size=1200,630 \
  --virtual-time-budget=4000 \
  --screenshot="$TMP/og-card.png" \
  "file://$SRC" 2>/dev/null

mv "$TMP/og-card.png" "$OUT"

size=$(wc -c < "$OUT" | tr -d ' ')
echo "wrote assets/og-card.png  ($((size / 1024)) KB)"
[ "$size" -gt 5000000 ] && echo "WARNING: over 5 MB, some platforms will refuse it" >&2

# Reminder, because this is the part people forget.
cat <<'NOTE'

LinkedIn and Slack cache a preview for about a week. After deploying a
changed card, force a refetch:
  https://www.linkedin.com/post-inspector/
  https://developers.facebook.com/tools/debug/
NOTE
