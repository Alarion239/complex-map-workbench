'use strict';
// tools/strip_js.js (#2012), which drops the published script's comments and indentation: what it keeps byte for byte
// (strings, regexes, template literals with their GLSL), what it drops, the line breaks that automatic semicolon
// insertion reads, and its own check of the output.
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
console.log(fails ? `${fails} of ${n} checks FAILED` : `strip_js: ${n} checks passed`);
process.exit(fails ? 1 : 0);
