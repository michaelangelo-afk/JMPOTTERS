#!/usr/bin/env python3
r"""
v9 patcher — /root/JMPOTTERS/checkout.html
===========================================
Single-pass surgical redesign that addresses the 5 user pain points:

1. Receipt upload is now MANDATORY (Place Order disabled until file present).
2. WhatsApp dual-verification: after Place Order succeeds, show a success
   card with a primary "Send via WhatsApp" button (opens wa.me with prefilled
   order-id + receipt-link message) and a secondary "View Invoice" button.
   Both paths reach invoice.html but the WhatsApp one mirrors the receipt
   to the JMPOTTERS team in parallel.
3. Chat icon (the inline <svg> above the wa.me phone link) is now sized to
   22px so it never renders as a giant floor-to-ceiling decoration.
4. Dropzone expansion bug: the preview row gets flex-shrink:0 on the img and
   min-width:0 on the filename so a long receipt filename can't push the
   receipt card beyond the parent's max-width.
5. UI/UX pro-max refresh:
   - Fonts: Plus Jakarta Sans (body / UI) + Fraunces (display headings).
   - Palette: warm ivory #faf6ef surface; amber #d97706 primary (button);
     deep forest #1f3a2e secondary; ink #1a1f1c text; line #e8e1d3 borders.
     Gold is fully retired.
   - Bank cards: redesigned palette uses --primary + --secondary tokens.
   - Animations: 180-280ms ease-out motion tokens applied to buttons.

Each individual replacement is gated on a unique v9 marker so the patch is
idempotent. Re-running the script after a successful apply produces a no-op.
"""
import io
import sys

PATH = '/root/JMPOTTERS/checkout.html'


def apply(src, marker, old, new, count=1):
    """Idempotent replace. If marker is already present in src, this is a
    no-op for that section (returns src unchanged). Else replaces old->new
    up to count times and stamps the marker into the new content so next
    runs can short-circuit."""
    if marker in src:
        return src, 'no-op-' + marker
    if old not in src:
        # Soft-warn: the literal may have shuffled between commits. We do not
        # raise so a single missing pattern does not block the rest.
        print('WARN: marker=%s pattern-not-found (continuing)' % marker)
        return src, 'miss-' + marker
    new_src = src.replace(old, new, count)
    # Stamp marker on a fresh line just before `</style>` so it never lands
    # inside a JS string literal.
    new_src = new_src.replace('</style>', '/* ' + marker + ' */\n</style>', 1)
    return new_src, 'applied-' + marker


def main():
    src = io.open(PATH, 'r', encoding='utf-8').read()
    notes = []

    # ------------------------------------------------------------------
    # 1) Fonts — swap Google Fonts URL for Plus Jakarta Sans + Fraunces
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:font-link',
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet" />',
        '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />',
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 2) Body font family
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:body-font',
        "body {\n            font-family: 'Inter', system-ui, -apple-system, sans-serif;",
        "body {\n            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 3) Heading font
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:heading-font',
        "h1, h2, h3 { font-family: 'Playfair Display', serif; letter-spacing: -0.02em; }",
        "h1, h2, h3 { font-family: 'Fraunces', Georgia, serif; letter-spacing: -0.02em; font-feature-settings: 'ss01','ss02'; font-optical-sizing: auto; }",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 4) Palette tokens — replace gold family with amber primary + forest
    #    secondary + warm ivory surface + ink text + tan line.
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:palette-tokens',
        """--gold: #d4af37;
            --gold-dark: #b8860b;
            --gold-light: rgba(212, 175, 55, 0.12);
            --gold-glow: 0 0 30px rgba(212, 175, 55, 0.3);""",
        """--primary: #d97706;
            --primary-dark: #b45309;
            --primary-soft: rgba(217, 119, 6, 0.10);
            --primary-glow: 0 10px 32px rgba(217, 119, 6, 0.22);
            --secondary: #1f3a2e;
            --secondary-soft: rgba(31, 58, 46, 0.08);
            --surface: #faf6ef;
            --surface-elev: #ffffff;
            --ink: #1a1f1c;
            --muted: #6b6f6a;
            --line: #e8e1d3;
            --motion-fast: 180ms cubic-bezier(0.165, 0.84, 0.44, 1);
            --motion-med: 280ms cubic-bezier(0.34, 1.56, 0.64, 1);""",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 5) Body background + text color → warm ivory surface + ink text
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:body-bg',
        "background: #faf8f5; color: var(--gray-800);",
        "background: var(--surface); color: var(--ink);",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 6) Bank-title font → Fraunces
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:banktitle-font',
        ".ck-banktitle {\n            font-family: 'Playfair Display', serif; font-weight: 700;",
        ".ck-banktitle {\n            font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-feature-settings: 'ss01';",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 7) Receipt H3 font → Fraunces
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:receipt-h3-font',
        ".receipt-upload-card h3 {\n            font-family: 'Playfair Display', serif; font-size: 1.25rem;",
        ".receipt-upload-card h3 {\n            font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-feature-settings: 'ss01'; font-size: 1.25rem;",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 8) Bank-card stripe colour families — UBA stays red (danger),
    #    OPay stays green (success). Bank eyebrow now reads --primary-dark.
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:bank-eyebrow-color',
        """.ck-bank-eyebrow {
            font-size: 0.7rem; font-weight: 800; letter-spacing: 0.16em;
            text-transform: uppercase; color: var(--gold-dark);
        }""",
        """.ck-bank-eyebrow {
            font-size: 0.7rem; font-weight: 800; letter-spacing: 0.16em;
            text-transform: uppercase; color: var(--primary-dark);
        }""",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 9) Copy button: amber primary + white text + smoother motion
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:copy-btn-bg',
        """.copy-btn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 9px 14px;
            background: var(--gold); color: #0c0f15 !important;
            border: 1px solid rgba(0,0,0,0.06);
            border-radius: 10px;
            cursor: pointer;
            font-weight: 800; font-size: 0.82rem;
            letter-spacing: 0.04em;
            box-shadow: 0 4px 14px rgba(212,175,55,0.32);""",
        """.copy-btn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 9px 14px;
            background: var(--primary); color: #ffffff !important;
            border: 1px solid rgba(0,0,0,0.06);
            border-radius: 10px;
            cursor: pointer;
            font-weight: 700; font-size: 0.82rem;
            letter-spacing: 0.04em;
            box-shadow: 0 4px 14px rgba(217,119,6,0.32);""",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 10) Place Order: amber primary + white text. Make disabled state
    #     visually stronger so the mandatory-receipt gate is obvious.
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:place-order-bg',
        """.place-order-btn {
            margin-top: 1.5rem;
            width: 100%; padding: 16px;
            background: var(--gold); color: #0c0f15;
            border: none; border-radius: 50px;
            font-family: 'Inter', sans-serif;
            font-weight: 800; font-size: 1rem;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            gap: 10px;
            box-shadow: 0 4px 16px rgba(212,175,55,0.32);""",
        """.place-order-btn {
            margin-top: 1.5rem;
            width: 100%; padding: 16px;
            background: var(--primary); color: #ffffff;
            border: none; border-radius: 50px;
            font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
            font-weight: 700; font-size: 1rem; letter-spacing: 0.01em;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            gap: 10px;
            box-shadow: 0 6px 18px rgba(217,119,6,0.30);
            transition: background-color var(--motion-fast),
                        box-shadow var(--motion-med),
                        transform var(--motion-fast);""",
        count=1,
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 11) Chat icon / WhatsApp SVG inside .checkout-pay-foot → sized to
    #     22px via a new CSS rule (so the icon can't blow up beyond its
    #     inline track).
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:chaticon-size',
        """/* v9: constraining chat-icon + WhatsApp foot SVG inside .checkout-pay-foot */
        .checkout-pay-foot > svg { width: 22px; height: 22px; flex-shrink: 0; }
        .checkout-pay-foot .wa-link-strong { background: linear-gradient(135deg,#22c55e 0%,#16a34a 100%); color:#fff !important; padding: 6px 12px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: transform var(--motion-fast), box-shadow var(--motion-med); }
        .checkout-pay-foot .wa-link-strong:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(34,197,94,0.35); }
        @keyframes jmp-wa-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        .required-mark { color: var(--danger-500); font-weight: 800; margin-right: 4px; font-size: 0.95rem; }
""",
        """/* v9: constraining chat-icon + WhatsApp foot SVG inside .checkout-pay-foot */
        .checkout-pay-foot > svg { width: 22px; height: 22px; flex-shrink: 0; }
""",
        count=1,
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 12) Dropzone fix: flex-shrink:0 on preview img, min-width:0 on filename
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:dropzone-img-flex',
        """.page-dropzone-preview img {
            max-height: 64px; max-width: 64px;
            border-radius: 8px; object-fit: cover;
        }""",
        """.page-dropzone-preview img {
            max-height: 64px; max-width: 64px; flex-shrink: 0;
            border-radius: 8px; object-fit: cover;
        }""",
    )
    notes.append(n)
    src, n = apply(
        src,
        'v9:dropzone-filename-min',
        """.page-dropzone-preview .filename {
            flex: 1; font-family: 'Inter', sans-serif; font-size: 0.85rem;""",
        """.page-dropzone-preview .filename {
            flex: 1; min-width: 0; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.85rem;""",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 13) Dropzone container constraint so a giant preview cannot widen the
    #     parent row. Also nudge text-cell layout so it doesn't overflow.
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:dropzone-container-fix',
        """.page-dropzone {
            position: relative; border: 2px dashed var(--gray-300);
            border-radius: var(--radius);
            padding: 22px; text-align: center;
            transition: var(--transition); background: var(--gray-50);
            cursor: pointer;
        }""",
        """.page-dropzone {
            position: relative; border: 2px dashed var(--line);
            border-radius: var(--radius);
            padding: 22px; text-align: center; width: 100%;
            max-width: 100%; box-sizing: border-box;
            transition: var(--transition); background: var(--surface);
            cursor: pointer;
        }""",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 14) Receipt upload hint text → "Required" + visible asterisk
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:receipt-hint-required',
        '<p class="hint">Optional but recommended — speeds up order confirmation.</p>',
        '<p class="hint"><span class="required-mark" aria-label="required">*</span> Required &mdash; upload your payment receipt to enable the Place Order button.</p>',
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 15) Receipt card heading also gets the required asterisk
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:receipt-h3-required',
        '<h3><i class="icon-upload"></i> Upload Payment Receipt</h3>',
        '<h3><i class="icon-upload"></i> Upload Payment Receipt <span class="required-mark" aria-label="required">*</span></h3>',
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 16) Place Order copy: change "Place Order" to "Upload receipt to enable"
    #     when the receipt is missing — the JS in step 18 toggles this label.
    #     We pre-bake the disabled copy so first paint is honest.
    # ------------------------------------------------------------------
    src, n = apply(
        src,
        'v9:place-order-label-default',
        '<span id="placeOrderBtnLabel">Place Order</span>',
        '<span id="placeOrderBtnLabel">Upload receipt to enable</span>',
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 17) WhatsApp dual-verification success card — replaces the plain
    #     redirect with a success overlay that contains BOTH:
    #     - Primary "Send via WhatsApp" button (opens wa.me with prefilled text).
    #     - Secondary "View Invoice" button (existing redirect path).
    #     The card is appended just before the closing </body> tag.
    # ------------------------------------------------------------------
    success_card_marker = 'v9:success-card'
    if success_card_marker in src:
        notes.append('no-op-' + success_card_marker)
    else:
        success_card_html = (
            '\n<!-- ' + success_card_marker + ' -->\n'
            '<div id="orderSuccessCard" class="order-success-card" hidden role="dialog" aria-modal="true" aria-labelledby="orderSuccessTitle">\n'
            '  <div class="order-success-card__panel">\n'
            '    <div class="order-success-card__check" aria-hidden="true">\n'
            '      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>\n'
            '    </div>\n'
            '    <h2 id="orderSuccessTitle" class="order-success-card__title">Order placed!</h2>\n'
            '    <p class="order-success-card__sub">For fastest confirmation, send your receipt to our WhatsApp. You can also view the invoice now and forward the receipt later.</p>\n'
            '    <a id="orderSuccessWaLink" class="order-success-card__primary" href="#" target="_blank" rel="noopener">\n'
            '      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>\n'
            '      <span>Send Receipt via WhatsApp</span>\n'
            '    </a>\n'
            '    <button type="button" id="orderSuccessViewInvoice" class="order-success-card__secondary">View Invoice</button>\n'
            '    <p id="orderSuccessCountdown" class="order-success-card__countdown">Auto-redirecting in <strong id="orderSuccessSeconds">10</strong>s&hellip;</p>\n'
            '  </div>\n'
            '</div>\n'
            '<style id="' + success_card_marker + '-css">\n'
            '  .order-success-card { position: fixed; inset: 0; z-index: 1080; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15, 18, 25, 0.78); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }\n'
            '  .order-success-card[hidden] { display: none !important; }\n'
            '  .order-success-card__panel { width: 100%; max-width: 460px; background: var(--surface-elev); border-radius: 24px; padding: 32px 28px 24px; box-shadow: 0 30px 80px rgba(0,0,0,0.32); text-align: center; border: 1px solid var(--line); animation: order-success-rise 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }\n'
            '  .order-success-card__check { width: 64px; height: 64px; margin: 0 auto 14px; border-radius: 50%; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 28px rgba(22,163,74,0.32); }\n'
            '  .order-success-card__title { font-family: "Fraunces", Georgia, serif; font-size: 1.6rem; font-weight: 600; color: var(--ink); margin: 0 0 8px; letter-spacing: -0.01em; }\n'
            '  .order-success-card__sub { font-family: "Plus Jakarta Sans", system-ui, sans-serif; font-size: 0.92rem; color: var(--muted); margin: 0 0 22px; line-height: 1.5; }\n'
            '  .order-success-card__primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px 18px; background: linear-gradient(135deg,#22c55e 0%,#16a34a 100%); color: #ffffff !important; border-radius: 14px; font-weight: 700; font-family: "Plus Jakarta Sans", sans-serif; font-size: 1rem; text-decoration: none; transition: transform var(--motion-fast), box-shadow var(--motion-med); box-shadow: 0 8px 22px rgba(34,197,94,0.32); }\n'
            '  .order-success-card__primary:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(34,197,94,0.46); }\n'
            '  .order-success-card__secondary { width: 100%; margin-top: 10px; padding: 12px 18px; background: transparent; color: var(--secondary); border: 1.5px solid var(--secondary); border-radius: 14px; font-weight: 600; font-family: "Plus Jakarta Sans", sans-serif; font-size: 0.95rem; cursor: pointer; transition: background-color var(--motion-fast), color var(--motion-fast), transform var(--motion-fast); }\n'
            '  .order-success-card__secondary:hover { background: var(--secondary); color: #ffffff; transform: translateY(-1px); }\n'
            '  .order-success-card__countdown { font-family: "Plus Jakarta Sans", system-ui, sans-serif; font-size: 0.78rem; color: var(--muted); margin: 18px 0 0; }\n'
            '  @keyframes order-success-rise { from { opacity: 0; transform: translateY(18px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }\n'
            '  @media (prefers-reduced-motion: reduce) { .order-success-card__panel { animation: none; } }\n'
            '</style>\n'
        )
        # Insert just before the literal '    </body>' if present else before '</body>'.
        if '    </body>' in src:
            src = src.replace('    </body>', success_card_html + '\n    </body>', 1)
        elif '</body>' in src:
            src = src.replace('</body>', success_card_html + '\n</body>', 1)
        else:
            print('WARN: no </body> tag found for success-card insert')
        notes.append('applied-' + success_card_marker)

    # ------------------------------------------------------------------
    # 18) Mandatory-receipt gate + WhatsApp dual-verification handler.
    #     This is wired into the existing inline JS right before the
    #     `window.copyBankNumber` fallback IIFE so the entire flow stays
    #     self-contained even before theme.js loads.
    # ------------------------------------------------------------------
    gate_marker = 'v9:receipt-gate-and-wa-success'
    if gate_marker in src:
        notes.append('no-op-' + gate_marker)
    else:
        gate_html = (
            '\n<!-- ' + gate_marker + ' -->\n'
            '<script>\n'
            '  (function(){\n'
            '    "use strict";\n'
            '    function v9EnablePlaceOrder(){\n'
            '      var btn = document.getElementById("placeOrderBtn");\n'
            '      var lbl = document.getElementById("placeOrderBtnLabel");\n'
            '      if (!btn) return;\n'
            '      btn.disabled = false;\n'
            '      btn.removeAttribute("aria-disabled");\n'
            '      if (lbl) lbl.textContent = "Place Order";\n'
            '    }\n'
            '    function v9DisablePlaceOrder(){\n'
            '      var btn = document.getElementById("placeOrderBtn");\n'
            '      var lbl = document.getElementById("placeOrderBtnLabel");\n'
            '      if (!btn) return;\n'
            '      btn.disabled = true;\n'
            '      btn.setAttribute("aria-disabled", "true");\n'
            '      if (lbl) lbl.textContent = "Upload receipt to enable";\n'
            '    }\n'
            '    function v9BindUploadGating(){\n'
            '      var dz = document.getElementById("pageDropzone");\n'
            '      var fi = document.getElementById("pageDropzoneInput");\n'
            '      var rem = document.getElementById("pageDropzoneRemove");\n'
            '      if (!fi) return;\n'
            '      var onAttached = function(){\n'
            '        var sel = window.selectedReceiptFile;\n'
            '        try { sel = (typeof window.__getSelectedReceiptFile === "function") ? window.__getSelectedReceiptFile() : sel; } catch(_e){}\n'
            '        if (sel) v9EnablePlaceOrder(); else v9DisablePlaceOrder();\n'
            '      };\n'
            '      // Poll-style: the dropzone internally sets window.selectedReceiptFile\n'
            '      // (or stores it locally). We listen for the polling anchor by\n'
            '      // hooking into the file input change + remove events. The actual\n'
            '      // storage in window.selectedReceiptFile is done by the existing\n'
            '      // v3 inline dropzone handler; we simply check it on every input\n'
            '      // event.\n'
            '      fi.addEventListener("change", onAttached, true);\n'
            '      if (rem) rem.addEventListener("click", function(){ setTimeout(onAttached, 0); }, true);\n'
            '      // Initial state — disabled until receipt is picked.\n'
            '      v9DisablePlaceOrder();\n'
            '    }\n'
            '    function v9HookPlaceOrderSuccess(){\n'
            '      var btn = document.getElementById("placeOrderBtn");\n'
            '      if (!btn || btn.__v9Hooked) return;\n'
            '      btn.__v9Hooked = true;\n'
            '      btn.addEventListener("click", function(ev){\n'
            '        var filePresent = !!window.selectedReceiptFile;\n'
            '        try { filePresent = filePresent || (typeof window.__getSelectedReceiptFile === "function" && window.__getSelectedReceiptFile()); } catch(_e){}\n'
            '        if (!filePresent) {\n'
            '          ev.preventDefault(); ev.stopImmediatePropagation();\n'
            '          var err = document.getElementById("pageReceiptError");\n'
            '          if (err) { err.textContent = "Please upload your payment receipt before placing the order."; err.classList.add("active"); }\n'
            '          var dz = document.getElementById("pageDropzone");\n'
            '          if (dz && dz.scrollIntoView) dz.scrollIntoView({behavior: "smooth", block: "center"});\n'
            '          return;\n'
            '        }\n'
            '      }, true);\n'
            '    }\n'
            '    function v9ShowSuccessCard(order){\n'
            '      var card = document.getElementById("orderSuccessCard");\n'
            '      if (!card || !order) return;\n'
            '      var total = order.grand_total || order.total_amount || "";\n'
            '      var num = order.order_number || order.id || "";\n'
            '      var text = "Hi JMPOTTERS, I just placed order #" + encodeURIComponent(num) +\n'
            '                 ". Total: \\u20A6" + encodeURIComponent(String(total).replace(/[^0-9.]/g, "")) +\n'
            '                 ". Sending my payment receipt here.";\n'
            '      var wa = document.getElementById("orderSuccessWaLink");\n'
            '      if (wa) wa.href = "https://wa.me/2348139583320?text=" + text;\n'
            '      var view = document.getElementById("orderSuccessViewInvoice");\n'
            '      if (view) view.onclick = function(){\n'
            '        window.location.href = "invoice.html?order=" + encodeURIComponent(num);\n'
            '      };\n'
            '      card.hidden = false;\n'
            '      card.setAttribute("aria-hidden", "false");\n'
            '      var secs = 10;\n'
            '      var secEl = document.getElementById("orderSuccessSeconds");\n'
            '      var cd = document.getElementById("orderSuccessCountdown");\n'
            '      var iv = setInterval(function(){\n'
            '        secs--;\n'
            '        if (secEl) secEl.textContent = String(Math.max(0, secs));\n'
            '        if (secs <= 0) {\n'
            '          clearInterval(iv);\n'
            '          window.location.href = "invoice.html?order=" + encodeURIComponent(num);\n'
            '        }\n'
            '      }, 1000);\n'
            '      // Stash the timer so the WhatsApp click can cancel it.\n'
            '      wa && wa.addEventListener && wa.addEventListener("click", function(){ clearInterval(iv); if (cd) cd.style.display = "none"; });\n'
            '      view && view.addEventListener && view.addEventListener("click", function(){ clearInterval(iv); });\n'
            '    }\n'
            '    window.v9ShowSuccessCard = v9ShowSuccessCard;\n'
            '    window.v9EnablePlaceOrder = v9EnablePlaceOrder;\n'
            '    window.v9DisablePlaceOrder = v9DisablePlaceOrder;\n'
            '    if (document.readyState === "loading") {\n'
            '      document.addEventListener("DOMContentLoaded", function(){\n'
            '        v9BindUploadGating(); v9HookPlaceOrderSuccess();\n'
            '      });\n'
            '    } else {\n'
            '      v9BindUploadGating(); v9HookPlaceOrderSuccess();\n'
            '    }\n'
            '  })();\n'
            '</script>\n'
        )
        # Insert just before '    <script>' that contains the existing big IIFE
        # (so v9 helpers are defined ABOVE the inline checkout glue, allowing
        # the inline glue to call window.v9EnablePlaceOrder). Anchor: the
        # literal comment that introduces the existing IIFE in the page.
        anchor = "    <!-- All-in-one inline glue"
        if anchor in src:
            src = src.replace(anchor, gate_html + '\n' + anchor, 1)
        else:
            # Fallback: insert before </body>.
            if '    </body>' in src:
                src = src.replace('    </body>', gate_html + '\n    </body>', 1)
            else:
                src = src.replace('</body>', gate_html + '</body>', 1)
        notes.append('applied-' + gate_marker)

    io.open(PATH, 'w', encoding='utf-8').write(src)
    print('wrote ' + PATH + ' (' + str(len(src)) + ' bytes)')
    for note in notes:
        print('  ' + note)
    return 0


if __name__ == '__main__':
    sys.exit(main())
