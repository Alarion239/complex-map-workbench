#!/usr/bin/env python3
"""Builds dist/glsl-test.html: inlines src/cx.js, parse.js, funcs.js, glsl.js and test/glsl_test.js."""
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
parts = [(src / f).read_text() for f in ['cx.js', 'parse.js', 'funcs.js', 'homrange.js', 'glsl.js']]
parts.append((root / 'test' / 'glsl_test.js').read_text())
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
out.write_text(html)
print('wrote', out, len(html), 'bytes')
