'use strict';
// Writes app.js and gl.js as build.py joins them from their parts (src/app/, src/gl/; test/src_text.js) to
// dist/tsc/app.js and dist/tsc/gl.js, which tsc checks in their place (tsconfig.json): a part is not a program of its
// own, so tsc sees each closure whole, as the page runs it.
//   node tools/join_src.js          (npm run typecheck runs it first; npm ci and npm install run it too, "prepare")
const fs = require('fs');
const path = require('path');
const { SPLIT, source } = require('../test/src_text');

const out = path.join(__dirname, '../dist/tsc');
// (once the sources are ES modules, #20 phase 4: an import's './x.js' is relative to src/, where the joined file
// would stand, not to dist/tsc/; it points back at src/ so tsc finds the module, and finds no module otherwise)
const SRC = path.relative(out, path.join(__dirname, '../src')).split(path.sep).join('/');
const repath = (text) => text.replace(/^(import\b[^'"\n]*?\bfrom\s*|import\s*|export\s*\{[^}\n]*\}\s*from\s*)(['"])\.\/([^'"\n]+)\2/gm, (m, head, q, p) => `${head}${q}${SRC}/${p}${q}`);
if (require.main === module) {
  fs.mkdirSync(out, { recursive: true });
  for (const f of SPLIT) fs.writeFileSync(path.join(out, f), repath(source(f)));
}
module.exports = { repath };
