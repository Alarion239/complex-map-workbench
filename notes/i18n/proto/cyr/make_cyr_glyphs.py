# Cyrillic outlines for figure labels (notes/i18n/DESIGN.md 5): MathJax's TeX fonts have no Cyrillic, so the figure
# composer sets Cyrillic words from Computer Modern Unicode (CMU, SIL OFL: the LH Cyrillic designed for Computer
# Modern, what pdfLaTeX with T2A and cm-super prints). Output: one JSON per face, paths in 1000 units per em, y up,
# exactly MathJax's glyph space, with advance widths and the GPOS/kern pairs among these glyphs.
# Basic Latin is included (review i18n-11), so a mixed word ('Круг-A', 'PDF-файл') is set from one face.
# Weight (review lead-1): MathJax's TeX fonts are the CM outlines grown by about 6.5 units per side (measured on
# I 0 m 1 t g: the cmr10 'I' stem is 89 units, MathJax's 104; ink +22..31 %). The table records that as 'stroke':
# the composer strokes each glyph with this width (in glyph units), so a Cyrillic word has the weight of the
# MathJax math beside it, as words and math share one weight in pdfLaTeX.
import json, subprocess, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

CHARS = [chr(c) for c in range(0x410, 0x450)] + ['Ё', 'ё', '«', '»', '„', '“', '№', '—', '–', '…'] + [chr(c) for c in range(0x21, 0x7f)]
FACES = {'rm': 'cmunrm.otf', 'bx': 'cmunbx.otf', 'ti': 'cmunti.otf'}   # ti: italic panel letters а, б (GLOSSARY 1.11)
STROKE = 13   # glyph units: 2 x 6.5, MathJax TeX-N/B/I against cmr10/cmbx10/cmti10 (measured, see above)

def path_of(gs, name, scale):
    pen = SVGPathPen(gs)
    gs[name].draw(TransformPen(pen, (scale, 0, 0, scale, 0, 0)))
    d = pen.getCommands()
    # round to 1 unit (1/1000 em: 0.01 pt at 10 pt) and drop spaces
    import re
    return re.sub(r'-?\d+\.\d+', lambda m: str(round(float(m.group()))), d)

def kern_pairs(f, names):
    out = {}
    if 'GPOS' not in f: return out
    for lk in f['GPOS'].table.LookupList.Lookup:
        for st in lk.SubTable:
            if getattr(st, 'Format', None) is None: continue
            if lk.LookupType == 9: st = st.ExtSubTable
            if getattr(st, 'LookupType', lk.LookupType) != 2: continue
            cov = st.Coverage.glyphs
            if st.Format == 1:
                for i, first in enumerate(cov):
                    if first not in names: continue
                    for pv in st.PairSet[i].PairValueRecord:
                        if pv.SecondGlyph in names and pv.Value1 and getattr(pv.Value1, 'XAdvance', 0):
                            out[first + '|' + pv.SecondGlyph] = pv.Value1.XAdvance
            elif st.Format == 2:
                c1 = st.ClassDef1.classDefs; c2 = st.ClassDef2.classDefs
                for first in cov:
                    if first not in names: continue
                    k1 = c1.get(first, 0)
                    for second in names:
                        k2 = c2.get(second, 0)
                        v = st.Class1Record[k1].Class2Record[k2].Value1
                        if v and getattr(v, 'XAdvance', 0): out[first + '|' + second] = v.XAdvance
    return out

CYR = [chr(c) for c in range(0x410, 0x450)] + ['Ё', 'ё']
for key, fn in FACES.items():
    # the italic face only sets Cyrillic \textit words (panel letters а, б): Latin italic is MathJax's
    CH = CYR + list('.,;:()-') if key == 'ti' else CHARS
    path = subprocess.run(['kpsewhich', fn], capture_output=True, text=True).stdout.strip()
    f = TTFont(path)
    upm = f['head'].unitsPerEm; scale = 1000 / upm
    cmap = f.getBestCmap(); gs = f.getGlyphSet(); hmtx = f['hmtx']
    names = {cmap[ord(c)] for c in CH if ord(c) in cmap}
    glyphs = {}
    for c in CH:
        g = cmap.get(ord(c))
        if not g: continue
        glyphs[c] = [round(hmtx[g][0] * scale), path_of(gs, g, scale)]
    kern = {}
    for k, v in kern_pairs(f, names).items():
        a, b = k.split('|')
        ca = next(c for c in CH if cmap.get(ord(c)) == a); cb = next(c for c in CH if cmap.get(ord(c)) == b)
        kern[ca + cb] = round(v * scale)
    # also: the Latin space and digit advances, to check the metrics against MathJax's cmr10 (a: 500, 0: 500)
    chk = {c: round(hmtx[cmap[ord(c)]][0] * scale) for c in 'a0 x'}
    out = {'face': fn, 'upm': 1000, 'stroke': STROKE, 'glyphs': glyphs, 'kern': kern, 'check': chk}
    s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    open(f'cyr_{key}.json', 'w').write(s)
    print(key, fn, 'glyphs', len(glyphs), 'kern pairs', len(kern), 'bytes', len(s.encode()), 'check', chk)
