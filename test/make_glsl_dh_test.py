#!/usr/bin/env python3
"""Builds dist/glsl-dh-test.html: the sources the GLChain page reads, then the Douady-Hubbard / Boettcher orbit's two GPU checks,
test/glsl_dh_orbit_test.js (window.__dhOrbit) and test/glsl_dh_stop_test.js (window.__dhStop), each in a WebGL2 context of its own.
ci/glsl.js runs it as its page 'dh'."""
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))
from tools.src_parts import source  # noqa: E402  (the files without their import and export lines: one classic script)
src = root / 'src'
parts = [(root / 'test' / 'module_stubs.js').read_text(encoding='utf-8')] + [source(f, src, esm='strip') for f in ['cx.js', 'symbolic.js', 'parse.js', 'derivs.js', 'natpaths.js', 'sheets.js', 'formulasteps.js', 'funcs.js', 'homrange.js', 'glsl.js']]
parts += [(root / 'test' / f).read_text(encoding='utf-8') for f in ['glsl_dh_orbit_test.js', 'glsl_dh_stop_test.js']]
js = '\n'.join(parts).replace('</script', '<\\/script')
html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>DH orbit GPU checks</title></head><body>
<pre id="out">running...</pre>
<script>
{js}
</script>
</body></html>
"""
out = root / 'dist' / 'glsl-dh-test.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print('wrote', out, len(html), 'bytes')
