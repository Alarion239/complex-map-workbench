# Builds notes/tour/harness.html: the published v12 app (notes/gate-merged-r2/dist/test.html, its own stylesheet,
# renderer and MathJax) with src/tour.js, the demo adapter (demo/adapter.js, the app side of INTEGRATION.md built on
# v12's test hooks) and the harness panel (demo/panel.js) appended. Nothing in src/ or dist/ is changed.
# Run from the project root: python3 notes/tour/build_harness.py
import pathlib
root = pathlib.Path(__file__).resolve().parents[2]
app = (root / 'notes/gate-merged-r2/dist/test.html').read_text()
def script(rel):
    return '<script>\n' + (root / rel).read_text().replace('</script', '<\\/script') + '\n</script>\n'
inject = script('src/tour.js') + script('notes/tour/demo/adapter.js') + script('notes/tour/demo/panel.js')
assert app.count('</body>') == 1
out = app.replace('</body>', inject + '</body>')
out = out.replace('<title>Complex Map Workbench</title>', '<title>Tour harness</title>', 1)
(root / 'notes/tour/harness.html').write_text(out)
print('built notes/tour/harness.html', len(out), 'bytes')
