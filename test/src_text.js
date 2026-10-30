'use strict';
// The app's source files as build.py joins them (issue #20, phase 2), for the tests and tools that read them as text.
// src/app.js, src/gl.js and src/figure.js are kept as ordered parts: src/<name>/wrap.js holds the closure's first and last lines
// around an "// @parts" line, and the parts src/<name>/NN-*.js take that line's place, joined in file name order. The
// joined text is the old single file byte for byte. tools/src_parts.py does the same for build.py and the Python.
//   const { appText, glText, source } = require('./src_text');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../src');
const PARTS_RE = /^ *\/\/ @parts\b[^\n]*\n/m;   // ([^\n], not ., which stops at the \r of a CRLF checkout)
// the files kept as parts
const SPLIT = ['app.js', 'gl.js', 'figure.js'];

// the parts of a split file ('app.js' -> [.../src/app/01-core.js, ...]) in order, or null for a file kept whole;
// dir: another copy of src/ (a snapshot of an older version holds app.js and gl.js whole)
function parts(file, dir = SRC) {
  const d = path.join(dir, file.replace(/\.js$/, ''));
  if (!fs.existsSync(path.join(d, 'wrap.js'))) return null;
  return fs.readdirSync(d).filter((n) => /^\d\d-.*\.js$/.test(n)).sort().map((n) => path.join(d, n));
}

// What a module file (ES modules, phase 4 of issue #20) carries around its code, which a test that evaluates the text as a
// script must not see: `import ... from '...';` lines (plain, default, `* as`, multi-line, or bare `import '...';`) and
// `export { ... };` lines, each standing at the start of a line, wherever in the file they are (the codemod puts the block
// at the end of a file so that no line number above it changes). Both go; the rest is as it was: an indented one, or
// `import(` as a call, stays. A file with neither is returned as it is.
const IMPORT_RE = /^import\s*(?:[\w$*{][^;'"]*?\bfrom\s*)?(['"])[^'"\n]+\1[ \t]*;?[ \t]*\r?\n?/gm;
const EXPORT_RE = /^export\s*\{[^}]*\}[ \t]*(?:from\s*['"][^'"\n]+['"][ \t]*)?;?[ \t]*\r?\n?/gm;
function stripEsm(text) {
  return text.replace(IMPORT_RE, '').replace(EXPORT_RE, '');
}

// the text of src/<file>: the file, or a split file's wrap.js with its parts joined in place of the // @parts line.
//   source(file)                      the app's own src/
//   source(file, dir)                 another copy of src/ (a snapshot)
//   source(file, { esm: 'strip' })    without the import lines and export { } lines of a module file (a script's text, for
//                                     vm and new Function); also source(file, dir, { esm: 'strip' })
function source(file, a, b) {
  // (the options are b when it is an object, whatever a is: source(f, undefined, { esm: 'strip' }) too)
  const dir = typeof a === 'string' ? a : SRC, opt = (b && typeof b === 'object' ? b : a && typeof a === 'object' ? a : null) || {};
  const text = joined(file, dir);
  return opt.esm === 'strip' ? stripEsm(text) : text;
}
function joined(file, dir) {
  const p = parts(file, dir);
  if (!p) return fs.readFileSync(path.join(dir, file), 'utf8');
  const wrap = fs.readFileSync(path.join(dir, file.replace(/\.js$/, ''), 'wrap.js'), 'utf8');
  const m = PARTS_RE.exec(wrap);
  if (!m) throw new Error(`${file}: wrap.js has no // @parts line`);
  return wrap.slice(0, m.index) + p.map((f) => fs.readFileSync(f, 'utf8')).join('') + wrap.slice(m.index + m[0].length);
}

module.exports = { SRC, SPLIT, PARTS_RE, parts, source, stripEsm, appText: () => source('app.js'), glText: () => source('gl.js') };
