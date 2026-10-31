'use strict';
// [#444] test/cdp_kit/vendor.js (CMW_VENDOR=1) answers every CDN file the test page can ask for: each https URL of
// cdnjs, jsDelivr and Google Fonts that src/ and build.py name is answered from vendor/ (a script with its bytes, a
// font sheet with @font-face rules over the vendored faces), and any other URL is not (it goes to the network).
// Run: node test/t_vendor_serve.js
const fs = require('fs');
const path = require('path');
const V = require('./cdp_kit/vendor.js');

let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } else if (process.env.V) console.log('ok  ', name); }

const ROOT = path.join(__dirname, '..');
const texts = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|html|css)$/.test(e.name)) texts.push(fs.readFileSync(p, 'utf8')); } };
walk(path.join(ROOT, 'src')); texts.push(fs.readFileSync(path.join(ROOT, 'build.py'), 'utf8'));
const urls = new Set();
for (const t of texts) for (const m of t.matchAll(/https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com)\/[^\s'"`<>)]+/g)) urls.add(m[0].replace(/[;,.]+$/, ''));
check('the sources name CDN files (the scan finds them)', urls.size >= 4, [...urls]);
for (const u of urls) {
  const a = V.answer(u);
  check(`${u.slice(0, 90)}: answered from vendor/`, !!a && a.body.length > 1000, a && a.body.length);
  if (a && /fonts\.googleapis/.test(u)) check(`${u.slice(0, 60)}: a font sheet (@font-face over woff2)`, a.type === 'text/css' && /@font-face\{font-family:"/.test(a.body.toString()) && /data:font\/woff2;base64,/.test(a.body.toString()));
}
check('the font sheet has the interface face (Roboto Flex), the mono and the math faces, and neither Archivo nor B612 Mono', (() => { const t = V.answer('https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz&display=swap').body.toString(); return /font-family:"Roboto Flex"/.test(t) && /font-family:"JetBrains Mono"/.test(t) && /font-family:"STIX Two Text"/.test(t) && !/Archivo|B612/.test(t); })());
// (#288) the STIX2 font MathJax 4 asks for by its own path: svg.js and a range it loads on demand; a file the font has not
for (const f of ['svg.js', 'svg/dynamic/cyrillic.js']) { const a = V.answer('https://cdn.jsdelivr.net/npm/@mathjax/mathjax-stix2-font@4.1.3/' + f); check(`MathJax's STIX2 font: ${f} answered from vendor/`, !!a && a.body.length > 1000 && a.type === 'text/javascript', a && a.body.length); }
check('MathJax\'s STIX2 font: a file it does not have is not answered', V.answer('https://cdn.jsdelivr.net/npm/@mathjax/mathjax-stix2-font@4.1.3/svg/dynamic/nonesuch.js') === null);
check('a URL it does not know: not answered', V.answer('https://cdnjs.cloudflare.com/ajax/libs/other/1.0/x.js') === null && V.answer('https://example.com/') === null);
check('every pattern is https and ends in /*', V.PATTERNS.every((p) => /^https:\/\/[^/]+\/\*$/.test(p)));
// a vendored file that is not the one LOCK.json records is never served: it throws, naming the file and both hashes
{
  const os = require('os'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmw-vendor-'));
  fs.mkdirSync(path.join(tmp, 'js')); fs.copyFileSync(path.join(ROOT, 'vendor', 'LOCK.json'), path.join(tmp, 'LOCK.json'));
  const rel = V.FILES['https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js'];
  fs.writeFileSync(path.join(tmp, rel), Buffer.concat([fs.readFileSync(path.join(ROOT, 'vendor', rel)), Buffer.from('\n// tampered\n')]));
  let err = null; try { V.answer('https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js', tmp); } catch (e) { err = e.message; }
  check('a tampered vendored file throws, naming it and both hashes', !!err && err.includes(rel) && /sha256 [0-9a-f]{64}, LOCK\.json [0-9a-f]{64}/.test(err), err);
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
