const PORT = 9845;
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ld = async (page, ns, st) => {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/gl-helpers.html` }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page}?ns=${ns}` }); await sleep(2200);
};
const sq = { type: 'root', params: { n: 2, cut: 180 }, on: true }, sn = { type: 'sin', params: {}, on: true };
const GAPON = `(() => { window.__gap = { gaps: [], last: performance.now(), t0: performance.now(), on: true, n50: 0 }; const f = () => { const t = performance.now(); const d = t - __gap.last; if (d > 50) __gap.n50++; if (d > 100) __gap.gaps.push([Math.round(__gap.last - __gap.t0), Math.round(d)]); __gap.last = t; if (__gap.on) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`;
const RECT = `(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width * 0.3), y: Math.round(b.top + b.height * 0.3), width: Math.round(b.width * 0.4), height: Math.round(b.height * 0.4) }; })()`;
const firstSurface = (frames) => { const fin = frames[frames.length - 1].img; for (const fr of frames) { let same = 0, n = 0; for (let i = 0; i < fin.data.length; i += fin.ch * 7) { n++; if (Math.abs(fr.img.data[i] - fin.data[i]) <= 6 && Math.abs(fr.img.data[i + 1] - fin.data[i + 1]) <= 6 && Math.abs(fr.img.data[i + 2] - fin.data[i + 2]) <= 6) same++; } if (same / n >= 0.9) return fr.te; } return null; };
const GLM = `(() => { const P = WebGL2RenderingContext.prototype; if (P.__glm) return; P.__glm = 1;
 const L = { tex: new Map(), buf: new Map(), sync: 0, prog: 0, fbo: 0, vao: 0 }; window.__glm = L;
 const BPP = { 0x8814: 16, 0x881A: 8, 0x8058: 4, 0x1908: 4, 0x822E: 4, 0x8230: 8, 0x822D: 2, 0x822F: 4, 0x8C43: 4, 0x8D70: 16, 0x8D82: 16, 0x8D88: 8 };
 const w = (n, f) => { const o = P[n]; P[n] = function (...a) { return f.call(this, o, a); }; };
 w('createTexture', function (o, a) { const t = o.apply(this, a); if (t) L.tex.set(t, 0); return t; });
 w('deleteTexture', function (o, a) { L.tex.delete(a[0]); return o.apply(this, a); });
 const tb = (gl, tg) => gl.getParameter(tg === gl.TEXTURE_3D ? gl.TEXTURE_BINDING_3D : tg === gl.TEXTURE_2D_ARRAY ? gl.TEXTURE_BINDING_2D_ARRAY : gl.TEXTURE_BINDING_2D);
 w('texImage2D', function (o, a) { const r = o.apply(this, a); if (a[1] === 0 && a[0] === this.TEXTURE_2D) { const t = tb(this, a[0]); if (t) { let W, H; if (a.length >= 8) { W = a[3]; H = a[4]; } else { W = a[5].width || 0; H = a[5].height || 0; } L.tex.set(t, W * H * (BPP[a[2]] || 4)); } } return r; });
 w('texStorage2D', function (o, a) { const r = o.apply(this, a); const t = tb(this, a[0]); if (t) L.tex.set(t, a[3] * a[4] * (BPP[a[2]] || 4) * (a[1] > 1 ? 1.34 : 1)); return r; });
 w('texImage3D', function (o, a) { const r = o.apply(this, a); const t = tb(this, a[0]); if (t && a[1] === 0) L.tex.set(t, a[3] * a[4] * a[5] * (BPP[a[2]] || 4)); return r; });
 w('createBuffer', function (o, a) { const b = o.apply(this, a); if (b) L.buf.set(b, 0); return b; });
 w('deleteBuffer', function (o, a) { L.buf.delete(a[0]); return o.apply(this, a); });
 const BB = { 0x8892: 0x8894, 0x8893: 0x8895, 0x8F36: 0x8F36, 0x8F37: 0x8F37, 0x88EB: 0x88ED, 0x88EC: 0x88EF, 0x8A11: 0x8A28, 0x8C8E: 0x8C8F };
 w('bufferData', function (o, a) { const r = o.apply(this, a); const b = this.getParameter(BB[a[0]]); if (b) L.buf.set(b, typeof a[1] === 'number' ? a[1] : (a[1] && a[1].byteLength) || 0); return r; });
 w('fenceSync', function (o, a) { L.sync++; return o.apply(this, a); }); w('deleteSync', function (o, a) { if (a[0]) L.sync--; return o.apply(this, a); });
 w('createProgram', function (o, a) { L.prog++; return o.apply(this, a); }); w('deleteProgram', function (o, a) { if (a[0]) L.prog--; return o.apply(this, a); });
 w('createFramebuffer', function (o, a) { L.fbo++; return o.apply(this, a); }); w('deleteFramebuffer', function (o, a) { if (a[0]) L.fbo--; return o.apply(this, a); });
 w('createVertexArray', function (o, a) { L.vao++; return o.apply(this, a); }); w('deleteVertexArray', function (o, a) { if (a[0]) L.vao--; return o.apply(this, a); });
 window.__glmSum = () => { let tb = 0, bb = 0; for (const v of L.tex.values()) tb += v; for (const v of L.buf.values()) bb += v; return { tex: L.tex.size, texMB: +(tb / 1048576).toFixed(1), buf: L.buf.size, bufMB: +(bb / 1048576).toFixed(1), sync: L.sync, prog: L.prog, fbo: L.fbo, vao: L.vao }; };
})();`;
// GPU objects (counted by wrapping WebGL2's create/delete/upload calls) at rest, after mesh changes, after play,
// after five more fresh formulas; base and r3
const reg = await send('Page.addScriptToEvaluateOnNewDocument', { source: GLM });
const B = 'base.html', T = 'test.html';
const K = 1000 + Math.floor(Math.random() * 8000);
const out = {};
for (const page of [B, T]) {
  const o = out[page === B ? 'base' : 'r3'] = [];
  const S = async (what) => o.push(what + ' ' + JSON.stringify(await ev('__glmSum()')));
  await ld(page, 'rvm' + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' });
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(4000); await S('rest m240 ALL');
  await ev(`__cmwSet('meshN', 1920); 1`); await settle(5000); await S('rest Max ALL');
  await ev(`__cmwSet('meshN', 240); 1`); await settle(5000); await S('back m240 ALL');
  await ev(`__cmwSet('meshN', 1920); 1`); await settle(5000); await ev(`__cmwSet('meshN', 240); 1`); await settle(5000); await S('m240 after Max x2');
  await ev(`__cmwSet('sheets', false); 1`); await settle(4000); await S('sheets off');
  await ev(`__cmwSet('sheets', true); 1`); await settle(4000); await S('sheets on');
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(1000);
  await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(3000); await ev('__cmwMorph({ playing: false })'); await settle(4000); await S('after play+stop');
  await ev('__cmwMorph({ open: false })'); await settle(1500);
  for (let i = 0; i < 5; i++) { await ev(`__cmwSet('steps', [{ type: 'custom', params: { expr: '\\\\sqrt{z^2+${K + i}}', cut: 180 }, on: true, id: 'q${i}' }, { type: 'sin', params: {}, on: true, id: 'r${i}' }]); 1`); await settle(3500); }
  await S('after 5 formulas');
  for (let i = 0; i < 5; i++) { await ev(`__cmwSet('steps', [{ type: 'custom', params: { expr: '\\\\log(z^2+${K + 10 + i})', cut: 180 }, on: true, id: 'p${i}' }]); 1`); await settle(3500); }
  await S('after 10 formulas'); await shot('mem-end-' + (page === B ? 'base' : 'r3'));
  o.push('logs ' + JSON.stringify(logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 4)));
}
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: reg.identifier });
return out;
