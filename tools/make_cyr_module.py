#!/usr/bin/env python3
# Builds src/cyr.js, the Cyrillic word module for figures (notes/i18n/DESIGN.md 5), from the phase-1 glyph tables
# notes/i18n/proto/cyr/cyr_{rm,bx,ti}.json (Computer Modern Unicode Serif, made by proto/cyr/make_cyr_glyphs.py from
# cmunrm.otf, cmunbx.otf, cmunti.otf; SIL OFL). Run: python3 tools/make_cyr_module.py
# Compact: the outlines are rewritten with relative commands (same points, fewer digits), the italic face keeps only
# the panel letters а б в г д е ж з и к л м, and each face is one JSON string that the page parses on the first
# Russian caption only (English never does).
import json, re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
cyr = root / 'notes' / 'i18n' / 'proto' / 'cyr'
ITALIC = 'абвгдежзиклм'
TOK = re.compile(r'[MLHVCZmlhvcz]|-?\d+(?:\.\d+)?')


def num(x):
    s = ('%.2f' % x).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def relative(d):
    """Absolute M L H V C Z (fontTools' SVG pen) -> relative m l h v c z; returns (path, ymin, ymax, xmin, xmax)."""
    toks = TOK.findall(d)
    i, out = 0, []
    x = y = sx = sy = 0.0
    ys, xs = [], []
    cmd = None

    def nums(n):
        nonlocal i
        v = [float(t) for t in toks[i:i + n]]
        i += n
        return v
    while i < len(toks):
        t = toks[i]
        if re.match(r'[A-Za-z]', t):
            cmd = t
            i += 1
            if cmd in 'Zz':
                out.append('z')
                x, y = sx, sy
                continue
        assert cmd and cmd.isupper(), d[:80]
        if cmd == 'M':
            nx, ny = nums(2)
            out.append('m' + num(nx - x) + ' ' + num(ny - y))
            x, y, sx, sy = nx, ny, nx, ny
            cmd = 'L'                       # implicit lineto after a moveto
            xs.append(x); ys.append(y)
        elif cmd == 'L':
            nx, ny = nums(2)
            out.append('l' + num(nx - x) + ' ' + num(ny - y))
            x, y = nx, ny
            xs.append(x); ys.append(y)
        elif cmd == 'H':
            (nx,) = nums(1)
            out.append('h' + num(nx - x))
            x = nx
            xs.append(x)
        elif cmd == 'V':
            (ny,) = nums(1)
            out.append('v' + num(ny - y))
            y = ny
            ys.append(y)
        elif cmd == 'C':
            a = nums(6)
            out.append('c' + ' '.join(num(a[j] - (x if j % 2 == 0 else y)) for j in range(6)))
            xs += a[0::2]; ys += a[1::2]
            x, y = a[4], a[5]
        else:
            raise ValueError(cmd)
    s = ''.join(out)
    s = re.sub(r' -', '-', s)                # "1 -2" -> "1-2"
    return s, min(ys or [0]), max(ys or [0]), min(xs or [0]), max(xs or [0])


faces = {}
for k in ('rm', 'bx', 'ti'):
    t = json.load(open(cyr / f'cyr_{k}.json', encoding='utf-8'))
    glyphs = {}
    for ch, (adv, d) in t['glyphs'].items():
        if k == 'ti' and ch not in ITALIC:
            continue
        p, y0, y1, x0, x1 = relative(d)
        glyphs[ch] = [adv, p, round(y0), round(y1)]
    kern = {pair: v for pair, v in t['kern'].items() if all(c in glyphs for c in pair)}
    faces[k] = {'face': t['face'], 'stroke': t['stroke'], 'space': t['check'].get(' ', 333), 'glyphs': glyphs, 'kern': kern}

src = (root / 'tools' / 'cyr_template.js').read_text(encoding='utf-8')
lits = {k: json.dumps(json.dumps(v, ensure_ascii=False, separators=(',', ':')), ensure_ascii=False) for k, v in faces.items()}
out = src.replace('/*RM*/""', lits['rm']).replace('/*BX*/""', lits['bx']).replace('/*TI*/""', lits['ti'])
with open(root / 'src' / 'cyr.js', 'w', encoding='utf-8', newline='\n') as f:   # UTF-8 and LF on every platform
    f.write(out)
sizes = {k: len(v) for k, v in lits.items()}
orig = {k: len(json.dumps(json.load(open(cyr / f'cyr_{k}.json', encoding='utf-8')), ensure_ascii=False, separators=(',', ':'))) for k in faces}
print('src/cyr.js', (root / 'src' / 'cyr.js').stat().st_size, 'bytes; faces', sizes, 'from', orig)
