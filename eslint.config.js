'use strict';
// ESLint (notes: issue #20, phase 1). Report-only for now: CI shows the counts, nothing fails on them yet.
//   npm run lint                    every file below
//   npx eslint src/view.js          one file (src/app/*.js: the parts of app.js)
// The app's files are ES modules (issue #20, phase 4): each imports what it uses from the others and exports its
// top-level names, and tools/bundle.mjs bundles them from src/main.js. Two files stay classic scripts before the
// bundle, src/i18n.js and src/cyr.js: their I18N, $t, $tx, $tn and CYR are the modules' only globals (with MathJax,
// which the page loads). The unit tests put the modules on node's global, so they see every top-level name of src/.
//
// app.js, gl.js, figure.js and construct.js are kept as ordered parts (issue #20, phase 2; test/src_text.js): src/<name>/wrap.js holds the
// closure's first and last lines, and the parts src/<name>/NN-*.js its body, which build.py joins in order. A part is
// not a program of its own (its names live in the closure, which the other parts share: a `let` one part declares
// another assigns, and app.js's own TAU, DEG, $ and h shadow other files' globals), so each part is linted as the
// joined file, with that file's globals, and keeps the messages on its own lines (the `closure` processor below).
// The counts are the ones the single files had; only max-lines is measured on the part itself.
const fs = require('fs');
const path = require('path');
const espree = require('espree');
const js = require('@eslint/js');
const globals = require('globals');
const { Linter } = require('eslint');
const { SPLIT, PARTS_RE, parts, source } = require('./test/src_text');

const SRC = path.join(__dirname, 'src');
const CLASSIC = ['i18n.js', 'cyr.js'];   // classic scripts before the bundle; every other file of src/ is a module
const parseAny = (text) => { try { return espree.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }).body; } catch (e) { return espree.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }).body; } };
const own = {};
for (const f of fs.readdirSync(SRC).filter((name) => name.endsWith('.js'))) {
  const text = fs.readFileSync(path.join(SRC, f), 'utf8');
  const names = new Set();
  let body = [];
  try {
    body = parseAny(text);
  } catch (e) {
    // a file that does not parse: ESLint reports the syntax error itself, the other files are still linted
  }
  for (const n of body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) { if (d.id.type === 'Identifier') names.add(d.id.name); }
    else if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) names.add(n.id.name);
  }
  for (const m of text.matchAll(/\broot\)?\.([A-Za-z_$][\w$]*) = M\b/g)) names.add(m[1]);
  own[f] = { names, text };
}
// a split file towards the others: its joined text and its top-level names (gl.js's GLR)
for (const f of SPLIT) {
  const text = source(f);
  const names = new Set();
  for (const n of parseAny(text)) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) { if (d.id.type === 'Identifier') names.add(d.id.name); }
  }
  own[f] = { names, text };
}
// the globals a module sees: the classic scripts' names, and MathJax
const classicGlobals = () => {
  // (require: a node fallback a few files keep, `typeof require === 'function'`, dead in a module)
  const out = { MathJax: 'readonly', require: 'readonly' };
  for (const f of CLASSIC) if (own[f]) for (const k of own[f].names) out[k] = 'readonly';
  return out;
};
const appGlobals = (file) => {
  const out = {};
  for (const [f, o] of Object.entries(own)) if (f !== file) for (const k of o.names) out[k] = 'readonly';
  return out;
};

// errors: likely bugs (eslint:recommended, unused code, loose equality); warnings: style and size, to shrink over time
const rules = {
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
  eqeqeq: ['error', 'smart'],
  'no-irregular-whitespace': ['error', { skipTemplates: true, skipStrings: true, skipRegExps: true }],
  'no-control-regex': 'off',     // control characters are used on purpose as markers (i18n.js, tour.js, app.js)
  'no-shadow': 'warn',
  'prefer-const': 'warn',
  // size budget (issue #20): max-lines is the aim (the warnings list the files still over it); max-lines-per-function
  // sits at today's largest function, so only growth past it is flagged. Both only go down: never raise them.
  'max-lines': ['warn', { max: 1500, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['warn', { max: 2367, skipBlankLines: true, skipComments: true }],   // src/constr.js; IIFEs (the closures) are not counted
};
// the file-size budget (issue #20, ongoing conventions): each file still over the 1,500-line aim at the size it had
// when the budget was set (max-lines' count: blank and comment lines left out), so max-lines warns only when it grows.
// A file may shrink, never grow: lower its number when it shrinks (never raise one), and drop it once it is under
// 1,500, where the aim above applies again. Moving code out of a file into a new one is how a number goes down.
const SIZE_BUDGET = {
  'src/funcs.js': 2603, 'src/tour.js': 2582, 'src/constr.js': 2431,
  'src/glsl.js': 2152, 'src/inverse.js': 2165, 'src/region.js': 1830, 'src/parse.js': 1777, 'src/sound.js': 1590,
};

// the parts of a split file: each is linted as the joined file (its own text in its place, as the editor holds it), and
// keeps the messages that fall on its lines, moved to the part's line numbers and offsets
const partOf = {};   // absolute path of a part -> its split file
for (const f of SPLIT) for (const p of parts(f)) partOf[path.resolve(p)] = f;
const placed = new Map();   // part -> { start (first line in the joined text), lines, offset, length, text }
const sizeLinter = new Linter();
const closure = {
  meta: { name: 'closure' },
  supportsAutofix: true,
  preprocess(text, filename) {
    const f = partOf[path.resolve(filename)];
    const wrap = fs.readFileSync(path.join(__dirname, 'src', f.replace(/\.js$/, ''), 'wrap.js'), 'utf8');
    const m = PARTS_RE.exec(wrap);
    let head = wrap.slice(0, m.index);
    const list = parts(f);
    const i = list.findIndex((p) => path.resolve(p) === path.resolve(filename));
    for (const p of list.slice(0, i)) head += fs.readFileSync(p, 'utf8');
    const tail = list.slice(i + 1).map((p) => fs.readFileSync(p, 'utf8')).join('') + wrap.slice(m.index + m[0].length);
    placed.set(path.resolve(filename), { start: head.split('\n').length, lines: text.split('\n').length - (text.endsWith('\n') ? 1 : 0), offset: head.length, length: text.length, text });
    return [head + text + tail];
  },
  postprocess([messages], filename) {
    const at = placed.get(path.resolve(filename));
    const end = at.start + at.lines - 1;
    const move = (fix) => (fix && fix.range[0] >= at.offset && fix.range[1] <= at.offset + at.length ? { ...fix, range: [fix.range[0] - at.offset, fix.range[1] - at.offset] } : undefined);
    const out = [];
    for (const msg of messages) {
      if (msg.ruleId === 'max-lines' || !(msg.line >= at.start && msg.line <= end)) continue;
      const m = { ...msg, line: msg.line - at.start + 1 };
      if (m.endLine) { if (m.endLine > end) { m.endLine = at.lines; delete m.endColumn; } else m.endLine -= at.start - 1; }
      if (m.fix) { m.fix = move(m.fix); if (!m.fix) delete m.fix; }
      if (m.suggestions) m.suggestions = m.suggestions.map((sg) => ({ ...sg, fix: move(sg.fix) })).filter((sg) => sg.fix);
      out.push(m);
    }
    // the file-size budget is the part's own
    const size = sizeLinter.verify(at.text, { languageOptions: { sourceType: 'module' }, rules: { 'max-lines': rules['max-lines'] } });
    return out.concat(size.filter((msg) => msg.ruleId === 'max-lines'));
  },
};

module.exports = [
  // not linted: built pages, notes, generated tables, and the test/ files other than the unit tests (most of those are
  // *_cmd.js snippets that the browser harness runs inside the page, with a top-level return)
  { ignores: ['dist/**', '_site/**', 'notes/**', '.ci/**', 'node_modules/**', 'vendor/**', 'src/i18n_ru.js', 'src/i18n_it.js', 'src/seasong.js', 'src/cyr.js', 'test/**', '!test/', '!test/t_*.js'] },
  js.configs.recommended,
  { rules },
  ...Object.entries(SIZE_BUDGET).map(([f, max]) => ({ files: [f], rules: { 'max-lines': ['warn', { max, skipBlankLines: true, skipComments: true }] } })),
  // the app: ES modules, one per file (an export is a use), bundled by tools/bundle.mjs
  { files: ['src/*.js'], ignores: CLASSIC.map((f) => `src/${f}`), languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser, ...classicGlobals() } } },
  // the classic scripts before the bundle (src/cyr.js is generated and not linted)
  { files: ['src/i18n.js'], languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.browser, module: 'readonly', require: 'readonly' } } },
  // the split files: wrap.js (the closure's first and last lines, and the module block) like a module of its own, and
  // each part as the joined file (the closure processor)
  ...SPLIT.flatMap((f) => {
    const languageOptions = { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser, ...classicGlobals() } };
    const dir = `src/${f.replace(/\.js$/, '')}`;
    // (wrap.js's imports are used by the parts: the parts, linted as the joined file, report an import nothing uses)
    const imported = [...fs.readFileSync(path.join(__dirname, dir, 'wrap.js'), 'utf8').matchAll(/^import \{ ([^}]+) \} from/gm)].flatMap((m) => m[1].split(',').map((k) => k.trim().split(/\s+as\s+/).pop()));
    return [
      { files: [`${dir}/wrap.js`], languageOptions, ...(imported.length && { rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: `^(${imported.map((k) => k.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')).join('|')})$` }] } }) },
      { files: [`${dir}/[0-9][0-9]-*.js`], processor: closure, languageOptions },
    ];
  }),
  // the template of src/cyr.js (tools/make_cyr_module.py): a classic browser script like the file it becomes
  { files: ['tools/cyr_template.js'], languageOptions: { sourceType: 'script', globals: { ...globals.browser, module: 'readonly' } } },
  // the bundler: a node ES module
  { files: ['tools/**/*.mjs'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node } },
  // CI, tools and the unit tests: node scripts (the tests also put the app's modules on global)
  {
    files: ['ci/**/*.js', 'tools/**/*.js', 'test/t_*.js', 'eslint.config.js'],
    ignores: ['tools/cyr_template.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node, ...appGlobals(null) } },
  },
];
