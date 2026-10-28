'use strict';
// Writes app.js and gl.js as build.py joins them from their parts (src/app/, src/gl/; test/src_text.js) to
// dist/tsc/app.js and dist/tsc/gl.js, which tsc checks in their place (tsconfig.json): a part is not a program of its
// own, so tsc sees each closure whole, as the page runs it.
//   node tools/join_src.js          (npm run typecheck runs it first; npm ci and npm install run it too, "prepare")
const fs = require('fs');
const path = require('path');
const { SPLIT, source } = require('../test/src_text');

const out = path.join(__dirname, '../dist/tsc');
fs.mkdirSync(out, { recursive: true });
for (const f of SPLIT) fs.writeFileSync(path.join(out, f), source(f));
