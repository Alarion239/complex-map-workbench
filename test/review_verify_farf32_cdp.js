// Reviewer scratch: drive headless Chrome over a CDP pipe (no port), inject app state into the ns-namespaced
// localStorage from a non-app same-origin page, load the app and capture the domain pane.
// usage: node test/review_verify_farf32_cdp.js <outdir> <caseName> '<stateJSON>' [extraArgs...]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const [outDir, caseName, stateJSON, ...extra] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const udd = path.join(outDir, 'udd-' + caseName + '-' + Date.now());
const NS = 'verify-robust-hl';
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-pipe', '--user-data-dir=' + udd, '--no-first-run',
  '--window-size=1400,850', '--hide-scrollbars', ...extra, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
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
(async () => {
  try {
    const { targetInfos } = await send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page');
    const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    await S('Page.enable'); await S('Runtime.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: 1400, height: 850, deviceScaleFactor: 1, mobile: false });
    const ev = async (expr) => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.value; };
    // same-origin non-app page: set state
    await S('Page.navigate', { url: 'http://localhost:8793/gl-helpers.html' }); await sleep(800);
    await ev(`localStorage.setItem('complex-map-workbench-v1:${NS}', ${JSON.stringify(stateJSON)}); 'ok'`);
    await S('Page.navigate', { url: 'http://localhost:8793/test.html?ns=' + NS }); await sleep(4000);
    const info = await ev(`(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); const e = g && g.getExtension('WEBGL_debug_renderer_info');
      return { gl2: !!g, renderer: g && e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : null, hp: g ? g.getShaderPrecisionFormat(g.VERTEX_SHADER, g.HIGH_FLOAT).precision : null,
        noGL: [...document.querySelectorAll('*')].some((n) => n.childElementCount === 0 && /needs WebGL2/.test(n.textContent || '') && n.offsetParent),
        state: JSON.parse(localStorage.getItem('complex-map-workbench-v1:${NS}')).srcView, info: window.__cmwInfo && window.__cmwInfo() }; })()`);
    console.log(JSON.stringify(info));
    const shot = await S('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, caseName + '.png'), Buffer.from(shot.data, 'base64'));
    console.log('wrote', path.join(outDir, caseName + '.png'));
  } catch (e) { console.error('ERR', e.message); }
  try { await send('Browser.close'); } catch (e) { /* ignore */ }
  setTimeout(() => { try { proc.kill(); } catch (e) { /* ignore */ } process.exit(0); }, 500);
})();
