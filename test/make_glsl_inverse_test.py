#!/usr/bin/env python3
"""Builds dist/glsl-inverse-test.html: the GLSL parity test of the inverse renderer (SPEC 12.2).

Inlines src/cx.js, parse.js, funcs.js, inverse.js, calc.js, glsl.js, region.js, gl.js, the REGION_FS fixtures
(test/fixtures/region_fs_*.glsl: recorded before P2 from the pre-change gl.js, re-recorded in P3 with the
reviewed pattern-8 addition; the pre-P3 ones are region_fs_*.pre-p3.glsl) and test/glsl_inverse_test.js.
Run in headless Chrome (test/cdp_kit): test/glsl_inverse_cmd.js; results in window.__invTest.
"""
import json
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
parts = [(src / f).read_text(encoding='utf-8') for f in ['cx.js', 'parse.js', 'funcs.js', 'inverse.js', 'calc.js', 'glsl.js', 'region.js', 'constr.js', 'gl.js']]   # (constr.js: v16's exact-form rows, review regress-3)
fx = {k: (root / 'test' / 'fixtures' / f'region_fs_{k}.glsl').read_text(encoding='utf-8') for k in ['flat', 'sphere']}
parts.append('window.__REGION_FS_FIXTURES = ' + json.dumps(fx) + ';')
parts.append((root / 'test' / 'glsl_inverse_test.js').read_text(encoding='utf-8'))
js = '\n'.join(parts).replace('</script', '<\\/script')
html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Inverse walker GPU vs CPU</title>
<style>body{{font:13px ui-monospace,monospace;margin:16px;background:#fff;color:#111}}pre{{white-space:pre-wrap}}</style>
</head><body>
<h3>Inverse walker: GPU vs CPU (SPEC 12.2)</h3>
<pre id="out">call __invTestRun()</pre>
<script>
{js}
</script>
</body></html>
"""
out = root / 'dist' / 'glsl-inverse-test.html'
out.write_text(html, encoding='utf-8')
print('wrote', out, len(html), 'bytes')
