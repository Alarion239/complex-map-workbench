// node proto/build.js: inlines v2/timbres.js, proto/worklet.js, proto/core.js and proto/ui.js into proto/page.html and
// writes hearf/options.html (one self-contained file). Re-run after any change to those sources (timbres.js included).
const fs = require('fs'), path = require('path'), P = __dirname, H = path.resolve(P, '..');
const rd = (f) => fs.readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(P, 'page.html'), 'utf8');
const parts = { TIMBRES: path.join(H, '..', 'v2', 'timbres.js'), WORKLET: path.join(P, 'worklet.js'), CORE: path.join(P, 'core.js'), UI: path.join(P, 'ui.js') };
for (const [k, f] of Object.entries(parts)) html = html.replace('/*@' + k + '@*/', () => rd(f));
fs.writeFileSync(path.join(H, 'options.html'), html);
console.log('options.html', (html.length / 1024).toFixed(1), 'KB');
