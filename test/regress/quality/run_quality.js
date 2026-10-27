#!/usr/bin/env node
'use strict';
// Image-quality regression runner for Complex Map Workbench.
//
// Renders every scene of scenes.js through the real app (dist/test.html served at --base-url) in its own headless
// Chrome (real WebGL2 via ANGLE Metal, same flags as test/cdp_kit), reads the right-plane canvas #canvasR, compares it
// with the exact per-pixel ground truth and writes:
//   <out>/metrics.json          all metrics (input of ../compare_quality.py)
//   <out>/renders/<id>.png      the right-plane canvas as rendered
//   <out>/maps/<id>.png         classification map (green ok, red hole, blue spill, purple wrong checker parity,
//                               grey: excluded 2.5 px band, yellow: strokes/annotations, pale green: not scored for parity)
//   <out>/golden_diff/<id>.png  bounded controls: pixels that differ from the golden PNG (red)
//   <out>/index.html            all of the above side by side
//
// Usage:
//   node run_quality.js [--out DIR] [--only id1,id2] [--base-url URL] [--stable-ms 1500] [--timeout-ms 30000]
//   node run_quality.js --accept DIR     copy DIR/metrics.json to baseline.json and DIR/renders of the bounded
//                                        controls to golden/ (deliberate baseline update; no browser)
//   node run_quality.js --override '{"meshN":80}' --out DIR   sensitivity check: the same scenes with a changed
//                                        saved state (never accepted as a baseline)
//   node run_quality.js --reeval DIR     recompute the metrics of DIR from its renders (after editing metrics.js or a
//                                        scene's truth; no browser)
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const PNG = require('./pngio');
const M = require('./metrics');
const SC = require('./scenes');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..', '..');
const GOLDEN = path.join(HERE, 'golden');
const BASELINE = path.join(HERE, 'baseline.json');
const VIEWPORT = { width: 1440, height: 900, dpr: 1 };
const GOLDEN_THR = 8;   // /255 per channel after the 1 px blur

function args() {
  const a = process.argv.slice(2), o = { out: path.join(HERE, 'out', 'latest'), only: null, base: 'http://localhost:8793', stableMs: 1500, timeoutMs: 30000, accept: null, reeval: null, override: null };
  for (let i = 0; i < a.length; i++) {
    const k = a[i], v = () => a[++i];
    if (k === '--out') o.out = path.resolve(v());
    else if (k === '--only') o.only = v().split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--base-url') o.base = v().replace(/\/$/, '');
    else if (k === '--stable-ms') o.stableMs = +v();
    else if (k === '--timeout-ms') o.timeoutMs = +v();
    else if (k === '--accept') o.accept = path.resolve(v());
    else if (k === '--reeval') o.reeval = path.resolve(v());
    else if (k === '--override') o.override = JSON.parse(v());
    else if (k === '-h' || k === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 22).join('\n')); process.exit(0); }
    else { console.error('unknown argument ' + k); process.exit(2); }
  }
  return o;
}

// ---------------- deliberate baseline update ----------------
function accept(dir) {
  const met = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json'), 'utf8'));
  if (met.meta.state_override) { console.error('refusing to accept a run made with --override'); process.exit(1); }
  const bad = Object.entries(met.runs).filter(([, r]) => !r.ok);
  if (bad.length) { console.error('refusing to accept a run with failed scenes: ' + bad.map(([k]) => k).join(', ')); process.exit(1); }
  fs.mkdirSync(GOLDEN, { recursive: true });
  let n = 0;
  for (const [id, r] of Object.entries(met.runs)) {
    if (!r.golden) continue;
    fs.copyFileSync(path.join(dir, 'renders', id + '.png'), path.join(GOLDEN, id + '.png'));
    r.metrics.golden_diff = 0; n++;
    r.problems = (r.problems || []).filter((p) => !/golden/.test(p));
  }
  met.meta.accepted = new Date().toISOString();
  // a partial run (--only) updates its runs in the existing baseline; a full run replaces it
  const all = SC.runs().map((r) => r.id), full = all.every((id) => met.runs[id]);
  let outMet = met;
  if (!full && fs.existsSync(BASELINE)) {
    outMet = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    Object.assign(outMet.runs, met.runs);
    outMet.meta.partial_updates = (outMet.meta.partial_updates || []).concat([{ date: met.meta.accepted, runs: Object.keys(met.runs), app_sha1: met.meta.app_sha1 }]);
  }
  fs.writeFileSync(BASELINE, JSON.stringify(outMet, null, 1) + '\n');
  console.log(`baseline.json ${full ? 'written' : 'updated'} from ${dir} (${Object.keys(met.runs).length} runs), ${n} golden PNGs updated`);
}

// ---------------- recompute metrics from saved renders ----------------
function reeval(dir) {
  const met = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json'), 'utf8'));
  const byId = Object.fromEntries(SC.runs().map((r) => [r.id, r]));
  for (const d of ['maps', 'golden_diff']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  for (const [id, prev] of Object.entries(met.runs)) {
    const run = byId[id];
    if (!run || !prev.capture) { console.log(`skip ${id}`); continue; }
    const img = PNG.decode(fs.readFileSync(path.join(dir, 'renders', id + '.png')));
    const res = evalRun(run, { rgba: img.data, cap: { geo: prev.capture.geo, colors: prev.capture.colors, clipWin: prev.capture.clipWin, info: prev.gpu }, settled: prev.settled, settleMs: prev.settle_ms, logs: [], busy: null }, dir, false);
    res.settle_ms = prev.settle_ms; res.render_sha1 = prev.render_sha1;
    res.problems = [...new Set([...(prev.problems || []).filter((p) => /settle|exception|GL error|runner/.test(p)), ...res.problems])];
    res.ok = prev.ok && res.ok;
    met.runs[id] = res;
  }
  met.meta.reevaluated = new Date().toISOString();
  Object.assign(met.meta, { band_px: M.BAND, parity_min_cell_px: M.PARITY_MIN_CELL, parity_min_edge_px: M.PARITY_MIN_EDGE });
  fs.writeFileSync(path.join(dir, 'metrics.json'), JSON.stringify(met, null, 1) + '\n');
  writeIndex(dir, met);
  console.log(`re-evaluated ${Object.keys(met.runs).length} runs in ${dir}`);
}

// ---------------- headless Chrome over the DevTools pipe ----------------
function chromePath() {
  const c = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium',
    ...(process.platform === 'win32' ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
      .filter(Boolean).map((d) => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe')) : [])];
  for (const p of c) if (p && fs.existsSync(p)) return p;
  throw new Error('Chrome not found (set CHROME=/path/to/chrome)');
}
// the platform's own ANGLE back end: Metal on macOS, Direct3D 11 on Windows
const ANGLE = process.platform === 'win32' ? 'd3d11' : 'metal';
async function startChrome() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cmw-quality-'));
  const ch = spawn(chromePath(), ['--headless=new', `--use-angle=${ANGLE}`, `--user-data-dir=${prof}`, `--disk-cache-dir=${path.join(prof, 'cache')}`, '--remote-debugging-pipe',
    '--no-first-run', '--no-default-browser-check', '--ignore-gpu-blocklist', '--enable-gpu', '--hide-scrollbars=false', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const wr = ch.stdio[3], rd = ch.stdio[4];
  wr.on('error', () => { /* the browser went away: reported through 'exit' */ });
  let id = 0, buf = '';
  const pend = new Map(), logs = [];
  rd.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\0')) >= 0) {
      const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (msg.id && pend.has(msg.id)) { const { res, rej } = pend.get(msg.id); pend.delete(msg.id); if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result); }
      else if (msg.method === 'Runtime.exceptionThrown') logs.push('EXC ' + ((msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description) || msg.params.exceptionDetails.text).slice(0, 300));
      else if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) logs.push(msg.params.type + ' ' + msg.params.args.map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type)).join(' ').slice(0, 300));
    }
  });
  let S = null, dead = null;
  // a crashed browser or a page that never answers fails the run instead of hanging the suite
  ch.on('exit', (code, sig) => { dead = `Chrome exited (${code ?? sig})`; for (const { rej } of pend.values()) rej(new Error(dead)); pend.clear(); });
  const send = (method, params = {}, sess = S) => new Promise((res, rej) => {
    if (dead) { rej(new Error(dead)); return; }
    const m = { id: ++id, method, params }; if (sess) m.sessionId = sess;
    const t = setTimeout(() => { if (pend.delete(m.id)) rej(new Error(`no answer to ${method} within 90 s`)); }, 90000);
    pend.set(m.id, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
    wr.write(JSON.stringify(m) + '\0');
  });
  const ver = await send('Browser.getVersion', {}, null);
  const t = await send('Target.createTarget', { url: 'about:blank' }, null);
  S = (await send('Target.attachToTarget', { targetId: t.targetId, flatten: true }, null)).sessionId;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: VIEWPORT.dpr, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
  const ev = async (expr, awaitPromise = false) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise, timeout: 60000 });
    if (r.exceptionDetails) throw new Error('page: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
    return r.result.value;
  };
  const close = () => { try { ch.kill(); } catch (e) { /* gone */ } setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { /* busy */ } }, 500); };
  return { send, ev, logs, close, version: ver.product };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// in-page helpers: a hash of the right canvas (read through a scratch canvas, so the app's own canvas is never read back
// repeatedly), whether the app reports work in progress, and the final capture
const PAGE_HELPERS = `window.__qreg = {
  snap() {
    const c = document.getElementById('canvasR');
    if (!c || !c.width) return null;
    let s = window.__qregScratch;
    if (!s || s.width !== c.width || s.height !== c.height) { s = window.__qregScratch = document.createElement('canvas'); s.width = c.width; s.height = c.height; }
    const x = s.getContext('2d', { willReadFrequently: true });
    x.globalCompositeOperation = 'copy';
    x.drawImage(c, 0, 0);
    return x.getImageData(0, 0, s.width, s.height).data;
  },
  hash() {
    const d = this.snap(); if (!d) return 'none';
    const u = new Uint32Array(d.buffer); let h = 2166136261 >>> 0, g = 0;
    for (let i = 0; i < u.length; i++) { h = Math.imul(h ^ u[i], 16777619) >>> 0; g = (g + u[i]) >>> 0; }
    return h.toString(16) + ':' + g.toString(16) + ':' + u.length;
  },
  busy() {
    const led = document.getElementById('rightLed');
    const st = typeof GLR !== 'undefined' && GLR.frameStatus ? GLR.frameStatus() : null;
    return { led: led ? led.className : '', pending: !!(st && st.pending), glErr: st && st.error || '' };
  },
  capture() {
    const c = document.getElementById('canvasR');
    const r = c.getBoundingClientRect();
    const d = this.snap();
    let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
    const geo = { w: c.width, h: c.height, rect: [r.left, r.top, r.width, r.height], dpr: devicePixelRatio };
    if (typeof __cmwW2S === 'function') { geo.o = __cmwW2S('R', 0, 0); geo.x1 = __cmwW2S('R', 1, 0); geo.y1 = __cmwW2S('R', 0, 1); }
    const cs = getComputedStyle(document.documentElement), colors = {};
    for (const k of ['--plane', '--c1', '--c1-alt', '--c1-edge', '--grid-minor', '--grid-medium', '--grid-major', '--axis', '--halo', '--cut', '--ink']) colors[k] = cs.getPropertyValue(k).trim();
    let cellCheck = null, clipWin = null;
    try {
      // the app's own pattern-cell rule (bbox of bounded areas, else the meshing window) for a cross-check
      const st = JSON.parse(localStorage.getItem('complex-map-workbench-v1:' + new URLSearchParams(location.search).get('ns')) || 'null');
      if (st && typeof Region !== 'undefined' && typeof Axes !== 'undefined') {
        let size = 0;
        for (const sh of st.shapes) { if (Region.KINDS[sh.kind].type !== 'area') continue; const b = Region.bboxOf(sh); if (b) size = Math.max(size, b.x1 - b.x0, b.y1 - b.y0); }
        if (!size && st.clipWin) size = Math.max(st.clipWin.x1 - st.clipWin.x0, st.clipWin.y1 - st.clipWin.y0);
        cellCheck = Axes.niceStep(size / 10) * (st.patternScale || 1);
      }
      if (st && st.clipWin) clipWin = st.clipWin;
    } catch (e) { cellCheck = null; }
    let info = null; try { info = typeof __cmwInfo === 'function' ? __cmwInfo() : null; } catch (e) { info = null; }
    return { b64: btoa(s), geo, colors, cellCheck, clipWin, info, title: document.title };
  },
};`;

async function renderRun(B, run, opt) {
  const ns = 'qreg-' + run.id.replace(/[^a-z0-9_-]/gi, '_');
  const key = 'complex-map-workbench-v1:' + ns;
  // the saved state is written before any app script runs (fresh profile, own namespace per scene)
  const seeded = 'qreg-seeded:' + ns;
  // (v15: the app's chain is 188 px; the scenes keep the v14 pane geometry, a 272 px chain, through the test hook)
  const inj = await B.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__cmwChainH = 272; if (new URLSearchParams(location.search).get('ns') === ${JSON.stringify(ns)} && !sessionStorage.getItem(${JSON.stringify(seeded)})) { localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(run.state))}); sessionStorage.setItem(${JSON.stringify(seeded)}, '1'); }` });
  const t0 = Date.now();
  B.logs.length = 0;
  await B.send('Page.navigate', { url: `${opt.base}/test.html?ns=${ns}` });
  // wait for the app, then until the right canvas stops changing and nothing is in progress
  let last = null, since = 0, settled = false, hashes = 0, lastBusy = null;
  const deadline = t0 + opt.timeoutMs;
  await sleep(600);
  while (Date.now() < deadline) {
    let h = null, busy = null;
    try {
      if (!(await B.ev(`typeof window.__qreg === 'object'`))) await B.ev(PAGE_HELPERS + ' true');
      const r = await B.ev(`({ h: __qreg.hash(), b: __qreg.busy(), ready: typeof __cmwState === 'function' })`);
      h = r.ready ? r.h : null; busy = r.b;
    } catch (e) { h = null; }
    const now = Date.now();
    lastBusy = busy;
    if (h && h !== 'none' && h === last) {
      if (now - since >= opt.stableMs && busy && !/\bbusy\b/.test(busy.led) && !busy.pending) { settled = true; break; }
    } else { last = h; since = now; hashes++; }
    await sleep(200);
  }
  await B.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
  if (!(await B.ev(`typeof window.__qreg === 'object'`))) await B.ev(PAGE_HELPERS + ' true');
  const cap = await B.ev('__qreg.capture()');
  const rgba = Buffer.from(cap.b64, 'base64'); delete cap.b64;
  const settleMs = since - t0;
  return { cap, rgba, settled, settleMs, hashes, ns, logs: B.logs.slice(), busy: lastBusy };
}

// r: {rgba, cap: {geo, colors, cellCheck, info}, settled, settleMs, logs, busy}
function evalRun(run, r, outDir, writeRender = true) {
  const { cap, rgba } = r;
  const W = cap.geo.w, H = cap.geo.h;
  const out = { id: run.id, scene: run.scene.name, variant: run.variant, group: run.scene.group, golden: run.golden, note: run.scene.note, truth: run.scene.truth.desc, ok: true, problems: [] };
  // runs added for SPEC 12.4 record how they were scored (the original mask / pattern runs keep their format)
  if (run.strict) Object.assign(out, { classifier: run.kind, parity_mode: run.parity, alpha: run.alpha, strict: true });
  if (writeRender) fs.writeFileSync(path.join(outDir, 'renders', run.id + '.png'), PNG.encode(W, H, rgba));
  if (!r.settled) out.problems.push(`did not settle within the timeout (last change at ${r.settleMs} ms)`);
  let viewKnown = true;
  if (!cap.geo.o) {
    // no __cmwW2S hook: assume the pinned view (centered in the canvas) and say so
    const v = run.scene.rightView, [L, T, RW, RH] = cap.geo.rect;
    cap.geo.o = [L + RW / 2 - v.cx * v.s, T + RH / 2 + v.cy * v.s]; cap.geo.x1 = [cap.geo.o[0] + v.s, cap.geo.o[1]]; cap.geo.y1 = [cap.geo.o[0], cap.geo.o[1] - v.s];
    viewKnown = false;
    out.problems.push('no __cmwW2S hook: the pinned right view is assumed, not verified');
  }
  const map = M.pixelMap(cap.geo);
  const want = run.scene.rightView;
  const dv = Math.max(Math.abs(map.view.cx - want.cx) * want.s, Math.abs(map.view.cy - want.cy) * want.s, Math.abs(map.view.s / want.s - 1) * W);
  if (dv > 0.5) out.problems.push(`right view differs from the pinned view by ${dv.toFixed(2)} px (got ${JSON.stringify(map.view)})`);
  if (cap.cellCheck != null && Math.abs(cap.cellCheck / run.cell - 1) > 1e-9) out.problems.push(`pattern cell: the app's rule gives ${cap.cellCheck}, the truth uses ${run.cell}`);
  // the sheet order of the truth (SPEC 5.1) uses the saved meshing window: the app must still use it
  if (run.sheet && cap.clipWin) {
    const a = cap.clipWin, b = run.sheet.win, sz = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    if (['x0', 'x1', 'y0', 'y1'].some((k) => !(Math.abs(a[k] - b[k]) <= 1e-6 * sz))) out.problems.push(`clipWin: the app uses ${JSON.stringify(a)}, the truth's sheet order ${JSON.stringify(b)}`);
  }
  const truthG = M.truthGrid(run.scene.truth, run.cell, map, W, H, { parity: run.parity, sheet: run.sheet, rc: run.rc, annot: run.strict });
  const classify = M.makeClassifier(cap.colors, run.kind);
  const ev = M.evaluate({ rgba, W, H, truthG, classify, variant: run.kind, parity: run.parity, opacity: run.opacity ? M.makeOpacity(cap.colors) : null,
    strict: run.strict, colorErr: run.strict ? M.makeColorErr(cap.colors, run.kind) : null, cellColor: run.cellErr ? M.makeCellColor(cap.colors) : null });
  fs.writeFileSync(path.join(outDir, 'maps', run.id + '.png'), PNG.encode(W, H, ev.map));
  out.metrics = ev.metrics;
  out.problems.push(...ev.problems);
  if (run.golden) {
    const gp = path.join(GOLDEN, run.id + '.png');
    if (fs.existsSync(gp)) {
      const g = PNG.decode(fs.readFileSync(gp));
      if (g.w !== W || g.h !== H) { out.metrics.golden_diff = 1; out.problems.push(`golden is ${g.w}x${g.h}, render is ${W}x${H}`); }
      else {
        const gd = M.goldenDiff(rgba, g.data, W, H, GOLDEN_THR);
        out.metrics.golden_diff = gd.frac;
        fs.writeFileSync(path.join(outDir, 'golden_diff', run.id + '.png'), PNG.encode(W, H, gd.map));
      }
    } else { out.metrics.golden_diff = null; out.problems.push('no golden PNG yet (run with --accept to create it)'); }
  }
  out.view = { cx: +map.view.cx.toPrecision(10), cy: +map.view.cy.toPrecision(10), s: +map.view.s.toPrecision(10), w: W, h: H, dpr: cap.geo.dpr };
  out.cell = run.cell;
  out.sdf = truthG.sdfKind;
  out.capture = { geo: cap.geo, colors: cap.colors };   // enough to recompute the metrics from the render (--reeval)
  if (run.strict && cap.clipWin) out.capture.clipWin = cap.clipWin;
  out.settle_ms = r.settleMs;
  out.settled = r.settled;
  out.render_sha1 = crypto.createHash('sha1').update(rgba).digest('hex');
  if (cap.info) out.gpu = cap.info;
  const exc = r.logs.filter((l) => l.startsWith('EXC'));
  if (exc.length) out.problems.push('page exceptions: ' + exc.slice(0, 3).join(' | '));
  if (r.busy && r.busy.glErr) out.problems.push('GL error: ' + r.busy.glErr);
  out.view_verified = viewKnown;
  out.ok = r.settled && !(r.busy && r.busy.glErr) && !out.problems.some((p) => p.startsWith('right view'));
  return out;
}

function writeIndex(outDir, met) {
  const rows = Object.values(met.runs).map((r) => {
    const m = r.metrics || {};
    const f = (k, d = 4) => (m[k] == null ? '' : typeof m[k] === 'number' ? m[k].toFixed(d) : m[k]);
    const gd = r.golden ? `<img src="golden_diff/${r.id}.png">` : '';
    return `<tr><td><b>${r.id}</b><br><small>${r.note}<br>truth: ${r.truth}</small><br><small>IoU ${f('iou')} · holes ${f('hole')} · spill ${f('spill')} · bnd ${f('bnd_err_px', 2)} px${m.parity_acc != null ? ` · ${r.parity_mode === 'polar' ? 'polar ' : ''}parity ${f('parity_acc')} (excl ${f('parity_excl', 3)})` : ''}${m.opacity_min != null ? ` · opacity min ${f('opacity_min', 3)} (p01 ${f('opacity_p01', 3)})` : ''}${m.color_off != null ? ` · colour off ${f('color_off', 4)}` : ''}${m.hole_leak != null ? ` · hole leak ${m.hole_leak}/${m.hole_leak_px} px` : ''}${r.golden ? ` · golden ${f('golden_diff', 5)}` : ''}</small>${r.problems.length ? `<br><small style="color:#b00">${r.problems.join('<br>')}</small>` : ''}</td><td><img src="renders/${r.id}.png"></td><td><img src="maps/${r.id}.png"></td><td>${gd}</td></tr>`;
  }).join('\n');
  fs.writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Image quality run</title>
<style>body{font:13px system-ui;margin:16px}td{vertical-align:top;padding:4px}img{width:205px;border:1px solid #ccc}td:first-child{width:260px}</style>
<p>${met.meta.date} · ${met.meta.browser} · app ${met.meta.app_sha1.slice(0, 12)} · map: green ok, red hole, blue spill, purple wrong parity, orange fill in a wrong colour (SPEC 12.4 runs), grey band (excluded), yellow strokes, pale green not scored for parity</p>
<table><tr><th>run</th><th>render</th><th>map</th><th>golden diff</th></tr>${rows}</table>\n`);
}

async function main() {
  const opt = args();
  if (opt.accept) { accept(opt.accept); return; }
  if (opt.reeval) { reeval(opt.reeval); return; }
  const runs = SC.runs(opt.only);
  // sensitivity checks only: merge a JSON object into every scene's saved state (e.g. '{"meshN": 80}')
  if (opt.override) for (const r of runs) Object.assign(r.state, opt.override);
  if (!runs.length) { console.error('no scenes match ' + opt.only); process.exit(2); }
  for (const d of ['renders', 'maps', 'golden_diff']) { fs.rmSync(path.join(opt.out, d), { recursive: true, force: true }); fs.mkdirSync(path.join(opt.out, d), { recursive: true }); }
  const appFile = path.join(ROOT, 'dist', 'test.html');
  const appSha = fs.existsSync(appFile) ? crypto.createHash('sha1').update(fs.readFileSync(appFile)).digest('hex') : 'unknown';
  try { const r = await fetch(opt.base + '/test.html'); if (!r.ok) throw new Error('HTTP ' + r.status); } catch (e) {
    console.error(`the app is not served at ${opt.base}/test.html (${e.message}); start the static server for dist/ first`); process.exit(2);
  }
  const B = await startChrome();
  const met = { meta: { suite: 'cmw-image-quality', version: 1, date: new Date().toISOString(), browser: B.version, viewport: VIEWPORT, base_url: opt.base, app_sha1: appSha,
    band_px: M.BAND, parity_min_cell_px: M.PARITY_MIN_CELL, parity_min_edge_px: M.PARITY_MIN_EDGE, golden_thr: GOLDEN_THR, stable_ms: opt.stableMs }, runs: {} };
  if (opt.override) met.meta.state_override = opt.override;
  const t0 = Date.now();
  try {
    for (const run of runs) {
      const t1 = Date.now();
      let res;
      try {
        const r = await renderRun(B, run, opt);
        res = evalRun(run, r, opt.out);
      } catch (e) {
        res = { id: run.id, scene: run.scene.name, variant: run.variant, group: run.scene.group, golden: run.golden, note: run.scene.note, truth: run.scene.truth.desc, ok: false, problems: ['runner error: ' + (e.stack || e).toString().split('\n')[0]] };
      }
      met.runs[run.id] = res;
      const m = res.metrics || {};
      const f = (k) => (m[k] == null ? '   -   ' : m[k].toFixed(4));
      console.log(`${res.ok ? 'ok ' : 'ERR'} ${run.id.padEnd(26)} IoU ${f('iou')} hole ${f('hole')} spill ${f('spill')} bnd ${m.bnd_err_px == null ? '-' : m.bnd_err_px.toFixed(2).padStart(7)}px` +
        (m.parity_acc != null ? ` ${res.parity_mode === 'polar' ? 'polar-' : ''}parity ${f('parity_acc')} excl ${f('parity_excl')}` : '') + (res.golden ? ` golden ${m.golden_diff == null ? 'none' : m.golden_diff.toFixed(5)}` : '') +
        (m.opacity_min != null ? ` opacity min ${f('opacity_min')} p01 ${f('opacity_p01')}` : '') + (m.color_off != null ? ` colour-off ${f('color_off')}` : '') + (m.hole_leak != null ? ` hole_leak ${m.hole_leak}/${m.hole_leak_px}` : '') +
        ` (${((Date.now() - t1) / 1000).toFixed(1)}s)` + (res.problems.length ? '  ! ' + res.problems.join('; ') : ''));
    }
  } finally { B.close(); }
  met.meta.wall_s = +((Date.now() - t0) / 1000).toFixed(1);
  fs.writeFileSync(path.join(opt.out, 'metrics.json'), JSON.stringify(met, null, 1) + '\n');
  writeIndex(opt.out, met);
  console.log(`\n${runs.length} runs in ${met.meta.wall_s}s -> ${path.relative(process.cwd(), path.join(opt.out, 'metrics.json'))}`);
  if (Object.values(met.runs).some((r) => !r.ok)) process.exitCode = 1;
}
main().catch((e) => { console.error(e.stack || e); process.exit(1); });
