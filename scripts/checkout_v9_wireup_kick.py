#!/usr/bin/env python3
import io, sys, re

PATH = '/root/JMPOTTERS/checkout.html'
MARKER = 'v9:wire-up-mark-hook-globals'

def main():
    src = io.open(PATH, 'r', encoding='utf-8').read()
    if MARKER in src:
        print('marker already present — no-op')
        return 0
    # Flexible regex: any whitespace between the two anchor lines
    pattern = re.compile(
        r'(\s*window\.v9DisablePlaceOrder\s*=\s*v9DisablePlaceOrder;\s*)(\n\s*if\s*\(\s*document\.readyState\b[^\n]*)',
        re.MULTILINE,
    )
    injection = (
        '\n            // v9 wire-up: connect IIFE-local receipt assignment to v9 enable/disable helpers.\n'
        '            window.__v9MarkReceiptSelected = function() {\n'
        '                if (typeof v9EnablePlaceOrder === "function") v9EnablePlaceOrder();\n'
        '            };\n'
        '            window.__v9MarkReceiptRemoved = function() {\n'
        '                if (typeof v9DisablePlaceOrder === "function") v9DisablePlaceOrder();\n'
        '            };\n'
    )
    new_src, n = pattern.subn(r'\1' + injection + r'\2', src, count=1)
    if n == 0:
        # Fallback: anchor purely on the line that sets v9DisablePlaceOrder
        fallback = re.compile(r'(window\.v9DisablePlaceOrder\s*=\s*v9DisablePlaceOrder;\s*\n)')
        new_src, n = fallback.subn(r'\1' + injection, src, count=1)
    if n == 0:
        print('ERROR: even the fallback anchor missed \u2014 manual intervention required', file=sys.stderr)
        return 1
    new_src = new_src.replace('</style>', '/* ' + MARKER + ' */\n</style>', 1)
    io.open(PATH, 'w', encoding='utf-8').write(new_src)
    print('applied (' + str(n) + ' replacement). wrote ' + PATH + ' (' + str(len(new_src)) + ' bytes)')
    return 0

if __name__ == '__main__':
    sys.exit(main())
