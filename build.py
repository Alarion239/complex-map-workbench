import json, pathlib, re
root = pathlib.Path(__file__).parent
src = root / 'src'
page = (src / 'page.html').read_text()
js = '\n'.join((src / f).read_text() for f in ['cx.js', 'parse.js', 'funcs.js', 'inverse.js', 'calc.js', 'glsl.js', 'region.js', 'curves.js', 'sphere.js', 'gl.js', 'view.js', 'figure.js', 'sound.js', 'tour.js', 'app.js'])
js = js.replace('</script', '<\\/script')
mj = """<script>
window.MathJax = { options: { enableAssistiveMml: false, enableMenu: false }, svg: { fontCache: 'local' }, startup: { typeset: false, ready: function () { MathJax.startup.defaultReady(); MathJax.startup.promise.then(function () { try { document.head.appendChild(MathJax.svgStylesheet()); } catch (e) {} if (window.__mjReady) window.__mjReady(); }); } } };
</script>
<script async src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.min.js"></script>
"""

# ---- the Russian data as JSON blocks (notes/i18n/USER-DECISIONS.md, page size) ----
# The Russian table (src/i18n_ru.js) and the Cyrillic outline faces (src/cyr.js) go into the page as
# <script type="application/json"> blocks, which the browser never runs: English pays their bytes only, never their
# parse or compile. i18n.js parses the table on the first Russian lookup, cyr.js a face on its first Russian figure.
# The blocks come before the app's script, which looks the table up while it loads (funcs.js's catalog in Russian).
CYR_RE = re.compile(r'(?:[\u0400-\u04FF])')


def block(name, text):
    json.loads(text)                     # valid JSON; '<' only occurs inside strings, so \u003c keeps </script out
    return f'<script type="application/json" id="{name}">' + text.replace('<', '\\u003c') + '</script>\n'


ru_js = (src / 'i18n_ru.js').read_text()
m = re.search(r"^I18N\.define\('ru', (\".*\")\);\s*$", ru_js, re.S | re.M)
assert m, 'src/i18n_ru.js: no I18N.define(\'ru\', "...")'
ru_text = json.loads(m.group(1))
ru_table = json.loads(ru_text)

cyr_js = (src / 'cyr.js').read_text()
LIT = r'("(?:[^"\\]|\\.)*")'
m = re.search(r'const RAW = \{ rm: ' + LIT + r', bx: ' + LIT + r', ti: ' + LIT + r' \};', cyr_js)
assert m, 'src/cyr.js: no RAW faces'
faces = {k: json.loads(json.loads(m.group(i + 1))) for i, k in enumerate(['rm', 'bx', 'ti'])}
cyr_js = cyr_js[:m.start()] + 'const RAW = { rm: null, bx: null, ti: null };' + cyr_js[m.end():]


# the bold face keeps the glyphs bold Russian text uses: a bold run is set from it only when it holds Cyrillic
# (cyr.js split), so these are the characters of the Russian (and literal) text of every bold caption segment
# ({ b: ... } in src/*.js: "Figure 1." -> «Рис. 1.») and of every \textbf{...} group in the Russian table
def bold_texts():
    out = []
    app = '\n'.join((src / f).read_text() for f in ['figure.js', 'app.js'])
    for mm in re.finditer(r'\{\s*b:\s*', app):
        i, depth = mm.end(), 1
        while i < len(app) and depth:
            depth += {'{': 1, '}': -1}.get(app[i], 0)
            i += 1
        expr = app[mm.end():i - 1]
        for k in re.findall(r"\$t\('((?:[^'\\]|\\.)*)'", expr):
            v = ru_table.get(k.replace("\\'", "'"))
            out += list(v.values()) if isinstance(v, dict) else [v] if v else []
        for q, tl in re.findall(r"'((?:[^'\\]|\\.)*)'|`([^`]*)`", expr):
            out.append(q or re.sub(r'\$\{[^}]*\}', '', tl))
    for v in ru_table.values():
        for s in (v.values() if isinstance(v, dict) else [v]):
            out += re.findall(r'\\textbf\{([^{}]*)\}', s)
    return out


bold = sorted({ch for s in bold_texts() if CYR_RE.search(s) for ch in s if ch not in ' \u00a0~'})
bx = faces['bx']
keep = [ch for ch in bold if ch in bx['glyphs']]
missing = [ch for ch in bold if ch not in bx['glyphs']]
assert not missing, f'bold Russian characters without a glyph: {missing}'
bx['glyphs'] = {ch: g for ch, g in bx['glyphs'].items() if ch in keep}
bx['kern'] = {p: v for p, v in bx['kern'].items() if all(c in keep for c in p)}
data = block('cmw-i18n-ru', ru_text)
for k in ['rm', 'bx', 'ti']:
    if k == 'bx' and not keep:
        continue                         # nothing is bold: no bold face (cyr.js then has a face without glyphs)
    data += block('cmw-cyr-' + k, json.dumps(faces[k], ensure_ascii=False, separators=(',', ':')))

# the interface language first (notes/i18n/DESIGN.md 1): i18n.js before cx.js, so the language is known before
# funcs.js builds its catalog; the table and the faces are the data blocks above
js = '\n'.join([(src / 'i18n.js').read_text(), cyr_js]).replace('</script', '<\\/script') + '\n' + js
body = page + '\n' + data + mj + '<script>\n' + js + '\n</script>\n'
# the published page drops the test hooks (window.__cmw*); dist/test.html keeps them for testing
pub_js = re.sub(r'\n[ \t]*// TEMP-DEBUG-HOOK \(removed before publishing\).*?// TEMP-DEBUG-HOOK\n', '\n', js, flags=re.S)
assert '__cmw' not in pub_js, 'test hooks left in the published page'
# (a charset first, so the file decodes as UTF-8 even served without a charset header or opened from disk; the
# artifact host's skeleton declares UTF-8 too)
pub = '<meta charset="utf-8">\n' + page + '\n' + data + mj + '<script>\n' + pub_js + '\n</script>\n'
dist = root / 'dist'
dist.mkdir(exist_ok=True)
(dist / 'complex-map-workbench.html').write_text(pub)
test = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>
""" + body + "</body></html>\n"
(dist / 'test.html').write_text(test)
print('built', len(body), 'bytes; Russian data blocks', len(data.encode()), 'bytes; bold glyphs', ''.join(keep) or 'none')
