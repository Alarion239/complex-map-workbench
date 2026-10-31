#!/usr/bin/env python3
"""Builds dist/gl-test.html: inlines src/cx.js, parse.js, funcs.js, glsl.js, region.js, gl.js and test/gl_test.js.

Open http://localhost:8793/gl-test.html (optionally ?theme=dark, ?only=grid|patterns|lines|color|land|sphere|perf).
Results (pixel comparisons, timings, errors) are in window.__glTest and in the <pre id="out"> block.
"""
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))
from tools.src_parts import source  # noqa: E402  (gl.js is joined from src/gl/, as build.py does)
src = root / 'src'
parts = [source(f, src, esm='strip') for f in ['cx.js', 'symbolic.js', 'parse.js', 'derivs.js', 'natpaths.js', 'sheets.js', 'formulasteps.js', 'funcs.js', 'glsl.js', 'regionlines.js', 'region.js', 'palette.js', 'gl.js']]
parts.append((root / 'test' / 'gl_test.js').read_text())
js = '\n'.join(parts).replace('</script', '<\\/script')
html = f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>GL renderer test</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wdth,wght@8..144,75..125,400..700&family=JetBrains+Mono:wght@400..700&display=swap">
<style>
:root{{--bg:#E3E8EA;--panel:#F1F4F5;--ink:#121A20;--muted:#56646E;--line:#D2DADE}}
:root[data-theme=dark]{{--bg:#12191E;--panel:#172026;--ink:#E3EAEE;--muted:#91A1AB;--line:#26333B}}
body{{margin:0;padding:12px 16px;background:var(--bg);color:var(--ink);font:13px/18px 'Roboto Flex',system-ui,sans-serif}}
h2{{font:600 13px/18px 'Roboto Flex',system-ui,sans-serif;margin:16px 0 6px}}
.row{{display:flex;flex-wrap:wrap;gap:8px}}
figure{{margin:0;display:flex;flex-direction:column;gap:2px}}
figure canvas{{border:1px solid var(--line);border-radius:4px;display:block}}
figcaption{{font:400 10px/12px 'JetBrains Mono',ui-monospace,monospace;color:var(--muted)}}
pre{{font:11px/15px 'JetBrains Mono',ui-monospace,monospace;white-space:pre-wrap;background:var(--panel);padding:8px;border-radius:4px}}
</style>
</head><body>
<pre id="out">running...</pre>
<div id="root"></div>
<script>
{js}
</script>
</body></html>
"""
out = root / 'dist' / 'gl-test.html'
out.write_text(html)
print('wrote', out, len(html), 'bytes')
