// The float64 reference renderer Inverse.renderCPU (SPEC 3.9) scored with the quality suite's own metrics and truth,
// SPEC 12.1 (g) reference renders, (h) golden emulation, (i) spherical checker.
// Run: node test/t_inverse_render.js [--quick] [--png DIR]   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
const Inverse = require('../src/inverse.js');
const Q = require('./regress/quality/scenes.js');
const MET = require('./regress/quality/metrics.js');
const C = CX.C;
const PI = Math.PI, TAU = 2 * PI;
const W = 410, H = 516;
const QUICK = process.argv.includes('--quick');
const PNG_DIR = process.argv.includes('--png') ? process.argv[process.argv.indexOf('--png') + 1] : null;
let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, info); } }
const t0All = Date.now();
// (a scene's steps as the app holds them, a repeat on its block's last step included: Funcs.applyRepeats)
const St = (s) => Object.assign({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params || {}), on: true }, s.repeat ? { repeat: Object.assign({}, s.repeat) } : {});
const builtOf = (steps) => Funcs.applyRepeats(steps, steps.map((st) => Funcs.build(st)));
function planOf(stepList) {
  const steps = stepList.map(St);
  return Inverse.planChain(steps, builtOf(steps));
}
const savePng = (name, rgba) => {
  if (!PNG_DIR) return;
  const fs = require('fs'), path = require('path'), PNG = require('./regress/quality/pngio.js');
  fs.mkdirSync(PNG_DIR, { recursive: true });
  fs.writeFileSync(path.join(PNG_DIR, name + '.png'), PNG.encode(W, H, Buffer.from(rgba.buffer)));
};
const cabs = (w) => Math.hypot(w.re, w.im);
const pixelAt = (view) => (i, j) => C(view.cx + (i + 0.5 - W / 2) / view.s, view.cy - (j + 0.5 - H / 2) / view.s);
// one render of a scene (plan, shape list, the left view's window as clipWin)
function render(sc, view, pattern, opts = {}) {
  const plan = planOf(sc.steps);
  if (!plan.ok) throw new Error(plan.reason);
  const win = sc.win || Q.boxOf(sc.srcView);
  const look = { alpha: opts.alpha ?? 1, pattern, cell: sc.cell || Q.cellOf(sc), sphN: 16 };
  return Inverse.renderCPU(plan, sc.shapes, Object.assign({ W, H, win }, view), look, null, {});
}

// ---------------------------------------------------------------------------------------------------------------
// (g) reference renders: every run of the quality suite (scenes.js runs(): mask, pattern, polar, mask85, mask20),
// scored exactly as run_quality.js scores the app, plus the zooms 12.1 (g) asks for that the suite does not render
// ---------------------------------------------------------------------------------------------------------------
console.log('--- (g) reference renders (the quality suite runs)');
// ([issue #260] a scene whose chain has no inverse plan, Φ_M's dh_disc, is drawn by the app's forward mesh: this
// renderer has nothing to draw it with. Those runs are left out here, and they must be exactly dh_disc's)
// (the globes, scenes.js SPHERE_SCENES, have no flat truth to score: left out here as in run_quality.js's metrics)
const flatRuns = Q.runs().filter((r) => !r.sphere);
const noPlan = flatRuns.filter((r) => !planOf(r.scene.steps).ok).map((r) => r.id);
check('the quality runs with no inverse plan are exactly dh_disc\'s', noPlan.join() === 'dh_disc.mask,dh_disc.pattern', noPlan.join());
const allRuns = flatRuns.filter((r) => !noPlan.includes(r.id));
for (const [base, f, variants] of [['expH', 4, ['mask', 'pattern']], ['e1z_disc', 4, ['mask', 'pattern']], ['zi_H', 16, ['polar']]]) {
  const src = Q.SCENES.find((x) => x.name === base);
  if (!src) continue;
  const sc = Object.assign({}, src, { name: `${base}_out${f}`, rightView: Object.assign({}, src.rightView, { s: src.rightView.s / f }) });
  if (allRuns.some((r) => r.scene.name === sc.name && variants.includes(r.variant))) continue;
  // the scored sheet order of SPEC 5.1 (scenes.js runs(): the saved clipWin and truth.accum), as the suite's own runs
  for (const v of variants) allRuns.push({ id: `${sc.name}.${v}`, scene: sc, variant: v, kind: Q.VARIANT_CLASS[v], parity: v === 'pattern' ? 'front' : v === 'polar' ? 'polar' : null,
    opacity: Q.VARIANT_CLASS[v] === 'mask', alpha: 1, cell: Q.cellOf(sc), extra: true,
    sheet: { win: Q.boxOf(sc.srcView), P: sc.truth.accum || [] }, rc: v === 'polar' ? Q.cellOf(sc) / 12 : 0 });
}
const kept = {};
const ziScenes = new Set();
for (const run of allRuns) {
  const sc = run.scene;
  if (QUICK && /_out4/.test(sc.name)) continue;
  const pattern = Q.VARIANTS[run.variant];
  const r = render(sc, sc.rightView, pattern, { alpha: run.alpha });
  savePng(run.id, r.rgba);
  const map = { at: pixelAt(sc.rightView), spx: sc.rightView.s };
  // sheet / rc: the truth's front member under the SPEC 5.1 order and the polar pattern's solid disc (metrics.js)
  const TG = MET.truthGrid(sc.truth, run.cell, map, W, H, { parity: run.parity, sheet: run.sheet || undefined, rc: run.rc });
  const ev = MET.evaluate({ rgba: r.rgba, W, H, truthG: TG, classify: MET.makeClassifier({}, run.kind), variant: run.kind, parity: run.parity, opacity: run.opacity ? MET.makeOpacity({}) : null });
  const m = ev.metrics;
  let extra = '';
  if (m.opacity_min !== undefined) extra += ` opacity min ${m.opacity_min.toFixed(4)}`;
  if (m.hole_leak !== undefined) extra += ` hole leak ${m.hole_leak}/${m.hole_leak_px}`;
  // z^i: every composited full-coverage sheet has the front sheet's polar parity (stats.disagree)
  if (sc.base === 'zi_H' && run.variant === 'polar') {
    let dis = 0;
    for (let k = 0; k < W * H; k++) if (r.stats.disagree[k] && TG.sdf[k] > 2.5) dis++;
    extra += ` sheets disagree ${dis}`;
    check(`${run.id}: no sheet of another polar parity`, dis === 0, `${dis}`);
    // the front sheet's own checker parity (not its colour: the polar pattern fades to c0 within cell/12 of the origin,
    // as REGION_FS does, which the colour-based suite metric counts as a parity error) against the exact parity
    let ok = 0, tot = 0;
    const at = pixelAt(sc.rightView);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (r.stats.par[k] < 0 || TG.sdf[k] <= 2.5) continue;
      const w = at(i, j), g = [Math.atan2(w.im, w.re) * 16 / TAU, -Math.log(cabs(w)) * 16 / TAU], rr = cabs(w);
      const da = Math.abs(g[0] - Math.round(g[0])) * TAU / 16 * rr * sc.rightView.s, dl = Math.abs(g[1] - Math.round(g[1])) * TAU / 16 * rr * sc.rightView.s;
      if (Math.min(da, dl) < 1.5) continue;
      tot++; if (r.stats.par[k] === ((((Math.floor(g[0]) + Math.floor(g[1])) % 2) + 2) % 2)) ok++;
    }
    extra += ` front-sheet parity ${ok}/${tot}`;
    if (tot) check(`${run.id}: front-sheet polar parity 1.0`, ok === tot, `${ok}/${tot}`);
    ziScenes.add(sc.name);
  }
  console.log(`${run.id.padEnd(26)} iou ${m.iou.toFixed(5)} hole ${m.n_hole} spill ${m.n_spill}${m.parity_n ? ` parity ${m.parity_acc.toFixed(5)} (n ${m.parity_n})` : ''} | leaves/px ${r.stats.visited.toFixed(2)} cover/px ${r.stats.covering.toFixed(2)} max entries ${r.stats.maxEntries} tail px ${r.stats.tailPx} | ${r.stats.ms} ms${extra}`);
  check(`${run.id}: eligible`, r.stats.skipped === 0, JSON.stringify(r.stats.reasons));
  check(`${run.id}: IoU >= 0.9999, no holes, no spill`, m.iou >= 0.9999 && m.n_hole === 0 && m.n_spill === 0, JSON.stringify({ iou: m.iou, hole: m.n_hole, spill: m.n_spill }));
  // checker parity >= 0.9999 (12.1 (g)). The suite's colour-based polar parity reads 0.9991 (zi_H) and 0.9989 (zi_H_out4)
  // for this exact renderer: every miss is a front sheet within cell/12 of the origin, which the polar pattern fades to
  // c0 by design (REGION_FS, SPEC 6.2); the front-sheet parity above is the 12.1 (g) criterion, this is only a floor
  if (m.parity_n) check(`${run.id}: parity (${run.parity})`, m.parity_acc >= (run.parity === 'polar' ? 0.998 : 0.9999), `${m.parity_acc} (n ${m.parity_n})`);
  // (a single sheet, as artanh's strip, composites to its own alpha: there the opacity must be that alpha everywhere, no
  // half-covered band where float32 saturates: P2 review)
  const wantO = run.scene.group === 'saturation' ? run.alpha - 0.005 : 0.99;
  if (m.opacity_min !== undefined) check(`${run.id}: opacity >= ${wantO}`, m.opacity_min >= wantO, `${m.opacity_min}`);
  if (m.hole_leak !== undefined) check(`${run.id}: hole leak 0`, m.hole_leak === 0, `${m.hole_leak}`);
  kept[run.id] = { r, TG };
}
check('z^i polar runs scored', ziScenes.size >= 2, [...ziScenes].join(' '));
// mask20 must be among the runs for exp(H), z^i(H), e^{1/z} (opacity at infinite multiplicity, SPEC 12.4)
for (const id of ['expH.mask20', 'zi_H.mask20', 'e1z_disc.mask20']) check(`${id} rendered`, !!kept[id] || QUICK);
const NEW = Q.SCENES;

// healed cuts: [log, exp], [root 2, z^2], [root 3, z^3] on a disc crossing the cut at sub-pixel offsets
console.log('--- (g) healed cuts (twin merge)');
{
  const disc = { kind: 'disc', c: [-1, 0], r: 0.6 };
  for (const off of [0, 0.25, 0.5]) {
    const view = { cx: -1, cy: off / 150, s: 150 };
    for (const [name, steps] of [['[log, exp]', [{ type: 'log', params: { cut: 180, k: 0 } }, { type: 'exp' }]], ['[root 2, z^2]', [{ type: 'root', params: { n: 2, cut: 180, k: 0 } }, { type: 'pown', params: { n: 2 } }]],
      ['[root 3, z^3]', [{ type: 'root', params: { n: 3, cut: 180, k: 0 } }, { type: 'pown', params: { n: 3 } }]]]) {
      const plan = planOf(steps);
      const r = Inverse.renderCPU(plan, [disc], Object.assign({ W, H, win: Q.boxOf(view) }, view), { pattern: 'solid' });
      let nIn = 0, low = 0, minC = 1, nOut = 0, spill = 0;
      const at = pixelAt(view);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const w = at(i, j), d = 0.6 - Math.hypot(w.re + 1, w.im), a = r.stats.alpha[j * W + i];
        if (d > 3 / view.s) { nIn++; if (a < 0.99) low++; minC = Math.min(minC, a); } else if (d < -3 / view.s) { nOut++; if (a > 0.01) spill++; }
      }
      console.log(`offset ${off} px ${name.padEnd(14)} interior px ${nIn}, coverage < 0.99: ${low}, min ${minC.toFixed(3)}; exterior px ${nOut}, spill ${spill}`);
      check(`healed cut ${name} offset ${off}`, low === 0 && spill === 0 && nIn > 0, `low ${low} min ${minC} spill ${spill}`);
    }
  }
}

// the Λ rule (4.3): log of shapes at 32x and 64x zoom-out against the exact limits
console.log('--- (g) Λ rule at 32x and 64x zoom-out');
{
  const SH = [
    ['H', { kind: 'halfplane', a: [0, 0], b: [1, 0] }], ['Im z > 1', { kind: 'halfplane', a: [0, 1], b: [1, 1] }], ['Re z < -1', { kind: 'halfplane', a: [-1, 0], b: [-1, 1] }],
    ['Re z > 1', { kind: 'halfplane', a: [1, 1], b: [1, 0] }], ['Im z > -1 (contains 0)', { kind: 'halfplane', a: [0, -1], b: [1, -1] }],
    ['disc |z-0.5|<1 (contains 0)', { kind: 'disc', c: [0.5, 0], r: 1 }], ['disc |z-3|<1', { kind: 'disc', c: [3, 0], r: 1 }],
    ['sector apex 0, 20..100 deg', { kind: 'sector', c: [0, 0], r: 0, t1: 20, t2: 100 }], ['sector apex 1+i, 20..100 deg', { kind: 'sector', c: [1, 1], r: 0, t1: 20, t2: 100 }],
    ['complement of |z-3|<1', { kind: 'disc', c: [3, 0], r: 1, complement: true }], ['formula Re z > 1', { kind: 'formula', expr: '\\Re z > 1' }],
  ];
  // exact inside test for z = e^{u + iv} (limits for |u| beyond float64)
  const truthAt = (sh, u, v) => {
    const big = u > 700, small = u < -700, e = C(Math.cos(v), Math.sin(v));
    if (!big && !small) return Region.levelOf(sh)(C(Math.exp(u) * e.re, Math.exp(u) * e.im)) > 0;
    if (small) return Region.levelOf(sh)(C(0, 0)) > 0;
    return sh.complement || ((sh.kind === 'halfplane' || (sh.kind === 'sector' && !(sh.r > 0)) || sh.kind === 'formula') && Region.levelOf(sh)(C(1e300 * e.re, 1e300 * e.im)) > 0);
  };
  const plan = planOf([{ type: 'log', params: { cut: 180, k: 0 } }]);
  for (const f of QUICK ? [64] : [32, 64]) {
    const view = { cx: 0, cy: 0, s: 60 / f };
    for (const [name, sh] of SH) {
      const r = Inverse.renderCPU(plan, [sh], Object.assign({ W, H, win: Q.boxOf({ cx: 0, cy: 1, s: 60 }) }, view), { pattern: 'solid' });
      let spill = 0, holes = 0, px = 0, lam = 0;
      const at = pixelAt(view);
      for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
        const w = at(i, j);
        if (!(w.im > -PI && w.im <= PI)) continue;
        // skip pixels whose 3 x 3 neighbourhood straddles the true boundary (anti-aliasing)
        let ins = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = at(i + di, j + dj); if (q.im > -PI && q.im <= PI && truthAt(sh, q.re, q.im)) ins++; }
        const tIn = truthAt(sh, w.re, w.im);
        if (ins !== 0 && ins !== 9) continue;
        px++;
        if (Math.abs(w.re) > 60) lam++;
        const got = r.stats.alpha[j * W + i] > 0.5;
        if (got && !tIn) spill++;
        if (!got && tIn) holes++;
      }
      console.log(`log of ${name.padEnd(30)} out ${f}x: px ${px} (Λ rule ${lam}), spill ${spill}, holes ${holes}`);
      check(`Λ rule ${name} out ${f}x`, spill === 0 && holes === 0 && lam > 0, `spill ${spill} holes ${holes}`);
    }
  }
}

// mask20: opacity at infinite multiplicity for alpha = 0.2 (B = 16 variant, K = 16, tail closure)
console.log('--- (g) mask20 opacity');
for (const name of ['expH', 'zi_H', 'e1z_disc']) {
  const sc = NEW.find((s) => s.name === name);
  const r = render(sc, sc.rightView, 'solid', { alpha: 0.2 });
  const at = pixelAt(sc.rightView);
  let nIn = 0, minO = 1;
  for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
    const w = at(i, j);
    if (!(sc.truth.sdf(w) * sc.rightView.s > 3)) continue;
    nIn++;
    minO = Math.min(minO, r.stats.alpha[j * W + i]);
  }
  console.log(`${name.padEnd(10)} alpha 0.2: interior px ${nIn}, opacity min ${minO.toFixed(4)}, tail px ${r.stats.tailPx}`);
  check(`mask20 ${name} opacity >= 0.99`, nIn > 0 && minO >= 0.99, `${minO}`);
}

// ---------------------------------------------------------------------------------------------------------------
// (h) golden emulation: the forward draw (emulated: the region meshes as the GPU places and orders them) vs the
// inverse render of the bounded controls. Where a region covers a pixel more than once, both show the front point of
// the one sheet key the region tiling, the pre-mapped meshes and the steps view's colours share (Inverse.sheetKey:
// the point nearest the window's centre, the poles penalised, keys within TIE_D tied and ordered by the tie rule),
// which is also the forward draw's depth
// ---------------------------------------------------------------------------------------------------------------
console.log('--- (h) golden emulation');
{
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const EDGE = hex('#093B9B'), HALO = hex('#FCFDFD'), PLANE = hex('#FCFDFD');
  const LOOKF = { pattern: 'solid', c0: hex('#3B6FD4'), c1: hex('#8CABE5'), k: EDGE };
  // the forward draw: Region.buildMesh at Q = 60, the L = 4 GPU template, the 0.2-edge midpoint test, linear source
  // interpolation inside each sub-triangle, its footprint, the shared sheet key's front point per pixel (its depth,
  // PRE_KEY), alpha 1 (notes/proto/lead-inv/golden_cmp.js); rev: the order reversed, the hindmost point shown
  function forward(sc, view, pattern, rev = false) {
    const steps = sc.steps.map(St), built = builtOf(steps);
    const F = (z) => { for (const b of built) z = b.f(z); return z; };
    const win = sc.win || Q.boxOf(sc.srcView), R = Math.hypot(win.x1 - win.x0, win.y1 - win.y0) / 2;
    const kp = { win, R, rs: R / 8, sing: Inverse.keySing(planOf(sc.steps), win) };
    const mesh = Region.buildMesh(sc.shapes[0], Q.boxOf(sc.srcView), 60);
    const cell = Q.cellOf(sc), look = Object.assign({}, LOOKF, { pattern, cell });
    const col = new Float32Array(W * H * 3), cov = new Uint8Array(W * H), best = new Array(W * H);
    const L = 4, S = mesh.src, T = mesh.tri, sub = [];
    for (let i = 0; i < L; i++) for (let j = 0; i + j < L; j++) { sub.push([[i, j], [i + 1, j], [i, j + 1]]); if (i + j < L - 1) sub.push([[i + 1, j], [i + 1, j + 1], [i, j + 1]]); }
    const px = (w) => [(w.re - view.cx) * view.s + W / 2, H / 2 - (w.im - view.cy) * view.s];
    for (let t = 0; t < T.length / 3; t++) {
      const A = C(S[2 * T[3 * t]], S[2 * T[3 * t] + 1]), B = C(S[2 * T[3 * t + 1]], S[2 * T[3 * t + 1] + 1]), Cc = C(S[2 * T[3 * t + 2]], S[2 * T[3 * t + 2] + 1]);
      const at = (i, j) => C(A.re + (B.re - A.re) * i / L + (Cc.re - A.re) * j / L, A.im + (B.im - A.im) * i / L + (Cc.im - A.im) * j / L);
      for (const st of sub) {
        const s3 = st.map(([i, j]) => at(i, j)), w3 = s3.map(F);
        if (!w3.every(CX.isFin)) continue;
        const sm = C((s3[0].re + s3[1].re + s3[2].re) / 3, (s3[0].im + s3[1].im + s3[2].im) / 3), wm = F(sm);
        const e = Math.max(CX.abs(CX.sub(w3[1], w3[0])), CX.abs(CX.sub(w3[2], w3[1])), CX.abs(CX.sub(w3[0], w3[2])));
        const mean = C((w3[0].re + w3[1].re + w3[2].re) / 3, (w3[0].im + w3[1].im + w3[2].im) / 3);
        if (!(CX.abs(CX.sub(wm, mean)) <= 0.2 * e)) continue;
        const p = w3.map(px);
        const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
        const y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
        const den = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
        if (!(Math.abs(den) > 1e-12)) continue;
        const bary = (x, y) => { const l0 = ((p[1][1] - p[2][1]) * (x - p[2][0]) + (p[2][0] - p[1][0]) * (y - p[2][1])) / den, l1 = ((p[2][1] - p[0][1]) * (x - p[2][0]) + (p[0][0] - p[2][0]) * (y - p[2][1])) / den; return [l0, l1, 1 - l0 - l1]; };
        const srcAt = (b) => C(b[0] * s3[0].re + b[1] * s3[1].re + b[2] * s3[2].re, b[0] * s3[0].im + b[1] * s3[1].im + b[2] * s3[2].im);
        const o = srcAt(bary(0, 0)), dX = CX.sub(srcAt(bary(1, 0)), o), dY = CX.sub(srcAt(bary(0, 1)), o);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const b = bary(x + 0.5, y + 0.5);
          if (b[0] < -1e-12 || b[1] < -1e-12 || b[2] < -1e-12) continue;
          const z = srcAt(b), k = y * W + x, cand = { z, D: Inverse.sheetKey(kp, z, null), lam: null };
          if (best[k] && !(rev ? Inverse.front(best[k], cand) : Inverse.front(cand, best[k]))) continue;
          best[k] = cand;
          const pc = Inverse.patternColor(look, { z, dX, dY, lam: null, J: [1, 0, 0, 1] });
          col[3 * k] = pc.col[0]; col[3 * k + 1] = pc.col[1]; col[3 * k + 2] = pc.col[2]; cov[k] = 1;
        }
      }
    }
    return { col, cov };
  }
  function composite(sc, view, variant, inv, rev = false) {
    const map = { at: pixelAt(view), spx: view.s };
    const TG = MET.truthGrid(sc.truth, Q.cellOf(sc), map, W, H);
    const fw = forward(sc, view, variant === 'mask' ? 'solid' : 'checker', rev);
    const A = Buffer.alloc(W * H * 4), B = Buffer.alloc(W * H * 4);
    for (let k = 0; k < W * H; k++) {
      const d = Math.min(Math.abs(TG.sdf[k]), TG.stroke ? TG.stroke[k] : Infinity);
      const fa = fw.cov[k] ? [fw.col[3 * k], fw.col[3 * k + 1], fw.col[3 * k + 2]] : PLANE;
      const ib = [inv.rgba[4 * k] / 255, inv.rgba[4 * k + 1] / 255, inv.rgba[4 * k + 2] / 255];
      // the unchanged line renderer: 1.5 px stroke on a 3.5 px casing
      const fin = (c) => (d < 0.75 ? EDGE : d < 1.75 ? c.map((x, q) => x * 0.15 + HALO[q] * 0.85) : c);
      const ca = fin(fa), cb = fin(ib);
      for (let q = 0; q < 3; q++) { A[4 * k + q] = Math.round(255 * ca[q]); B[4 * k + q] = Math.round(255 * cb[q]); }
      A[4 * k + 3] = B[4 * k + 3] = 255;
    }
    return MET.goldenDiff(A, B, W, H);
  }
  for (const name of ['disc_cube', 'joukowski', 'annulus_log', 'poly_mobius']) {
    const sc = Q.SCENES.find((s) => s.name === name);
    for (const variant of ['mask', 'pattern']) {
      const inv = kept[`${name}.${variant}`] ? kept[`${name}.${variant}`].r : render(sc, sc.rightView, variant === 'mask' ? 'solid' : 'checker');
      const gd = composite(sc, sc.rightView, variant, inv);
      console.log(`${(name + '.' + variant).padEnd(22)} golden_diff ${(100 * gd.frac).toFixed(3)} % (${gd.n} px)`);
      check(`golden ${name}.${variant} <= 0.05 %`, gd.frac <= 0.0005, `${(100 * gd.frac).toFixed(3)} %`);
    }
  }
  // the order matters: the forward draw with the sheet order reversed is far from the inverse render (so the golden
  // checks above see which point is in front)
  {
    const sc = Q.SCENES.find((x) => x.name === 'disc_cube'), kd = kept['disc_cube.pattern'];
    const gdr = composite(sc, sc.rightView, 'pattern', kd ? kd.r : render(sc, sc.rightView, 'checker'), true);
    console.log(`disc_cube.pattern with the sheet order reversed: golden_diff ${(100 * gdr.frac).toFixed(3)} %`);
    check('the sheet order matters: reversed disc_cube.pattern > 0.1 %', gdr.frac > 0.001, `${(100 * gdr.frac).toFixed(3)} %`);
  }
  // the key is continuous: no tie class (a D of 0 over the whole window, ordered by the tie rule alone, would flip
  // sheets along the window's sides). Along a line from the window's centre out across its side, D
  // grows strictly and never faster than its Lipschitz bound 1 / (R ln 2) per unit
  {
    const sc = Q.SCENES.find((s) => s.name === 'disc_cube'), win = Q.boxOf(sc.srcView), R = Math.hypot(win.x1 - win.x0, win.y1 - win.y0) / 2;
    const kp = { win, R, rs: R / 8, sing: [] }, cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2, h = (win.x1 - cx) / 200;
    let grows = true, maxRate = 0;
    for (let i = 0; i < 400; i++) {
      const d0 = Inverse.sheetKey(kp, C(cx + i * h, cy), null), d1 = Inverse.sheetKey(kp, C(cx + (i + 1) * h, cy), null);
      if (!(d1 > d0)) grows = false;
      maxRate = Math.max(maxRate, (d1 - d0) / h);
    }
    console.log(`sheet key across the window's side: grows ${grows}, max rate ${maxRate.toFixed(5)} (bound ${(1 / (R * Math.LN2)).toFixed(5)})`);
    check('the sheet key is continuous: it grows from the window\'s centre out across its side, within 1 / (R ln 2)', grows && maxRate <= 1.0001 / (R * Math.LN2), `${grows} ${maxRate}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// (i) the spherical checker (pattern 8)
// ---------------------------------------------------------------------------------------------------------------
console.log('--- (i) spherical checker');
{
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const c0 = hex('#3B6FD4'), c1 = hex('#8CABE5');
  // fraction of c1 in a pixel (projection onto c0 -> c1)
  const tOf = (rgba, k) => { let num = 0, den = 0; for (let q = 0; q < 3; q++) { const d = c1[q] - c0[q]; num += (rgba[4 * k + q] - c0[q]) * d; den += d * d; } return num / den; };
  // parity transitions along a sampled path: positions (in path parameter) where t crosses 0.5, sub-pixel interpolated
  const crossings = (vals) => { const out = []; for (let i = 1; i < vals.length; i++) { const a = vals[i - 1] - 0.5, b = vals[i] - 0.5; if (a * b < 0) out.push(i - 1 + a / (a - b)); } return out; };
  // log(H): latitude columns at Re w = ln tan(j pi / 16)
  {
    const sc = Q.SCENES.find((s) => s.name === 'logH'), view = sc.rightView;
    const r = render(sc, view, 'sphere');
    savePng('logH.sphere', r.rgba);
    const wy = 5 * PI / 16, j = Math.round(H / 2 - (wy - view.cy) * view.s - 0.5);
    const vals = []; for (let i = 0; i < W; i++) vals.push(tOf(r.rgba, j * W + i));
    const xs = crossings(vals).map((x) => x + 0.5);                       // pixel centres at i + 0.5
    let worst = 0, matched = 0, expected = 0;
    for (let q = 1; q < 16; q++) {
      const re = Math.log(Math.tan(q * PI / 16)), x = (re - view.cx) * view.s + W / 2;
      if (x < 3 || x > W - 3) continue;
      // cells on both sides at least 3 px wide
      const wl = (Math.log(Math.tan(q * PI / 16)) - Math.log(Math.tan((q - 1) * PI / 16))) * view.s, wr = (Math.log(Math.tan((q + 1) * PI / 16)) - Math.log(Math.tan(q * PI / 16))) * view.s;
      if (!(wl >= 3 && wr >= 3)) continue;
      expected++;
      const d = Math.min(...xs.map((c) => Math.abs(c - x)));
      worst = Math.max(worst, d);
      if (d <= 0.5) matched++;
    }
    console.log(`log(H): ${expected} latitude columns in view, ${matched} within 0.5 px (worst ${worst.toFixed(3)} px), ${xs.length} crossings on the row`);
    check('sphere checker log(H) columns at ln tan(j pi/16) +- 0.5 px', expected >= 4 && matched === expected, `worst ${worst}`);
  }
  // z^i(H): longitude rings at |w| = e^{-j pi/8}
  {
    const sc = NEW.find((s) => s.name === 'zi_H'), view = sc.rightView;
    const r = render(sc, view, 'sphere');
    savePng('zi_H.sphere', r.rgba);
    const ang = -0.2, step = 0.05;                                         // a ray inside one latitude band
    const vals = [], rs = [];
    for (let t = 0; t * step / view.s < 1.2; t++) {
      const rr = t * step / view.s, x = rr * Math.cos(ang) * view.s + W / 2 - 0.5, y = H / 2 - rr * Math.sin(ang) * view.s - 0.5;
      const i = Math.round(x), j = Math.round(y);
      // bilinear sample of the rendered t value
      const fx = x - Math.floor(x), fy = y - Math.floor(y), i0 = Math.floor(x), j0 = Math.floor(y);
      const v = (1 - fx) * (1 - fy) * tOf(r.rgba, j0 * W + i0) + fx * (1 - fy) * tOf(r.rgba, j0 * W + i0 + 1) + (1 - fx) * fy * tOf(r.rgba, (j0 + 1) * W + i0) + fx * fy * tOf(r.rgba, (j0 + 1) * W + i0 + 1);
      vals.push(v); rs.push(rr);
      void i; void j;
    }
    const cr = crossings(vals).map((c) => c * step);                     // in pixels from the centre
    let worst = 0, matched = 0, expected = 0;
    for (let q = 1; q < 8; q++) {
      const rad = Math.exp(-q * PI / 8) * view.s;
      const wIn = (Math.exp(-q * PI / 8) - Math.exp(-(q + 1) * PI / 8)) * view.s, wOut = (Math.exp(-(q - 1) * PI / 8) - Math.exp(-q * PI / 8)) * view.s;
      if (!(wIn >= 3 && wOut >= 3)) continue;
      expected++;
      const d = Math.min(...cr.map((c) => Math.abs(c - rad)));
      worst = Math.max(worst, d);
      if (d <= 0.5) matched++;
    }
    console.log(`z^i(H): ${expected} longitude rings, ${matched} within 0.5 px (worst ${worst.toFixed(3)} px), ${cr.length} crossings on the ray`);
    check('sphere checker z^i rings at |w| = e^{-j pi/8} +- 0.5 px', expected >= 4 && matched === expected, `worst ${worst}`);
  }
  // Cayley(H) at w = 1 (the image of infinity): every fill pixel within 3 px is the average colour (no noise)
  {
    const sc = Q.SCENES.find((s) => s.name === 'cayley_H'), view = sc.rightView;
    const r = render(sc, view, 'sphere');
    savePng('cayley_H.sphere', r.rgba);
    const avg = [0, 1, 2].map((q) => (c0[q] + c1[q]) / 2);
    const at = pixelAt(view);
    let nn = 0, worst = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const w = at(i, j), d1 = Math.hypot(w.re - 1, w.im) * view.s, inside = (1 - cabs(w)) * view.s;
      if (d1 > 3 || inside < 1.5) continue;
      const k = j * W + i;
      nn++;
      worst = Math.max(worst, ...[0, 1, 2].map((q) => Math.abs(r.rgba[4 * k + q] - avg[q])));
    }
    console.log(`Cayley(H) at w = 1: ${nn} fill pixels within 3 px, max deviation from the average ${worst.toFixed(1)}/255`);
    check('sphere checker Cayley(H) at w = 1 is averaged (<= 4/255)', nn > 0 && worst <= 4, `${worst}`);
  }
}

console.log(`\n${n} checks, ${bad} failed (${((Date.now() - t0All) / 1000).toFixed(1)} s)`);
process.exitCode = bad ? 1 : 0;
