import pathlib, re
root = pathlib.Path(__file__).parent
src = root / 'src'
page = (src / 'page.html').read_text()
js = '\n'.join((src / f).read_text() for f in ['cx.js', 'parse.js', 'funcs.js', 'inverse.js', 'calc.js', 'glsl.js', 'region.js', 'gl.js', 'view.js', 'app.js'])
js = js.replace('</script', '<\\/script')
mj = """<script>
window.MathJax = { options: { enableAssistiveMml: false, enableMenu: false }, svg: { fontCache: 'local' }, startup: { typeset: false, ready: function () { MathJax.startup.defaultReady(); MathJax.startup.promise.then(function () { try { document.head.appendChild(MathJax.svgStylesheet()); } catch (e) {} if (window.__mjReady) window.__mjReady(); }); } } };
</script>
<script async src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.min.js"></script>
"""
body = page + '\n' + mj + '<script>\n' + js + '\n</script>\n'
# the published page drops the test hooks (window.__cmw*); dist/test.html keeps them for testing
pub_js = re.sub(r'\n[ \t]*// TEMP-DEBUG-HOOK \(removed before publishing\).*?// TEMP-DEBUG-HOOK\n', '\n', js, flags=re.S)
assert '__cmw' not in pub_js, 'test hooks left in the published page'
pub = page + '\n' + mj + '<script>\n' + pub_js + '\n</script>\n'
dist = root / 'dist'
dist.mkdir(exist_ok=True)
(dist / 'complex-map-workbench.html').write_text(pub)
test = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>
""" + body + "</body></html>\n"
(dist / 'test.html').write_text(test)
print('built', len(body), 'bytes')
