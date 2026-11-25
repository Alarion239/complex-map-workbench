'use strict';
// The published script without its comments and indentation (#2012): every gap between two tokens (whitespace and
// comments only) becomes one line break when it holds one, else one space; two tokens with no gap stay touching. The tokens are the parser's own (acorn, so a
// regex, a string and a template literal are tokens like any other, their text kept byte for byte), and a line break
// stays wherever there was one, so automatic semicolon insertion and every line of the program are as they were. The
// one change inside a token: the strings of a GLSL template (glsl`…`, src/glsl.js; glsl2`…` and so on as a bundler
// renames the tag) lose each line's `//` comment (#2037). strip() checks its own output: the same tokens, a GLSL
// template's strings without their comments, each with a line break before it exactly where the input had one;
// anything else throws, and the build stops.
//   node tools/strip_js.js < in.js > out.js
const acorn = require('acorn');
const OPTS = { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowHashBang: true };
const BREAK = /[\n\r\u2028\u2029]/;
// the program's tokens: [start, end] of each, from a full parse (the tokenizer alone can misread / as a regex), and the
// strings of its GLSL templates: start -> whether it is the template's last
function parse(text) {
  const toks = [], glsl = new Map();
  const ast = acorn.parse(text, Object.assign({ onToken: (t) => { if (t.type !== acorn.tokTypes.eof) toks.push([t.start, t.end]); } }, OPTS));
  const walk = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'TaggedTemplateExpression' && n.tag.type === 'Identifier' && /^glsl\d*$/.test(n.tag.name)) for (const q of n.quasi.quasis) glsl.set(q.start, q.tail);
    for (const k in n) {
      const v = n[k];
      if (Array.isArray(v)) { for (const x of v) walk(x); } else if (v && typeof v.type === 'string') walk(v);
    }
  };
  walk(ast);
  return { toks, glsl };
}
// a GLSL template's string (its raw text) without its comments: each line's `//` to the line's end goes, with the
// spaces before it, and the line break stays. Kept as written: the last line of a string the template continues after
// (the comment runs on into the value ${…} that follows), and a comment that ends in a backslash (in a template it
// joins the next line to it)
function stripGlsl(raw, last) {
  const lines = raw.split('\n');
  return lines.map((l, i) => {
    const k = l.indexOf('//');
    if (k < 0 || (i === lines.length - 1 && !last) || /\\$/.test(l)) return l;
    return l.slice(0, k).replace(/[ \t]+$/, '');
  }).join('\n');
}
// each token's text, a GLSL template's strings without their comments, with '\n' before it when a line break precedes
// it (the parse's view of the program)
function shape(text) {
  const { toks, glsl } = parse(text);
  return toks.map(([a, b], i) => (i && BREAK.test(text.slice(toks[i - 1][1], a)) ? '\n' : '') + (glsl.has(a) ? stripGlsl(text.slice(a, b), glsl.get(a)) : text.slice(a, b)));
}
function strip(text) {
  const { toks, glsl } = parse(text);
  let out = '';
  for (let i = 0; i < toks.length; i++) {
    const [a, b] = toks[i], gap = i ? text.slice(toks[i - 1][1], a) : '';
    if (gap) out += BREAK.test(gap) ? '\n' : ' ';
    out += glsl.has(a) ? stripGlsl(text.slice(a, b), glsl.get(a)) : text.slice(a, b);
  }
  verify(text, out);
  return out + '\n';
}
// throws unless `after` is `before`'s program: the same tokens, a GLSL template's strings without their comments, a
// line break before each exactly where `before` has one
function verify(before, after) {
  const was = shape(before), now = shape(after);
  let at = was.findIndex((t, i) => t !== now[i]);
  if (at < 0 && was.length !== now.length) at = Math.min(was.length, now.length);
  if (at >= 0) throw new Error(`strip_js: the stripped script's tokens differ at token ${at}: ${JSON.stringify(was[at])} became ${JSON.stringify(now[at])}`);
}
module.exports = { strip, verify, stripGlsl };
if (require.main === module) {
  let s = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { s += d; });
  process.stdin.on('end', () => { process.stdout.write(strip(s)); });
}
