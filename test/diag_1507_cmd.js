// TEMPORARY (#1507 diagnosis, deleted before the pull request): GLR.evalMap against __cmwEval('cpuMap') for the pieces
// of sin∘√'s glide on this machine's renderer, each reported as a row (the job log shows them): which map, which t,
// which source plane gives non-finite GPU values. A command file for a CDP daemon.
const rows = [];
const note = (name, got) => rows.push({ name, got });
let s = 9;
const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
await view(1440, 900, false);
note('renderer', await ev("(() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : null; })()"));
const CH = {
  sinsqrt: [{ type: 'root', params: { n: 2 }, on: true }, { type: 'sin', params: {}, on: true }],
  sin: [{ type: 'sin', params: {}, on: true }],
  sinh: [{ type: 'sinh', params: {}, on: true }],
  tan: [{ type: 'tan', params: {}, on: true }],
  sinhsqrt: [{ type: 'root', params: { n: 2 }, on: true }, { type: 'sinh', params: {}, on: true }],
  expsqrt: [{ type: 'root', params: { n: 2 }, on: true }, { type: 'exp', params: {}, on: true }],
  sinexp: [{ type: 'exp', params: {}, on: true }, { type: 'sin', params: {}, on: true }],
};
const cmp = (m, pts) => ev(`(() => { const m = ${JSON.stringify(m)}, pts = ${JSON.stringify(pts)}; let g = null, err = null; try { g = GLR.evalMap(m, pts); } catch (e) { err = String(e); } const c = __cmwEval('cpuMap', m, pts); if (!g) return { err: err || 'no gpu' }; let worst = 0, k = 0, nf = 0, nan = 0, inf = 0; const raw = []; c.forEach((w, i) => { const gx = g[2 * i], gy = g[2 * i + 1]; if (i < 3) raw.push([pts[i], w, [gx, gy]]); if (!isFinite(gx) || !isFinite(gy)) { nf++; if (Number.isNaN(gx) || Number.isNaN(gy)) nan++; else inf++; return; } if (!w) return; k++; worst = Math.max(worst, Math.hypot(gx - w[0], gy - w[1]) / (1 + Math.hypot(w[0], w[1]))); }); return { k, nf, nan, inf, worst, raw }; })()`);
for (const [name, steps] of Object.entries(CH)) {
  const box = name === 'sinsqrt' || name.endsWith('sqrt') ? [0.2, 30, -2, 2] : [-2, 2, -1.5, 1.5];
  await load('diag' + name + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [box[0], box[2]], b: [box[1], box[3]] }], steps, srcView: { cx: 0, cy: 0, s: 60 } });
  await sleep(900);
  const pts = Array.from({ length: 32 }, () => [box[0] + (box[1] - box[0]) * rnd(), box[2] + (box[3] - box[2]) * rnd()]);
  const n = steps.length;
  await ev("__cmwSteps({ order: 'steps', span: null })");
  await ev(`__cmwSteps({ x: ${n - 0.5} })`);
  const between = await ev('__cmwSteps().between');
  note(`${name}: between at x ${n - 0.5}`, between);
  for (const t of [0.1, 0.25, 0.5, 0.75, 0.9, 0.999]) note(`${name}: mode 1 hi ${n} t ${t}`, await cmp(Object.assign({}, between, { t }), pts));
  note(`${name}: mode 0 0..${n}`, await cmp({ mode: 0, a: 0, b: n }, pts));
  if (n > 1) {
    note(`${name}: mode 0 1..${n}`, await cmp({ mode: 0, a: 1, b: n }, pts));
    note(`${name}: mode 1 hi ${n} t 0.5 from plane ${n - 1}`, await cmp(Object.assign({}, between, { t: 0.5, base: n - 1 }), pts));
    note(`${name}: mode 1 hi 1 t 0.5 (+post)`, await cmp(Object.assign({}, between, { hi: 1, t: 0.5 }), pts));
    note(`${name}: mode 3 0..${n} t 0.5`, await cmp({ mode: 3, a: 0, b: n, t: 0.5 }, pts));
  }
}
return { pass: false, nfails: rows.length, fails: rows, info: {} };
