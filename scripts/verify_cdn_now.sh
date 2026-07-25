#!/usr/bin/env bash
# One-shot truth check: is the syntax error actually fixed in BOTH disk AND
# the live CDN right now? Run this whenever you suspect something is broken.
set +e
DISK=/root/JMPOTTERS/app.js
URL=https://www.jmpotters.com/app.js
TMP=$(mktemp /tmp/jmpot-cdn.XXXX.js)
trap 'rm -f "$TMP"' EXIT

echo "[verify_cdn_now] === DISK ($(date -u +%H:%M:%SZ)) ==="
node --check "$DISK"  2>&1 && echo "  disk: node --check PASS" || { echo "  disk: node --check FAIL"; exit 1; }
DISK_BYTES=$(wc -c < "$DISK")
DISK_CLOSE_COUNT=$(grep -cF '})();' "$DISK")
echo "  disk: app.js size = $DISK_BYTES bytes"
echo "  disk: '})();' literal count = $DISK_CLOSE_COUNT  (expected: 1)"
[ "$DISK_CLOSE_COUNT" = "1" ] || { echo "  disk: BAD - should be exactly 1"; exit 1; }
grep -qF '1026078101' "$DISK" && echo "  disk: UBA account number present" || echo "  disk: UBA missing"
grep -qF '8139583320' "$DISK" && echo "  disk: OPay account number present" || echo "  disk: OPay missing"

echo
echo "[verify_cdn_now] === LIVE CDN ($(date -u +%H:%M:%SZ)) ==="
curl -sf --max-time 25 "$URL" -o "$TMP"
if [ ! -s "$TMP" ]; then
  echo "  cdn: UNREACHABLE - check network"
  exit 1
fi
node --check "$TMP"  2>&1 && echo "  cdn: node --check PASS" || { echo "  cdn: node --check FAIL"; exit 1; }
CDN_BYTES=$(wc -c < "$TMP")
CDN_CLOSE_COUNT=$(grep -cF '})();' "$TMP")
echo "  cdn: app.js size = $CDN_BYTES bytes"
echo "  cdn: '})();' literal count = $CDN_CLOSE_COUNT  (expected: 1)"
[ "$CDN_CLOSE_COUNT" = "1" ] || { echo "  cdn: BAD - should be exactly 1"; exit 1; }
grep -qF '1026078101' "$TMP" && echo "  cdn: UBA account number present" || echo "  cdn: UBA missing"
grep -qF '8139583320' "$TMP" && echo "  cdn: OPay account number present" || echo "  cdn: OPay missing"

echo
echo "[verify_cdn_now] === PARITY ==="
if [ "$DISK_BYTES" = "$CDN_BYTES" ]; then
  echo "  disk size == cdn size ($DISK_BYTES = $CDN_BYTES)  -> MATCH"
else
  echo "  disk size ($DISK_BYTES) != cdn size ($CDN_BYTES)  -> CDN IS STALE"
  echo "  run:  cd /root/JMPOTTERS && git log --oneline -3"
  echo "  run:  cd /root/JMPOTTERS && git push origin HEAD:refs/heads/main"
fi
