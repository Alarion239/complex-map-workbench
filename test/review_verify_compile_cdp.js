// Skeptic check for the "add step compiles shaders synchronously" perf finding.
// Drives a private headless Chrome over --remote-debugging-pipe (no port), loads the app from the
// running static server, and times add-step from the Enter keydown to the end of the first frame.
// Usage: node test/review_verify_compile_cdp.js [angle]   (angle: metal | swiftshader | default)
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const angle = process.argv[2] || 'metal';
const prof = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'chprof-'));
const args = ['--headless=new', `--user-data-dir=${prof}`, '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check',
  '--ignore-gpu-blocklist', '--enable-gpu', 'about:blank'];
if (angle !== 'default') args.splice(1, 0, `--use-angle=${angle}`);
const ch = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const wr = ch.stdio[3], rd = ch.stdio[4];
let id = 0, buf = '';
const pend = new Map();
rd.on('data', (d) => {
  buf += d.toString('utf8');
  let i;
  while ((i = buf.indexOf('\0')) >= 0) {
    const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (msg.id && pend.has(msg.id)) { const { res, rej } = pend.get(msg.id); pend.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); }
  }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const m = { id: ++id, method, params }; if (sessionId) m.sessionId = sessionId; pend.set(m.id, { res, rej }); wr.write(JSON.stringify(m) + '\0'); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGE_SETUP = `
window.__P = { on:false, c:{}, t:{} };
{
  const G = WebGL2RenderingContext.prototype;
  for (const n of ['compileShader','linkProgram','getShaderParameter','getProgramParameter','drawArrays','drawArraysInstanced']) {
    const o = G[n]; G[n] = function(...a){ if(!__P.on) return o.apply(this,a); const t0=performance.now(); try { return o.apply(this,a);} finally { __P.c[n]=(__P.c[n]||0)+1; __P.t[n]=(__P.t[n]||0)+performance.now()-t0; } };
  }
  window.__loaf = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) __loaf.push({ s: e.startTime, d: e.duration }); }).observe({ type:'long-animation-frame' }); } catch (e) {}
}
const W = (ms) => new Promise(r=>setTimeout(r,ms));
const snap = () => ({ c: {...__P.c}, t: Object.fromEntries(Object.entries(__P.t).map(([k,v])=>[k, +v.toFixed(1)])) });
// time an action: handler time, end of first frame after it, GL compile cost inside that window, frames in the 480 ms homotopy
window.__timeAct = async (act) => {
  __P.c={}; __P.t={}; __P.on = true;
  const frames = []; let stop = false;
  const l0 = __loaf.length;
  const t0 = performance.now();
  act();
  const handlerMs = performance.now() - t0;
  const profHandler = snap();
  const loop = () => { frames.push(+(performance.now()-t0).toFixed(1)); if (!stop) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const firstDone = await new Promise(r => requestAnimationFrame(() => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(performance.now()-t0); mc.port2.postMessage(0); }));
  const prof = snap();
  await W(800); stop = true; __P.on = false; await W(50);
  return { handlerMs: +handlerMs.toFixed(1), firstFrameDoneMs: +firstDone.toFixed(1), profHandler, profToFirstFrame: prof,
    framesIn480: frames.filter(f=>f<=480).length, firstFrames: frames.slice(0,6),
    loaf: __loaf.slice(l0).map(e=>({ s: Math.round(e.s - t0), d: Math.round(e.d) })) };
};
window.__addFn = async (name) => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }));
  await W(250);
  const inp = document.getElementById('palInput');
  inp.value = name; inp.dispatchEvent(new Event('input', { bubbles: true }));
  await W(250);
  const r = await __timeAct(() => inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  r.cards = [...document.querySelectorAll('#pipeline .card')].map(c => c.textContent.slice(0, 14));
  return r;
};
'ok'`;

(async () => {
  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    await S('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
    await S('Page.enable');
    await S('Page.navigate', { url: 'http://localhost:8793/test.html?ns=verify-perf-headless' });
    await sleep(5000);
    const ev = async (expr) => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 800)); return r.result.value; };
    const out = {};
    out.env = await ev(`(() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g && g.getExtension('WEBGL_debug_renderer_info'); return { GLRok: GLR.ok, renderer: d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : null, parallel: !!(g && g.getExtension('KHR_parallel_shader_compile')), dpr: devicePixelRatio, w: innerWidth, h: innerHeight, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches }; })()`);
    await ev(PAGE_SETUP);
    const runs = (process.env.FNS || 'sin,cos,sinh,tanh,joukowski,log,sin').split(',');
    out.adds = [];
    for (const fn of runs) {
      await ev(`(async () => { __cmwExample(0); await W(2500); return 1; })()`);
      const r = await ev(`__addFn(${JSON.stringify(fn)})`);
      r.fn = fn;
      out.adds.push(r);
      await sleep(600);
    }
    // undo of the add, then redo (chain keys differ from the previous step's key, single-slot program cache)
    out.undo = await ev(`(async () => { await W(600); return __timeAct(() => document.getElementById('undoBtn').click()); })()`);
    out.redo = await ev(`(async () => { await W(600); return __timeAct(() => document.getElementById('redoBtn').click()); })()`);
    console.log(JSON.stringify(out, null, 1));
  } catch (e) {
    console.error('ERR', e && e.message);
  } finally {
    try { await send('Browser.close'); } catch (e) { /* ignore */ }
    setTimeout(() => { try { ch.kill(); } catch (e) { /* ignore */ } fs.rmSync(prof, { recursive: true, force: true }); process.exit(0); }, 800);
  }
})();
