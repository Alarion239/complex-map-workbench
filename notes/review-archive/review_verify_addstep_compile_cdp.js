// Reviewer scratch (verifier of perf finding "add step compiles shaders synchronously").
// Drives headless Chrome over a CDP pipe (no port, no server), loads the app, wraps WebGL2 compile/link status
// queries, adds steps via the + palette and times the first frames after Enter.
// usage: node test/review_verify_addstep_compile_cdp.js <outdir> [extra chrome args...]
const { spawn } = require('child_process');
const path = require('path');
const [outDir, ...extra] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const udd = path.join(outDir, 'udd-addstep-' + Date.now());
const NS = 'verify-addstep-compile';
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

const INSTALL = `(() => {
  window.__T = { log: [] };
  const P = WebGL2RenderingContext.prototype;
  for (const n of ['getShaderParameter', 'getProgramParameter', 'compileShader', 'linkProgram']) {
    const o = P[n];
    P[n] = function (...a) { const t = performance.now(); const r = o.apply(this, a); __T.log.push([n, t, performance.now() - t]); return r; };
  }
  const oraf = window.requestAnimationFrame.bind(window);
  window.__frames = [];
  window.requestAnimationFrame = function (cb) { return oraf(function (ts) { const t = performance.now(); cb(ts); window.__frames.push([t, performance.now() - t]); }); };
  window.__add = async (q) => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    const inp = document.getElementById('palInput');
    if (!inp) return 'no palette';
    inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    const label = document.querySelector('.pal-item.sel .pal-label')?.textContent;
    __T.log = []; __frames = [];
    const t0 = performance.now();
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const tH = performance.now() - t0;
    await new Promise((r) => setTimeout(r, 1200));
    const sum = {};
    for (const [n, t, d] of __T.log) { if (t - t0 > 600) continue; sum[n] = sum[n] || [0, 0]; sum[n][0]++; sum[n][1] += d; }
    const fr = __frames.filter(([t]) => t - t0 < 700).map(([t, d]) => [Math.round(t - t0), +d.toFixed(1)]);
    return { label, handlerMs: +tH.toFixed(1), firstFrame: fr[0], firstFrameEndMs: fr.length ? fr[0][0] + Math.round(fr[0][1]) : null,
      framesStartedBefore480: fr.filter(([t]) => t < 480).length, frames: fr.slice(0, 8),
      gl: Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, [v[0], +v[1].toFixed(1)]])) };
  };
  return 'installed';
})()`;

(async () => {
  try {
    const { targetInfos } = await send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page');
    const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    await S('Page.enable'); await S('Runtime.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
    const ev = async (expr) => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return 'EXC ' + JSON.stringify(r.exceptionDetails).slice(0, 400); return r.result.value; };
    await S('Page.navigate', { url: 'http://localhost:8793/test.html?ns=' + NS }); await sleep(4000);
    console.log('env', JSON.stringify(await ev(`(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); const e = g && g.getExtension('WEBGL_debug_renderer_info');
      return { gl2: !!g, renderer: g && e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : null, glrOk: GLR.ok, parallel: !!(g && g.getExtension('KHR_parallel_shader_compile')) }; })()`)));
    console.log(await ev(INSTALL));
    const queries = ['sin', 'cos', 'Joukowski', 'sinh', 'tanh', 'log'];
    for (const q of queries) {
      await ev(`__cmwExample(0); 'ok'`); await sleep(2500);
      const r = await ev(`__add(${JSON.stringify(q)})`);
      console.log(q, JSON.stringify(r));
      await sleep(500);
    }
    // repeat sin a second time (programs for that chain were deleted when the example reloaded?)
    await ev(`__cmwExample(0); 'ok'`); await sleep(2500);
    console.log('sin-again', JSON.stringify(await ev(`__add('sin')`)));
    // undo of the add: chain key goes back -> recompile?
    await sleep(800);
    console.log('undo', JSON.stringify(await ev(`(async () => { __T.log = []; __frames = []; const t0 = performance.now(); document.getElementById('undoBtn').click(); await new Promise((r) => setTimeout(r, 900));
      const sum = {}; for (const [n, t, d] of __T.log) { sum[n] = sum[n] || [0, 0]; sum[n][0]++; sum[n][1] += d; }
      const fr = __frames.map(([t, d]) => [Math.round(t - t0), +d.toFixed(1)]); return { frames: fr.slice(0, 4), gl: sum }; })()`)));
  } catch (e) { console.error('ERR', e.message); }
  try { await send('Browser.close'); } catch (e) { /* ignore */ }
  setTimeout(() => { try { proc.kill(); } catch (e) { /* ignore */ } process.exit(0); }, 500);
})();
