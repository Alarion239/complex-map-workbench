// Reviewer scratch: shows GLR.ok drops to false on webglcontextlost (no separate 'lost' state), and comes back on restore.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/gl.js'), 'utf8');
const listeners = {};
const fakeGL = new Proxy({ getParameter: () => 4096, MAX_TEXTURE_SIZE: 0x0D33 }, { get: (t, k) => (k in t ? t[k] : () => null) });
const canvas = { width: 10, height: 10, getContext: () => fakeGL, addEventListener: (n, f) => { listeners[n] = f; } };
const ctx = { console, Float32Array, Uint8Array, Uint16Array, Uint32Array, Int32Array, Map, Set, Math, Object, Array, JSON, document: { createElement: () => canvas } };
vm.createContext(ctx);
vm.runInContext(src + '\nthis.GLR = GLR;', ctx);
const GLR = ctx.GLR;
let restored = 0; GLR.onRestore = () => restored++;
console.log('init ->', GLR.init(canvas), 'ok =', GLR.ok);
listeners.webglcontextlost({ preventDefault() {} });
console.log('after webglcontextlost: ok =', GLR.ok, '| any lost/unsupported flag on api?', Object.keys(GLR).filter(k => /lost|unsupp|support/i.test(k)));
listeners.webglcontextrestored();
console.log('after webglcontextrestored: ok =', GLR.ok, 'onRestore calls =', restored);
const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
console.log('noGL text:', (app.match(/fillText\('(This view needs WebGL2[^']*)'/) || [])[1]);
console.log('noGL call sites gated only on GLR.ok:', (app.match(/noGL\(pane\)/g) || []).length);
