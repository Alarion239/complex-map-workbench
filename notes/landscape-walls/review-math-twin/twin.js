const SRC = '<project>/work/xvls/src/';
global.CX = require(SRC + 'cx.js'); global.Expr = require(SRC + 'parse.js');
try { global.Recognize = require(SRC + 'recognize.js'); } catch (e) {}
const FN = require(SRC + 'funcs.js'); const { C } = CX;
const H = 0.55, N = +(process.env.N || 256);
const mk = (steps) => { const S = steps.map((s, i) => ({ type: s.type, params: Object.assign(FN.defaults(s.type), s.params || {}), on: true, uid: 'f' + i })); const built = S.map((st) => FN.build(st)); return { S, built, F: FN.stageFunctions(S, built)[S.length] }; };
const hOf = (mode, mu) => (w) => { if (!w || Number.isNaN(w.re) || Number.isNaN(w.im)) return NaN; if (mode === 'log') return H * (2 / Math.PI) * Math.atan(Math.log(Math.min(Math.max(CX.abs(w), 1e-37), 3e38)) / 1.4); const x = mode === 're' ? w.re : w.im; return H * (2 / Math.PI) * Math.atan(Math.max(-1e30, Math.min(1e30, x / mu))); };
function muOf(F, mode, bx) { const v = []; for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const w = F(C(bx.x0 + (i + 0.5) / 32 * (bx.x1 - bx.x0), bx.y0 + (j + 0.5) / 32 * (bx.y1 - bx.y0))); const x = mode === 're' ? Math.abs(w.re) : Math.abs(w.im); if (Number.isFinite(x)) v.push(x); } v.sort((a, b) => a - b); return v.length ? Math.max(1e-6, v[Math.floor(v.length / 2)]) : 1; }
const same = (c, p) => { const ac = CX.abs(c), ap = CX.abs(p); if (!(ac < 1e30) || !(ap < 1e30)) return true; return CX.abs(CX.sub(c, p)) <= 1e-3 * (ac + ap) + 1e-20; };
const lerp = (a, b, m) => C(a.re + (b.re - a.re) * m, a.im + (b.im - a.im) * m);
function rule(h, P, Cn, z0, z1, pre) { const tol = 2e-3 * H, h0 = h(z0), h1 = h(z1); if (!(Number.isFinite(h0) && Number.isFinite(h1))) return null; if (pre && !(Math.abs(h1 - h0) > tol)) return null; if (same(Cn(z0, z1), P(z1))) return null; let lo = 0, hi = 1, hL = h0, hH = h1; for (let k = 0; k < 13; k++) { const m = (lo + hi) / 2, zm = lerp(z0, z1, m), wp = P(zm), hp = h(zm); if (same(Cn(z0, zm), wp)) { lo = m; if (Number.isFinite(hp)) hL = hp; } else { hi = m; if (Number.isFinite(hp)) hH = hp; } } return Math.abs(hH - hL) > tol ? { t: (lo + hi) / 2, d: Math.abs(hH - hL) } : null; }
function oracle(h, a, b) { let p = a, q = b, hp = h(a), hq = h(b); if (!(Math.abs(hq - hp) > 0.02 * H)) return 0; for (let k = 0; k < 40; k++) { const m = lerp(p, q, 0.5), hm = h(m); if (!Number.isFinite(hm)) return 0; if (Math.abs(hm - hp) >= Math.abs(hq - hm)) { q = m; hq = hm; } else { p = m; hp = hm; } } return Math.abs(hq - hp) > 0.02 * H ? Math.abs(hq - hp) : 0; }
function scan(name, bx, h, P, Cn, sing, singR) {
  const cw = (bx.x1 - bx.x0) / (N - 1);
  const Z = (i, j) => C(bx.x0 + i / (N - 1) * (bx.x1 - bx.x0), bx.y0 + j / (N - 1) * (bx.y1 - bx.y0));
  const near = (a, b) => (sing || []).some((p) => { const dx = b.re - a.re, dy = b.im - a.im; const t = Math.max(0, Math.min(1, ((p.re - a.re) * dx + (p.im - a.im) * dy) / (dx * dx + dy * dy))); return Math.hypot(a.re + t * dx - p.re, a.im + t * dy - p.im) < Math.max(1e-12, (singR || 1) * cw); });
  let onlyNoPre = 0, maxNoPre = 0, curt = 0, maxCurt = 0, jumps = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) for (const [di, dj] of [[1, 0], [0, 1], [1, 1]]) {
    if (i + di >= N || j + dj >= N) continue;
    const a = Z(i, j), b = Z(i + di, j + dj);
    if (near(a, b)) continue;
    const r1 = rule(h, P, Cn, a, b, true), r0 = rule(h, P, Cn, a, b, false);
    if (r1) jumps++;
    if (r0 && !r1) { onlyNoPre++; maxNoPre = Math.max(maxNoPre, r0.d / H); }
    if (!r1) { const o = oracle(h, a, b); if (o) { curt++; maxCurt = Math.max(maxCurt, o / H); } }
  }
  console.log(JSON.stringify({ name, N, jumps, missedByPrefilter: onlyNoPre, maxMissedStepH: +maxNoPre.toFixed(4), oracleCurtains: curt, maxCurtainH: +maxCurt.toFixed(3) }));
}
const bxs = { x0: -2, x1: 2, y0: -2, y1: 2 };
module.exports = { FN, C, mk, hOf, muOf, scan, bxs, H, N };
