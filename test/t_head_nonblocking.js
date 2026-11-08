'use strict';
// The page's start-up must not wait on the network: a stylesheet from another origin that blocks rendering holds
// every inline script after it until the request settles, so the app's test hooks stay undefined with the document in
// readyState 'loading' when the font request stalls (#1258). Every external stylesheet in the head of src/page.html
// is therefore loaded with media="print" and switched to "all" on load.
// Run: node test/t_head_nonblocking.js
const fs = require('fs');
const path = require('path');

let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } else if (process.env.V) console.log('ok  ', name); }

const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'page.html'), 'utf8');
const head = page.slice(0, page.indexOf('<script'));
const sheets = [...head.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)].map((m) => m[0]).filter((t) => /\bhref="https?:/.test(t));
check('the head names an external stylesheet (the scan finds it)', sheets.length >= 1, sheets);
for (const t of sheets) {
  check(`${t.slice(0, 70)}: starts as print media`, /\bmedia="print"/.test(t), t.slice(0, 200));
  check(`${t.slice(0, 70)}: switches to all media on load`, /\bonload="this\.media='all'"/.test(t), t.slice(0, 200));
}
console.log(bad ? `${bad} of ${n} checks failed` : `all ${n} checks passed`);
process.exit(bad ? 1 : 0);
