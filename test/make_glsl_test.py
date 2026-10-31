#!/usr/bin/env python3
"""Builds dist/glsl-test.html: inlines src/cx.js, parse.js, funcs.js, glsl.js and test/glsl_test.js."""
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))
from tools.src_parts import source  # noqa: E402  (the files without their import and export lines: one classic script)
src = root / 'src'
parts = [(root / 'test' / 'module_stubs.js').read_text(encoding='utf-8')] + [source(f, src, esm='strip') for f in ['cx.js', 'parse.js', 'derivs.js', 'natpaths.js', 'sheets.js', 'funcs.js', 'homrange.js', 'glsl.js']]
# (test/module_stubs.js: stand-ins for the modules left out, which the sources no longer check for; issue #20)
parts.append((root / 'test' / 'glsl_tiers.js').read_text(encoding='utf-8'))   # (the tiers and parts: before the page's own test)
parts.append((root / 'test' / 'glsl_test.js').read_text(encoding='utf-8'))
js = '\n'.join(parts).replace('</script', '<\\/script')
html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>GLChain conformance</title>
<style>body{{font:13px ui-monospace,monospace;margin:16px;background:#fff;color:#111}}pre{{white-space:pre-wrap}}</style>
</head><body>
<h3>GLChain GPU vs CPU</h3>
<pre id="out">running...</pre>
<script>
{js}
</script>
</body></html>
"""
out = root / 'dist' / 'glsl-test.html'
out.write_text(html, encoding='utf-8')
print('wrote', out, len(html), 'bytes')
