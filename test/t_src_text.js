// test/src_text.js: source(file, { esm: 'strip' }) drops a module file's import block and export { } lines, and nothing else.
const { source, stripEsm } = require('./src_text');
let bad = 0, n = 0;
const check = (name, ok, detail) => { n++; if (!ok) { bad++; console.log('FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); } };
const eq = (name, got, want) => check(name, got === want, { got, want });

eq('a script is untouched', stripEsm("'use strict';\nconst a = 1;\n"), "'use strict';\nconst a = 1;\n");
eq('the leading imports go, in every form', stripEsm("'use strict';\n// the deps\nimport { a, b } from './a.js';\nimport c from \"./c.js\";\nimport * as d from './d.js'\nimport './side.js';\n\n/* x */\nconst z = a;\n"), "'use strict';\n// the deps\n\n/* x */\nconst z = a;\n");
eq('a multi-line import goes', stripEsm("import {\n  a,\n  b,\n} from './ab.js';\nconst z = a;\n"), 'const z = a;\n');
eq('an import after the code is code (a string or a template line), not stripped', stripEsm("const s = `\nimport x from 'y';\n`;\n"), "const s = `\nimport x from 'y';\n`;\n");
eq('the export lines go', stripEsm('const a = 1, b = 2;\nexport { a, b };\n'), 'const a = 1, b = 2;\n');
eq('a multi-line export goes', stripEsm('const a = 1;\nexport {\n  a,\n};\n'), 'const a = 1;\n');
eq('an indented export (inside a template) stays', stripEsm('const t = `\n  export { a };\n`;\n'), 'const t = `\n  export { a };\n`;\n');
eq('CRLF lines too', stripEsm("import a from './a.js';\r\nconst z = a;\r\nexport { z };\r\n"), 'const z = a;\r\n');
// the joined files and the signatures
const app = source('app.js');
check('no option: the text as it was', source('app.js', {}) === app && source('app.js', undefined) === app);
check('strip on a file with neither is the same text', source('app.js', { esm: 'strip' }) === app && source('cx.js', { esm: 'strip' }) === source('cx.js'));
check('a dir as the second argument still works', source('cx.js', require('path').join(__dirname, '../src')) === source('cx.js'));
check('dir and options together', source('cx.js', require('path').join(__dirname, '../src'), { esm: 'strip' }) === source('cx.js'));
console.log(bad ? `${bad} of ${n} checks FAILED` : `all ${n} checks pass`);
process.exit(bad ? 1 : 0);
