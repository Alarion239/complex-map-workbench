// Reviewer scratch (verify perf finding): Landscape-mode left-plane pan cost vs Image mode, in headless Chrome over a CDP pipe.
// usage: node test/review_verify_landpan_cdp.js <outdir> [dpr] [extra chrome args...]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const [outDir, dprArg, ...extra] = process.argv.slice(2);
const DPR = +(dprArg || 2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const udd = path.join(outDir, 'udd-landpan-' + Date.now());
const NS = 'verify-perf-cdp';
const SYNC = process.env.SYNC === '1';
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-pipe', '--user-data-dir=' + udd, '--no-first-run',
  '--window-size=1440,900', '--hide-scrollbars', ...extra, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
const wr = proc.stdio[3], rd = proc.stdio[4];
let id = 0; const pending = new Map(); let buf = '';
rd.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\0')) >= 0) {
    const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result); }
  }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const m = { id: ++id, method, params }; if (sessionId) m.sessionId = sessionId; pending.set(m.id, { res, rej }); wr.write(JSON.stringify(m) + '\0'); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HARNESS = `
Element.prototype.setPointerCapture = function () {}; Element.prototype.releasePointerCapture = function () {}; Element.prototype.hasPointerCapture = function () { return true; };
window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
window.__key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
window.__stat = (a) => { a = a.slice(2).sort((p, q) => p - q); if (!a.length) return null; const q = (p) => +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(2); return { p50: q(0.5), p95: q(0.95), max: +a[a.length - 1].toFixed(2), mean: +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(2) }; };
window.__P = { c: {}, t: {} };
for (const n of ['blit', 'drawLandscape', 'begin', 'drawRegion', 'drawLines', 'drawGrid']) { const o = GLR[n]; if (!o) continue; GLR[n] = function (...a) { const t0 = performance.now(); try { return o.apply(this, a); } finally { __P.c[n] = (__P.c[n] || 0) + 1; __P.t[n] = (__P.t[n] || 0) + performance.now() - t0; } }; }
{ const G = WebGL2RenderingContext.prototype; const o = G.beginTransformFeedback; G.beginTransformFeedback = function (...a) { __P.c.tf = (__P.c.tf || 0) + 1; window.__gl = this; return o.apply(this, a); };
  const od = G.drawArrays; G.drawArrays = function (...a) { if (!window.__gl) window.__gl = this; return od.apply(this, a); }; }
window.__SYNC = !!window.__SYNC_ON;
{ const o = GLR.drawLandscape; GLR.drawLandscape = function (...a) { const t0 = performance.now(); const r = o.apply(this, a); if (window.__SYNC && window.__gl) { const px = new Uint8Array(4); __gl.readPixels(0, 0, 1, 1, __gl.RGBA, __gl.UNSIGNED_BYTE, px); } __P.c.landSync = (__P.c.landSync || 0) + 1; __P.t.landSync = (__P.t.landSync || 0) + performance.now() - t0; return r; }; }
window.__mloop = async (fn, ms = 1500) => {
  const ts = [], pre = [], full = [];
  const mc = new MessageChannel(); let pendingTs = 0;
  mc.port1.onmessage = () => { full.push(performance.now() - pendingTs); };
  const t0 = performance.now(); let k = 0;
  __P.c = {}; __P.t = {};
  await new Promise((done) => {
    const step = (t) => {
      ts.push(t); pre.push(performance.now() - t); pendingTs = t; mc.port2.postMessage(0);
      k++; fn(k);
      if (performance.now() - t0 < ms) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
  await __wait(60);
  const iv = ts.slice(1).map((t, i) => t - ts[i]);
  const n = iv.length; const prof = {}; for (const kk of Object.keys(__P.c)) prof[kk] = [+(__P.c[kk] / n).toFixed(2), +((__P.t[kk] || 0) / n).toFixed(2)];
  return { frames: n, fps: +(1000 / (iv.reduce((s, v) => s + v, 0) / n)).toFixed(1), interval: __stat(iv), appFrameMs: __stat(pre), mainMs: __stat(full), perFrame_count_ms: prof };
};
window.__pe = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true }));
window.__mdrag = async (el, fx = 0.12, fy = 0.15, ms = 1500, still = false) => {
  const r = el.getBoundingClientRect();
  const x0 = r.x + r.width * fx, y0 = r.y + r.height * fy;
  __pe(el, 'pointerdown', x0, y0);
  let x = x0, y = y0;
  const res = await __mloop((k) => { if (still) return; const s = (k % 120) < 60 ? 1 : -1; x += 3 * s; y += 1 * s; __pe(el, 'pointermove', x, y); }, ms);
  __pe(el, 'pointerup', x, y);
  return res;
};
'ok'`;

(async () => {
  const out = {};
  try {
    const { targetInfos } = await send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page');
    const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    await S('Page.enable'); await S('Runtime.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: DPR, mobile: false });
    const ev = async (expr) => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
    await S('Page.navigate', { url: 'http://localhost:8793/test.html?ns=' + NS }); await sleep(3000);
    out.env = await ev(`(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); const e = g && g.getExtension('WEBGL_debug_renderer_info');
      return { gl2: !!g, renderer: g && e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : null, dpr: devicePixelRatio, glrOk: GLR.ok, iw: innerWidth, ih: innerHeight }; })()`);
    await ev((SYNC ? 'window.__SYNC_ON = true;' : '') + HARNESS);
    await ev(`__cmwExample(0); __wait(1200)`);
    const L = `document.getElementById('overlayL')`;
    const viewProbe = `(() => { const s = JSON.parse(localStorage.getItem('complex-map-workbench-v1:${NS}') || 'null'); return s && s.srcView; })()`;
    // Image mode
    await ev(`__key('1'); __wait(1500)`);
    out.mode1 = await ev(`document.querySelector('.seg .on, [aria-pressed=true]')?.textContent`);
    out.image_leftPan = await ev(`__mdrag(${L})`);
    await ev(`__wait(800)`);
    out.image_leftPan2 = await ev(`__mdrag(${L})`);
    // Landscape mode
    await ev(`__key('3'); __wait(1500)`);
    const shot = await S('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'landpan_3d_dpr' + DPR + '.png'), Buffer.from(shot.data, 'base64'));
    out.land_idle = await ev(`__mloop(() => {}, 800)`);
    out.land_leftPan = await ev(`__mdrag(${L})`);
    await ev(`__wait(800)`);
    out.land_leftPan2 = await ev(`__mdrag(${L})`);
    await ev(`__wait(800)`);
    // pointer held still in left plane (no moves): baseline
    out.land_leftHoldStill = await ev(`__mdrag(${L}, 0.12, 0.15, 1000, true)`);
    await ev(`__wait(800)`);
    // orbit in the right plane (camera-only per spec)
    out.land_orbit = await ev(`__mdrag(document.getElementById('overlayR'), 0.5, 0.5)`);
    await ev(`__wait(800)`);
    out.land_leftPan3 = await ev(`__mdrag(${L}, 0.12, 0.15, 3000)`);
    await ev(`__wait(800)`);
    out.land_orbit2 = await ev(`__mdrag(document.getElementById('overlayR'), 0.5, 0.5, 3000)`);
    await ev(`__wait(800)`);
    // Phase mode left pan (per-pixel mode) for comparison
    await ev(`__key('2'); __wait(1500)`);
    out.phase_leftPan = await ev(`__mdrag(${L})`);
    const shot2 = await S('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'landpan_phase_dpr' + DPR + '.png'), Buffer.from(shot2.data, 'base64'));
  } catch (e) { out.err = e.message; }
  console.log(JSON.stringify(out, null, 1));
  try { await send('Browser.close'); } catch (e) { /* ignore */ }
  setTimeout(() => { try { proc.kill(); } catch (e) { /* ignore */ } try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { /* ignore */ } process.exit(0); }, 500);
})();
