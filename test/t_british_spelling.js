// node test/t_british_spelling.js : the English text of the tools menu and the examples guide uses British spelling
// ("colour", "centre"): every $t(...) string literal in those two files is free of "color" and "center".
'use strict';
const fs = require('fs'), path = require('path');
const FILES = ['src/app/10-tools-menus.js', 'src/app/15-examples-guide.js'];
let bad = 0;
for (const f of FILES) {
  const text = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  for (const m of text.matchAll(/\$t\(\s*'((?:[^'\\]|\\.)*)'/g)) {
    const w = /\b(colou?r\w*|cent(?:er|re)\w*)\b/gi;
    for (const x of m[1].matchAll(w)) if (/^(color|center)/i.test(x[0])) { bad++; console.log(`FAIL ${f}: "${m[1]}" has "${x[0]}"`); break; }
  }
}
if (bad) { console.log(`${bad} American spelling(s)`); process.exit(1); }
console.log('ok: British spelling in the tools menu and the examples guide');
