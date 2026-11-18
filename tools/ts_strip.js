'use strict';
// The TypeScript files of src/ (issue #20) as plain JavaScript, for ESLint and for the test pages that inline src/ as
// one classic script (tools/src_parts.py). Node's own type stripping does it (module.stripTypeScriptTypes, mode
// 'strip'): every annotation becomes spaces, so each line and column stays where it was and a message about the
// stripped text points at the .ts file's own text. The .ts files use erasable syntax only (no enum, namespace or
// parameter property), which strip mode refuses with an error. tsc checks the types themselves (npm run typecheck).
//   node tools/ts_strip.js src/palette.ts     the stripped text on stdout
// ESLint's parser for the .ts files is `parser` below (eslint.config.js): typescript 7 is a native binary with no
// JavaScript API, so typescript-eslint, whose parser calls the compiler from JavaScript, cannot parse with it.
const fs = require('fs');
const mod = require('module');
const espree = require('espree');

// the text of a .ts file without its types; throws when this node has no type stripping (node 22.13 or later has it)
function strip(text, file = 'a .ts file') {
  if (typeof mod.stripTypeScriptTypes !== 'function') throw new Error(`${file}: node ${process.version} has no module.stripTypeScriptTypes (node 22.13 or later has it)`);
  // (node warns once that the function is experimental: to stderr, which the lint JSON on stdout never sees, but
  // silenced here so that the lint and test output stays as it was. The swap lasts for one synchronous call, so no
  // other warning can arrive while it is in place.)
  const emit = process.emitWarning;
  process.emitWarning = function (w, type, ...rest) {
    const t = type && typeof type === 'object' ? type.type : type;
    if (t === 'ExperimentalWarning' && /stripTypeScriptTypes/.test(String(w && w.message ? w.message : w))) return;
    return emit.call(process, w, type, ...rest);
  };
  try { return mod.stripTypeScriptTypes(text, { mode: 'strip' }); } finally { process.emitWarning = emit; }
}

// ESLint's parser for a .ts file: espree on the stripped text, with the options ESLint gives it
const parser = {
  meta: { name: 'ts-strip' },
  parse(text, options = {}) {
    return espree.parse(strip(text, options.filePath), { ...options, ecmaVersion: options.ecmaVersion || 'latest', sourceType: options.sourceType || 'module' });
  },
};

module.exports = { strip, parser };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node tools/ts_strip.js FILE.ts'); process.exit(2); }
  process.stdout.write(strip(fs.readFileSync(file, 'utf8'), file));
}
