// [#444] The CDN files the test page asks for, answered from vendor/ (CMW_VENDOR=1, opt-in; cdpd.js intercepts the
// requests with CDP's Fetch domain): MathJax and the PDF library, and the Google Fonts CSS as @font-face rules over the
// vendored woff2 (the main set; the Russian set for the Roboto Flex sheet), as build.py writes them into the offline page.
// A URL not listed here is not answered (null): it goes to the network as without the flag. CI never sets the flag, so
// it keeps testing the live page's CDN path.
'use strict';
const fs = require('fs');
const path = require('path');

const VENDOR = path.join(__dirname, '..', '..', 'vendor');
const FILES = {
  'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.min.js': 'js/tex-svg.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js': 'js/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js': 'js/svg2pdf.umd.min.js',
};
// the patterns cdpd.js asks Chrome to pause (every request to these hosts; an unlisted URL is let through)
const PATTERNS = ['https://cdnjs.cloudflare.com/*', 'https://cdn.jsdelivr.net/*', 'https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*'];

let lock = null;
const faces = (set) => {
  lock = lock || JSON.parse(fs.readFileSync(path.join(VENDOR, 'LOCK.json'), 'utf8'));
  return lock.faces.filter((f) => f.set === set).map((f) => `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};${f.stretch ? `font-stretch:${f.stretch};` : ''}font-display:swap;`
    + `src:url(data:font/woff2;base64,${fs.readFileSync(path.join(VENDOR, f.file)).toString('base64')}) format("woff2");unicode-range:${f.unicodeRange}}\n`).join('');
};

// url -> { body: Buffer, type } from vendor/, or null (not one of the page's CDN files)
function answer(url) {
  const u = String(url).split('#')[0];
  if (FILES[u]) return { body: fs.readFileSync(path.join(VENDOR, FILES[u])), type: 'text/javascript' };
  if (u.startsWith('https://fonts.googleapis.com/css2?')) return { body: Buffer.from(faces(/family=Roboto\+Flex/.test(u) ? 'ru' : 'main')), type: 'text/css' };
  return null;
}

module.exports = { answer, PATTERNS, FILES };
