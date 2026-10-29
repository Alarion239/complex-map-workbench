// test/src_text.js: source(file, { esm: 'strip' }) drops a module file's import block and export { } lines, and nothing else.
const { source, stripEsm } = require('./src_text');
let bad = 0, n = 0;
const check = (name, ok, detail) => { n++; if (!ok) { bad++; console.log('FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); } };
const eq = (name, got, want) => check(name, got === want, { got, want });

eq('a script is untouched', stripEsm("'use strict';\nconst a = 1;\n"), "'use strict';\nconst a = 1;\n");
eq('the leading imports go, in every form', stripEsm("'use strict';\n// the deps\nimport { a, b } from './a.js';\nimport c from \"./c.js\";\nimport * as d from './d.js'\nimport './side.js';\n\n/* x */\nconst z = a;\n"), "'use strict';\n// the deps\n\n/* x */\nconst z = a;\n");
eq('a multi-line import goes', stripEsm("import {\n  a,\n  b,\n} from './ab.js';\nconst z = a;\n"), 'const z = a;\n');
eq('an import anywhere in the file goes (the codemod puts the block at the end)', stripEsm("const z = a;\nimport { a } from './a.js';\nimport * as d from './d.js';\nexport { z };\n"), 'const z = a;\n');
eq('so do the line counts above it stay', stripEsm("'use strict';\nconst a = 1;\nconst b = 2;\nimport { c } from './c.js';\nexport { a, b };\n").split('\n').slice(0, 3).join('\n'), "'use strict';\nconst a = 1;\nconst b = 2;");
eq('a dynamic import() and an indented import stay', stripEsm("const m = import('./x.js');\n  import y from 'y';\n"), "const m = import('./x.js');\n  import y from 'y';\n");
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
{ let read = 0; source('cx.js', undefined, { get esm() { read++; return 'strip'; } }); check('options after an undefined dir are read (source(f, undefined, { esm }))', read === 1 && source('cx.js', undefined, { esm: 'strip' }) === source('cx.js')); }
console.log(bad ? `${bad} of ${n} checks FAILED` : `all ${n} checks pass`);
process.exit(bad ? 1 : 0);
