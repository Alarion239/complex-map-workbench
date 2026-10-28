'use strict';
// ESLint (notes: issue #20, phase 1). Report-only for now: CI shows the counts, nothing fails on them yet.
//   npm run lint                    every file below
//   npx eslint src/view.js          one file (src/app/*.js: the parts of app.js)
// The app's files are plain scripts that build.py joins into one <script>, so a file sees the globals the other
// files declare at their top level (const CX = ..., class Pane, and the UMD modules' root.HomRange = M, also written
// (root).HomRange = M with a JSDoc cast). They are read from src/ here, so the list never goes stale; each file gets
// the others' names, not its own.
//
// app.js and gl.js are kept as ordered parts (issue #20, phase 2; test/src_text.js): src/<name>/wrap.js holds the
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
const own = {};
for (const f of fs.readdirSync(SRC).filter((name) => name.endsWith('.js'))) {
  const text = fs.readFileSync(path.join(SRC, f), 'utf8');
  const names = new Set();
  let body = [];
  try {
    body = espree.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }).body;
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
  for (const n of espree.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }).body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) { if (d.id.type === 'Identifier') names.add(d.id.name); }
  }
  own[f] = { names, text };
}
// a file's own top-level names that another file uses are its exports, not unused variables
const exported = (file) => [...own[file].names].filter((k) =>
  Object.entries(own).some(([f, o]) => f !== file && new RegExp(`(^|[^\\w$.])${k.replace(/\$/g, '\\$')}\\b`).test(o.text)));
const unusedRule = (file) => {
  const names = exported(file);
  return ['error', { args: 'none', caughtErrors: 'none', ...(names.length && { varsIgnorePattern: `^(${names.map((k) => k.replace(/\$/g, '\\$')).join('|')})$` }) }];
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
    const size = sizeLinter.verify(at.text, { languageOptions: { sourceType: 'script', parserOptions: { ecmaFeatures: { globalReturn: true } } }, rules: { 'max-lines': rules['max-lines'] } });
    return out.concat(size.filter((msg) => msg.ruleId === 'max-lines'));
  },
};

module.exports = [
  // not linted: built pages, notes, generated tables, and the test/ files other than the unit tests (most of those are
  // *_cmd.js snippets that the browser harness runs inside the page, with a top-level return)
  { ignores: ['dist/**', '_site/**', 'notes/**', '.ci/**', 'node_modules/**', 'src/i18n_ru.js', 'src/i18n_it.js', 'src/seasong.js', 'src/cyr.js', 'test/**', '!test/', '!test/t_*.js'] },
  js.configs.recommended,
  { rules },
  // the app: browser scripts, one per file, joined by build.py
  ...Object.keys(own).map((f) => ({
    files: [`src/${f}`],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...appGlobals(f),
        module: 'readonly',     // the UMD modules export to node when module is defined (their unit tests)
        require: 'readonly',
        MathJax: 'readonly',    // loaded from the CDN by the page (build.py)
      },
    },
    rules: { 'no-unused-vars': unusedRule(f) },
  })),
  // the split files: wrap.js like a file of its own, and each part as the joined file (the closure processor)
  ...SPLIT.flatMap((f) => {
    const languageOptions = { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.browser, ...appGlobals(f), module: 'readonly', require: 'readonly', MathJax: 'readonly' } };
    const dir = `src/${f.replace(/\.js$/, '')}`;
    return [
      { files: [`${dir}/wrap.js`], languageOptions, rules: { 'no-unused-vars': unusedRule(f) } },
      { files: [`${dir}/[0-9][0-9]-*.js`], processor: closure, languageOptions, rules: { 'no-unused-vars': unusedRule(f) } },
    ];
  }),
  // the template of src/cyr.js (tools/make_cyr_module.py): a browser script like the files it becomes
  { files: ['tools/cyr_template.js'], languageOptions: { sourceType: 'script', globals: { ...globals.browser, ...appGlobals('cyr.js'), module: 'readonly' } }, rules: { 'no-unused-vars': unusedRule('cyr.js') } },
  // CI, tools and the unit tests: node scripts (the tests also put the app's modules on global)
  {
    files: ['ci/**/*.js', 'tools/**/*.js', 'test/t_*.js', 'eslint.config.js'],
    ignores: ['tools/cyr_template.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node, ...appGlobals(null) } },
  },
];
