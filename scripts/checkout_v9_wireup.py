#!/usr/bin/env python3
r"""
v9 wire-up — fixes the two customer-facing bugs the reviewer flagged.

Bug A (RECEIPT GATE — button stuck disabled forever)
=====================================================
The v9 helpers try to read window.selectedReceiptFile, but the v3 composer
stores it inside an IIFE closure (var selectedReceiptFile = null; at line
1312 of /root/JMPOTTERS/checkout.html). So the helper's poll always resolves
to undefined, keeping the Place Order button permanently disabled and
locking customers out of checkout.

Fix:
  - After `var selectedReceiptFile = null;` (line 1312), expose a getter on
    window: window.__getSelectedReceiptFile = function(){return selectedReceiptFile;};
  - After `selectedReceiptFile = file;` (line 1345, inside acceptReceiptFile),
    fire window.__v9MarkReceiptSelected().
  - When selectedReceiptFile is reset to null (line 1330, inside
    clearReceipt), fire window.__v9MarkReceiptRemoved().

Bug B (SUCCESS CARD NEVER SHOWN — WhatsApp dual-verification is dead code)
==========================================================================
The v9 success card is mounted in DOM but the existing inline placeOrder()
async flow fires `window.location.href = 'invoice.html?order=' + ...;`
immediately after `await J.createOrder(...)`. v9ShowSuccessCard is never
called, so customers never see the WhatsApp dual-verification CTA.

Fix:
  - Intercept the line `window.location.href = 'invoice.html?order='+
    encodeURIComponent(order.order_number);` (line 1448) and prepend a call
    to `window.v9ShowSuccessCard(order)`. v9ShowSuccessCard starts a 10s
    countdown; if the user clicks either "Send via WhatsApp" or "View
    Invoice" inside the success card, the countdown is cancelled and the
    click handler triggers the redirect manually. If neither is clicked,
    the conditional below ALSO keeps the original redirect as a safety
    fallback (in case window.v9ShowSuccessCard is undefined for any
    reason), so customers still reach the invoice.

Idempotency:
  Each step is gated on a unique v9:wire-up-* marker.
"""
import io
import sys

PATH = '/root/JMPOTTERS/checkout.html'


def apply_once(src, marker, old, new, count=1):
    """Apply old->new with idempotency marker."""
    if marker in src:
        return src, 'no-op-' + marker
    if old not in src:
        # Look for the literal with relaxed whitespace using both 4 and 8
        # leading spaces since the v3 composer's exact indentation varies.
        # Try a quick swap-and-retry for leading whitespace.
        candidates = [old, old.lstrip(), old.rstrip()]
        for c in list(candidates):
            # Pad with common leading indents if the original started white.
            for indent in ['    ', '        ', '\t']:
                trial = indent + c.lstrip()
                if trial in src:
                    new_src = src.replace(trial, indent + new.lstrip(), count)
                    new_src = new_src.replace('</style>', '/* ' + marker + ' */\n</style>', 1) if new_src != src else new_src
                    return new_src, 'applied-' + marker
        print('WARN: marker=%s pattern-not-found (continuing)' % marker, file=sys.stderr)
        return src, 'miss-' + marker
    new_src = src.replace(old, new, count)
    # Stamp marker near </style> as canonical idempotency target.
    new_src = new_src.replace('</style>', '/* ' + marker + ' */\n</style>', 1)
    return new_src, 'applied-' + marker


def main():
    src = io.open(PATH, 'r', encoding='utf-8').read()
    notes = []

    # ------------------------------------------------------------------
    # Bug A.1 — Expose the IIFE-local selectedReceiptFile to window so the
    #          existing v9 helpers can poll it. Anchor: line 1312.
    # ------------------------------------------------------------------
    src, n = apply_once(
        src,
        'v9:wire-up-expose-receipt-getter',
        """var selectedReceiptFile = null;""",
        """var selectedReceiptFile = null;
            // v9 wire-up: expose the IIFE-local var to window so the
            //             receipt-mandatory gate helpers can read it.
            window.__getSelectedReceiptFile = function(){ return selectedReceiptFile; };""",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # Bug A.2 — Fire the v9 enable hook when a receipt is picked.
    #          Anchor: line 1345.
    # ------------------------------------------------------------------
    src, n = apply_once(
        src,
        'v9:wire-up-receipt-selected-hook',
        """selectedReceiptFile = file;""",
        """selectedReceiptFile = file;
                // v9 wire-up: notify v9 helpers that a receipt is now selected.
                if (window.__v9MarkReceiptSelected) window.__v9MarkReceiptSelected();""",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # Bug A.3 — Fire the v9 disable hook when the receipt is cleared.
    #          Anchor: line 1330.
    # ------------------------------------------------------------------
    src, n = apply_once(
        src,
        'v9:wire-up-receipt-removed-hook',
        """selectedReceiptFile = null;""",
        """selectedReceiptFile = null;
                // v9 wire-up: notify v9 helpers that the receipt was removed.
                if (window.__v9MarkReceiptRemoved) window.__v9MarkReceiptRemoved();""",
        count=1,
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # Bug B — Intercept the post-createOrder redirect to surface the
    #         WhatsApp dual-verification success card. Anchor: line 1448.
    # ------------------------------------------------------------------
    src, n = apply_once(
        src,
        'v9:wire-up-success-card-call',
        """window.location.href = 'invoice.html?order=' + encodeURIComponent(order.order_number);""",
        """// v9 wire-up: surface the WhatsApp dual-verification success card
                //             BEFORE the redirect. The card provides a 10s
                //             auto-redirect countdown that cancels on either
                //             button click, AND falls back to the original
                //             redirect below if the success card helper is
                //             unavailable for any reason.
                if (typeof window.v9ShowSuccessCard === 'function') {
                    window.v9ShowSuccessCard(order);
                    return;
                }
                window.location.href = 'invoice.html?order=' + encodeURIComponent(order.order_number);""",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # Optional follow-on: the v9 helpers already expose v9EnablePlaceOrder
    # + v9DisablePlaceOrder. Pair them with the mark/unmark hooks so the
    # patches above work end-to-end. Inject the hooks into the existing v9
    # helper block just before the closing IIFE.
    # ------------------------------------------------------------------
    src, n = apply_once(
        src,
        'v9:wire-up-mark-hook-globals',
        """window.v9DisablePlaceOrder = v9DisablePlaceOrder;
            if (document.readyState === "loading") {""",
        """window.v9DisablePlaceOrder = v9DisablePlaceOrder;
            // v9 wire-up: connect the IIFE-local receipt assignment to the
            //              v9 enable/disable helpers.
            window.__v9MarkReceiptSelected = function() {
                if (typeof v9EnablePlaceOrder === 'function') v9EnablePlaceOrder();
            };
            window.__v9MarkReceiptRemoved = function() {
                if (typeof v9DisablePlaceOrder === 'function') v9DisablePlaceOrder();
            };
            if (document.readyState === "loading") {""",
    )
    notes.append(n)

    io.open(PATH, 'w', encoding='utf-8').write(src)
    print('wrote ' + PATH + ' (' + str(len(src)) + ' bytes)')
    for note in notes:
        print('  ' + note)
    return 0


if __name__ == '__main__':
    sys.exit(main())
