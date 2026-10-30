"""The live page for GitHub Pages (.github/workflows/pages.yml): the built page in a document shell.

    python3 build.py && python3 ci/pages.py [OUT_DIR]

Writes OUT_DIR/index.html (default _site/): dist/complex-map-workbench.html between the shell below (the same file
the hand-committed docs/index.html was, before Pages deployed from CI), and an empty .nojekyll. Beside it,
OUT_DIR/complex-map-workbench-offline.html: the offline page (issue #21, dist/complex-map-workbench-offline.html, with
MathJax and the faces inline) in the same shell, which the live page's Settings links to (Download offline page).
"""
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / '_site'

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Complex Map Workbench: draw regions, chain complex functions, and see exact images, phase portraits, landscapes and deformations.">
</head>
<body>
"""
TAIL = '\n</body>\n</html>\n'

out.mkdir(parents=True, exist_ok=True)
for name, built in [('index.html', 'complex-map-workbench.html'), ('complex-map-workbench-offline.html', 'complex-map-workbench-offline.html')]:
    page = (root / 'dist' / built).read_text(encoding='utf-8')
    with open(out / name, 'w', encoding='utf-8', newline='\n') as f:
        f.write(HEAD + page + TAIL)
    print(f'{out / name}: {len(HEAD) + len(page) + len(TAIL)} characters')
(out / '.nojekyll').write_text('')
