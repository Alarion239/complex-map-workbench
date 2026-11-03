// P3 acceptance (notes/sphere-design/SPEC.md 12.4 (h)): the figure export of z^i(H) at 300 dpi, exact and equal to the
// screen scaled; a cancelled export returns at once; the Export figure dialog's options changed while a figure is made.
// The other P3 acceptance checks are test/p3_accept_cmd.js.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/p3_accept_export_cmd.js
// Prints {pass, fails, results}; pass is true when every check holds.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const base = { pattern: 'solid', alpha: 1, lines: false, unit: false };
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
const ZI = { type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true };
const settle = async (ms = 2500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
await view(1440, 900, false);

// ---- (h) the figure export at 300 dpi of z^i(H): exact (the analytic annulus) and equal to the screen scaled;
// a cancelled export returns at once and never blocks the main thread for more than 50 ms
await load('p3h' + Date.now(), Object.assign({ shapes: [H], steps: [ZI], srcView: { cx: 0, cy: 1, s: 60 } }, base));
await settle();
R.h = await ev(`await (async () => {
  const lk = __cmwLook('s1', 'R'), cv = document.getElementById('canvasR'), rr = cv.getBoundingClientRect();
  const dpr = 300 / 96, w = rr.width, h = rr.height;
  const url = __cmwRenderOff('R', w, h, dpr);
  const img = new Image(); img.src = url; await img.decode();
  const g = document.createElement('canvas'); g.width = img.width; g.height = img.height; const x = g.getContext('2d'); x.drawImage(img, 0, 0);
  const E = x.getImageData(0, 0, g.width, g.height).data, EW = g.width, EH = g.height;
  const g2 = document.createElement('canvas'); g2.width = cv.width; g2.height = cv.height; const x2 = g2.getContext('2d'); x2.drawImage(cv, 0, 0);
  const D = x2.getImageData(0, 0, g2.width, g2.height).data, SW = g2.width, SH = g2.height;
  const fill = (A, k) => A[4 * k] < 0.6 * A[4 * k + 2] && A[4 * k + 2] > 60;
  const e = Math.exp(-Math.PI), v = lk.view;
  // the export against the truth (outside 4 screen px of the rims, where the strokes are)
  const se = v.s * w / w * dpr;   // export px per unit (the view scaled with the panel: same window)
  let n = 0, bad = 0, inter = 0, uni = 0;
  for (let j = 0; j < EH; j++) for (let i = 0; i < EW; i++) {
    const wr = v.cx + (i + 0.5 - EW / 2) / se, wi = v.cy - (j + 0.5 - EH / 2) / se, a = Math.hypot(wr, wi);
    if (Math.min(Math.abs(a - 1), Math.abs(a - e)) * v.s < 4) continue;
    const t = a > e && a < 1, f = fill(E, j * EW + i);
    n++; if (t !== f) bad++;
  }
  // the screen against the export sampled at screen pixel centres
  const ss = v.s * lk.dpr;
  for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
    const wr = v.cx + (i + 0.5 - SW / 2) / ss, wi = v.cy - (j + 0.5 - SH / 2) / ss, a = Math.hypot(wr, wi);
    if (Math.min(Math.abs(a - 1), Math.abs(a - e)) * v.s < 4) continue;
    const ei = Math.min(EW - 1, Math.floor((i + 0.5) / SW * EW)), ej = Math.min(EH - 1, Math.floor((j + 0.5) / SH * EH));
    const fs = fill(D, j * SW + i), fe = fill(E, ej * EW + ei);
    if (fs && fe) inter++; if (fs || fe) uni++;
  }
  return { EW, EH, dpiOk: Math.abs(EW / w - 300 / 96) < 0.01, n, bad, truthErr: bad / Math.max(1, n), iou: uni ? inter / uni : 1 };
})()`);
ok('(h) the export is 300 dpi', R.h.dpiOk, R.h);
ok('(h) the export is exact (fill = annulus away from the strokes)', R.h.n > 100000 && R.h.truthErr <= 1e-4, R.h);
ok('(h) the export equals the screen scaled, IoU >= 0.999', R.h.iou >= 0.999, R.h);
// cancellation: a new chain (its inverse program compiles: prepareExport waits), cancelled after 40 ms
await load('p3hc' + Date.now(), Object.assign({ shapes: [H, { id: 's2', kind: 'disc', c: [0.4, 0.8], r: 0.3 }], steps: [ZI, { type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 1, s: 60 } }, base));
// (MathJax started: its own start, after the first paint, is not the export's main-thread time, #288)
for (let i = 0; i < 80 && !(await ev('!!(window.MathJax && MathJax.startup && MathJax.startup.document)')); i++) await sleep(250);
await sleep(30);
R.hc = await ev(`await (async () => {
  const long = [];
  const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) long.push(Math.round(e.duration)); });
  try { po.observe({ type: 'longtask' }); } catch (e) {}
  let live = true; const t0 = performance.now();
  setTimeout(() => { live = false; }, 40);
  const res = await __cmwBuildFigure({ alive: () => live });
  const t1 = performance.now();
  await new Promise((r) => setTimeout(r, 60));
  po.disconnect();
  // the full export afterwards (not cancelled): its time
  const t2 = performance.now(); const f = await __cmwBuildFigure({}); const t3 = performance.now();
  return { cancelled: res === null, returnedMs: Math.round(t1 - t0), longTasks: long, fullMs: Math.round(t3 - t2), fullOk: !!(f && f.svg && f.svg.length > 1000) };
})()`);
ok('(h) a cancelled export returns null soon after the cancel', R.hc.cancelled && R.hc.returnedMs < 40 + 80, R.hc);
ok('(h) no main-thread task over 50 ms while preparing and cancelling', (R.hc.longTasks || [null]).every((d) => d !== null && d <= 50), R.hc);
ok('(h) the export completes when not cancelled', R.hc.fullOk, R.hc);

// the dialog: options toggled while a figure is being made (each change cancels the one in progress): the last one
// wins, and no main-thread task over 50 ms meanwhile (after the first preview, whose caption typesetting is MathJax's).
// (v14: the Export figure dialog of the export redesign, notes/export-design/AS-BUILT.md. The old dialog's width
// switch, 3.4 in / 7 in, is now Columns, 1 / 2, in the Article preset.)
const dlgReady = async () => { for (let i = 0; i < 120; i++) { await sleep(150); const r = await ev(`(() => { const d = __cmwFig.dialog(); return !!(d && d.fig && !d.building); })()`); if (r === true) return true; } return false; };
await key('e', 4);
R.dlgFirst = await dlgReady();
await clickSel('#xfFor button[data-v="article"]'); await dlgReady();
await clickSel('#xfCols button[data-v="2"]'); R.dlgFirst = R.dlgFirst && await dlgReady();
R.dlg = await ev(`await (async () => {
  const long = []; const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) long.push(Math.round(e.duration)); });
  try { po.observe({ type: 'longtask' }); } catch (e) {}
  const btn = (v) => document.querySelector('#xfCols button[data-v="' + v + '"]');
  const seq = ['1', '2', '1', '2', '1'];
  for (const v of seq) { btn(v).click(); await new Promise((r) => setTimeout(r, 15)); }
  for (let i = 0; i < 200; i++) { const d = __cmwFig.dialog(); if (d && d.fig && !d.building) break; await new Promise((r) => setTimeout(r, 50)); }
  await new Promise((r) => setTimeout(r, 100));
  po.disconnect();
  const d = __cmwFig.dialog(), on = document.querySelector('#xfCols [aria-checked="true"]');
  return { long, cols: d && d.fig ? d.fig.cols : null, checked: on ? on.dataset.v : null, last: !!(d && d.fig && String(d.fig.cols) === '1' && on && on.dataset.v === '1'), building: !!(d && d.building) };
})()`, 60000);
await key('Escape'); await sleep(300);
ok('(h) the dialog: the last option wins', R.dlgFirst && R.dlg.last, R.dlg);
ok('(h) the dialog: no main-thread task over 50 ms while options change', (R.dlg.long || [null]).every((d) => d !== null && d <= 50), R.dlg);

R.logs = logs().filter((l) => /error|exception/i.test(l.t) && !/404/.test(l.m)).slice(0, 6);
ok('no console errors', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
