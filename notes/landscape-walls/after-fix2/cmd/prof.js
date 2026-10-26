const RUNS = globalThis.__runs || [['test.html', 'z^3/(\\cosh z+31)'], ['base/test.html', 'z^3/(\\cosh z+29)']];
const out = [];
await view(1440, 900, false, false);
for (const [page, f] of RUNS) {
  const ns = 'wfp' + Date.now();
  await send('Page.navigate', { url: 'http://127.0.0.1:9807/gl-helpers.html' }); await sleep(300);
  const o = { v3: true, v4: true, shapes: [], steps: [{ type: 'custom', params: { expr: f, cut: 180 }, on: true }], nextId: 50, focus: 0, rightMode: 'image', pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 }, sheets: false, height: 'im' };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: 'http://127.0.0.1:9807/' + page + '?ns=' + ns }); await sleep(3500);
  await ev(`(() => { const P = WebGL2RenderingContext.prototype; window.__slow = []; const srcs = new Map(); const lab = new Map();
    const ss = P.shaderSource; P.shaderSource = function (s, t) { srcs.set(s, t); return ss.call(this, s, t); };
    const at = P.attachShader; P.attachShader = function (p, s) { const t = srcs.get(s) || ''; const m = (lab.get(p) || '') + '|' + t.length + ':' + (t.match(/\\bvoid main\\(\\)/) ? '' : '') + (t.includes('landW') ? 'FS-land' : t.includes('edgeJump') ? 'EDGE' : t.includes('vEdge') ? 'land*' : ''); lab.set(p, m); return at.call(this, p, s); };
    for (const k of ['getProgramParameter', 'linkProgram', 'useProgram', 'drawArrays', 'drawArraysInstanced', 'drawElements', 'readPixels', 'getShaderParameter', 'endTransformFeedback', 'clientWaitSync', 'getBufferSubData']) { const f0 = P[k]; if (!f0) continue; P[k] = function (...a) { const t0 = performance.now(); const r = f0.apply(this, a); const d = performance.now() - t0; if (d > 40) __slow.push([k, Math.round(d), k === 'getProgramParameter' || k === 'useProgram' || k === 'linkProgram' ? lab.get(a[0]) : '', Math.round(t0)]); return r; }; }
    return 1; })()`);
  await ev('__cmwSetMain("land")');
  await sleep(5000);
  out.push({ page, f, slow: await ev('__slow') });
}
return out;
