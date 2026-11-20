'use strict';
// The published script without its comments and indentation (#2012): every gap between two tokens (whitespace and
// comments only) becomes one line break when it holds one, else one space; two tokens with no gap stay touching. The tokens are the parser's own (acorn, so a
// regex, a string and a template literal are tokens like any other, their text kept byte for byte, GLSL included), and
// a line break stays wherever there was one, so automatic semicolon insertion and every line of the program are as they
// were. strip() checks its own output: the same tokens, each with a line break before it exactly where the input had
// one; anything else throws, and the build stops.
//   node tools/strip_js.js < in.js > out.js
const acorn = require('acorn');
const OPTS = { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowHashBang: true };
const BREAK = /[\n\r\u2028\u2029]/;
// the program's tokens: [start, end] of each, from a full parse (the tokenizer alone can misread / as a regex)
function tokens(text) {
  const out = [];
  acorn.parse(text, Object.assign({ onToken: (t) => { if (t.type !== acorn.tokTypes.eof) out.push([t.start, t.end]); } }, OPTS));
  return out;
}
// each token's text, with '\n' before it when a line break precedes it (the parse's view of the program)
function shape(text, toks) {
  return toks.map(([a, b], i) => (i && BREAK.test(text.slice(toks[i - 1][1], a)) ? '\n' : '') + text.slice(a, b));
}
function strip(text) {
  const toks = tokens(text);
  let out = '';
  for (let i = 0; i < toks.length; i++) {
    const gap = i ? text.slice(toks[i - 1][1], toks[i][0]) : '';
    if (gap) out += BREAK.test(gap) ? '\n' : ' ';
    out += text.slice(toks[i][0], toks[i][1]);
  }
  verify(text, out);
  return out + '\n';
}
// throws unless `after` is `before`'s program: the same tokens, a line break before each exactly where `before` has one
function verify(before, after) {
  const was = shape(before, tokens(before)), now = shape(after, tokens(after));
  let at = was.findIndex((t, i) => t !== now[i]);
  if (at < 0 && was.length !== now.length) at = Math.min(was.length, now.length);
  if (at >= 0) throw new Error(`strip_js: the stripped script's tokens differ at token ${at}: ${JSON.stringify(was[at])} became ${JSON.stringify(now[at])}`);
}
module.exports = { strip, verify };
if (require.main === module) {
  let s = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { s += d; });
  process.stdin.on('end', () => { process.stdout.write(strip(s)); });
}
