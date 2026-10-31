// Issue #21: the offline page's typesetter and faces are vendored (tools/vendor.py writes vendor/, build.py reads it
// only; the live page keeps its CDNs). This test fails when vendor/ does not match its LOCK.json, when a source uses a
// character the faces were not subset for (run python3 tools/vendor.py again), or when build.py reaches the network.
// test/t_publish.js checks the built offline page itself (no CDN left in it) and test/offline_cmd.js opens it with the
// network off. Node, no browser.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got).slice(0, 600) : '')); } };
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor', 'LOCK.json'), 'utf8'));

// the files are the ones tools/vendor.py wrote
for (const [f, o] of Object.entries(lock.outputs)) {
  const p = path.join(ROOT, 'vendor', f);
  const b = fs.existsSync(p) ? fs.readFileSync(p) : null;
  ok(`vendor/${f} as LOCK.json records it`, b && b.length === o.bytes && crypto.createHash('sha256').update(b).digest('hex') === o.sha256);
}
ok('every face\'s file is in the lock', lock.faces.every((f) => lock.outputs[f.file]), lock.faces.filter((f) => !lock.outputs[f.file]).map((f) => f.file));

// the subset covers the sources' characters (tools/vendor.py's chars(): every non-ASCII character of src/'s .js, .html
// and .css files, the generated tables included: the interface, the figures' TeX fallbacks, the captions)
const have = new Set([...lock.chars]);
const missing = new Map();
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html|css)$/.test(e.name)) for (const c of fs.readFileSync(p, 'utf8')) if (c.codePointAt(0) >= 0x80 && !have.has(c)) missing.set(c, path.relative(ROOT, p));
  }
};
walk(path.join(ROOT, 'src'));
ok('the faces cover every character the sources use (else: python3 tools/vendor.py)', missing.size === 0,
  [...missing].map(([c, f]) => `U+${c.codePointAt(0).toString(16).toUpperCase()} ${c} (${f})`));

// the build reads vendor/ only (the URLs in build.py are the live page's tags it replaces, never fetched; a CDN URL's
// /npm/ path, jsDelivr's, is not the npm command)
const build = fs.readFileSync(path.join(ROOT, 'build.py'), 'utf8');
ok('build.py reads vendor/ and never the network', /vendor \/ 'LOCK\.json'/.test(build) && !/\burllib\b|\brequests\b|http\.client|(?<!\/)\bnpm\b|\bcurl\b|\bwget\b/.test(build));
console.log(`t_vendor: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
