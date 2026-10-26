// Landscape mesh diagnosis (notes/landscape-walls): the shipped principal-branch mesher's triangle rule replayed on the
// CPU (256 x 256 vertices, triOK: all corners finite and height spread <= 0.3 H), each triangle classified by what
// its edges really hold: a JUMP (bisection keeps a height jump > 0.02 H down to 2^-40 of the edge) or CONTINUOUS.
//   hole    : dropped by the 0.3 H rule although every edge is continuous (a steep wall that should be drawn)
//   cut     : dropped, an edge holds a jump (correct)
//   curtain : drawn although an edge holds a jump (a bridging triangle across a cut)
//   nan     : dropped, a corner not finite
// Run: node test/wl_diag.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
try { global.Recognize = require('../src/recognize.js'); } catch (e) { /* optional */ }
const FN = require('../src/funcs.js');
const { C } = CX;
const mk = (steps) => {
  const S = steps.map((s, i) => ({ type: s.type, params: Object.assign(FN.defaults(s.type), s.params || {}), on: true, uid: 'f' + i }));
  const built = S.map((st) => FN.build(st));
  const fs = FN.stageFunctions(S, built);
  return { F: fs[S.length], built };
};
const cxs = (expr) => ({ type: 'custom', params: { expr, cut: 180 } });
const PANE = [868, 624];
const box = (v) => ({ x0: v.cx - PANE[0] / 2 / v.s, x1: v.cx + PANE[0] / 2 / v.s, y0: v.cy - PANE[1] / 2 / v.s, y1: v.cy + PANE[1] / 2 / v.s });
const trim = (b) => { const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2; let w = b.x1 - b.x0, h = b.y1 - b.y0; if (w > 2 * h) w = 2 * h; else if (h > 2 * w) h = 2 * w; return { x0: mx - w / 2, x1: mx + w / 2, y0: my - h / 2, y1: my + h / 2 }; };
const H = 0.55;
function heightFn(F, mode, bx) {
  const val = (w) => (mode === 're' ? w.re : mode === 'im' ? w.im : CX.abs(w));
  let mu = 1;
  if (mode !== 'log') {
    const v = [];
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const x = Math.abs(val(F(C(bx.x0 + (i + 0.5) / 32 * (bx.x1 - bx.x0), bx.y0 + (j + 0.5) / 32 * (bx.y1 - bx.y0))))); if (Number.isFinite(x)) v.push(x); }
    v.sort((a, b) => a - b); mu = v.length ? Math.max(1e-6, v[Math.floor(v.length / 2)]) : 1;
  }
  return (z) => {
    const w = F(z);
    if (!w || Number.isNaN(w.re) || Number.isNaN(w.im)) return NaN;
    const x = val(w);
    if (mode === 'log') return H * (2 / Math.PI) * Math.atan(Math.log(Math.min(Math.max(x, 1e-37), 3e38)) / 1.4);
    if (mode === 'abs') return H * ((4 / Math.PI) * Math.atan(Math.min(x / mu, 1e30)) - 1);
    if (Number.isNaN(x)) return NaN;
    return H * (2 / Math.PI) * Math.atan(Math.max(-1e30, Math.min(1e30, x / mu)));
  };
}
function jumpOn(h, a, b, ha, hb) {
  // follow the half with the larger height change; a jump survives at 2^-40 of the edge
  let p = a, q = b, hp = ha, hq = hb;
  for (let k = 0; k < 40; k++) {
    const m = C((p.re + q.re) / 2, (p.im + q.im) / 2), hm = h(m);
    if (!Number.isFinite(hm)) return 'nan';
    if (Math.abs(hm - hp) >= Math.abs(hq - hm)) { q = m; hq = hm; } else { p = m; hp = hm; }
  }
  return Math.abs(hq - hp) > 0.02 * H ? 'jump' : 'cont';
}
function diag(F, mode, bx, N = 256) {
  const h = heightFn(F, mode, bx);
  const Z = (i, j) => C(bx.x0 + i / (N - 1) * (bx.x1 - bx.x0), bx.y0 + j / (N - 1) * (bx.y1 - bx.y0));
  const hv = new Float64Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) hv[j * N + i] = h(Z(i, j));
  const ecache = new Map();
  const edge = (i0, j0, i1, j1) => {
    const k = i0 < i1 || (i0 === i1 && j0 < j1) ? `${i0},${j0},${i1},${j1}` : `${i1},${j1},${i0},${j0}`;
    let r = ecache.get(k);
    if (r === undefined) {
      const ha = hv[j0 * N + i0], hb = hv[j1 * N + i1];
      r = Math.abs(ha - hb) <= 0.02 * H ? 'cont' : jumpOn(h, Z(i0, j0), Z(i1, j1), ha, hb);
      ecache.set(k, r);
    }
    return r;
  };
  const st = { tris: 0, drawn: 0, hole: 0, cut: 0, curtain: 0, nan: 0, aDrawn: 0, aHole: 0, aCurtain: 0 };
  const BW = bx.x1 - bx.x0, BH = bx.y1 - bx.y0, Mx = Math.max(BW, BH), ax = BW / Mx, ay = BH / Mx;
  const P = (i, j, hh) => [(i / (N - 1) - 0.5) * 2 * ax, (j / (N - 1) - 0.5) * 2 * ay, hh];
  const area = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return 0.5 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]); };
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    for (const tri of [0, 1]) {
      const V = tri === 0 ? [[i, j], [i + 1, j], [i + 1, j + 1]] : [[i, j], [i + 1, j + 1], [i, j + 1]];
      const hs = V.map(([a, b]) => hv[b * N + a]);
      st.tris++;
      if (!hs.every(Number.isFinite)) { st.nan++; continue; }
      const spread = Math.max(...hs) - Math.min(...hs);
      const es = [edge(...V[0], ...V[1]), edge(...V[1], ...V[2]), edge(...V[2], ...V[0])];
      const jump = es.includes('jump');
      const A = area(...V.map(([a, b], k) => P(a, b, hs[k])));
      if (spread <= 0.3 * H) { st.drawn++; st.aDrawn += A; if (jump) { st.curtain++; st.aCurtain += A; } }
      else if (jump) st.cut++;
      else { st.hole++; st.aHole += A; }
    }
  }
  return st;
}
const CASES = [
  ['sqrt', [{ type: 'root', params: { n: 2 } }], { cx: 0, cy: 0, s: 80 }, ['im', 're', 'log']],
  ['log', [{ type: 'log' }], { cx: 0, cy: 0, s: 80 }, ['im', 'log']],
  ['tan', [{ type: 'tan' }], { cx: 0, cy: 0, s: 60 }, ['re', 'im', 'log']],
  ['recip', [{ type: 'recip' }], { cx: 0, cy: 0, s: 120 }, ['re', 'log', 'abs']],
  ['inv-z2p1', [cxs('\\frac{1}{z^2+1}')], { cx: 0, cy: 0, s: 110 }, ['re', 'im', 'log']],
  ['exp-inv', [cxs('e^{1/z}')], { cx: 0, cy: 0, s: 220 }, ['re', 'log']],
  ['z-pow-i', [{ type: 'powa', params: { alpha: 'i' } }], { cx: 0, cy: 0, s: 80 }, ['im', 'log']],
  ['cbrt-z2m1', [cxs('(z^2-1)^{1/3}')], { cx: 0, cy: 0, s: 110 }, ['im', 're']],
  ['gamma-like', [{ type: 'zp', params: { a: '1', zeros: '', poles: '0, -1, -2, -3' } }], { cx: -1.5, cy: 0, s: 110 }, ['re', 'log']],
  ['zeros-poles', [cxs('\\frac{z^2-1}{z^2+1}')], { cx: 0, cy: 0, s: 110 }, ['re', 'im', 'log']],
];
const rows = [];
for (const [id, steps, v, modes] of CASES) {
  let F;
  try { F = mk(steps).F; } catch (e) { rows.push({ id, err: String(e) }); continue; }
  const bx = trim(box(v));
  for (const m of modes) { const t0 = Date.now(); const s = diag(F, m, bx); rows.push(Object.assign({ id, mode: m, ms: Date.now() - t0 }, s)); }
}
// the user's case: H_t = sin(h_t(z)), h_t the root's own homotopy (√ bracketed), principal branch
{
  const { built } = mk([{ type: 'root', params: { n: 2 } }, { type: 'sin' }]);
  const bx = trim(box({ cx: 0, cy: 0, s: 60 }));
  for (const t of [0.2, 0.5, 0.8]) {
    const ht = built[0].hom(t), F = (z) => CX.sin(ht(z));
    for (const m of ['im', 're']) { const s = diag(F, m, bx); rows.push(Object.assign({ id: `sinsqrt t=${t}`, mode: m }, s)); }
  }
}
const pct = (a, b) => (100 * a / b).toFixed(2) + '%';
console.log('case | height | triangles drawn | holes: dropped continuous triangles (their 3D area / drawn area) | cut: dropped across a jump (correct) | curtains: drawn across a jump (3D area / drawn) | NaN');
for (const r of rows) {
  if (r.err) { console.log(r.id, 'ERR', r.err); continue; }
  console.log(`${r.id} | ${r.mode} | ${pct(r.drawn, r.tris)} | ${r.hole} (${pct(r.aHole, r.aDrawn)}) | ${r.cut} | ${r.curtain} (${pct(r.aCurtain, r.aDrawn)}) | ${r.nan}`);
}
require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(rows, null, 1));
