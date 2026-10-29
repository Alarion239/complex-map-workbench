'use strict';
// tools/src_parts.py's strip_esm (the page makers that inline src/ as one classic script) drops what test/src_text.js's
// stripEsm drops, on the same texts (issue #20, phase 4): the module block the codemod writes, every import form,
// CRLF lines, and what must stay (a dynamic import(), an indented import, a string that reads like one).
//   node test/t_strip_esm_py.js
const path = require('path'), { execFileSync } = require('child_process');
const { stripEsm } = require('./src_text');
const CASES = [
  "'use strict';\nconst a = 1;\n",
  "const z = a;\nimport { a, b } from './a.js';\nimport * as d from './d.js';\nexport { z, b as 'module.exports' };\n",
  "import {\n  a,\n  b,\n} from './ab.js';\nimport c from \"./c.js\";\nimport './side.js';\nconst z = a;\n",
  "const a = 1;\nexport {\n  a,\n};\nexport { q } from './q.js';\n",
  "import a from './a.js';\r\nconst z = a;\r\nexport { z };\r\n",
  "const m = import('./x.js');\n  import y from 'y';\nconst s = \"import x from './q.js'\";\nconst t = `\n  export { a };\n`;\n",
];
const py = execFileSync(process.env.PYTHON || 'python3', ['-c', [
  'import json, sys',
  `sys.path.insert(0, ${JSON.stringify(path.join(__dirname, '..'))})`,
  'from tools.src_parts import strip_esm',
  'print(json.dumps([strip_esm(t) for t in json.loads(sys.stdin.read())]))',
].join('\n')], { input: JSON.stringify(CASES), encoding: 'utf8' });
const got = JSON.parse(py);
let bad = 0;
CASES.forEach((t, i) => { if (got[i] !== stripEsm(t)) { bad++; console.log('FAIL case', i, JSON.stringify({ py: got[i], js: stripEsm(t) })); } });
console.log(bad ? `${bad} of ${CASES.length} cases FAILED` : `all ${CASES.length} cases: the same text as stripEsm`);
process.exit(bad ? 1 : 0);
