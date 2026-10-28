'use strict';
// Reviewer scratch: runs src/gl.js against a mock WebGL2 context and replays the app's drawRegion cache keys
// (app.js drawScene / sphere) to count transform-feedback passes and the GPU bytes held by the map cache.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../src/gl.js'), 'utf8');

let nextId = 1;
const bytesOf = new Map(); // object id -> bytes (buffers and textures)
const stats = { tf: 0, tfLog: [] };
let boundArr = null, boundTex = null, inTF = false;
const gl = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (typeof k === 'string' && /^[A-Z0-9_]+$/.test(k)) return k; // enum constants
    return () => ({ id: nextId++ });
  },
});
Object.assign(gl, {
  getParameter: () => 16384,
  getShaderParameter: () => true,
  getProgramParameter: (p, w) => (w === 'ACTIVE_UNIFORMS' ? 0 : true),
  createBuffer: () => ({ id: nextId++, kind: 'buf' }),
  createTexture: () => ({ id: nextId++, kind: 'tex' }),
  bindBuffer: (target, b) => { if (target === 'ARRAY_BUFFER') boundArr = b; },
  bufferData: (target, d) => { if (target === 'ARRAY_BUFFER' && boundArr) bytesOf.set(boundArr, typeof d === 'number' ? d : d.byteLength); },
  bindTexture: (target, x) => { boundTex = x; },
  texImage2D: (t, lvl, ifmt, w, h) => { if (boundTex && ifmt === 'RG32F') bytesOf.set(boundTex, w * h * 8); },
  deleteBuffer: (b) => bytesOf.delete(b),
  deleteTexture: (x) => bytesOf.delete(x),
  beginTransformFeedback: () => { inTF = true; },
  endTransformFeedback: () => { inTF = false; },
  drawArraysInstanced: (m, f, c, n) => { if (inTF) { stats.tf++; stats.tfLog.push(c * n); } },
});
const canvas = { getContext: () => gl, addEventListener() {}, width: 640, height: 480 };
const ctx = { console, Math, Float32Array, Float64Array, Uint8Array, Uint16Array, Uint32Array, Int32Array, Map, Set, Array, Object, String, Number, JSON, Error, Symbol, Promise };
vm.createContext(ctx);
vm.runInContext(src + '\n;this.GLR = GLR;', ctx);
const GLR = ctx.GLR;
if (!GLR.init(canvas)) throw new Error('init failed');
GLR.setChain({ key: 'exp|mob', slots: 2, fill(d) { d[0] = 1; }, source: '' });

const held = () => { let s = 0; for (const [o, b] of bytesOf) if (b > 1e6) s += b; return +(s / 1e6).toFixed(1); };
const n = 76800; // strip mesh at the Max preset (base 320 -> 320 x 120 x 2)
const mesh = GLR.createMesh(new Float32Array(n * 6));
const base = held();
const map = { mode: 0, a: 0, b: 2 };
const mk = 'meshKey|0|0|2|0|0|sig2';
const st = (cacheKey, skip) => ({ map, view: { cx: 0, cy: 0, s: 50 }, dpr: 1, L: 4, color: [0, 0, 0], color2: [0, 0, 0], edge: [0, 0, 0], ink: [0, 0, 0], alpha: 1, skip, cacheKey });

// frame 1: fix-up not done yet (fx = null)  -> app key ends with '|'
GLR.drawRegion(mesh, st(`${mk}|`, null));
console.log('after first frame       tf passes', stats.tf, ' cache MB (beyond mesh)', +(held() - base).toFixed(1));
// frame 2: same map, unchanged -> cache hit
GLR.drawRegion(mesh, st(`${mk}|`, null));
console.log('after identical frame   tf passes', stats.tf);
// fix-up for the right pane completes: fx = {mapKey: 'S'+sig, skip: createSkip(...)}
const skR = GLR.createSkip(mesh, new Float32Array(n));
GLR.drawRegion(mesh, st(`${mk}|Ssig2${skR.id}`, skR));
console.log('after R fix-up lands    tf passes', stats.tf, ' cache MB (beyond mesh)', +(held() - base).toFixed(1), ' entries', mesh.tf.size);
// a second view (left pane) at the same stage with its own fix-up skip
const skL = GLR.createSkip(mesh, new Float32Array(n));
GLR.drawRegion(mesh, st(`${mk}|Ssig2${skL.id}`, skL));
console.log('after L fix-up (same map) tf passes', stats.tf, ' cache MB (beyond mesh)', +(held() - base).toFixed(1), ' entries', mesh.tf.size);
// how much of each entry is the never-read TF buffer
const e = [...mesh.tf.values()][0];
console.log('entry W x H', e.W, 'x', e.H, ' buf MB', (bytesOf.get(e.buf) / 1e6).toFixed(1), ' tex MB', (bytesOf.get(e.tex) / 1e6).toFixed(1));
console.log('TF pass sizes (points):', stats.tfLog.join(', '));
