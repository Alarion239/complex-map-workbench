"""The app's source files as build.py joins them (issue #20, phase 2).

src/app.js and src/gl.js are kept as ordered parts: src/<name>/wrap.js holds the closure's first and last lines around
an "// @parts" line, and the parts src/<name>/NN-*.js take that line's place, joined in file name order. The joined
text is the old single file byte for byte. test/src_text.js does the same for the JavaScript tests and tools.
"""
import pathlib
import re

SRC = pathlib.Path(__file__).resolve().parent.parent / 'src'
PARTS_RE = re.compile(r'^ *// @parts\b.*\n', re.M)


def parts(f, src=SRC):
    """The parts of a split file ('app.js' -> [src/app/01-core.js, ...]) in order, or None for a file kept whole."""
    d = pathlib.Path(src) / f.removesuffix('.js')
    if not (d / 'wrap.js').is_file():
        return None
    return sorted(d.glob('[0-9][0-9]-*.js'))


def source(f, src=SRC):
    """The text of src/<f>: the file, or a split file's wrap.js with its parts joined in place of the // @parts line."""
    p = parts(f, src)
    if p is None:
        return (pathlib.Path(src) / f).read_text(encoding='utf-8')
    wrap = (pathlib.Path(src) / f.removesuffix('.js') / 'wrap.js').read_text(encoding='utf-8')
    m = PARTS_RE.search(wrap)
    assert m, f'{f}: wrap.js has no // @parts line'
    return wrap[:m.start()] + ''.join(q.read_text(encoding='utf-8') for q in p) + wrap[m.end():]


def src_texts(src=SRC):
    """[(name, text)] for the files of src/ in name order, a split file as one ('app.js', its joined text), so that
    line numbers are the joined file's, as the hand-written tables' file:line references expect."""
    src = pathlib.Path(src)
    out = []
    for p in sorted(src.iterdir(), key=lambda p: p.name + '.js' if p.is_dir() else p.name):
        if p.is_file():
            out.append((p.name, p.read_text(encoding='utf-8')))
        elif (p / 'wrap.js').is_file():
            out.append((p.name + '.js', source(p.name + '.js', src)))
    return out
