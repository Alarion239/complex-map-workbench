'use strict';
// ESLint (notes: issue #20, phase 1). Report-only for now: CI shows the counts, nothing fails on them yet.
//   npm run lint                    every file below
//   npx eslint src/app.js           one file
// The app's files are plain scripts that build.py joins into one <script>, so a file sees the globals the other
// files declare at their top level (const CX = ..., class Pane, and the UMD modules' root.HomRange = M). They are
// read from src/ here, so the list never goes stale; each file gets the others' names, not its own.
const fs = require('fs');
const path = require('path');
const espree = require('espree');
const js = require('@eslint/js');
const globals = require('globals');

const SRC = path.join(__dirname, 'src');
const own = {};
for (const f of fs.readdirSync(SRC).filter((name) => name.endsWith('.js'))) {
  const text = fs.readFileSync(path.join(SRC, f), 'utf8');
  const names = new Set();
  for (const n of espree.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }).body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) { if (d.id.type === 'Identifier') names.add(d.id.name); }
    else if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) names.add(n.id.name);
  }
  for (const m of text.matchAll(/\broot\.([A-Za-z_$][\w$]*) = M\b/g)) names.add(m[1]);
  own[f] = names;
}
const appGlobals = (file) => {
  const out = {};
  for (const [f, names] of Object.entries(own)) if (f !== file) for (const k of names) out[k] = 'readonly';
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
  'max-lines': ['warn', { max: 1500, skipBlankLines: true, skipComments: true }],
};

module.exports = [
  // not linted: built pages, notes, generated tables, and the test/ files other than the unit tests (most of those are
  // *_cmd.js snippets that the browser harness runs inside the page, with a top-level return)
  { ignores: ['dist/**', 'docs/**', 'notes/**', '.ci/**', 'node_modules/**', 'src/i18n_ru.js', 'src/i18n_it.js', 'src/seasong.js', 'src/cyr.js', 'test/**', '!test/', '!test/t_*.js'] },
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
  })),
  // the template of src/cyr.js (tools/make_cyr_module.py): a browser script like the files it becomes
  { files: ['tools/cyr_template.js'], languageOptions: { sourceType: 'script', globals: { ...globals.browser, ...appGlobals('cyr.js'), module: 'readonly' } } },
  // CI, tools and the unit tests: node scripts (the tests also put the app's modules on global)
  {
    files: ['ci/**/*.js', 'tools/**/*.js', 'test/t_*.js', 'eslint.config.js'],
    ignores: ['tools/cyr_template.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node, ...appGlobals(null) } },
  },
];
