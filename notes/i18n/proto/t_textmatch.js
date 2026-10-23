// node notes/i18n/proto/t_textmatch.js [src dir] : code must not read its own English UI text (review i18n-10).
// Flags comparisons and regexes on labels and text content. KNOWN lists the sites still to fix in phase 2 (they
// are in files this prototype does not own, or need the call site rewritten); any other hit fails.
'use strict';
const fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.resolve(__dirname, '../../../work/xl/src');
const RULES = [
  [/\.textContent\s*===?\s*[a-z_$][\w$.]*\.label\b/, 'textContent compared with a label'],
  [/\/[^/\n]*\b[A-Z][a-z]+[^/\n]*\/\.test\((\w+\.)?label\)/, 'regex test on a label'],
  [/\.label\s*===?\s*'[A-Z][a-z]|score\(\w+\.label\)/, 'label compared with English text'],
  [/\[A-Za-z\]\{\d,?\d*\}[^\n]*\.test\([\w.]*label\)|\.test\([\w.]*label\)[^\n]*\[A-Za-z\]/, "word test on a label (use \\p{L}, not [A-Za-z])"],
  [/\.replace\(\/ [a-z]+ [a-z]+\$\//, 'regex rewrite of an English phrase'],
  [/\.replace\(\/[^/]*Dashed boundaries/, 'English sentence removed by regex'],
];
// file:fragment -> why it stays for now
const KNOWN = {
  'app.js:onto image': 'latexDocument: name(k).replace(/ onto image$/, ...): its own template in phase 2',
  'app.js:word:!!': 'point labels: /[A-Za-z]{2}|\\s/ decides word vs math: use /\\p{L}{2}|\\s/u (phase 2, with xr 2285)',
  'app.js:const lab = s.label': 'figure shape labels: the same word test (xr 9010): /\\p{L}{2}|\\s/u in phase 2',
  'app.js:score(d.label)': 'palette search scores the English label: search the shown label and the English one (xr 8330)',
  'app.js:score(dd.label)': 'the same palette search',
};
let hits = [], unknown = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'i18n.js')) {
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
  lines.forEach((ln, i) => {
    for (const [re, why] of RULES) if (re.test(ln)) {
      const k = Object.keys(KNOWN).find((kk) => kk.startsWith(f + ':') && ln.includes(kk.split(':')[1]));
      const h = `${f}:${i + 1} ${why}`;
      hits.push(h + (k ? ' (known)' : ''));
      if (!k) unknown.push(h + ': ' + ln.trim().slice(0, 120));
    }
  });
}
console.log(hits.join('\n') || 'no hits');
console.log(unknown.length ? `FAIL ${unknown.length} new text matchers:\n` + unknown.join('\n') : `text matchers: ${hits.length} known, 0 new`);
process.exit(unknown.length ? 1 : 0);
