#!/usr/bin/env python3
r"""
tiny kick patcher — fixes the one v9 patch that missed in v9_uioverhaul.py.

Why this exists:
  The first v9 run anchored the chat-icon-size rule on a literal string
  `        /* v4 image-fallback: sibling-element + adjacent-class-swap... */`
  with 8 leading spaces. The actual on-disk line uses a different (likely 4)
  indentation. So `str.replace(old, new, 1)` returned 0 and the patch was
  skipped.

  This script uses a regex anchor so it lands regardless of the exact
  whitespace.

What it applies:
  - .checkout-pay-foot > svg { width: 22px; height: 22px; flex-shrink: 0; }
  - .checkout-pay-foot .wa-link-strong (green WhatsApp inline pill button)
  - required-mark CSS rule (already shipped by v9uioverhaul — duplicate guard
    so re-running this kick is idempotent)

Idempotency:
  `v9:chaticon-size` marker comment is stamped into the new content, and the
  apply step early-returns if `v9:chaticon-size` is already present.
"""
import io
import re
import sys

PATH = '/root/JMPOTTERS/checkout.html'
MARKER = 'v9:chaticon-size'


def main():
    src = io.open(PATH, 'r', encoding='utf-8').read()

    if MARKER in src:
        print('v9:chaticon-size already applied — no-op')
        return 0

    # Regex anchor on the v4 image-fallback comment (whitespace-flexible).
    pattern = re.compile(
        r'(/[ \t]*\*[ \t]*v4 image-fallback:[^\n]*?\*/)',
        re.MULTILINE,
    )

    insertion = (
        '\n/* v9: constraining chat-icon + WhatsApp foot SVG inside .checkout-pay-foot */'
        '\n.checkout-pay-foot > svg { width: 22px; height: 22px; flex-shrink: 0; }'
        '\n.checkout-pay-foot .wa-link-strong {'
        '\n    background: linear-gradient(135deg,#22c55e 0%,#16a34a 100%);'
        '\n    color:#fff !important;'
        '\n    padding: 6px 12px;'
        '\n    border-radius: 8px;'
        '\n    font-weight: 700;'
        '\n    text-decoration: none;'
        '\n    display: inline-flex;'
        '\n    align-items: center;'
        '\n    gap: 6px;'
        '\n    transition: transform var(--motion-fast), box-shadow var(--motion-med);'
        '\n}'
        '\n.checkout-pay-foot .wa-link-strong:hover {'
        '\n    transform: translateY(-1px);'
        '\n    box-shadow: 0 6px 16px rgba(34,197,94,0.35);'
        '\n}'
        '\n.required-mark { color: var(--danger-500); font-weight: 800; margin-right: 4px; font-size: 0.95rem; }'
        '\n/* ' + MARKER + ' */'
    )

    new_src, n = pattern.subn(r'\1' + insertion, src, count=1)

    if n == 0:
        print('ERROR: v4 image-fallback anchor not found anywhere — manual intervention required.', file=sys.stderr)
        return 1

    # Stamp the marker on a fresh line just before </style> as a single
    # canonical record (idempotency early-exit target), even though the
    # insertion above also stamps it.
    if '/* ' + MARKER + ' */\n</style>' not in new_src:
        new_src = new_src.replace('</style>', '/* ' + MARKER + ' canonical-marker */\n</style>', 1)

    io.open(PATH, 'w', encoding='utf-8').write(new_src)
    print('v9:chaticon-size applied (' + str(n) + ' replacement). wrote ' + PATH + ' (' + str(len(new_src)) + ' bytes)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
