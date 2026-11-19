'use strict';
// JavaScript texts with every comment blanked, for the generators that ask what the code itself holds (tools/make_ru_table.py:
// a comment must not decide which strings ship). Reads a JSON array of texts on stdin and writes the JSON array of the same
// texts with each comment replaced by spaces (newlines kept), so every other character stays at its offset. The comments are
// the parser's own (espree, as ESLint reads these files): a quote or a slash inside a string, a template or a regular
// expression is not taken for one. A text that does not parse is an error.
//   echo '["a /* b */ = \"//c\"; // d"]' | node tools/js_blank_comments.js
const espree = require('espree');

function blank(text) {
  let comments = null, error = null;
  for (const sourceType of ['script', 'module']) {
    try { comments = espree.parse(text, { ecmaVersion: 'latest', sourceType, comment: true, range: true }).comments; break; } catch (e) { error = e; }
  }
  if (!comments) throw error;
  const a = text.split('');
  for (const c of comments) for (let i = c.range[0]; i < c.range[1]; i++) if (a[i] !== '\n') a[i] = ' ';
  return a.join('');
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  let out;
  try { out = JSON.parse(input).map(blank); } catch (e) { process.stderr.write(`js_blank_comments: ${e.message}\n`); process.exit(1); }
  process.stdout.write(JSON.stringify(out));
});
