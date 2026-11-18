'use strict';
// The programs the app starts ahead of their first draw (GLR.prestartNames, GLR.prestart, GLR.prestartCarry) are named
// by string, and a name the GL layer's DEFS does not have is skipped without a word, so a renamed program would quietly
// go back to linking in its first frame. Every quoted name passed to them in src/ must be a key of DEFS
// (src/gl/04-programs-resources.js). Run: node test/t_prestart_names.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const defsSrc = read('src/gl/04-programs-resources.js');
const d0 = defsSrc.indexOf('const DEFS = {');
if (d0 < 0) { console.log('FAIL DEFS not found'); process.exit(1); }
// (the keys at DEFS's own indent, four spaces: `name: {`)
const keys = new Set([...defsSrc.slice(d0).split('\n  };')[0].matchAll(/^ {4}(\w+): \{/gm)].map((m) => m[1]));
const files = ['src/gl/05-frames-2d-draws.js', ...fs.readdirSync(path.join(ROOT, 'src/app')).map((f) => 'src/app/' + f)];
let checks = 0, failed = 0;
for (const f of files) {
  const s = read(f);
  // (the array literals passed to prestartNames / prestart, and those in carryNames's body, the names prestartCarry starts)
  const lists = [...s.matchAll(/prestart(?:Names)?\(\s*(\[[^\]]*\])/g)].map((m) => m[1]);
  for (const pc of ['function carryNames()'].map((n) => s.indexOf(n)).filter((i) => i >= 0)) {
    let i = s.indexOf('{', pc), depth = 0;
    const b0 = i;
    for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}' && --depth === 0) break; }
    // (its name lists, the array literals in it)
    for (const m of s.slice(b0, i).matchAll(/\[[^\]]*\]/g)) lists.push(m[0]);
  }
  for (const L of lists) {
    for (const m of L.matchAll(/'(\w+)'/g)) {
      checks++;
      if (!keys.has(m[1])) { failed++; console.log(`FAIL ${f}: '${m[1]}' is not a program in DEFS`); }
    }
  }
}
if (keys.size < 20 || checks < 10) { failed++; console.log(`FAIL too few found: ${keys.size} DEFS keys, ${checks} names`); }
console.log(`${checks} checks, ${failed} failed (${keys.size} programs in DEFS)`);
process.exit(failed ? 1 : 0);
