#!/usr/bin/env bash
# Defensive guard: NEVER ship app.js with a syntax error.
# Run this in CI or pre-push before deploying.
set -e
FILE="${1:-app.js}"
if ! node --check "$FILE" 2>&1; then
  echo "[check_appjs] SYNTAX ERROR in $FILE - refusing to ship." >&2
  exit 1
fi
# Count stray `})();` lines - should be exactly 1 (the legitimate IIFE close)
COUNT=$(grep -cF '})();' "$FILE")
if [ "$COUNT" -ne 1 ]; then
  echo "[check_appjs] WARNING: $COUNT `})();` literal occurrences in $FILE (expected exactly 1)." >&2
  grep -nF '})();' "$FILE" >&2
  exit 1
fi
echo "[check_appjs] OK - $FILE parses and has exactly 1 IIFE close."
