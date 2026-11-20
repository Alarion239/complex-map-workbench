'use strict';
// tools/strip_js.js (#2012), which drops the published script's comments and indentation: what it keeps byte for byte
// (strings, regexes, template literals), what it drops (a GLSL template's comments too, #2037, its lines kept), the
// line breaks that automatic semicolon insertion reads, and its own check of the output.
//   node test/t_strip_js.js
const vm = require('vm');
const { strip, verify } = require('../tools/strip_js');
let fails = 0, n = 0;
const ok = (name, pass, detail) => { n++; if (!pass) { fails++; console.log('FAIL ' + name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 400)); } };
const eq = (name, src, want) => { const got = strip(src); ok(name, got === want, { got, want }); };
eq('a line comment goes, its line break stays', 'a = 1; // one\nb = 2;', 'a = 1;\nb = 2;\n');
eq('a whole-line comment and the indentation go', 'if (x) {\n    // why\n    y();\n}\n', 'if (x) {\ny();\n}\n');
eq('a block comment on one line becomes one space', 'f(/** @type {any} */ (x)); g(/* @__PURE__ */ h());', 'f( (x)); g( h());\n');
eq('a block comment over two lines becomes a line break', 'a = 1 /* x\n y */ b = 2', 'a = 1\nb = 2\n');
eq('tokens with no gap stay touching', 'a+b;c=d', 'a+b;c=d\n');
eq('a string keeps // and /* */', 's = "http://x /* y */"; t = \'//\';', 's = "http://x /* y */"; t = \'//\';\n');
eq('a regex keeps //, and a division stays a division', 'r = /\\/\\/[^\\n]*/g; q = a / b / c;', 'r = /\\/\\/[^\\n]*/g; q = a / b / c;\n');
const glsl = 'const fs = `\n  // the step: a forward difference\n  vec2 s = f(u);   /* kept */\n  ${body}\n`;';
eq('a template literal (GLSL) keeps its text byte for byte', glsl, glsl + '\n');
eq('blank lines collapse to one line break', 'a();\n\n\n\nb();', 'a();\nb();\n');
// (#2037) a GLSL template (glsl`…`) loses each line's // comment, its lines kept; nothing else of it changes
eq('a GLSL template: a whole-line comment leaves an empty line, a trailing one goes with the spaces before it',
  'const fs = glsl`\n  // the step\n  vec2 s = f(u);   // a forward difference\n  s *= 2.0;\n`;',
  'const fs = glsl`\n\n  vec2 s = f(u);\n  s *= 2.0;\n`;\n');
eq('a GLSL template: a comment that runs on into a value ${…} is kept, the lines after it are stripped',
  'x = glsl`a; // see ${n} steps\nb; // c\n`;', 'x = glsl`a; // see ${n} steps\nb;\n`;\n');
eq('a GLSL template: the comment on its last line goes', 'x = glsl`a; // end`;', 'x = glsl`a;`;\n');
eq('a GLSL template: a comment that ends in a backslash (which joins the next line) is kept', 'x = glsl`a; // b \\\nc;`;', 'x = glsl`a; // b \\\nc;`;\n');
eq('a GLSL template under a bundler\'s name (glsl2`…`) is stripped too', 'x = glsl2`a; // b\n`;', 'x = glsl2`a;\n`;\n');
eq('a template under another tag keeps its //', 'x = css`a { b: url(//x) }`; y = `// z`;', 'x = css`a { b: url(//x) }`; y = `// z`;\n');
{
  const src = 'const fs = glsl`\n  // one\n  a; // two\n  ${b} // three\n  c;\n`;', out = strip(src);
  ok('a GLSL template keeps its line count (a compile error\'s line number is the same)', out.split('\n').length === src.split('\n').length + 1, out);
  const run2 = (t) => vm.runInNewContext('const glsl = (s, ...v) => s.reduce((a, x, i) => a + x + (i < v.length ? v[i] : ""), ""); const b = "B"; ' + t + ' fs');
  ok('… and is the same shader less its comments when it runs', run2(out) === '\n\n  a;\n  B\n  c;\n', run2(out));
}
// (automatic semicolon insertion: the same program before and after)
const run = (src) => vm.runInNewContext(src + '\n;[typeof f === "function" ? f() : null, typeof a === "undefined" ? null : a, typeof b === "undefined" ? null : b]');
for (const [name, src] of [
  ['return before a line break returns undefined', 'function f() { return // nothing\n    1; }'],
  ['a line break before ++ ends the statement', 'var a = 1, b = 1;\na\n++b'],
  ['a comment that holds the only line break keeps it', 'var a = 1 /*\n*/ var b = 2'],
]) {
  const before = run(src), after = run(strip(src));
  ok(name, JSON.stringify(before) === JSON.stringify(after), { before, after, stripped: strip(src) });
}
// (its own check)
let threw = null;
try { verify('function f() { return\n1; }', 'function f() { return 1; }'); } catch (e) { threw = e.message; }
ok('the check throws on a line break lost', !!threw && /token/.test(threw), threw);
threw = null;
try { verify('a = "x";', 'a = "y";'); } catch (e) { threw = e.message; }
ok('the check throws on a changed token', !!threw, threw);
threw = null;
try { verify('a = 1; // c\n  b', 'a = 1;\nb'); } catch (e) { threw = e.message; }
ok('the check passes the same program', threw === null, threw);
threw = null;
try { verify('x = glsl`a; // c\nb;\n`;', 'x = glsl`a;\nb;\n`;'); } catch (e) { threw = e.message; }
ok('the check passes a GLSL template less its comments', threw === null, threw);
threw = null;
try { verify('x = glsl`a; // c\nb;\n`;', 'x = glsl`a;b;\n`;'); } catch (e) { threw = e.message; }
ok('the check throws on a GLSL template that lost a line', !!threw, threw);
threw = null;
try { verify('x = `a; // c\n`;', 'x = `a;\n`;'); } catch (e) { threw = e.message; }
ok('the check throws on a comment dropped from a template that is not GLSL', !!threw, threw);
console.log(fails ? `${fails} of ${n} checks FAILED` : `strip_js: ${n} checks passed`);
process.exit(fails ? 1 : 0);
