"""The app's source files as build.py joins them (issue #20, phase 2).

src/app.js, src/gl.js and src/figure.js are kept as ordered parts: src/<name>/wrap.js holds the closure's first and last lines around
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


# an ES module's import and export { } lines (issue #20, phase 4), as test/src_text.js's stripEsm finds them: a test page
# that inlines src/ files as one classic script drops them (its files' top-level names are then globals, as before)
IMPORT_RE = re.compile(r'''^import\s*(?:[\w$*{][^;'"]*?\bfrom\s*)?(['"])[^'"\n]+\1[ \t]*;?[ \t]*\r?\n?''', re.M)
EXPORT_RE = re.compile(r'''^export\s*\{[^}]*\}[ \t]*(?:from\s*['"][^'"\n]+['"][ \t]*)?;?[ \t]*\r?\n?''', re.M)


def strip_esm(text):
    """text without its line-start import lines and export { } lines; nothing else changes."""
    return EXPORT_RE.sub('', IMPORT_RE.sub('', text))


def source(f, src=SRC, esm=None):
    """The text of src/<f>: the file, or a split file's wrap.js with its parts joined in place of the // @parts line;
    esm='strip' drops its import and export lines (strip_esm), for a page that inlines it as a classic script."""
    p = parts(f, src)
    if p is None:
        text = (pathlib.Path(src) / f).read_text(encoding='utf-8')
    else:
        wrap = (pathlib.Path(src) / f.removesuffix('.js') / 'wrap.js').read_text(encoding='utf-8')
        m = PARTS_RE.search(wrap)
        assert m, f'{f}: wrap.js has no // @parts line'
        text = wrap[:m.start()] + ''.join(q.read_text(encoding='utf-8') for q in p) + wrap[m.end():]
    return strip_esm(text) if esm == 'strip' else text


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
