// [#444] The CDN files the test page asks for, answered from vendor/ (CMW_VENDOR=1, opt-in; cdpd.js intercepts the
// requests with CDP's Fetch domain): MathJax and the PDF library, and the Google Fonts CSS as @font-face rules over the
// vendored woff2 (the one set, #288: every language has the same faces), as build.py writes them into the offline page.
// A URL not listed here is not answered (null): it goes to the network as without the flag. CI never sets the flag, so
// it keeps testing the live page's CDN path.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VENDOR = path.join(__dirname, '..', '..', 'vendor');
const FILES = {
  'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.min.js': 'js/tex-svg.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js': 'js/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js': 'js/svg2pdf.umd.min.js',
};
// the patterns cdpd.js asks Chrome to pause (every request to these hosts; an unlisted URL is let through)
const PATTERNS = ['https://cdnjs.cloudflare.com/*', 'https://cdn.jsdelivr.net/*', 'https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*'];

// (a file is served only as LOCK.json records it: a changed or unrecorded file throws, naming it and both hashes)
const locks = new Map();
const lockOf = (dir) => { if (!locks.has(dir)) locks.set(dir, JSON.parse(fs.readFileSync(path.join(dir, 'LOCK.json'), 'utf8'))); return locks.get(dir); };
function read(dir, rel) {
  const want = (lockOf(dir).outputs[rel] || {}).sha256, b = fs.readFileSync(path.join(dir, rel));
  const got = crypto.createHash('sha256').update(b).digest('hex');
  if (got !== want) throw new Error(`vendor/${rel} is not the file LOCK.json records (sha256 ${got}, LOCK.json ${want || 'none'}): run python3 tools/vendor.py`);
  return b;
}
const faces = (dir, set) => lockOf(dir).faces.filter((f) => f.set === set).map((f) => `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};${f.stretch ? `font-stretch:${f.stretch};` : ''}font-display:swap;`
  + `src:url(data:font/woff2;base64,${read(dir, f.file).toString('base64')}) format("woff2");unicode-range:${f.unicodeRange}}\n`).join('');

// url -> { body: Buffer, type } from vendor/ (dir: another copy of it, for the test), or null (not one of the page's
// CDN files)
function answer(url, dir = VENDOR) {
  const u = String(url).split('#')[0];
  if (FILES[u]) return { body: read(dir, FILES[u]), type: 'text/javascript' };
  if (u.startsWith('https://fonts.googleapis.com/css2?')) return { body: Buffer.from(faces(dir, 'main')), type: 'text/css' };
  return null;
}

module.exports = { answer, PATTERNS, FILES };
