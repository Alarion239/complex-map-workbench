#!/usr/bin/env python3
"""Builds dist/inv-bench.html: the generated-program benchmark of the inverse renderer (SPEC 4.7, 13.10).

Inlines the app's pure modules and gl.js (src/cx.js, parse.js, funcs.js, inverse.js, calc.js, glsl.js, region.js,
gl.js) and test/inv_bench.js, which drives GLR.drawInverse with the programs glsl.js and gl.js generate (no
hand-written GLSL). Run it through a CDP daemon (test/cdp_kit): test/inv_bench_cmd.js.
"""
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
parts = [(src / f).read_text() for f in ['cx.js', 'parse.js', 'funcs.js', 'inverse.js', 'calc.js', 'glsl.js', 'region.js', 'palette.js', 'gl.js']]
parts.append((root / 'test' / 'inv_bench.js').read_text())
js = '\n'.join(parts).replace('</script', '<\\/script')
html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Inverse renderer benchmark</title>
<style>body{{font:13px ui-monospace,monospace;margin:16px;background:#fff;color:#111}}</style>
</head><body>
<pre id="out">ready</pre>
<script>
{js}
</script>
</body></html>
"""
out = root / 'dist' / 'inv-bench.html'
out.write_text(html)
print('wrote', out, len(html), 'bytes')
