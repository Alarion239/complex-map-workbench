'use strict';
// Minimal standalone Chrome DevTools Protocol client for the perf suite.
// Launches its own headless Chrome (ANGLE Metal, real WebGL2, same flags as test/cdp_kit/cdpd.js) over
// --remote-debugging-pipe with a throw-away profile, opens one page and exposes small helpers.
// Nothing here is shared with other harnesses: every run gets a fresh browser and profile.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  ...(process.platform === 'win32' ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
    .filter(Boolean).map((d) => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe')) : []),
].filter(Boolean);
// the platform's own ANGLE back end: Metal on macOS, Direct3D 11 on Windows (what Chrome uses there by default)
const ANGLE = process.platform === 'win32' ? 'd3d11' : 'metal';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Flags are part of the measurement protocol: keep them identical between the baseline and later runs.
// --disable-gpu-program-cache / --disable-gpu-shader-disk-cache: every shader compiles cold, so compile-bound
// timings (example loading) do not depend on what an earlier run left in a cache.
const CHROME_FLAGS = [
  '--headless=new', `--use-angle=${ANGLE}`, '--remote-debugging-pipe',
  '--no-first-run', '--no-default-browser-check', '--ignore-gpu-blocklist', '--enable-gpu',
  '--disable-gpu-program-cache', '--disable-gpu-shader-disk-cache',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-extensions', '--disable-component-update', '--disable-sync', '--metrics-recording-only', '--mute-audio',
  '--hide-scrollbars=false',
];

// opts.angle: another ANGLE backend than Metal (e.g. 'swiftshader' for the CPU-rendered WebGL2 of machines without a
// usable GPU: swiftshader.ratio); every other flag stays the same
function flagsFor(opts) {
  if (!opts.angle || opts.angle === ANGLE) return CHROME_FLAGS.slice();
  const f = CHROME_FLAGS.map((x) => (x === `--use-angle=${ANGLE}` ? `--use-angle=${opts.angle}` : x));
  if (opts.angle === 'swiftshader') f.push('--enable-unsafe-swiftshader');
  return f;
}

async function launch(opts = {}) {
  const chrome = opts.chrome || CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!chrome) throw new Error('Google Chrome not found; set CHROME_BIN');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cmw-perf-prof-'));
  const flags = flagsFor(opts);
  const ch = spawn(chrome, [...flags, `--user-data-dir=${prof}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const wr = ch.stdio[3], rd = ch.stdio[4];
  let id = 0, buf = '';
  const pend = new Map();
  const LOG = [];
  const listeners = [];
  let dead = null;
  ch.on('exit', (code) => { dead = `chrome exited (${code})`; for (const { rej } of pend.values()) rej(new Error(dead)); pend.clear(); });
  rd.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\0')) >= 0) {
      const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (msg.id && pend.has(msg.id)) {
        const { res, rej } = pend.get(msg.id); pend.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
        continue;
      }
      if (msg.method === 'Runtime.consoleAPICalled') LOG.push({ t: msg.params.type, m: msg.params.args.map((a) => (a.value !== undefined ? String(a.value) : (a.description || a.type))).join(' ').slice(0, 400) });
      else if (msg.method === 'Runtime.exceptionThrown') LOG.push({ t: 'EXC', m: ((msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description) || msg.params.exceptionDetails.text).slice(0, 600) });
      else if (msg.method === 'Log.entryAdded') LOG.push({ t: 'log-' + msg.params.entry.level, m: msg.params.entry.text.slice(0, 400) });
      for (const l of listeners) l(msg);
    }
  });
  const sendRaw = (method, params = {}, sessionId) => new Promise((res, rej) => {
    if (dead) { rej(new Error(dead)); return; }
    const m = { id: ++id, method, params }; if (sessionId) m.sessionId = sessionId;
    pend.set(m.id, { res, rej });
    wr.write(JSON.stringify(m) + '\0');
  });
  const version = await sendRaw('Browser.getVersion');
  const t = await sendRaw('Target.createTarget', { url: 'about:blank' });
  const a = await sendRaw('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  const S = a.sessionId;
  const send = (m, p) => sendRaw(m, p, S);
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable'); await send('Performance.enable', { timeDomain: 'timeTicks' });
  const W = opts.width || 1440, H = opts.height || 900;
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: opts.dpr || 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  if (opts.inject) await send('Page.addScriptToEvaluateOnNewDocument', { source: opts.inject });

  const H_ = {};
  H_.version = version;
  H_.send = send;
  H_.sleep = sleep;
  // evaluate an expression in the page; returns its value (no promise awaiting: start async work in the page,
  // store the result on window and poll it)
  H_.ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('page eval failed: ' + ((d.exception && d.exception.description) || d.text) + '\n  in: ' + expr.slice(0, 300));
    }
    return r.result.value;
  };
  // poll an expression until it returns a truthy value; returns that value (or throws after timeout)
  H_.until = async (expr, timeout = 15000, every = 50) => {
    const t0 = Date.now();
    for (;;) {
      const v = await H_.ev(expr);
      if (v) return v;
      if (Date.now() - t0 > timeout) throw new Error(`timeout (${timeout} ms) waiting for: ${expr.slice(0, 200)}`);
      await sleep(every);
    }
  };
  H_.nav = async (url) => {
    const loaded = new Promise((res) => { const f = (m) => { if (m.method === 'Page.loadEventFired' && m.sessionId === S) { listeners.splice(listeners.indexOf(f), 1); res(); } }; listeners.push(f); });
    await send('Page.navigate', { url });
    await Promise.race([loaded, sleep(20000)]);
  };
  // a script that runs before the page's own scripts on the next navigations (returns its identifier)
  H_.addInit = async (source) => (await send('Page.addScriptToEvaluateOnNewDocument', { source })).identifier;
  H_.removeInit = async (identifier) => send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  // mouse
  const BTN = { left: 1, right: 2, middle: 4 };
  H_.mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', Object.assign({ type, x, y }, extra));
  H_.move = (x, y, button) => H_.mouse('mouseMoved', x, y, button ? { button, buttons: BTN[button] } : {});
  // a real drag: press, n moves dt ms apart, release
  H_.drag = async (x0, y0, x1, y1, { n = 30, dt = 16, button = 'left', modifiers = 0 } = {}) => {
    await H_.mouse('mouseMoved', x0, y0);
    await H_.mouse('mousePressed', x0, y0, { button, buttons: BTN[button], clickCount: 1, modifiers });
    for (let i = 1; i <= n; i++) {
      const t = Date.now();
      await H_.mouse('mouseMoved', x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, { button, buttons: BTN[button], modifiers });
      const left = dt - (Date.now() - t);
      if (left > 0) await sleep(left);
    }
    await H_.mouse('mouseReleased', x1, y1, { button, buttons: 0, clickCount: 1, modifiers });
  };
  // a key held (P3b: Space held turns an editable globe in every tool): 'keyDown' / 'keyUp' without text
  H_.key = (type, code = 'Space', key = ' ', vk = 32) => send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  H_.wheel = (x, y, deltaY, deltaX = 0) => send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY });
  H_.shot = async (clip) => {
    const p = { format: 'png' }; if (clip) p.clip = Object.assign({ scale: 1 }, clip);
    const r = await send('Page.captureScreenshot', p);
    return Buffer.from(r.data, 'base64');
  };
  H_.metrics = async () => {
    const r = await send('Performance.getMetrics');
    const o = {}; for (const m of r.metrics) o[m.name] = m.value; return o;
  };
  H_.logs = (clear = true) => { const l = LOG.slice(); if (clear) LOG.length = 0; return l; };
  H_.close = async () => {
    try { await sendRaw('Browser.close'); } catch (e) { /* already gone */ }
    await Promise.race([new Promise((r) => (dead ? r() : ch.on('exit', r))), sleep(3000)]);
    try { ch.kill('SIGKILL'); } catch (e) { /* gone */ }
    try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  };
  H_.chromePath = chrome;
  H_.flags = flags;
  return H_;
}

module.exports = { launch, sleep, CHROME_FLAGS };
