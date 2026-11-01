// texEsc (src/export.js): the caption's text as LaTeX, one pass over the special characters. A backslash gives
// \textbackslash{}, whose braces must not be escaped again (the old code escaped the backslash first, then the braces:
// a backslash exported as \textbackslash\{\}). Run: node test/t_tex_esc.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'export.js'), 'utf8');
const m = /^[ \t]*const texEsc = (.*);$/m.exec(src);
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) pass++; else { fail++; console.log('FAIL ' + name + (detail ? ': ' + detail : '')); } };
check('texEsc is found in src/export.js', !!m);
if (m) {
  const texEsc = new Function('return ' + m[1])();
  const cases = [
    ['a\\b{c}_~^', 'a\\textbackslash{}b\\{c\\}\\_\\textasciitilde{}\\textasciicircum{}'],
    ['\\', '\\textbackslash{}'],
    ['50% of $x$ & #1', '50\\% of \\$x\\$ \\& \\#1'],
    ['{}', '\\{\\}'],
    ['plain text', 'plain text'],
    ['', ''],
    [12, '12'],
  ];
  for (const [i, want] of cases) { const got = texEsc(i); check(`texEsc(${JSON.stringify(i)})`, got === want, `${got} != ${want}`); }
}
console.log(`t_tex_esc: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
