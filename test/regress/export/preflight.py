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
# Round 3 (notes/export-design/ROUND3.md):
# Captions: a snippet whose caption displays F (\[ \displaystyle F(z) = ... \], guarded for LaTeX's one-line trial) has
#         a short caption (\caption[short]{long}) with no display in it.
# Video:  every out/*.mp4 parsed box by box (ftyp, mvhd, tkhd, mdhd, stsd/avc1/avcC, stts, stss, stsz, stco, mdat): the
#         duration, the frame count, the frame rate and the codec match video-<view>.json, the sizes add up to mdat, the
#         first sample is a key frame; with QuickLook (macOS qlmanage) a thumbnail is decoded independently.
# --latex now compiles every snippet (PDF and PNG) with pdfLaTeX and XeLaTeX, the English ones in English documents
#         and the Russian ones (-ru-) in Russian ones, with \listoffigures (the short captions).
# Exit status 1 on any failure. Options: --dir DIR (default: out/ next to this file), --latex.
import argparse
import json
import pathlib
import re
import shutil
import struct
import subprocess
import sys

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
    return subprocess.run(cmd, capture_output=True, text=True, errors='replace', **kw)


have = {t: shutil.which(t) for t in ('pdffonts', 'pdfimages', 'latexmk', 'qlmanage')}
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
        kinds = sorted({ln.split()[2] + '/' + ln.split()[5] for ln in imgs})
        check(n, not any(' smask ' in f' {ln} ' for ln in imgs), f'images {len(imgs)} {kinds}, no smask')
        check(n, not any(ln.split()[9] == 'yes' for ln in imgs), 'images not interpolated')
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
    # (paths-aesthetics) the deformation's paths: vectors, black, 0.5 pt on a 1 pt white casing, a ring at each start and
    # a dot at each end, no transparency (print)
    if 'class="mf-paths"' in s:
        lw = set(re.findall(r'stroke-width="([\d.]+)"[^>]*class="mf-paths"', s))
        nr = len(re.findall(r'<circle', (re.search(r'class="mf-rings">(.*?)</g>', s) or [None, ''])[1])) if 'mf-rings' in s else 0
        ne = len(re.findall(r'<circle', (re.search(r'class="mf-ends">(.*?)</g>', s) or [None, ''])[1])) if 'mf-ends' in s else 0
        op = re.findall(r'(?:stroke-|fill-)?opacity="(?!1")[^"]*"[^>]*>(?=[^<]*(?:<circle|<path)[^>]*class="mf-)', s)
        check(svg.name + ' paths', lw == {'0.5'} and nr > 0 and ne > 0 and not op, f'path weight {sorted(lw)} pt, {nr} start rings, {ne} end dots, {len(op)} transparent layers')


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

# ---- round 3: the display-style F in the snippets ----
for t in sorted(OUT.glob('*.tex')):
    snip = t.read_text()
    if '\\displaystyle' not in snip:
        continue
    m = re.search(r"\\caption\[\{(.*?)\}\]\{", snip)
    # (review r3, editor-1: or the chain, gathered lines in \displaystyle that start with F(z) = ...)
    guarded = re.search(r'\\ifinner\\hskip\\hsize\\else\\\[ (?:\\begin\{gathered\})?\\displaystyle [A-Za-z_{}0-9]+\([a-z_{}0-9]+\)=.*?\\\]\\fi', snip, re.S)
    if guarded and 'gathered' in guarded.group(0):
        guarded = guarded if re.search(r'F=f_\{\d+\}(\\circ f_\{\d+\})+', guarded.group(0)) and '\\end{gathered}' in guarded.group(0) else None
    check(t.name, bool(m) and '\\[' not in m.group(1) and bool(guarded), f'display F guarded: {bool(guarded)}; short caption: {(m.group(1)[:60] + "...") if m else "missing"}')


# ---- round 3: the videos ----
def mp4_boxes(b, start=0, end=None, path=''):
    out, i, end = [], start, len(b) if end is None else end
    while i + 8 <= end:
        size, typ = struct.unpack('>I4s', b[i:i + 8])
        typ = typ.decode('latin-1')
        hdr = 8
        if size == 1:
            size = struct.unpack('>Q', b[i + 8:i + 16])[0]; hdr = 16
        if size < hdr or i + size > end:
            break
        out.append((path + '/' + typ, i, i + hdr, i + size))
        if typ in ('moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf'):
            out += mp4_boxes(b, i + hdr, i + size, path + '/' + typ)
        if typ == 'stsd':
            out += mp4_boxes(b, i + hdr + 8, i + size, path + '/' + typ)
        if typ == 'avc1':
            out += mp4_boxes(b, i + hdr + 78, i + size, path + '/' + typ)
        i += size
    return out


for mp4 in sorted(OUT.glob('*.mp4')):
    b = mp4.read_bytes()
    bx = {p: (s0, d0, e0) for p, s0, d0, e0 in mp4_boxes(b)}
    def g(p, bx=bx):
        return bx.get(p)

    try:
        _, d, _ = g('/moov/mvhd'); mts, mdur = struct.unpack('>II', b[d + 12:d + 20])
        _, d, _ = g('/moov/trak/mdia/mdhd'); tts, tdur = struct.unpack('>II', b[d + 12:d + 20])
        _, d, _ = g('/moov/trak/mdia/minf/stbl/stts'); n_e = struct.unpack('>I', b[d + 4:d + 8])[0]; cnt, delta = struct.unpack('>II', b[d + 8:d + 16])
        _, d, _ = g('/moov/trak/mdia/minf/stbl/stsz'); n = struct.unpack('>I', b[d + 8:d + 12])[0]; sizes = struct.unpack(f'>{n}I', b[d + 12:d + 12 + 4 * n])
        _, d, _ = g('/moov/trak/mdia/minf/stbl/stss'); nk = struct.unpack('>I', b[d + 4:d + 8])[0]; keys = struct.unpack(f'>{nk}I', b[d + 8:d + 8 + 4 * nk])
        _, d, _ = g('/moov/trak/mdia/minf/stbl/stco'); off = struct.unpack('>I', b[d + 8:d + 12])[0]
        s0, d, e = g('/moov/trak/mdia/minf/stbl/stsd/avc1'); W, H = struct.unpack('>HH', b[d + 24:d + 28])
        _, d, _ = g('/moov/trak/mdia/minf/stbl/stsd/avc1/avcC'); prof, compat, level = b[d + 1], b[d + 2], b[d + 3]
        md = g('/mdat')
        fps = tts / delta
        meta = json.loads((OUT / (mp4.stem + '.json')).read_text()) if (OUT / (mp4.stem + '.json')).exists() else {}
        codec = f'avc1.{prof:02X}{compat:02X}{level:02X}'
        ok = (n_e == 1 and cnt == n and md and md[2] - md[1] == sum(sizes) and off == md[1] and keys and keys[0] == 1
              and (not meta or (meta['frames'] == n and abs(fps - meta['fps']) < 1e-6 and meta['W'] == W and meta['H'] == H and meta['codec'].upper() == codec.upper()))
              and abs(mdur / mts - n / fps) < 0.002)
        check(mp4.name, ok, f'{codec} (profile {prof}, level {level / 10:.1f}), {W}x{H}, {n} frames at {fps:g} fps = {mdur / mts:.3f} s, {nk} key frames, mdat {sum(sizes) // 1024} KB')
    except Exception as ex:
        check(mp4.name, False, f'not a readable MP4: {ex!r}')
        continue
    if have['qlmanage']:
        qd = OUT / 'ql'
        qd.mkdir(exist_ok=True)
        try:
            run(['qlmanage', '-t', '-s', '320', '-o', str(qd), str(mp4)], timeout=60)
        except Exception:
            pass
        th = qd / (mp4.name + '.png')
        check(mp4.name, th.exists() and th.stat().st_size > 2000, f'QuickLook (AVFoundation) decodes it: {"thumbnail " + str(th.stat().st_size // 1024) + " KB" if th.exists() else "no thumbnail"}')

# WebM (the fallback): the EBML header's DocType, the track's codec and size, one SimpleBlock per frame, key frames
def ebml(b, i, end):
    while i < end:
        wl = 8 - b[i].bit_length() + 1; eid = int.from_bytes(b[i:i + wl], 'big'); i += wl
        wl = 8 - b[i].bit_length() + 1; sz = int.from_bytes(b[i:i + wl], 'big') & ((1 << (7 * wl)) - 1); i += wl
        yield eid, i, i + sz
        i += sz


for wm in sorted(OUT.glob('*.webm')):
    b = wm.read_bytes()
    try:
        info = {'doctype': None, 'codec': None, 'W': None, 'H': None, 'blocks': 0, 'keys': 0, 'cues': [], 'seek': {}, 'seg': None}
        def walk(i, end, b=b, info=info):
            for eid, a, z in ebml(b, i, end):
                # (review r3, video-9: the Cues, one CuePoint per cluster, and the SeekHead that finds them)
                if eid == 0x18538067: info['seg'] = a
                if eid in (0x1A45DFA3, 0x18538067, 0x1654AE6B, 0xAE, 0xE0, 0x1F43B675):
                    walk(a, z)
                elif eid == 0x1C53BB6B:
                    for e2, a2, z2 in ebml(b, a, z):
                        if e2 == 0xBB:
                            for e3, a3, z3 in ebml(b, a2, z2):
                                if e3 == 0xB7:
                                    for e4, a4, z4 in ebml(b, a3, z3):
                                        if e4 == 0xF1: info['cues'].append(int.from_bytes(b[a4:z4], 'big'))
                elif eid == 0x114D9B74:
                    for _, a2, z2 in ebml(b, a, z):
                        sid = pos = None
                        for e3, a3, z3 in ebml(b, a2, z2):
                            if e3 == 0x53AB: sid = int.from_bytes(b[a3:z3], 'big')
                            if e3 == 0x53AC: pos = int.from_bytes(b[a3:z3], 'big')
                        info['seek'][sid] = pos
                elif eid == 0x4282: info['doctype'] = b[a:z].decode()
                elif eid == 0x86: info['codec'] = b[a:z].decode()
                elif eid == 0xB0: info['W'] = int.from_bytes(b[a:z], 'big')
                elif eid == 0xBA: info['H'] = int.from_bytes(b[a:z], 'big')
                elif eid == 0xA3:
                    info['blocks'] += 1; info['keys'] += 1 if b[a + 3] & 0x80 else 0
        walk(0, len(b))
        meta = json.loads((OUT / (wm.stem + '.json')).read_text()) if (OUT / (wm.stem + '.json')).exists() else {}
        ok = info['doctype'] == 'webm' and info['codec'] in ('V_VP9', 'V_VP8') and info['keys'] >= 1 and (not meta or (meta['frames'] == info['blocks'] and meta['W'] == info['W'] and meta['H'] == info['H']))
        check(wm.name, ok, f"{info['doctype']} {info['codec']} {info['W']}x{info['H']}, {info['blocks']} frames, {info['keys']} key frames")
        # cluster element starts, relative to the segment's data: each must be a CuePoint's position
        seg = info['seg'] or 0
        # (each element's own start: its id and size fields included)
        starts, cues_at = [], None
        i = seg
        while i < len(b):
            h0 = i
            wl = 8 - b[i].bit_length() + 1; eid = int.from_bytes(b[i:i + wl], 'big'); i += wl
            wl = 8 - b[i].bit_length() + 1; sz = int.from_bytes(b[i:i + wl], 'big') & ((1 << (7 * wl)) - 1); i += wl
            if eid == 0x1F43B675: starts.append(h0 - seg)
            if eid == 0x1C53BB6B: cues_at = h0 - seg
            i += sz
        okc = len(info['cues']) == len(starts) and info['cues'] == starts and info['seek'].get(0x1C53BB6B) == cues_at and 0x1549A966 in info['seek']
        check(wm.name + ' cues', okc, f"{len(info['cues'])} cue points for {len(starts)} clusters, positions {'match' if info['cues'] == starts else 'differ'}, SeekHead {'finds the Cues' if info['seek'].get(0x1C53BB6B) == cues_at else 'missing'}")
    except Exception as ex:
        check(wm.name, False, f'not a readable WebM: {ex!r}')

# ---- one label per figure (review r3, editor-2): a label is shared only by the variants of one figure (its PNG
# snippet, its B/W and Russian versions), never by two different figures ----
lab = {}
for t in sorted(OUT.glob('*.tex')):
    m = re.search(r'\\label\{([^}]*)\}', t.read_text())
    if not m or not t.stem.startswith('r3-'):
        continue
    fam = re.sub(r'-(png|bw|ru)(?=-|$)', '', t.stem)
    fam = re.sub(r'-(article1|article2W|article2|homework|slides)$', '', fam)
    lab.setdefault(m.group(1), set()).add(fam)
shared = {k: sorted(v) for k, v in lab.items() if len(v) > 1}
check('labels: one figure each (round 3)', not shared, f'{len(lab)} labels' + (f', shared: {shared}' if shared else ''))

# ---- the snippets in the documents they were made for ----
DOCS = {
    # tag suffix -> (preamble, the width the snippet names, the macro to measure)
    'article1': ('\\documentclass{amsart}\n\\usepackage{graphicx,amsmath,amssymb}', '\\linewidth'),
    'article2': ('\\documentclass[aps,twocolumn]{revtex4-2}\n\\usepackage{graphicx,amsmath,amssymb}', '\\columnwidth'),
    'article2W': ('\\documentclass[aps,twocolumn]{revtex4-2}\n\\usepackage{graphicx,amsmath,amssymb}', '\\textwidth'),
    'homework': ('\\documentclass[11pt]{article}\n\\usepackage[letterpaper,margin=1in]{geometry}\n\\usepackage{graphicx,amsmath,amssymb,float}', '\\linewidth'),
    'slides': ('\\documentclass[aspectratio=169]{beamer}\n\\usepackage{graphicx,amsmath,amssymb}', '\\textwidth'),
}
RU_PRE = {
    # (the snippets' Russian captions sit in \foreignlanguage{russian}{...}: the English-main preamble they name)
    'pdflatex': '\\usepackage[T2A,T1]{fontenc}\n\\usepackage[utf8]{inputenc}\n\\usepackage[russian,english]{babel}',
    'xelatex': '\\usepackage{fontspec}\n\\setmainfont{cmunrm.otf}[BoldFont=cmunbx.otf,ItalicFont=cmunti.otf,BoldItalicFont=cmunbi.otf]\n\\setsansfont{cmunss.otf}[BoldFont=cmunsx.otf,ItalicFont=cmunsi.otf]\n\\usepackage[russian,english]{babel}',
}
if args.latex:
    if not have['latexmk']:
        rows.append(('latex', 'info', 'latexmk not installed: skipped'))
    else:
        tdir = OUT / 'latex'
        tdir.mkdir(exist_ok=True)
        for kind, (pre0, macro), engine, lang in [(k, d, e, lg) for k, d in DOCS.items() for e in ('pdflatex', 'xelatex') for lg in ('en', 'ru')]:
            texs = sorted(p for p in OUT.glob(f'*-{kind}.tex')) + sorted(p for p in OUT.glob(f'*-{kind}-bw.tex'))
            texs = [t for t in texs if ('-ru-' in t.name) == (lang == 'ru')]
            if not texs:
                continue
            pre = pre0 + ('\n' + RU_PRE[engine] if lang == 'ru' else '')
            body = []
            for t in texs:
                snip = t.read_text()
                # the file the snippet includes, next to the document (a PDF, or the PNG its snippet names)
                src = next((OUT / f'{t.stem}{x}' for x in ('.pdf', '.png') if (OUT / f'{t.stem}{x}').exists()), None)
                if src is None:
                    continue
                shutil.copy(src, tdir / src.name)
                m = re.search(r'made for (\\[a-z]+) = ([0-9.]+)pt', snip)
                claim = float(m.group(2)) if m else None
                body.append(f'\\typeout{{CMW {t.stem} {macro}=\\the{macro} claim={claim}}}')
                if kind == 'homework':
                    body.append(f'\\section*{{Problem}} Find the image of the region under the map.\n{snip}\nThe figure stays right after the problem.\n')
                elif kind == 'slides':
                    body.append(snip)
                else:
                    body.append(f'Some text before the figure. {snip}\nSome text after it.\n\\clearpage')
            lof = '' if kind == 'slides' else '\n\\listoffigures'
            doc = f'{pre}\n\\begin{{document}}\n' + '\n'.join(body) + lof + '\n\\end{document}\n'
            job = f'test-{kind}' + ('' if (engine, lang) == ('pdflatex', 'en') else f'-{engine}-{lang}')
            src = tdir / f'{job}.tex'
            src.write_text(doc)
            r = run(['latexmk', '-pdf' if engine == 'pdflatex' else '-xelatex', '-interaction=nonstopmode', '-halt-on-error', src.name], cwd=tdir)
            log = (tdir / f'{job}.log').read_text(errors='replace') if (tdir / f'{job}.log').exists() else ''
            errs = re.findall(r'^! .*', log, re.M)
            over = re.findall(r'Overfull \\hbox \(([0-9.]+)pt too wide\)', log)
            widths = re.findall(r'CMW (\S+) \\[a-z]+=([0-9.]+)pt claim=([0-9.None]+)', log)
            bad = [f'{t} {w}pt vs {c}pt' for t, w, c in widths if c != 'None' and abs(float(w) - float(c)) > 0.6]
            check(f'latex {kind} {engine} {lang}', r.returncode == 0 and not errs and not over and not bad,
                  f'{len(texs)} snippets, errors {errs[:2] or "none"}, overfull {over[:3] or "none"}, widths {bad[:3] or "as claimed"}')
            for p in tdir.glob(f'{job}.*'):
                if p.suffix not in ('.tex', '.pdf', '.log'):
                    p.unlink()

w = max(len(r[0]) for r in rows)
for r in rows:
    print(f'{r[0]:<{w}}  {r[1]:<4} {r[2]}')
print(f'\n{len(fails)} failure(s) in {len(rows)} checks')
sys.exit(1 if fails else 0)
