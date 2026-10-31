"""Vendor the page's third-party code and fonts into vendor/ (issue #21). A manual step: build.py never touches the
network, it reads vendor/ only.

    python3 tools/vendor.py            fetch the pinned packages (npm pack), check them against vendor/LOCK.json,
                                       and write vendor/ again
    python3 tools/vendor.py --update   the same, recording new tarball hashes (after a version change below)

What it writes:
  vendor/js/       fflate's inflate (the offline page's MathJax block is gzipped, #491: where a browser lacks
                   DecompressionStream), MathJax's tex-svg-nofont.js (the typesetter) and, in mathjax-stix2/, its STIX2 font (svg.js, and the
                   rarer ranges in svg/dynamic/ that MathJax loads on demand; #288), and jsPDF and svg2pdf.js (the figure
                   export's PDF, loaded on the first PDF export; issue #393), for the offline page
  vendor/fonts/    the faces the page sets text in, subset to the characters the app's sources use (chars() below)
                   plus the letters a user may type, and their variation axes cut to the ranges the CSS uses
  vendor/licenses/ the packages' licenses
  vendor/LOCK.json the packages and their tarballs' sha256, the outputs' sha256 and sizes, the @font-face list
                   build.py writes, and the subset's characters (test/t_vendor.js fails when a source uses a
                   character outside them: run this again)

Needs npm (the registry) and fontTools (pip install fonttools brotli).
"""
import hashlib
import io
import json
import pathlib
import re
import subprocess
import sys
import tarfile
import tempfile

root = pathlib.Path(__file__).resolve().parent.parent
VENDOR = root / 'vendor'
LOCK = VENDOR / 'LOCK.json'

PACKAGES = {
    'mathjax': '4.1.3',
    '@mathjax/mathjax-stix2-font': '4.1.3',
    '@fontsource-variable/archivo': '5.3.0',
    '@fontsource-variable/stix-two-text': '5.3.0',
    '@fontsource/b612-mono': '5.3.0',
    '@fontsource-variable/jetbrains-mono': '5.3.0',
    '@fontsource-variable/roboto-flex': '5.3.0',
    'jspdf': '2.5.1',
    'svg2pdf.js': '2.2.3',
    'fflate': '0.8.2',
}
SCRIPTS = [  # (package, file in the package, vendor/js name)
    ('mathjax', 'tex-svg-nofont.js', 'tex-svg-nofont.js'),
    ('mathjax', 'a11y/assistive-mml.js', 'a11y/assistive-mml.js'),   # the hidden MathML (build.py), loaded by the core
    ('jspdf', 'dist/jspdf.umd.min.js', 'jspdf.umd.min.js'),
    ('svg2pdf.js', 'dist/svg2pdf.umd.min.js', 'svg2pdf.umd.min.js'),
    ('fflate', 'umd/index.js', 'fflate.umd.js'),   # (#491: the offline page's inflate where DecompressionStream is missing)
]
# MathJax 4's STIX2 font (#288): its SVG data and the dynamic ranges, under vendor/js/mathjax-stix2/ as in the package
# a package that ships no license file: the package whose license file has the same license's text, and a note
# (the STIX2 font: Apache-2.0 as MathJax, its glyphs drawn from the STIX Two fonts, SIL OFL 1.1)
LICENSE_FROM = {
    '@mathjax/mathjax-stix2-font': ('mathjax', 'Its glyph outlines come from the STIX Two fonts, Copyright 2001-2021 The STIX Fonts Project\n'
                                    'Authors (https://github.com/stipub/stixfonts), licensed under the SIL Open Font License, Version 1.1:\n'
                                    'its text is in fontsource-variable__stix-two-text.txt beside this file. The Apache License 2.0 the\n'
                                    'package declares (the text from MathJax, the same license) follows.'),
}
MJ_FONT = ('@mathjax/mathjax-stix2-font', 'mathjax-stix2', re.compile(r'svg\.js|svg/dynamic/[a-z-]+\.js'))
# The faces, as the Google Fonts stylesheets they replace asked for them (src/page.html, src/i18n.js): the family,
# the package and its file pattern ({r}: a unicode range's name), the style, the axes' ranges (the others pinned to
# their defaults), the CSS weight and stretch. set 'ru': the Russian set, loaded with the language only.
FACES = [
    dict(family='Archivo', pkg='@fontsource-variable/archivo', file='archivo-{r}-standard-normal.woff2', style='normal',
         axes={'wght': (400, 700), 'wdth': (75, 125)}, weight='400 700', stretch='75% 125%', set='main'),
    dict(family='STIX Two Text', pkg='@fontsource-variable/stix-two-text', file='stix-two-text-{r}-wght-normal.woff2',
         style='normal', axes={'wght': (400, 700)}, weight='400 700', set='main'),
    dict(family='STIX Two Text', pkg='@fontsource-variable/stix-two-text', file='stix-two-text-{r}-wght-italic.woff2',
         style='italic', axes={'wght': (400, 700)}, weight='400 700', set='main'),
    dict(family='B612 Mono', pkg='@fontsource/b612-mono', file='b612-mono-{r}-400-normal.woff2', style='normal',
         weight='400', set='main'),
    dict(family='B612 Mono', pkg='@fontsource/b612-mono', file='b612-mono-{r}-700-normal.woff2', style='normal',
         weight='700', set='main'),
    dict(family='JetBrains Mono', pkg='@fontsource-variable/jetbrains-mono', file='jetbrains-mono-{r}-wght-normal.woff2',
         style='normal', axes={'wght': (400, 700)}, weight='400 700', set='main'),
    dict(family='Roboto Flex', pkg='@fontsource-variable/roboto-flex', file='roboto-flex-{r}-full-normal.woff2',
         style='normal', axes={'opsz': (8, 144), 'wdth': (75, 125), 'wght': (400, 700)}, weight='400 700',
         stretch='75% 125%', set='ru'),
]
# the letters a user may type beyond the sources' own: ASCII, Latin-1, basic Greek and Cyrillic, punctuation
BASE = [(0x20, 0x7E), (0xA0, 0xFF), (0x391, 0x3C9), (0x400, 0x45F), (0x2010, 0x2027), (0x2030, 0x205E), (0x2212, 0x2212)]


def chars():
    """The characters the page may set in its faces: every non-ASCII character of the app's sources (src/, its
    generated tables included: the interface's strings, the figures' TeX fallbacks and captions), and BASE.
    test/t_vendor.js reads the same files the same way."""
    s = set()
    for p in sorted((root / 'src').rglob('*')):
        if p.suffix in ('.js', '.html', '.css'):
            s |= {c for c in p.read_text(encoding='utf-8') if ord(c) >= 0x80 and not 0xD800 <= ord(c) <= 0xDFFF}
    for a, b in BASE:
        s |= {chr(c) for c in range(a, b + 1)}
    return s


def sha(b):
    return hashlib.sha256(b).hexdigest()


def fetch(name, version, tmp):
    out = subprocess.run(['npm', 'pack', '--silent', '--pack-destination', tmp, f'{name}@{version}'],
                         capture_output=True, text=True, check=True).stdout.strip().splitlines()[-1]
    data = (pathlib.Path(tmp) / out).read_bytes()
    return data, tarfile.open(fileobj=io.BytesIO(data))


def ranges(cps):
    cps, out, i = sorted(cps), [], 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1:
            j += 1
        out.append(f'U+{cps[i]:X}' if i == j else f'U+{cps[i]:X}-{cps[j]:X}')
        i = j + 1
    return ', '.join(out)


def subset(data, face, keep):
    from fontTools.ttLib import TTFont
    from fontTools import subset as fsub
    from fontTools.varLib import instancer
    font = TTFont(io.BytesIO(data))
    stamp = font['head'].modified   # (kept: the same input gives the same bytes)
    have = set(font.getBestCmap())
    want = have & {ord(c) for c in keep}
    if not want:
        return None, None
    if 'fvar' in font and face.get('axes') is not None:
        limits = {}
        for a in font['fvar'].axes:   # an axis the CSS uses keeps its range there; the others are pinned (None)
            r = face['axes'].get(a.axisTag)
            limits[a.axisTag] = (max(r[0], a.minValue), min(r[1], a.maxValue)) if r else None
        font = instancer.instantiateVariableFont(font, limits)
        tmp = io.BytesIO()
        font.recalcTimestamp = False
        font.save(tmp)
        font = TTFont(io.BytesIO(tmp.getvalue()), lazy=False)   # (the subsetter wants the instanced tables loaded)
    opts = fsub.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_glyph = False   # (fontsource's range files have none)
    sub = fsub.Subsetter(opts)
    sub.populate(unicodes=sorted(want))
    sub.subset(font)
    buf = io.BytesIO()
    font['head'].modified = stamp
    font.recalcTimestamp = False
    font.flavor = 'woff2'
    font.save(buf)
    return buf.getvalue(), sorted(set(font.getBestCmap()))


def main():
    update = '--update' in sys.argv
    lock = json.loads(LOCK.read_text()) if LOCK.exists() else {}
    keep = chars()
    (VENDOR / 'js').mkdir(parents=True, exist_ok=True)
    (VENDOR / 'fonts').mkdir(parents=True, exist_ok=True)
    (VENDOR / 'licenses').mkdir(parents=True, exist_ok=True)
    for old in (VENDOR / 'fonts').glob('*.woff2'):
        old.unlink()
    pk, outs, faces = {}, {}, []
    with tempfile.TemporaryDirectory() as tmp:
        tars = {}
        for name, ver in PACKAGES.items():
            data, tar = fetch(name, ver, tmp)
            h = sha(data)
            was = lock.get('packages', {}).get(name, {})
            if was.get('version') == ver and was.get('sha256') not in (None, h) and not update:
                sys.exit(f'{name}@{ver}: the tarball is not the one LOCK.json recorded ({h} != {was["sha256"]})')
            pk[name] = {'version': ver, 'sha256': h}
            tars[name] = tar
            lic = next((m for m in tar.getmembers() if re.fullmatch(r'package/LICEN[CS]E(\.\w+)?', m.name)), None)
            lfile = VENDOR / 'licenses' / (name.replace('/', '__').lstrip('@') + '.txt')
            if lic:
                lfile.write_bytes(tar.extractfile(lic).read())
            else:   # (a package with no license file: the license its package.json declares, and its text from LICENSE_FROM)
                meta = json.loads(tar.extractfile('package/package.json').read())
                text = f'{name}@{ver}: {meta.get("license", "no license declared")} (from its package.json; the package ships no license file)\n'
                if name in LICENSE_FROM:
                    src_pkg, note = LICENSE_FROM[name]
                    src_lic = next(m for m in tars[src_pkg].getmembers() if re.fullmatch(r'package/LICEN[CS]E(\.\w+)?', m.name))
                    text += note + '\n\n' + tars[src_pkg].extractfile(src_lic).read().decode('utf-8')
                lfile.write_text(text, encoding='utf-8')
        for name, inner, out in SCRIPTS:
            b = tars[name].extractfile('package/' + inner).read()
            (VENDOR / 'js' / out).parent.mkdir(parents=True, exist_ok=True)
            (VENDOR / 'js' / out).write_bytes(b)
            outs['js/' + out] = {'sha256': sha(b), 'bytes': len(b)}
        fpkg, fdir, fpat = MJ_FONT
        for m in sorted(tars[fpkg].getmembers(), key=lambda m: m.name):
            inner = m.name.split('/', 1)[1]
            if not m.isfile() or not fpat.fullmatch(inner):
                continue
            b = tars[fpkg].extractfile(m).read()
            dst = VENDOR / 'js' / fdir / inner
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(b)
            outs[f'js/{fdir}/{inner}'] = {'sha256': sha(b), 'bytes': len(b)}
        for face in FACES:
            tar = tars[face['pkg']]
            pat = re.compile(re.escape(face['file']).replace(re.escape('{r}'), '([a-z-]+?)'))
            for m in sorted(tar.getmembers(), key=lambda m: m.name):
                g = pat.fullmatch(m.name.rsplit('/', 1)[-1])
                if not g or '/files/' not in m.name:
                    continue
                b, cps = subset(tar.extractfile(m).read(), face, keep)
                if b is None:
                    continue
                fn = m.name.rsplit('/', 1)[-1]
                (VENDOR / 'fonts' / fn).write_bytes(b)
                outs['fonts/' + fn] = {'sha256': sha(b), 'bytes': len(b)}
                faces.append({k: face[k] for k in ('family', 'style', 'weight', 'set') if k in face}
                             | ({'stretch': face['stretch']} if 'stretch' in face else {})
                             | {'file': 'fonts/' + fn, 'unicodeRange': ranges(cps)})
    out = {'note': 'written by tools/vendor.py; build.py reads vendor/ only', 'packages': pk, 'outputs': outs,
           'faces': faces, 'chars': ''.join(sorted(keep))}
    LOCK.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    total = sum(o['bytes'] for k, o in outs.items() if k.startswith('fonts/'))
    print(f'vendor/: {len(outs)} files; fonts {total} bytes in {len(faces)} faces; {len(keep)} characters')


if __name__ == '__main__':
    main()
