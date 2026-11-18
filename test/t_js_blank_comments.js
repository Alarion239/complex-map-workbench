'use strict';
// tools/js_blank_comments.js: a JavaScript text with each comment replaced by spaces (newlines kept), so the generators that ask what
// the code holds (tools/make_ru_table.py) never take a comment for code, nor a string, a template or a regular expression
// with comment-like text in it for a comment. Run: node test/t_js_blank_comments.js
const { spawnSync } = require('child_process');
const path = require('path');
let n = 0, fails = 0;
const ok = (name, c, info) => { n++; if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : String(info).slice(0, 400)); } };
const blank = (texts) => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'js_blank_comments.js')], { input: JSON.stringify(texts), encoding: 'utf8' });
  return r.status === 0 ? { out: JSON.parse(r.stdout) } : { err: r.stderr };
};
const SPACES = (t) => t.replace(/[^\n]/g, ' ');
{
  const src = ["const a = $t('Try it'); // Try it: a line comment\nconst b = 1; /* Clear shapes\n  over two lines */ const c = 2;"];
  const { out } = blank(src);
  ok('a line comment and a block comment are blanked, the code kept', out && out[0] === "const a = $t('Try it');" + SPACES(' // Try it: a line comment') + '\nconst b = 1;' + SPACES(' /* Clear shapes') + '\n' + SPACES('  over two lines */') + ' const c = 2;', out);
  ok('the text keeps its length and its lines', out && out[0].length === src[0].length && out[0].split('\n').length === src[0].split('\n').length, out);
}
{
  const src = ["const s = 'a // b', t = \"c /* d */\", u = `e // ${1 /* f */} g`, r = /h\\/\\/i/; // j"];
  const { out } = blank(src);
  ok('comment-like text in a string, a template or a regular expression is kept', out && out[0].startsWith("const s = 'a // b', t = \"c /* d */\", u = `e // ${1" + SPACES(' /* f */') + "} g`, r = /h\\/\\/i/;"), out);
  ok('a comment inside a template substitution and the one after the code are blanked', out && !/ f /.test(out[0]) && !/ j/.test(out[0]), out);
}
{
  const { out } = blank(['a', '// only a comment', 'b /* c */']);
  ok('several texts come back one for one, in order', out && out.length === 3 && out[0] === 'a' && out[1].trim() === '' && out[2] === 'b' + SPACES(' /* c */'), out);
}
{
  const { err } = blank(['const = ;']);
  ok('a text that does not parse is an error', !!err && /js_blank_comments/.test(err), err);
}
console.log(`t_js_blank_comments: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
