// Reviewer scratch (verify perf finding): per-frame ruler/corner overhead (forced layouts, getImageData) during pans and scrubs.
// Headless Chrome over a CDP pipe. Compares the app as shipped with an in-page counterfactual that skips identical
// corner.innerHTML writes (no src change). usage: node test/review_verify_rulers_cdp.js <outdir> [dpr]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const [outDir, dprArg] = process.argv.slice(2);
const DPR = +(dprArg || 2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const udd = path.join(outDir, 'udd-rulers-' + Date.now());
const NS = 'verify-perf-rulers';
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-pipe', '--user-data-dir=' + udd, '--no-first-run',
  '--window-size=1440,900', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
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
window.__stat = (a) => { a = a.slice(2).sort((p, q) => p - q); if (!a.length) return null; const q = (p) => +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(2); return { p50: q(0.5), p95: q(0.95), max: +a[a.length - 1].toFixed(2), mean: +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3) }; };
window.__C = {};
window.__reset = () => { window.__C = { gbcr: 0, gbcrT: 0, gbcrSlow: 0, gid: 0, gidT: 0, pid: 0, pidT: 0, cornerW: 0, byId: {} }; };
__reset();
{
  const og = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () { const t0 = performance.now(); const r = og.call(this); const d = performance.now() - t0; __C.gbcr++; __C.gbcrT += d; if (d > 0.1) __C.gbcrSlow++; const k = this.id || this.className || this.tagName; const b = (__C.byId[k] ||= [0, 0]); b[0]++; b[1] += d; return r; };
  const P = CanvasRenderingContext2D.prototype;
  const gi = P.getImageData; P.getImageData = function (...a) { const t0 = performance.now(); const r = gi.apply(this, a); __C.gid++; __C.gidT += performance.now() - t0; return r; };
  const pi = P.putImageData; P.putImageData = function (...a) { const t0 = performance.now(); const r = pi.apply(this, a); __C.pid++; __C.pidT += performance.now() - t0; return r; };
  for (const id of ['cornerL', 'cornerR']) { const el = document.getElementById(id); if (el) new MutationObserver((m) => { __C.cornerW += m.length; }).observe(el, { childList: true, subtree: true, characterData: true }); }
}
// counterfactual for the finding's first fix: skip identical corner writes (instance-level, src untouched)
window.__fixCorner = (on) => {
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  for (const id of ['cornerL', 'cornerR']) {
    const el = document.getElementById(id);
    if (on) Object.defineProperty(el, 'innerHTML', { configurable: true, get() { return d.get.call(this); }, set(v) { if (d.get.call(this) !== v) d.set.call(this, v); } });
    else delete el.innerHTML;
  }
};
window.__mloop = async (fn, ms = 1500) => {
  const ts = [], pre = [], full = [], hnd = [];
  const mc = new MessageChannel(); let pendingTs = 0;
  mc.port1.onmessage = () => { full.push(performance.now() - pendingTs); };
  const t0 = performance.now(); let k = 0;
  __reset();
  await new Promise((done) => {
    const step = (t) => {
      ts.push(t); pre.push(performance.now() - t); pendingTs = t; mc.port2.postMessage(0);
      k++; const w0 = performance.now(); fn(k); hnd.push(performance.now() - w0);
      if (performance.now() - t0 < ms) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
  await __wait(60);
  const iv = ts.slice(1).map((t, i) => t - ts[i]);
  const n = iv.length, C = __C;
  const by = {}; for (const [kk, v] of Object.entries(C.byId)) by[kk] = [+(v[0] / n).toFixed(2), +(v[1] / n).toFixed(3)];
  return { frames: n, fps: +(1000 / (iv.reduce((s, v) => s + v, 0) / n)).toFixed(1), appFrameMs: __stat(pre), mainMs: __stat(full), handlerMs: __stat(hnd),
    perFrame: { gbcr: +(C.gbcr / n).toFixed(2), gbcrMs: +(C.gbcrT / n).toFixed(3), gbcrSlowCalls: +(C.gbcrSlow / n).toFixed(2), getImageData: +(C.gid / n).toFixed(2), gidMs: +(C.gidT / n).toFixed(3), putImageData: +(C.pid / n).toFixed(2), pidMs: +(C.pidT / n).toFixed(3), cornerMutations: +(C.cornerW / n).toFixed(2) }, gbcrById: by };
};
window.__pe = (el, type, x, y, btn = 1) => el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse', button: btn, buttons: type === 'pointerup' ? 0 : (btn === 1 ? 4 : 1), isPrimary: true }));
window.__mdrag = async (el, ms = 1500, btn = 1, horizOnly = false) => {
  const r = el.getBoundingClientRect();
  const x0 = r.x + r.width * 0.5, y0 = r.y + r.height * 0.5;
  __pe(el, 'pointerdown', x0, y0, btn);
  let x = x0, y = y0;
  const res = await __mloop((k) => { const s = (k % 120) < 60 ? 1 : -1; x += 3 * s; if (!horizOnly) y += 1 * s; __pe(el, 'pointermove', x, y, btn); }, ms);
  __pe(el, 'pointerup', x, y, btn);
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
    await S('Page.enable'); await S('Runtime.enable'); await S('Performance.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: DPR, mobile: false });
    const ev = async (expr) => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
    const metrics = async () => { const { metrics: m } = await S('Performance.getMetrics'); const o = {}; for (const x of m) o[x.name] = x.value; return o; };
    // run a scenario and attach layout/style metrics per frame from the Performance domain
    const run = async (expr) => {
      const a = await metrics(); const r = await ev(expr); const b = await metrics();
      const n = r.frames || 1;
      r.perFrameCDP = {
        layouts: +((b.LayoutCount - a.LayoutCount) / n).toFixed(2), layoutMs: +((b.LayoutDuration - a.LayoutDuration) * 1000 / n).toFixed(3),
        styleRecalcs: +((b.RecalcStyleCount - a.RecalcStyleCount) / n).toFixed(2), styleMs: +((b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000 / n).toFixed(3),
        scriptMs: +((b.ScriptDuration - a.ScriptDuration) * 1000 / n).toFixed(3), taskMs: +((b.TaskDuration - a.TaskDuration) * 1000 / n).toFixed(3),
      };
      return r;
    };
    await S('Page.navigate', { url: 'http://localhost:8793/test.html?ns=' + NS }); await sleep(3000);
    out.env = await ev(`({ dpr: devicePixelRatio, glrOk: typeof GLR !== 'undefined' && GLR.ok, iw: innerWidth, ih: innerHeight })`);
    await ev(HARNESS);
    await ev(`__cmwExample(0); __wait(1500)`);
    await ev(`__key('1'); __wait(1200)`);
    const L = `document.getElementById('overlayL')`, R = `document.getElementById('overlayR')`;
    // warm up
    await ev(`__mdrag(${L}, 600)`); await ev(`__wait(600)`);
    for (const rep of [1, 2]) {
      out['leftPan_asShipped_' + rep] = await run(`__mdrag(${L})`); await ev(`__wait(600)`);
      out['rightPan_asShipped_' + rep] = await run(`__mdrag(${R})`); await ev(`__wait(600)`);
      await ev(`__fixCorner(true)`);
      out['leftPan_cornerFix_' + rep] = await run(`__mdrag(${L})`); await ev(`__wait(600)`);
      out['rightPan_cornerFix_' + rep] = await run(`__mdrag(${R})`); await ev(`__wait(600)`);
      await ev(`__fixCorner(false)`);
    }
    // idle with nothing happening, for a baseline of per-frame layout
    out.idle = await run(`__mloop(() => {}, 800)`);
    // shape move-drag in the left plane (select tool): shapesChanged(false) updates DOM on every move
    out.shapes = await ev(`(() => { const st = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith(':${NS}')))); return { tool: st.tool, srcView: st.srcView, shapes: st.shapes.map((s) => ({ id: s.id, kind: s.kind, h: (typeof Region !== 'undefined' && Region.handlesOf) ? Region.handlesOf(s).map(([k, z]) => [k, +z.re.toFixed(3), +z.im.toFixed(3)]) : null })) }; })()`);
    window_moveDrag: {
      const MV = `(async () => {
        const st = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith(':${NS}'))));
        const el = document.getElementById('overlayL'); const r = el.getBoundingClientRect(); const v = st.srcView;
        const sh = st.shapes.find((q) => Region.handlesOf(q).length); const hz = Region.handlesOf(sh)[0][1];
        const x0 = r.x + r.width / 2 + (hz.re - v.cx) * v.s, y0 = r.y + r.height / 2 - (hz.im - v.cy) * v.s;
        __pe(el, 'pointerdown', x0, y0, 0);
        let x = x0, y = y0;
        const res = await __mloop((k) => { const s = (k % 60) < 30 ? 1 : -1; x += 3 * s; y += 1 * s; __pe(el, 'pointermove', x, y, 0); }, 1500);
        __pe(el, 'pointerup', x, y, 0);
        res.at = [Math.round(x0), Math.round(y0), sh.kind];
        return res;
      })()`;
      try {
        for (const rep of [1, 2]) {
          out['move_asShipped_' + rep] = await run(MV); await ev(`__key('z'); __wait(1200)`);
          await ev(`__fixCorner(true)`);
          out['move_cornerFix_' + rep] = await run(MV); await ev(`__wait(1200)`);
          await ev(`__fixCorner(false)`);
        }
      } catch (e) { out.moveErr = e.message; }
    }
    // parameter scrub on the first scrubbable label in the chain
    out.scrubLabels = await ev(`[...document.querySelectorAll('.scrub')].slice(0, 6).map((e) => e.textContent.trim().slice(0, 20) + ' @' + Math.round(e.getBoundingClientRect().x) + ',' + Math.round(e.getBoundingClientRect().y))`);
    const SC = `document.querySelectorAll('.scrub')[0]`;
    if (out.scrubLabels.length) {
      await ev(`__mdrag(${SC}, 500, 0, true)`); await ev(`__wait(800)`);
      for (const rep of [1, 2]) {
        out['scrub_asShipped_' + rep] = await run(`__mdrag(${SC}, 1500, 0, true)`); await ev(`__wait(900)`);
        await ev(`__fixCorner(true)`);
        out['scrub_cornerFix_' + rep] = await run(`__mdrag(${SC}, 1500, 0, true)`); await ev(`__wait(900)`);
        await ev(`__fixCorner(false)`);
      }
    }
    const shot = await S('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'rulers_after.png'), Buffer.from(shot.data, 'base64'));
  } catch (e) { out.err = e.message; }
  console.log(JSON.stringify(out, null, 1));
  try { await send('Browser.close'); } catch (e) { /* ignore */ }
  setTimeout(() => { try { proc.kill(); } catch (e) { /* ignore */ } try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { /* ignore */ } process.exit(0); }, 500);
})();
