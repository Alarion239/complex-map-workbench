// QA daemon: keeps one headless Chrome (ANGLE Metal; Direct3D 11 on Windows, SwiftShader on Linux) alive over --remote-debugging-pipe and runs
// command files dropped into ./q (N.js -> N.out). Each command file is the body of an async function
// with helpers in scope (ev, shot, nav, view, key, click, drag, logs, send, S, sleep).
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const DIR = __dirname;
const Q = path.join(DIR, 'q');
fs.mkdirSync(Q, { recursive: true });
// (Windows: Chrome's own install path and ANGLE's Direct3D 11 back end, what Chrome uses there; Linux: google-chrome
// and SwiftShader, CPU WebGL2. CHROME_BIN, CMW_ANGLE and CMW_CHROME_ARGS override them, as in the CI scripts: ci/README.md)
const WIN = process.platform === 'win32', MAC = process.platform === 'darwin';
const CHROME = process.env.CHROME_BIN || (WIN ? path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe')
  : MAC ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p)) || 'google-chrome');
const ANGLE = process.env.CMW_ANGLE || (WIN ? 'd3d11' : MAC ? 'metal' : 'swiftshader');
const prof = fs.mkdtempSync(path.join(DIR, 'chprof-'));
// (the disk cache in the profile, not the system's cache folder: deleting the profile deletes it)
const ch = spawn(CHROME, ['--headless=new', `--use-angle=${ANGLE}`, `--user-data-dir=${prof}`, `--disk-cache-dir=${path.join(prof, 'cache')}`, '--remote-debugging-pipe',
  '--no-first-run', '--no-default-browser-check', '--ignore-gpu-blocklist', '--enable-gpu', '--hide-scrollbars=false',
  ...(ANGLE === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : []), ...(process.env.CMW_CHROME_ARGS || '').split(/\s+/).filter(Boolean), 'about:blank'],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const wr = ch.stdio[3], rd = ch.stdio[4];
let id = 0, buf = '';
const pend = new Map();
const LOG = [];
rd.on('data', (d) => {
  buf += d.toString('utf8');
  let i;
  while ((i = buf.indexOf('\0')) >= 0) {
    const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (msg.id && pend.has(msg.id)) { const { res, rej } = pend.get(msg.id); pend.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); }
    else if (msg.method === 'Runtime.consoleAPICalled') LOG.push({ t: msg.params.type, m: msg.params.args.map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ').slice(0, 400) });
    else if (msg.method === 'Runtime.exceptionThrown') LOG.push({ t: 'EXC', m: (msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description || msg.params.exceptionDetails.text).slice(0, 600) });
    else if (msg.method === 'Log.entryAdded') LOG.push({ t: 'log-' + msg.params.entry.level, m: msg.params.entry.text.slice(0, 400) });
  }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const m = { id: ++id, method, params }; if (sessionId) m.sessionId = sessionId; pend.set(m.id, { res, rej }); wr.write(JSON.stringify(m) + '\0'); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let S = null;
const H = {};
H.send = (m, p) => send(m, p, S);
H.sleep = sleep;
H.ev = async (expr, timeout = 20000) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout, userGesture: true, replMode: true }, S);
  if (r.exceptionDetails) return { __exc: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text };
  return r.result.value;
};
H.view = async (w, h, dark, mobile) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile }, S);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] }, S);
  await send('Emulation.setTouchEmulationEnabled', { enabled: !!mobile, maxTouchPoints: mobile ? 5 : 1 }, S);
};
H.nav = async (url) => { await send('Page.navigate', { url }, S); await sleep(2500); };
H.shot = async (name, clip) => {
  const p = { format: 'png' }; if (clip) p.clip = Object.assign({ scale: 1 }, clip);
  const r = await send('Page.captureScreenshot', p, S);
  const f = path.join(DIR, 'shots', name + '.png'); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, Buffer.from(r.data, 'base64')); return f;
};
const KEYS = { Enter: [13, '\r'], Escape: [27, ''], Tab: [9, ''], Backspace: [8, ''], Delete: [46, ''], ArrowDown: [40, ''], ArrowUp: [38, ''], ArrowLeft: [37, ''], ArrowRight: [39, ''], F6: [117, ''], Home: [36, ''], End: [35, ''], ' ': [32, ' '] };
H.key = async (k, mods = 0) => {
  const kc = KEYS[k] ? KEYS[k][0] : k.toUpperCase().charCodeAt(0);
  const text = KEYS[k] ? KEYS[k][1] : (mods & ~8 ? '' : k);
  const code = KEYS[k] ? k : (/[a-z]/i.test(k) ? 'Key' + k.toUpperCase() : /[0-9]/.test(k) ? 'Digit' + k : '');
  await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code, windowsVirtualKeyCode: kc, text, unmodifiedText: text, modifiers: mods }, S);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: kc, modifiers: mods }, S);
};
H.type = async (s) => { await send('Input.insertText', { text: s }, S); };
H.click = async (x, y, opts = {}) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, S);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers: opts.mods || 0 }, S);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers: opts.mods || 0 }, S);
};
H.move = async (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, S);
H.drag = async (x0, y0, x1, y1, n = 12, dt = 16) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 }, S);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 }, S);
  for (let i = 1; i <= n; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n, button: 'left', buttons: 1 }, S); await sleep(dt); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 }, S);
};
H.clickSel = async (sel) => {
  const r = await H.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; e.scrollIntoView({block:'nearest'}); const b=e.getBoundingClientRect(); return [b.left+b.width/2,b.top+b.height/2];})()`);
  if (!r || r.__exc) return 'nosel ' + sel;
  await H.click(r[0], r[1]); return r;
};
H.load = async (ns, st, extra) => {
  await send('Page.navigate', { url: 'http://localhost:8793/gl-helpers.html' }, S); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await H.ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); ${extra || ''}; 1`);
  await send('Page.navigate', { url: 'http://localhost:8793/test.html?ns=' + ns }, S); await sleep(2200);
  return H.ev(`({cards: __qa.cards(), lamps: __qa.lamps()})`);
};
H.img = async (clip) => { const p = { format: 'png' }; if (clip) p.clip = Object.assign({ scale: 1 }, clip); const r = await send('Page.captureScreenshot', p, S); return require(path.join(DIR, 'png.js'))(Buffer.from(r.data, 'base64')); };
H.logs = (clear = true) => { const l = LOG.slice(); if (clear) LOG.length = 0; return l; };
H.fs = fs; H.path = path; H.DIR = DIR;

(async () => {
  const t = await send('Target.createTarget', { url: 'about:blank' });
  const a = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  S = a.sessionId;
  await send('Runtime.enable', {}, S); await send('Page.enable', {}, S); await send('Log.enable', {}, S);
  await H.view(1440, 900, false);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(DIR, 'qa_inject.js'), 'utf8') }, S);
  fs.writeFileSync(path.join(DIR, 'q', 'READY'), 'ok');
  const done = new Set();
  for (;;) {
    const files = fs.readdirSync(Q).filter((f) => /^\d+\.js$/.test(f) && !done.has(f)).sort((x, y) => parseInt(x) - parseInt(y));
    for (const f of files) {
      done.add(f);
      const body = fs.readFileSync(path.join(Q, f), 'utf8');
      let out;
      try {
        const fn = new (Object.getPrototypeOf(async function () {}).constructor)(...Object.keys(H), body);
        out = await fn(...Object.values(H));
      } catch (e) { out = { __daemonError: String(e && e.stack || e) }; }
      fs.writeFileSync(path.join(Q, f.replace('.js', '.out')), JSON.stringify(out, null, 1));
    }
    if (fs.existsSync(path.join(Q, 'QUIT'))) { ch.kill(); process.exit(0); }
    await sleep(80);
  }
})().catch((e) => { fs.writeFileSync(path.join(Q, 'FATAL'), String(e.stack || e)); ch.kill(); process.exit(1); });
