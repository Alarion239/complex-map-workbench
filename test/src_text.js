'use strict';
// The app's source files as build.py joins them (issue #20, phase 2), for the tests and tools that read them as text.
// src/app.js and src/gl.js are kept as ordered parts: src/<name>/wrap.js holds the closure's first and last lines
// around an "// @parts" line, and the parts src/<name>/NN-*.js take that line's place, joined in file name order. The
// joined text is the old single file byte for byte. tools/src_parts.py does the same for build.py and the Python.
//   const { appText, glText, source } = require('./src_text');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../src');
const PARTS_RE = /^ *\/\/ @parts\b.*\n/m;
// the files kept as parts
const SPLIT = ['app.js', 'gl.js'];

// the parts of a split file ('app.js' -> [.../src/app/01-core.js, ...]) in order, or null for a file kept whole;
// dir: another copy of src/ (a snapshot of an older version holds app.js and gl.js whole)
function parts(file, dir = SRC) {
  const d = path.join(dir, file.replace(/\.js$/, ''));
  if (!fs.existsSync(path.join(d, 'wrap.js'))) return null;
  return fs.readdirSync(d).filter((n) => /^\d\d-.*\.js$/.test(n)).sort().map((n) => path.join(d, n));
}

// What a module file (ES modules, phase 4 of issue #20) carries around its code, which a test that evaluates the text as a
// script must not see: a leading block of `import ... from '...';` lines (among comments, blank lines and 'use strict'),
// and `export { ... };` lines, which stand at the start of a line. Both go; the rest of the file is as it was. A file
// with neither is returned as it is.
function stripEsm(text) {
  const skip = /(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|(['"])use strict\1;?)/y, imp = /import\s*(?:[\w$*{][^;'"]*?\bfrom\s*)?(['"])[^'"\n]+\1[ \t]*;?[ \t]*\r?\n?/y;
  const cuts = [];
  for (let i = 0; i < text.length;) {
    skip.lastIndex = i; imp.lastIndex = i;
    const m = skip.exec(text);
    if (m) { i = skip.lastIndex; continue; }
    const n = imp.exec(text);
    if (!n) break;
    cuts.push([i, imp.lastIndex]); i = imp.lastIndex;
  }
  let out = '', at = 0;
  for (const [a, b] of cuts) { out += text.slice(at, a); at = b; }
  out += text.slice(at);
  return out.replace(/^export\s*\{[^}]*\}[ \t]*(?:from\s*['"][^'"\n]+['"][ \t]*)?;?[ \t]*\r?\n?/gm, '');
}

// the text of src/<file>: the file, or a split file's wrap.js with its parts joined in place of the // @parts line.
//   source(file)                      the app's own src/
//   source(file, dir)                 another copy of src/ (a snapshot)
//   source(file, { esm: 'strip' })    without the import lines and export { } lines of a module file (a script's text, for
//                                     vm and new Function); also source(file, dir, { esm: 'strip' })
function source(file, a, b) {
  const dir = typeof a === 'string' ? a : SRC, opt = (typeof a === 'string' ? b : a) || {};
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
