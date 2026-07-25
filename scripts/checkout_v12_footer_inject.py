#!/usr/bin/env python3
import io, re, sys

PATH = '/root/JMPOTTERS/checkout.html'
CART = '/root/JMPOTTERS/cart.html'
MARKER = 'v12:footer-restored-from-cart'


def main() -> int:
    src = io.open(PATH, 'r', encoding='utf-8').read()
    if MARKER in src:
        print('v12 marker present - no-op')
        return 0

    cart = io.open(CART, 'r', encoding='utf-8').read()
    m = re.search(
        r'^[ \t]*<!-- ===== SILHOUETTE FOOTER ===== -->.*?^[ \t]*<!-- Back to top -->(?=\s*\n)',
        cart, re.DOTALL | re.MULTILINE,
    )
    if not m:
        print('cart.html footer regex missed', file=sys.stderr)
        return 1

    cart_footer = m.group(0)

    pattern = re.compile(
        r'^[ \t]*<!-- ===== SILHOUETTE FOOTER ===== -->.*?^[ \t]*<!-- Back to top -->(?=\s*\n)',
        re.DOTALL | re.MULTILINE,
    )
    if pattern.search(src):
        new = pattern.sub(cart_footer, src, count=1)
        print('replaced existing footer block (' + str(len(cart_footer)) + ' bytes)')
    else:
        if '<button class="back-to-top' in src:
            idx = src.find('<button class="back-to-top')
            new = src[:idx] + cart_footer + '\n\n' + src[idx:]
        else:
            idx = src.find('</body>')
            new = src[:idx] + cart_footer + '\n\n' + src[idx:]
        print('injected footer block (' + str(len(cart_footer)) + ' bytes)')

    new = new.replace('</style>', '/* ' + MARKER + ' */\n</style>', 1)
    io.open(PATH, 'w', encoding='utf-8').write(new)
    return 0


if __name__ == '__main__':
    sys.exit(main())
