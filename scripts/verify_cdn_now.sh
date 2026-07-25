#!/usr/bin/env bash
# One-shot truth check: is the syntax error actually fixed in BOTH disk AND
# the live CDN right now? Run this whenever you suspect something is broken.
#
# Usage:
#   ./scripts/verify_cdn_now.sh           # check both disk AND live CDN
#   OFFLINE=1 ./scripts/verify_cdn_now.sh # check disk only (skip CDN)
#   VERBOSE=1 ./scripts/verify_cdn_now.sh  # also print the diff if CDN differs
#
# Exit code: 0 if ALL checks pass, 1 if any check fails.
set +e
DISK=/root/JMPOTTERS/app.js
URL=https://www.jmpotters.com/app.js
TMP=$(mktemp /tmp/jmpot-cdn.XXXX.js)
trap 'rm -f "$TMP"' EXIT
RUN_TS=$(date -u +%FT%TZ)
OFFLINE="${OFFLINE:-0}"
VERBOSE="${VERBOSE:-0}"

PASS=0; FAIL=0
record_pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
record_fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "[verify_cdn_now] start_ts: $RUN_TS"
echo "[verify_cdn_now] disk=$DISK"
echo "[verify_cdn_now] cdn =$URL (OFFLINE=$OFFLINE)"

echo
echo "[verify_cdn_now] === DISK ==="
if node --check "$DISK" 2>/dev/null; then
  record_pass "disk: node --check"
else
  record_fail "disk: node --check FAILED"
fi
DISK_BYTES=$(wc -c < "$DISK")
DISK_CLOSE=$(grep -cF '})();' "$DISK")
echo "  disk: app.js size     = $DISK_BYTES bytes"
[ "$DISK_CLOSE" = "1" ] && record_pass "disk: '})();' literal count = 1 (one IIFE close)" \
                          || record_fail "disk: '})();' count = $DISK_CLOSE (expected exactly 1)"
grep -qF '1026078101' "$DISK" && record_pass "disk: UBA account 1026078101 present"  || record_fail "disk: UBA account 1026078101 MISSING"
grep -qF '8139583320' "$DISK" && record_pass "disk: OPay account 8139583320 present" || record_fail "disk: OPay account 8139583320 MISSING"

if [ "$OFFLINE" = "1" ]; then
  echo
  echo "[verify_cdn_now] (OFFLINE=1 mode - skipping CDN checks)"
else
  echo
  echo "[verify_cdn_now] === LIVE CDN ==="
  if ! curl -sf --max-time 25 "$URL" -o "$TMP"; then
    record_fail "cdn: UNREACHABLE - check network"
  else
    # INDEPENDENT parse of CDN bytes (do not assume disk == cdn)
    if node --check "$TMP" 2>/dev/null; then
      record_pass "cdn: node --check (CDN bytes parsed independently)"
    else
      record_fail "cdn: node --check FAILED (CDN bytes parsed independently)"
    fi
    CDN_BYTES=$(wc -c < "$TMP")
    CDN_CLOSE=$(grep -cF '})();' "$TMP")
    echo "  cdn:  app.js size    = $CDN_BYTES bytes"
    [ "$CDN_CLOSE" = "1" ] && record_pass "cdn: '})();' literal count = 1 (one IIFE close)" \
                            || record_fail "cdn: '})();' count = $CDN_CLOSE (expected exactly 1)"
    grep -qF '1026078101' "$TMP" && record_pass "cdn: UBA account 1026078101 present"  || record_fail "cdn: UBA account 1026078101 MISSING"
    grep -qF '8139583320' "$TMP" && record_pass "cdn: OPay account 8139583320 present" || record_fail "cdn: OPay account 8139583320 MISSING"

    if [ "$DISK_BYTES" = "$CDN_BYTES" ] && [ "$DISK_CLOSE" = "$CDN_CLOSE" ]; then
      record_pass "disk == cdn: byte-size parity ($DISK_BYTES = $CDN_BYTES)"
    else
      record_fail "disk size=$DISK_BYTES close=$DISK_CLOSE  vs  cdn size=$CDN_BYTES close=$CDN_CLOSE  --> CDN IS STALE"
      if [ "$VERBOSE" = "1" ]; then
        echo "  --- diff (first 40 lines) ---"
        diff "$DISK" "$TMP" | head -40
        echo "  --- end diff ---"
      fi
    fi
  fi
fi

echo
echo "[verify_cdn_now] === VERDICT (verified_at: $RUN_TS) ==="
echo "  PASS: $PASS  FAIL: $FAIL"
if [ "$FAIL" = "0" ]; then
  echo "  ALL CHECKS PASS"
  exit 0
else
  echo "  $FAIL CHECK(S) FAILED - investigate the lines above"
  exit 1
fi
