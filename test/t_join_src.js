'use strict';
// tools/join_src.js: dist/tsc/app.js and gl.js are the joined parts as they are, but for an import's path, which points
// back at src/ (#20 phase 4: './x.js' is relative to src/, where the joined file would stand, not to dist/tsc/).
//   node test/t_join_src.js
const fs = require('fs'), path = require('path');
const { repath } = require('../tools/join_src.js');
const { SPLIT, source } = require('./src_text');
let fails = 0, n = 0;
const ok = (name, pass, detail) => { n++; if (!pass) { fails++; console.log('FAIL ' + name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 300)); } };
const R = (t) => repath(t).split('\n');
ok('an import of names from a file of src/ points at src/', R("import { CX, cadd } from './cx.js';")[0] === "import { CX, cadd } from '../../src/cx.js';", R("import { CX, cadd } from './cx.js';"));
ok('an import for its effect alone, the same', R("import './expose.js';")[0] === "import '../../src/expose.js';");
ok('an export from another file, the same', R('export { Q } from "./q.js";')[0] === 'export { Q } from "../../src/q.js";');
ok('an export of its own names stays', R('export { CX, cadd };')[0] === 'export { CX, cadd };');
ok('a string that only reads like an import stays', R("const s = \"import x from './y.js'\";")[0] === "const s = \"import x from './y.js'\";");
ok('an import that is not at a line\'s start stays (a module\'s imports are)', R("  import { A } from './a.js';")[0] === "  import { A } from './a.js';");
ok('CRLF text keeps its CRLF', repath("import { A } from './a.js';\r\nx\r\n") === "import { A } from '../../src/a.js';\r\nx\r\n");
for (const f of SPLIT) { const t = source(f); ok(`${f}: text with no import is written as it is`, /^import\b/m.test(t) || repath(t) === t); }
ok('the path is relative to dist/tsc/', path.resolve(__dirname, '../dist/tsc', '../../src/cx.js') === path.resolve(__dirname, '../src/cx.js') && fs.existsSync(path.resolve(__dirname, '../dist/tsc', '../../src/cx.js')));
console.log(fails ? `${fails} of ${n} checks FAILED` : `all ${n} checks pass`);
process.exit(fails ? 1 : 0);
