"""Build dist/css-fixture.html: src/page.html plus static mock DOM (test/css_fixture.js), no app JS.
Query params: mode=image|color|morph, tool=<id>, theme=light|dark, compact, empty, noshapes,
hideLeft, hideRight, drawerLeft, drawerRight, solo=L|R, show=palette,menu,examples,pad,toast,tip,modal,dragging"""
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
page = (root / 'src' / 'page.html').read_text()
js = (root / 'test' / 'css_fixture.js').read_text()
out = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
</head><body>
""" + page + "\n<script>\n" + js + "\n</script>\n</body></html>\n"
(root / 'dist' / 'css-fixture.html').write_text(out)
print('wrote dist/css-fixture.html', len(out))
