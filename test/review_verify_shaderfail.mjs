// Reviewer scratch: drive a private headless Chrome over CDP to check silent shader-link failures.
// usage: node test/review_verify_shaderfail.mjs <chromeBinary> <userDataDir> <outDir> [nCoeffs]
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [bin, udd, out, nArg] = process.argv.slice(2);
const N = +(nArg || 2100);
const port = 9000 + Math.floor(Math.random() * 900);
const proc = spawn(bin, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${udd}`, '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', '--use-angle=metal', '--window-size=1400,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const logs = [];
function send(method, params = {}, sessionId) {
  const msg = { id: ++id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => pending.set(msg.id, { res, rej }));
}
try {
  let ver = null;
  for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    else if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  await S('Runtime.enable');
  await S('Page.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  const ev = async (expr) => {
    const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) return 'EXC: ' + JSON.stringify(r.exceptionDetails).slice(0, 600);
    return r.result.value;
  };
  const shot = async (name) => { const r = await S('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, name), Buffer.from(r.data, 'base64')); };
  await S('Page.navigate', { url: 'http://localhost:8793/test.html?ns=verify-robust-shaderfail' });
  await sleep(2500);
  const res = {};
  res.gl = await ev(`(() => { const g = GLR.gl; return { ok: GLR.ok, err: GLR.error, maxVU: g && g.getParameter(g.MAX_VERTEX_UNIFORM_VECTORS), maxFU: g && g.getParameter(g.MAX_FRAGMENT_UNIFORM_VECTORS), renderer: g && g.getParameter(g.RENDERER) }; })()`);
  // pixel probe: count non-background-ish pixels in a canvas by comparing to the grid colour distribution
  const probe = `(() => { const out = {}; for (const s of ['L','R']) { const a = document.getElementById('canvas'+s); const c = document.createElement('canvas'); c.width = a.width; c.height = a.height; const g = c.getContext('2d'); g.drawImage(a, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let sat = 0; for (let i = 0; i < d.length; i += 16) { const r = d[i], gg = d[i+1], b = d[i+2]; const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); if (mx - mn > 40) sat++; } out[s] = sat; } return out; })()`;
  res.before = await ev(probe);
  res.stepsBefore = await ev(`[...document.querySelectorAll('#pipeline .card')].map(c => c.dataset.k + ':' + (c.textContent||'').slice(0,40))`);
  await shot('before.png');
  // open the function palette with '+', pick Polynomial
  res.palette = await ev(`(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true })); await new Promise(r => setTimeout(r, 400)); const items = [...document.querySelectorAll('[role=option], .pal-item, .fp-item, li, button')].filter(e => /^\\s*Polynomial\\b/.test(e.textContent || '') || (e.getAttribute('aria-label')||'').startsWith('Polynomial')); return items.slice(0,5).map(e => e.tagName + '.' + e.className + ' ' + (e.textContent||'').slice(0,60)); })()`);
  await shot('palette.png');
  writeFileSync(join(out, 'res.json'), JSON.stringify({ res, logs }, null, 2));
  // hand back control: keep going in a second phase driven by a JSON command file
  const cmdFile = join(out, 'cmds.js');
  if (existsSync(cmdFile)) {
    const steps = (await import(cmdFile + '?t=' + Date.now())).default;
    for (const st of steps) {
      if (st.sleep) await sleep(st.sleep);
      if (st.eval) res[st.name] = await ev(st.eval.replace(/__N__/g, String(N)));
      if (st.shot) await shot(st.shot);
    }
  }
  writeFileSync(join(out, 'res.json'), JSON.stringify({ res, logs }, null, 2));
  console.log(JSON.stringify({ res, logs }, null, 2));
} finally {
  try { ws && ws.close(); } catch {}
  proc.kill('SIGKILL');
}
