#!/usr/bin/env python3
r"""
v11 patcher — align the silhouette-footer boundary comments in
/root/JMPOTTERS/checkout.html to match cart.html's indented style.

The diagnostic basher showed two footers are byte-identical for CSS and
byte-identical for body markup, but checkout.html slipped on whitespace at
two boundary comments:

  1.  `<!-- ===== SILHOUETTE FOOTER ===== -->` is at column 0 in
      checkout.html but at column 4 (4 leading spaces) in cart.html.
  2.  `<!-- Back to top -->` is at column 0 in checkout.html but at
      column 4 (4 leading spaces) in cart.html.

Plus a missing blank line between `</footer>` and the Back-to-top comment.

This patcher rewrites those 3 cosmetic things so the footer block in
checkout.html is byte-for-byte identical to cart.html's. Idempotent via
a v11:footer-aligned marker comment stamped before </style>. Re-runs
return early as a no-op.
"""
import io
import sys

PATH = '/root/JMPOTTERS/checkout.html'
MARKER = 'v11:footer-aligned'


def apply_once(src, marker, old, new, count=1):
    if marker in src:
        return src, 'no-op-' + marker
    if old not in src:
        print('WARN: marker=%s pattern-not-found (continuing)' % marker, file=sys.stderr)
        return src, 'miss-' + marker
    new_src = src.replace(old, new, count)
    new_src = new_src.replace('</style>', '/* ' + marker + ' */\n</style>', 1)
    return new_src, 'applied-' + marker


def main():
    src = io.open(PATH, 'r', encoding='utf-8').read()
    notes = []

    # ------------------------------------------------------------------
    # 1) Re-indent the SILHOUETTE FOOTER boundary comment.
    #    cart.html has 4 leading spaces; checkout.html has none.
    # ------------------------------------------------------------------
    src, n = apply_once(
        src,
        'v11:footer-comment-align',
        """<!-- ===== SILHOUETTE FOOTER ===== -->
    <footer class=\"silhouette-footer\">""",
        """    <!-- ===== SILHOUETTE FOOTER ===== -->
    <footer class=\"silhouette-footer\">""",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 2) Re-indent the Back-to-top boundary comment + restore the blank
    #    line above it. cart.html has a blank line between </footer> and
    #    the Back-to-top comment; checkout.html has none.
    # ------------------------------------------------------------------
    src, n = apply_once(
        src,
        'v11:back-to-top-comment-align',
        """</footer>
<!-- Back to top -->""",
        """</footer>

    <!-- Back to top -->""",
    )
    notes.append(n)

    # ------------------------------------------------------------------
    # 3) Also align the "JMPOTTERS_THEME_JS placeholder" comment
    #    that immediately follows `</footer>` in some pages, IF present
    #    in checkout.html. Optional / safe — idem if absent.
    # ------------------------------------------------------------------
    src, n = apply_once(
        src,
        'v11:placeholder-comment-align',
        "<!-- JMPOTTERS_THEME_JS placeholder (replaced with /theme.js at deploy) -->",
        "    <!-- JMPOTTERS_THEME_JS placeholder (replaced with /theme.js at deploy) -->",
    )
    notes.append(n)

    io.open(PATH, 'w', encoding='utf-8').write(src)
    print('wrote ' + PATH + ' (' + str(len(src)) + ' bytes)')
    for note in notes:
        print('  ' + note)
    return 0


if __name__ == '__main__':
    sys.exit(main())
