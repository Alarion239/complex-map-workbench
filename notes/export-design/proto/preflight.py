# Preflight for the prototype figures (review-editor.md M4). Run: python3 proto/preflight.py  (exit 1 on any failure)
# PDF: no fonts, no SMask, no ExtGState with CA/ca < 1, MediaBox width = the target width in bp, not interpolated.
# PNG: colour type 0 (grey), 2 (RGB) or 3 (indexed), never alpha; pHYs present. SVG: no duplicate ids, no nested <svg>.
# Layout: no typeset box crosses a frame line or overlaps another box (titles, ticks, point labels, captions).
import json, pathlib, re, struct, subprocess, sys, zlib
OUT = pathlib.Path(__file__).resolve().parent / 'out'
fails, rows = [], []
def check(name, ok, what):
    rows.append((name, 'ok ' if ok else 'FAIL', what))
    if not ok: fails.append(f'{name}: {what}')
for pdf in sorted(OUT.glob('*.pdf')):
    n = pdf.name
    d = pdf.read_bytes()
    fonts = subprocess.run(['pdffonts', str(pdf)], capture_output=True, text=True).stdout.strip().splitlines()[2:]
    check(n, not fonts, f'fonts: {len(fonts)}')
    imgs = subprocess.run(['pdfimages', '-list', str(pdf)], capture_output=True, text=True).stdout.strip().splitlines()[2:]
    kinds = sorted({l.split()[2] + '/' + l.split()[5] for l in imgs})
    check(n, not any(' smask ' in f' {l} ' for l in imgs), f'images {len(imgs)} {kinds}, no smask')
    check(n, not any(l.split()[9] == 'yes' for l in imgs), 'images not interpolated')
    ca = [float(v) for v in re.findall(rb'/(?:CA|ca) ([0-9.]+)', d)]
    check(n, all(v >= 1 for v in ca), f'ExtGState alpha values {sorted(set(ca)) or "none"}')
    mb = re.search(rb'/MediaBox \[([^\]]*)\]', d)
    w = float(mb.group(1).split()[2]); h = float(mb.group(1).split()[3])
    bx = OUT / (pdf.stem + '-boxes.json')
    tgt = json.loads(bx.read_text()).get('target') if bx.exists() else None
    if tgt: check(n, abs(w - tgt * 72 / 72.27) < 0.02, f'MediaBox {w:.2f} x {h:.2f} bp; target {tgt} pt = {tgt * 72 / 72.27:.2f} bp')
    else: rows.append((n, 'info', f'MediaBox {w:.2f} x {h:.2f} bp (art/overlay file)'))
    check(n, d[:8] in (b'%PDF-1.3', b'%PDF-1.4'), f'header {d[:8].decode()}')
for png in sorted(OUT.glob('*.png')):
    if png.name.startswith('raw-') or png.name == 'phase-key-raw.png': continue
    b = png.read_bytes()
    ct = b[25]; chunks = []
    i = 8
    while i < len(b):
        ln = struct.unpack('>I', b[i:i + 4])[0]; chunks.append(b[i + 4:i + 8].decode()); i += 12 + ln
    ok = ct in (0, 2, 3) and ('pHYs' in chunks or png.name.endswith('-grey.png'))
    check(png.name, ok, f'colour type {ct} ({ {0: "grey", 2: "RGB", 3: "indexed", 6: "RGBA"}.get(ct, ct) }), chunks {",".join(c for c in chunks if c not in ("IDAT",))}')
for svg in sorted(OUT.glob('*.svg')):
    s = svg.read_text()
    ids = re.findall(r'\sid="([^"]+)"', s)
    dup = len(ids) - len(set(ids))
    nested = s.count('<svg') - 1
    check(svg.name, dup == 0 and nested == 0, f'{len(ids)} ids, {dup} duplicates, {nested} nested <svg>, {len(s) // 1024} KB')
def inter(a, b, pad=0.0):
    return a['x0'] < b['x1'] - pad and a['x1'] > b['x0'] + pad and a['y0'] < b['y1'] - pad and a['y1'] > b['y0'] + pad
for bj in sorted(OUT.glob('*-boxes.json')):
    o = json.loads(bj.read_text()); boxes = o['boxes']; name = bj.name.replace('-boxes.json', '')
    hits = []
    for b in boxes:
        for f in o.get('lines', []):  # a frame rectangle: does the box cross one of its four edges?
            for (x0, y0, x1, y1) in [(f['x0'], f['y0'], f['x1'], f['y0']), (f['x0'], f['y1'], f['x1'], f['y1']), (f['x0'], f['y0'], f['x0'], f['y1']), (f['x1'], f['y0'], f['x1'], f['y1'])]:
                if inter(b, {'x0': min(x0, x1) - 0.25, 'x1': max(x0, x1) + 0.25, 'y0': min(y0, y1) - 0.25, 'y1': max(y0, y1) + 0.25}):
                    hits.append(f"{b['kind']} '{b['tex']}' x frame")
    for i, a in enumerate(boxes):
        for b in boxes[i + 1:]:
            if a['kind'] == 'caption' and b['kind'] == 'caption': continue
            if inter(a, b, 0.2): hits.append(f"{a['kind']} '{a['tex']}' x {b['kind']} '{b['tex']}'")
    check(name, not hits, f'{len(boxes)} typeset boxes, collisions: {"; ".join(sorted(set(hits))[:6]) or "none"}')
w = max(len(r[0]) for r in rows)
for r in rows: print(f'{r[0]:<{w}}  {r[1]:<4} {r[2]}')
print(f'\n{len(fails)} failure(s)')
sys.exit(1 if fails else 0)
