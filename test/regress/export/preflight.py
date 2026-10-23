#!/usr/bin/env python3
# Preflight for the figures the app exports (notes/export-design/AS-BUILT.md; ported from notes/export-design/proto/
# preflight.py, review-editor.md M4). The files come from the built app through the headless harness:
#   python3 build.py && test/<you>_cdp/q.sh test/export_cmd.js && python3 test/regress/export/preflight.py --latex
# PDF:    no fonts, no SMask, no image interpolation, no ExtGState with CA/ca < 1, a PDF 1.3/1.4 header, and a MediaBox
#         whose width is the target layout width in bp (1 pt = 72/72.27 bp).
# PNG:    colour type 0 (grey), 2 (RGB) or 3 (indexed), never alpha; a pHYs chunk (the physical size).
# SVG:    no duplicate ids, no nested <svg>.
# Layout: no typeset box crosses a frame line or overlaps another box (titles, ticks, point labels, captions).
# --latex: every snippet compiled with latexmk in the document class it was made for (amsart, REVTeX two-column,
#         Letter with 1 in margins at 11 pt, Beamer 16:9): no errors, no overfull boxes, and the measured
#         \linewidth / \columnwidth / \textwidth equal to the width the figure claims.
# Exit status 1 on any failure. Options: --dir DIR (default: out/ next to this file), --latex.
import argparse, json, pathlib, re, shutil, struct, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument('--dir', default=str(pathlib.Path(__file__).resolve().parent / 'out'))
ap.add_argument('--latex', action='store_true')
args = ap.parse_args()
OUT = pathlib.Path(args.dir)
fails, rows = [], []


def check(name, ok, what):
    rows.append((name, 'ok ' if ok else 'FAIL', what))
    if not ok:
        fails.append(f'{name}: {what}')


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


have = {t: shutil.which(t) for t in ('pdffonts', 'pdfimages', 'latexmk')}
if not OUT.is_dir() or not any(OUT.iterdir()):
    print(f'no files in {OUT}: run test/export_cmd.js first')
    sys.exit(2)

for pdf in sorted(OUT.glob('*.pdf')):
    n = pdf.name
    d = pdf.read_bytes()
    if have['pdffonts']:
        fonts = run(['pdffonts', str(pdf)]).stdout.strip().splitlines()[2:]
        check(n, not fonts, f'fonts: {len(fonts)}')
    if have['pdfimages']:
        imgs = run(['pdfimages', '-list', str(pdf)]).stdout.strip().splitlines()[2:]
        kinds = sorted({l.split()[2] + '/' + l.split()[5] for l in imgs})
        check(n, not any(' smask ' in f' {l} ' for l in imgs), f'images {len(imgs)} {kinds}, no smask')
        check(n, not any(l.split()[9] == 'yes' for l in imgs), 'images not interpolated')
    ca = [float(v) for v in re.findall(rb'/(?:CA|ca) ([0-9.]+)', d)]
    check(n, all(v >= 1 for v in ca), f'ExtGState alpha values {sorted(set(ca)) or "none"}')
    check(n, b'/SMask' not in d, 'no /SMask')
    mb = re.search(rb'/MediaBox \[([^\]]*)\]', d)
    w = float(mb.group(1).split()[2]); h = float(mb.group(1).split()[3])
    bx = OUT / (pdf.stem + '-boxes.json')
    tgt = json.loads(bx.read_text()).get('target') if bx.exists() else None
    if tgt:
        check(n, abs(w - tgt * 72 / 72.27) < 0.02, f'MediaBox {w:.2f} x {h:.2f} bp; target {tgt} pt = {tgt * 72 / 72.27:.2f} bp')
    check(n, d[:8] in (b'%PDF-1.3', b'%PDF-1.4'), f'header {d[:8].decode(errors="replace")}')

for png in sorted(OUT.glob('*.png')):
    b = png.read_bytes()
    ct = b[25]; chunks = []
    i = 8
    while i < len(b):
        ln = struct.unpack('>I', b[i:i + 4])[0]; chunks.append(b[i + 4:i + 8].decode()); i += 12 + ln
    ok = ct in (0, 2, 3) and 'pHYs' in chunks
    ppm = None
    if 'pHYs' in chunks:
        j = b.index(b'pHYs') + 4
        ppm = struct.unpack('>I', b[j:j + 4])[0]
    check(png.name, ok, f'colour type {ct} ({ {0: "grey", 2: "RGB", 3: "indexed", 6: "RGBA"}.get(ct, ct) }), {round(ppm * 0.0254) if ppm else "no"} dpi, chunks {",".join(c for c in chunks if c != "IDAT")}')

for svg in sorted(OUT.glob('*.svg')):
    s = svg.read_text()
    ids = re.findall(r'\sid="([^"]+)"', s)
    dup = len(ids) - len(set(ids))
    nested = s.count('<svg') - 1
    refs = set(re.findall(r'(?:xlink:)?href="#([^"]+)"', s)) | set(re.findall(r'url\(#([^)]+)\)', s))
    missing = sorted(refs - set(ids))
    check(svg.name, dup == 0 and nested == 0 and not missing, f'{len(ids)} ids, {dup} duplicates, {nested} nested <svg>, {len(missing)} dangling refs, {len(s) // 1024} KB')


def inter(a, b, pad=0.0):
    return a['x0'] < b['x1'] - pad and a['x1'] > b['x0'] + pad and a['y0'] < b['y1'] - pad and a['y1'] > b['y0'] + pad


for bj in sorted(OUT.glob('*-boxes.json')):
    o = json.loads(bj.read_text()); boxes = o.get('boxes', []); name = bj.name.replace('-boxes.json', '')
    if not boxes:
        continue
    hits = []
    for b in boxes:
        for f in o.get('lines', []):  # a frame rectangle: does the box cross one of its four edges?
            for (x0, y0, x1, y1) in [(f['x0'], f['y0'], f['x1'], f['y0']), (f['x0'], f['y1'], f['x1'], f['y1']), (f['x0'], f['y0'], f['x0'], f['y1']), (f['x1'], f['y0'], f['x1'], f['y1'])]:
                if inter(b, {'x0': min(x0, x1) - 0.25, 'x1': max(x0, x1) + 0.25, 'y0': min(y0, y1) - 0.25, 'y1': max(y0, y1) + 0.25}):
                    hits.append(f"{b['kind']} '{b['tex']}' x frame")
    for i, a in enumerate(boxes):
        for b in boxes[i + 1:]:
            if a['kind'] == 'caption' and b['kind'] == 'caption':
                continue
            if inter(a, b, 0.2):
                hits.append(f"{a['kind']} '{a['tex']}' x {b['kind']} '{b['tex']}'")
    W = o.get('W')
    out = [b for b in boxes if W and (b['x0'] < -0.3 or b['x1'] > W + 0.3 or b['y0'] < -0.3)]
    for b in out:
        hits.append(f"{b['kind']} '{b['tex']}' outside the page")
    check(name, not hits, f'{len(boxes)} typeset boxes, collisions: {"; ".join(sorted(set(hits))[:6]) or "none"}')

# ---- the snippets in the documents they were made for ----
DOCS = {
    # tag suffix -> (preamble, the width the snippet names, the macro to measure)
    'article1': ('\\documentclass{amsart}\n\\usepackage{graphicx,amsmath,amssymb}', '\\linewidth'),
    'article2': ('\\documentclass[aps,twocolumn]{revtex4-2}\n\\usepackage{graphicx,amsmath,amssymb}', '\\columnwidth'),
    'article2W': ('\\documentclass[aps,twocolumn]{revtex4-2}\n\\usepackage{graphicx,amsmath,amssymb}', '\\textwidth'),
    'homework': ('\\documentclass[11pt]{article}\n\\usepackage[letterpaper,margin=1in]{geometry}\n\\usepackage{graphicx,amsmath,amssymb,float}', '\\linewidth'),
    'slides': ('\\documentclass[aspectratio=169]{beamer}\n\\usepackage{graphicx,amsmath,amssymb}', '\\textwidth'),
}
if args.latex:
    if not have['latexmk']:
        rows.append(('latex', 'info', 'latexmk not installed: skipped'))
    else:
        tdir = OUT / 'latex'
        tdir.mkdir(exist_ok=True)
        for kind, (pre, macro) in DOCS.items():
            texs = sorted(p for p in OUT.glob(f'*-{kind}.tex')) + sorted(p for p in OUT.glob(f'*-{kind}-bw.tex'))
            if not texs:
                continue
            body = []
            for t in texs:
                snip = t.read_text()
                # the file the snippet includes, next to the document
                if (OUT / f'{t.stem}.pdf').exists():
                    shutil.copy(OUT / f'{t.stem}.pdf', tdir / f'{t.stem}.pdf')
                else:
                    continue
                m = re.search(r'made for (\\[a-z]+) = ([0-9.]+)pt', snip)
                claim = float(m.group(2)) if m else None
                body.append(f'\\typeout{{CMW {t.stem} {macro}=\\the{macro} claim={claim}}}')
                if kind == 'homework':
                    body.append(f'\\section*{{Problem}} Find the image of the region under the map.\n{snip}\nThe figure stays right after the problem.\n')
                elif kind == 'slides':
                    body.append(snip)
                else:
                    body.append(f'Some text before the figure. {snip}\nSome text after it.\n\\clearpage')
            doc = f'{pre}\n\\begin{{document}}\n' + '\n'.join(body) + '\n\\end{document}\n'
            src = tdir / f'test-{kind}.tex'
            src.write_text(doc)
            r = run(['latexmk', '-pdf', '-interaction=nonstopmode', '-halt-on-error', src.name], cwd=tdir)
            log = (tdir / f'test-{kind}.log').read_text(errors='replace') if (tdir / f'test-{kind}.log').exists() else ''
            errs = re.findall(r'^! .*', log, re.M)
            over = re.findall(r'Overfull \\hbox \(([0-9.]+)pt too wide\)', log)
            widths = re.findall(r'CMW (\S+) \\[a-z]+=([0-9.]+)pt claim=([0-9.None]+)', log)
            bad = [f'{t} {w}pt vs {c}pt' for t, w, c in widths if c != 'None' and abs(float(w) - float(c)) > 0.6]
            check(f'latex {kind}', r.returncode == 0 and not errs and not over and not bad,
                  f'{len(texs)} snippets, errors {errs[:2] or "none"}, overfull {over[:3] or "none"}, widths {bad[:3] or "as claimed"}')
            for p in tdir.glob(f'test-{kind}.*'):
                if p.suffix not in ('.tex', '.pdf', '.log'):
                    p.unlink()

w = max(len(r[0]) for r in rows)
for r in rows:
    print(f'{r[0]:<{w}}  {r[1]:<4} {r[2]}')
print(f'\n{len(fails)} failure(s) in {len(rows)} checks')
sys.exit(1 if fails else 0)
