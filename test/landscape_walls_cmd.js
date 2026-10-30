// Landscape walls (notes/landscape-walls/AS-BUILT.md, r2/AS-BUILT.md), a command file for a CDP daemon (test/cdp_kit,
// ANGLE Metal): test/<you>_cdp/q.sh test/landscape_walls_cmd.js   (the page at http://127.0.0.1:9811/test.html, PORT
// below; round 1's build at r1/test.html and the base's at base/test.html next to it, for the speckle and cold-open
// comparisons; globalThis.__lwParts limits the parts: 'mesh', 'speck', 'cold', 'perf')
// For each case, desktop 1440 x 900 and phone 390 x 844 (Android Chrome emulation), light and dark:
//   - the GPU's mesh (GLR.landMesh: the heights and the jump data of every grid edge, read back) against an
//     independent CPU oracle on the same grid (bisection toward the larger height change to 2^-40 of the edge, as
//     test/wl_diag.js): curtains = edges the oracle sees jump but the GPU draws across; walls cut = edges the GPU
//     splits where the oracle sees a continuous rise; dropped = triangles the shipped rule leaves out (a corner not
//     finite, or three crossings). Edges through a declared pole, branch point or essential singularity are counted
//     apart (the one cell that holds it is drawn, design 3.5 / 3.6).
//   - steep walls drawn: grid edges rising more than 0.3 H that the old rule dropped, now drawn.
//   - round 2, the refinement (GLR.landRefine: the levels, the list and the refined vertices read back): the GPU's mesh
//     of the refined cells and the base cells around them is watertight (every edge shared by two triangles, or on
//     the domain's rim, or on the side of a cell the refinement leaves to the cut rule: a real jump or a corner not
//     finite); and no refined triangle's edge crosses a real jump (the oracle).
//   - speckles, counted from the rendered image: the same frame on the default mesh (256) and the Fine one (384); a
//     pixel that differs alone, on a face that is smooth around it in one of the two pictures, is a speck (a line or a
//     silhouette that moved by a fraction of a pixel is not). The user's case at t = 0.2 (All sheets, Im), tan z Re and
//     sec z Re, light and dark, this build and round 1's.
//   - cold opens: a fresh formula's first Landscape, the base and this build alternating: the longest main-thread gap
//     (rAF) of each; this build's must not pass the base's by more than 100 ms. The first surface is timed by when the
//     capture that shows it returned.
//   - frame times (__qa.frames) while orbiting (a held drag) and while the deformation plays (the user's case,
//     All sheets on and off): BUDGET60 (fps >= 55 and p95 <= 20 ms at 60 Hz).
//   - round 3, cold opens with All sheets on and off (6 + 6 each, alternating): this build's longest gap no more than
//     100 ms over the base's, sheets on and off apart.
//   - round 3, motion: the user's case at t = 0.2 drawn at rest and on the moving path (GLR._lw.motion: the levels,
//     budget and list playing frames use, T stepped up to it by 0.006 a frame as playing steps it), All sheets on and
//     off, desktop light and dark. The Im H_t = 0 contour on the left wall: per column the line's centroid, a line
//     fitted through them; moving, its largest deviation at most max(0.6 px, the rest's + 0.15) and no more columns
//     without the line than at rest + 3 %. (Round 2 on the same frames: 2.8 to 3.6 px.) Round 2's build can be
//     measured with the same hook patched in (globalThis.__lwMotionPages).
// (run from ci/browser.js --include-excluded: the port is the kit copy's, LW_PARTS=mesh,motion and LW_ONLY=sqrt-im,log-im narrow it)
const PORT = globalThis.__lwPort || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, 9811])[1];
const PARTS = globalThis.__lwParts || (process.env.LW_PARTS ? process.env.LW_PARTS.split(',') : ['mesh', 'speck', 'cold', 'perf', 'motion']);
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const rect = async () => ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) }; })()`);
const cx = (expr) => ({ type: 'custom', params: { expr, cut: 180 }, on: true });
const CASES = [
  { id: 'sqrt-im', steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }], v: { cx: 0, cy: 0, s: 80 }, h: 'im', cuts: true, sing: [[0, 0]], singR: 1 },
  { id: 'log-im', steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], v: { cx: 0, cy: 0, s: 80 }, h: 'im', cuts: true, sing: [[0, 0]], singR: 1 },
  { id: 'tan-re', steps: [{ type: 'tan', params: {}, on: true }], v: { cx: 0, cy: 0, s: 60 }, h: 're', cuts: false, sing: [-3, -1, 1, 3].map((k) => [k * Math.PI / 2, 0]) },
  { id: 'recip-re', steps: [{ type: 'recip', params: {}, on: true }], v: { cx: 0, cy: 0, s: 120 }, h: 're', cuts: false, sing: [[0, 0]] },
  { id: 'inv-z2p1-re', steps: [cx('\\frac{1}{z^2+1}')], v: { cx: 0, cy: 0, s: 110 }, h: 're', cuts: false, sing: [[0, 1], [0, -1]] },
  { id: 'gamma-like-re', steps: [{ type: 'zp', params: { a: '1', zeros: '', poles: '0, -1, -2, -3' }, on: true }], v: { cx: -1.5, cy: 0, s: 110 }, h: 're', cuts: false, sing: [[0, 0], [-1, 0], [-2, 0], [-3, 0]] },
  { id: 'cbrt-z2m1-im', steps: [cx('(z^2-1)^{1/3}')], v: { cx: 0, cy: 0, s: 110 }, h: 'im', cuts: true, sing: [[1, 0], [-1, 0]], singR: 1 },
  { id: 'z-pow-i-im', steps: [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true }], v: { cx: 0, cy: 0, s: 80 }, h: 'im', cuts: true, sing: [[0, 0]], singR: 4 },
  // (review round: a root on branch 1 is found by bisection, cut mode 2; z^2 and z^-2 while they deform have a cut of
  // their path's own, review math-1; tan has no cut at all, so no edge pass, math-3)
  { id: 'sqrt-k1-im', steps: [{ type: 'root', params: { n: 2, cut: 180, k: 1 }, on: true }], v: { cx: 0, cy: 0, s: 80 }, h: 'im', cuts: true, sing: [[0, 0]], singR: 1, mode: 2 },
  { id: 'z2-t0.5-im', steps: [{ type: 'pown', params: { n: 2 }, on: true }], v: { cx: 0.2, cy: 0.1, s: 80 }, h: 'im', cuts: true, sing: [[0, 0]], singR: 1, homT: 0.5, mode: 1 },
  { id: 'z2-t0.25-im', steps: [{ type: 'pown', params: { n: 2 }, on: true }], v: { cx: 0.2, cy: 0.1, s: 80 }, h: 'im', cuts: true, sing: [[0, 0]], singR: 1, homT: 0.25, mode: 1 },
  { id: 'zm2-t0.2-im', steps: [{ type: 'pown', params: { n: -2 }, on: true }], v: { cx: 0.2, cy: 0.1, s: 80 }, h: 'im', cuts: true, sing: [[0, 0]], singR: 1, homT: 0.2, mode: 1 },
  // (#168 review) the same page, the log's cut moved 90 -> 180 -> 90: its cuts change kind (other <-> sheet) under the
  // same chain key, and landTF's kind with them (N <-> S). A landTF compiled at 90 (N: no edge pass) and drawn at 180,
  // where it should run the edge pass itself, leaves the cut without walls; the program must follow the kind
  { id: 'log-cut-flip-im', steps: [{ type: 'log', params: { cut: 90, k: 0 }, on: true }], v: { cx: 0, cy: 0, s: 80 }, h: 'im', cuts: true, sing: [[0, 0]], singR: 1, flips: [180, 90] },
];
const ONLY = typeof globalThis.__lwOnly === 'object' ? globalThis.__lwOnly : process.env.LW_ONLY ? process.env.LW_ONLY.split(',') : null;
// the in-page check: the GPU mesh of the pane (N = 256) against the oracle on the CPU (the app's own Funcs)
const CHECK = (steps, h, sing, singR, homT) => `(() => {
  const m = GLR.landMesh(256);
  if (!m || !m.h) return { err: 'no mesh' };
  const f = m.key.split('|'), n = f.length;
  const bx = { x0: +f[n - 9], x1: +f[n - 8], y0: +f[n - 7], y1: +f[n - 6] }, N = +f[n - 5], H = +f[n - 3], mu = +f[n - 2], cm = +f[n - 1];
  const steps = ${JSON.stringify(steps)};
  const S = steps.map((s, i) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params || {}), on: true, uid: 'f' + i }));
  const built = S.map((st) => Funcs.build(st)), F = ${homT != null ? `built[0].hom(${homT})` : 'Funcs.stageFunctions(S, built)[S.length]'};
  const hf = (w) => { const x = ${JSON.stringify(h)} === 're' ? w.re : w.im; return Number.isNaN(x) ? NaN : H * (2 / Math.PI) * Math.atan(Math.max(-1e30, Math.min(1e30, x / mu))); };
  const hz = (z) => hf(F(z));
  const Z = (i, j) => CX.C(bx.x0 + i / (N - 1) * (bx.x1 - bx.x0), bx.y0 + j / (N - 1) * (bx.y1 - bx.y0));
  const oracle = (a, b) => {
    let p = a, q = b, hp = hz(a), hq = hz(b);
    if (!(Math.abs(hq - hp) > 0.02 * H)) return 'cont';
    for (let k = 0; k < 40; k++) {
      const c = CX.C((p.re + q.re) / 2, (p.im + q.im) / 2), hc = hz(c);
      if (!Number.isFinite(hc)) return 'nan';
      if (Math.abs(hc - hp) >= Math.abs(hq - hc)) { q = c; hq = hc; } else { p = c; hp = hc; }
    }
    return Math.abs(hq - hp) > 0.02 * H ? 'jump' : 'cont';
  };
  const cell = (bx.x1 - bx.x0) / (N - 1), SG = ${JSON.stringify(sing)}.map(([x, y]) => CX.C(x, y)), R = Math.max(1e-9 * (bx.x1 - bx.x0), ${singR || 0} * cell);
  const segD = (p, a, b) => { const dx = b.re - a.re, dy = b.im - a.im, L = dx * dx + dy * dy; const t = L > 0 ? Math.max(0, Math.min(1, ((p.re - a.re) * dx + (p.im - a.im) * dy) / L)) : 0; return Math.hypot(a.re + t * dx - p.re, a.im + t * dy - p.im); };
  const r = { N, cutMode: cm, edges: 0, steep: 0, steepDrawn: 0, jumps: 0, curtains: 0, wallsCut: 0, atSingular: 0, dropped: 0, gpuVsCpuHeight: 0 };
  const D = [[1, 0], [0, 1], [1, 1]];
  const hv = (i, j) => m.h[4 * (j * N + i) + 2], ok = (i, j) => m.h[4 * (j * N + i) + 3] > 0.5;
  // the GPU heights against the CPU's (float32 against float64)
  for (let j = 0; j < N; j += 17) for (let i = 0; i < N; i += 13) { const c = hz(Z(i, j)); if (ok(i, j) && Number.isFinite(c)) r.gpuVsCpuHeight = Math.max(r.gpuVsCpuHeight, Math.abs(c - hv(i, j)) / H); }
  for (let d = 0; d < 3; d++) for (let j = 0; j < N - D[d][1]; j++) for (let i = 0; i < N - D[d][0]; i++) {
    const i1 = i + D[d][0], j1 = j + D[d][1];
    if (!ok(i, j) || !ok(i1, j1)) continue;
    r.edges++;
    const dh = Math.abs(hv(i1, j1) - hv(i, j));
    const jump = m.e && m.e[d][4 * (j * N + i) + 3] > 0.5;
    if (jump) r.jumps++;
    if (dh > 0.3 * H) { r.steep++; if (!jump) r.steepDrawn++; }
    if (!(dh > 0.02 * H)) continue;
    const za = Z(i, j), zb = Z(i1, j1);
    const o = oracle(za, zb);
    const near = SG.some((p) => segD(p, za, zb) < R);
    if (o === 'jump' && !jump) { if (near) r.atSingular++; else r.curtains++; }
    if (o === 'cont' && jump) { if (near) r.atSingular++; else r.wallsCut++; }
  }
  // triangles the rule leaves out: a corner not finite, or three crossings
  const J = (d, i, j) => !!(m.e && m.e[d][4 * (j * N + i) + 3] > 0.5);
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    if (!ok(i, j) || !ok(i + 1, j) || !ok(i + 1, j + 1) || !ok(i, j + 1)) { r.dropped += 2; continue; }
    if (J(0, i, j) && J(1, i + 1, j) && J(2, i, j)) r.dropped++;
    if (J(2, i, j) && J(0, i, j + 1) && J(1, i, j)) r.dropped++;
  }
  r.gpuVsCpuHeight = +r.gpuVsCpuHeight.toExponential(2);
  return r;
})()`;

// round 2: the refined mesh read back from the GPU, rebuilt as LAND_VS draws it; holes and curtains
const WATERTIGHT = (steps, h, homT) => `(() => {
  const R = GLR.landRefine(true, 256), m = GLR.landMesh(256);
  const L = R && R.land;
  if (!L || !m) return { refineErr: 'no refinement' };
  const N = L.N, M = N - 1, Mq = (M + 3) >> 2, GM = 16 * M;
  const lv = (i, j) => { const v = L.lv[4 * (j * Mq + (i >> 2)) + (i & 3)] | 0; return [v & 7, v >> 3]; };
  const ok = (i, j) => L.h[4 * (j * N + i) + 3] > 0.5;
  const J = (d, i, j) => !!(m.e && m.e[d][4 * (j * N + i) + 3] > 0.5);
  // cells left to the cut rule (a real jump on a side or the diagonal, or a corner not finite): their sides may end the mesh
  const skip = new Set();
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const [lx, ly] = lv(i, j);
    if (lx || ly) continue;
    if (!ok(i, j) || !ok(i + 1, j) || !ok(i, j + 1) || !ok(i + 1, j + 1) || J(0, i, j) || J(0, i, j + 1) || J(1, i, j) || J(1, i + 1, j) || J(2, i, j)) skip.add(j * M + i);
  }
  const E = new Map(), tris = [];
  const add = (a, b) => { const k = a < b ? a + '|' + b : b + '|' + a; E.set(k, (E.get(k) || 0) + 1); };
  const tri = (P) => { if (P[0] === P[1] || P[1] === P[2] || P[0] === P[2]) return; add(P[0], P[1]); add(P[1], P[2]); add(P[2], P[0]); };
  let refinedTris = 0;
  const rfKey = (t) => L.rf[4 * (t + 1) + 2] + ',' + L.rf[4 * (t + 1) + 3];
  const rfOk = (t) => L.rf[4 * t + 1] > 0.5;
  const rfH = (t) => L.rf[4 * t];
  const curt = [];
  for (const g of L.groups) {
    const nx = 1 << g.L[0], ny = 1 << g.L[1], S = (nx + 1) * (ny + 1);
    for (let e = 0; e < g.n; e++) {
      const vb = g.y0 * 2048 + 2 * e * S, T = (sx, sy) => vb + 2 * (sy * (nx + 1) + sx);
      for (let sy = 0; sy < ny; sy++) for (let sx = 0; sx < nx; sx++) for (const t of [0, 1]) {
        const P = t === 0 ? [T(sx, sy), T(sx + 1, sy), T(sx + 1, sy + 1)] : [T(sx, sy), T(sx + 1, sy + 1), T(sx, sy + 1)];
        if (!P.every(rfOk)) continue;
        const K = P.map(rfKey);
        tri(K); refinedTris++;
        if (curt.length < 4000) for (let k = 0; k < 3; k++) { const a = P[k], b = P[(k + 1) % 3]; if (Math.abs(rfH(a) - rfH(b)) > 0.02 * 0.55) curt.push([L.rf[4 * (a + 1) + 2], L.rf[4 * (a + 1) + 3], L.rf[4 * (b + 1) + 2], L.rf[4 * (b + 1) + 3]]); }
      }
    }
  }
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const [lx, ly] = lv(i, j);
    if (lx || ly || skip.has(j * M + i)) continue;
    const k = (a, b) => (16 * a) + ',' + (16 * b);
    tri([k(i, j), k(i + 1, j), k(i + 1, j + 1)]); tri([k(i, j), k(i + 1, j + 1), k(i, j + 1)]);
  }
  const onSkipSide = (a, b) => {
    // both ends on one side of a skipped cell
    for (const [x, y] of [a, b]) {}
    const cx = Math.floor(Math.min(a[0], b[0]) / 16), cy = Math.floor(Math.min(a[1], b[1]) / 16);
    for (let dj = -1; dj <= 0; dj++) for (let di = -1; di <= 0; di++) {
      const i = cx + di + (a[0] === b[0] && a[0] % 16 === 0 ? 0 : 0), j = cy + dj;
      for (const [ii, jj] of [[cx + di, cy + dj], [cx, cy]]) {
        if (ii < 0 || jj < 0 || ii >= M || jj >= M || !skip.has(jj * M + ii)) continue;
        const x0 = 16 * ii, y0 = 16 * jj, x1 = x0 + 16, y1 = y0 + 16;
        const inS = (p) => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
        if (inS(a) && inS(b) && ((a[0] === b[0] && (a[0] === x0 || a[0] === x1)) || (a[1] === b[1] && (a[1] === y0 || a[1] === y1)))) return true;
      }
    }
    return false;
  };
  let holes = 0, rim = 0, cutSide = 0;
  for (const [k, n] of E) {
    if (n === 2) continue;
    const [a, b] = k.split('|').map((s) => s.split(',').map(Number));
    if ((a[0] === b[0] && (a[0] === 0 || a[0] === GM)) || (a[1] === b[1] && (a[1] === 0 || a[1] === GM))) { rim++; continue; }
    if (onSkipSide(a, b)) { cutSide++; continue; }
    holes++;
  }
  // curtains: refined edges that rise more than 0.02 H, against the oracle (bisection to 2^-40)
  const f = m.key.split('|'), nn = f.length;
  const bx = { x0: +f[nn - 9], x1: +f[nn - 8], y0: +f[nn - 7], y1: +f[nn - 6] }, H = +f[nn - 3], mu = +f[nn - 2];
  const steps = ${JSON.stringify(steps)};
  const S = steps.map((s, i) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params || {}), on: true, uid: 'f' + i }));
  const built = S.map((st) => Funcs.build(st)), F = ${homT != null ? `built[0].hom(${homT})` : 'Funcs.stageFunctions(S, built)[S.length]'};
  const hz = (z) => { const w = F(z); const x = ${JSON.stringify(h)} === 're' ? w.re : w.im; return Number.isNaN(x) ? NaN : H * (2 / Math.PI) * Math.atan(Math.max(-1e30, Math.min(1e30, x / mu))); };
  const Z = (G) => CX.C(bx.x0 + G[0] / GM * (bx.x1 - bx.x0), bx.y0 + G[1] / GM * (bx.y1 - bx.y0));
  let refinedCurtains = 0;
  for (const [ax, ay, bx2, by2] of curt) {
    let p = Z([ax, ay]), q = Z([bx2, by2]), hp = hz(p), hq = hz(q);
    if (!(Math.abs(hq - hp) > 0.02 * H)) continue;
    let bad = true;
    for (let k = 0; k < 40; k++) {
      const c = CX.C((p.re + q.re) / 2, (p.im + q.im) / 2), hc = hz(c);
      if (!Number.isFinite(hc)) { bad = false; break; }
      if (Math.abs(hc - hp) >= Math.abs(hq - hc)) { q = c; hq = hc; } else { p = c; hp = hc; }
    }
    if (bad && Math.abs(hq - hp) > 0.02 * H) refinedCurtains++;
  }
  return { refinedCells: L.entries, refinedTris, groups: L.groups.map((g) => g.L.join(',') + ':' + g.n).join(' '), holes, rimEdges: rim, cutSideEdges: cutSide, refinedCurtains, refinedEdgesTested: curt.length };
})()`;
const out = { rows: [], perf: [], fails: [], speck: [], cold: [] };
for (const [vw, vh, mobile] of [[1440, 900, false], [390, 844, true]]) for (const dark of [false, true]) {
  await view(vw, vh, dark, mobile);
  const tag = `${vw}-${dark ? 'dark' : 'light'}`;
  for (const c of PARTS.includes('mesh') ? CASES : []) {
    if (ONLY && !ONLY.includes(c.id)) continue;
    await load('lw' + c.id + tag + Date.now(), { shapes: [], steps: c.steps, pattern: 'checker', srcView: c.v, view: { main: 'land' }, sheets: false, height: c.h });
    await settle(1200);
    await ev('__cmwSetMain("land")'); await settle(1200);
    if (c.homT != null) { await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900); await ev(`__cmwMorph({ T: ${c.homT} })`); await settle(1500); }
    // (a map with a cut: until its edge pass has compiled and settled the surface is drawn by the former rule, key ending in
    // -1; a first page on a software renderer takes tens of seconds for it)
    if (c.cuts) for (let k = 0; k < 120; k++) { if (await ev('(() => { const m = GLR.landMesh(256); return !!(m && !/\\|-1$/.test(m.key)); })()')) break; await sleep(500); }
    const r = await ev(CHECK(c.steps, c.h, c.sing || [], c.singR || 0, c.homT), 120000);
    // (the refinement follows the surface by a frame or two, its programs one per frame on a fresh page: wait for it)
    for (let k = 0; k < 40; k++) { if (await ev('(() => { const q = GLR.landRefine(false, 256); return !!(q && q.land); })()')) break; await sleep(150); }
    Object.assign(r, await ev(WATERTIGHT(c.steps, c.h, c.homT), 120000));
    if (c.mode != null && r.cutMode !== c.mode) out.fails.push(`${c.id} ${tag}: cut mode ${r.cutMode}, want ${c.mode}`);
    if (c.homT != null) await ev('__cmwMorph({ open: false })');
    const row = Object.assign({ id: c.id, tag }, r);
    out.rows.push(row);
    if (r.err) { out.fails.push(`${c.id} ${tag}: ${r.err}`); continue; }
    if (r.curtains) out.fails.push(`${c.id} ${tag}: ${r.curtains} curtains`);
    if (r.wallsCut) out.fails.push(`${c.id} ${tag}: ${r.wallsCut} continuous walls cut`);
    if (r.dropped > 4) out.fails.push(`${c.id} ${tag}: ${r.dropped} triangles dropped`);
    if (c.cuts && !r.jumps) out.fails.push(`${c.id} ${tag}: the cut was not found`);
    if (!c.cuts && r.jumps) out.fails.push(`${c.id} ${tag}: ${r.jumps} jumps on a continuous surface`);
    if (!c.cuts && r.cutMode !== 0) out.fails.push(`${c.id} ${tag}: cut mode ${r.cutMode} on a map with no cut`);
    if (r.steep && r.steepDrawn < r.steep - r.jumps) out.fails.push(`${c.id} ${tag}: steep walls not drawn`);
    if (r.refineErr) out.fails.push(`${c.id} ${tag}: ${r.refineErr}`);
    if (r.holes) out.fails.push(`${c.id} ${tag}: ${r.holes} hole edges in the refined mesh`);
    if (r.refinedCurtains) out.fails.push(`${c.id} ${tag}: ${r.refinedCurtains} refined edges across a jump`);
    // (a case's cut moved on the same page: each surface checked again, its heights against the CPU's too)
    for (const cut of c.flips || []) {
      const steps = c.steps.map((st, i) => (i === 0 ? Object.assign({}, st, { params: Object.assign({}, st.params, { cut }) }) : st));
      const key0 = await ev('(() => { const m = GLR.landMesh(256); return m ? m.key : null; })()');
      await ev(`__cmwStepParam(0, 'cut', ${cut})`); await settle(1200);
      for (let k = 0; k < 120; k++) { if (await ev(`(() => { const m = GLR.landMesh(256); return !!(m && m.key !== ${JSON.stringify(key0)} && !/\\|-1$/.test(m.key)); })()`)) break; await sleep(500); }
      const f = await ev(CHECK(steps, c.h, c.sing || [], c.singR || 0), 120000);
      const at = `${c.id} ${tag} (cut ${cut})`;
      out.rows.push(Object.assign({ id: c.id + '@' + cut, tag }, f));
      if (f.err) { out.fails.push(`${at}: ${f.err}`); continue; }
      if (f.curtains) out.fails.push(`${at}: ${f.curtains} curtains`);
      if (f.wallsCut) out.fails.push(`${at}: ${f.wallsCut} continuous walls cut`);
      if (!f.jumps) out.fails.push(`${at}: the cut was not found`);
      if (!(f.gpuVsCpuHeight < 1e-3)) out.fails.push(`${at}: GPU heights off the CPU's by ${f.gpuVsCpuHeight} H`);
    }
  }
  // frame times: orbiting tan z (Re), and the user's case playing (All sheets on and off)
  if (PARTS.includes('perf') && (!ONLY || globalThis.__lwPerf)) {
    await load('lwperf' + tag + Date.now(), { shapes: [], steps: [{ type: 'tan', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: false, height: 're' });
    await settle(1200); await ev('__cmwSetMain("land")'); await settle(900);
    // (the camera turned a little every frame through the app's camera hook, as a held drag does)
    const orbit = await ev(`await (async () => { const c0 = __cmwCam('L'); let k = 0, run = true; const spin = () => { if (!run) return; __cmwCam('L', { yaw: c0.yaw + 0.01 * (++k) }); requestAnimationFrame(spin); }; requestAnimationFrame(spin); const r = await __qa.frames(2000); run = false; return Object.assign(r, { turned: +(__cmwCam('L').yaw - c0.yaw).toFixed(2) }); })()`, 30000);
    out.perf.push({ tag, what: 'orbit tan Re', ...orbit });
    const sq = { type: 'root', params: { n: 2, cut: 180 }, on: true }, sn = { type: 'sin', params: {}, on: true };
    for (const sh of [true, false]) {
      await load('lwplay' + tag + sh + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: sh, height: 'im' });
      await settle(1500); await ev('__cmwSetMain("land")'); await settle(800);
      await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
      await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(500);
      const play = await ev('await (async () => await __qa.frames(2500))()', 30000);
      await ev('__cmwMorph({ playing: false })');
      out.perf.push({ tag, what: `play sin √z Im${sh ? ', All sheets' : ''}`, ...play });
    }
    // (r3 review speed-1: orbiting at the Max mesh, All sheets on and off, through the camera hook and by a held drag)
    for (const sh of [true, false]) {
      await load('lwmax' + tag + sh + Date.now(), { meshN: 1920, shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: sh, height: 'im' });
      await settle(1500); await ev('__cmwSetMain("land")'); await settle(3000);
      const orbitM = await ev(`await (async () => { const c0 = __cmwCam('L'); let k = 0, run = true; const spin = () => { if (!run) return; __cmwCam('L', { yaw: c0.yaw + 0.01 * (++k) }); requestAnimationFrame(spin); }; requestAnimationFrame(spin); const r = await __qa.frames(2500); run = false; return r; })()`, 30000);
      out.perf.push({ tag, what: `orbit Max sin √z Im${sh ? ', All sheets' : ''}`, ...orbitM });
      const pr = await ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, b.width]; })()`);
      await settle(1500);
      await ev('window.__fr = __qa.frames(2500); 1');
      const x0 = pr[0] - pr[2] * 0.15;
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: pr[1] });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: pr[1], button: 'left', clickCount: 1 });
      const t0 = Date.now(); let i = 0;
      while (Date.now() - t0 < 2400) { i++; await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (i % 120 < 60 ? i % 60 : 60 - (i % 60)) * 3, y: pr[1] + 10 * Math.sin(i / 9), button: 'left', buttons: 1 }); await sleep(12); }
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0, y: pr[1], button: 'left', clickCount: 1 });
      const dragM = await ev('await window.__fr', 30000);
      out.perf.push({ tag, what: `drag Max sin √z Im${sh ? ', All sheets' : ''}`, ...dragM });
    }
  }
}

// ---- speckles (round 2) ----
const ld = async (page, ns, st) => {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/gl-helpers.html` }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` + page + '?ns=' + ns }); await sleep(2200);
};
const flips = (A, B) => {
  const W = A.w, H = A.h, ch = A.ch, d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { const p = i * ch; d[i] = Math.hypot(A.data[p] - B.data[p], A.data[p + 1] - B.data[p + 1], A.data[p + 2] - B.data[p + 2]); }
  let n = 0;
  flips.pts = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!(d[i] > 30)) continue;
    // (alone, or with one or two flagged neighbours that do not line up through it: a pixel of a 1 px line that
    // moved, flagged with its two neighbours along the line, is not a speck)
    let k = 0; const fl = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && d[i + dy * W + dx] > 15) { k++; fl.push([dx, dy]); }
    if (k > 2 || (k === 2 && fl[0][0] === -fl[1][0] && fl[0][1] === -fl[1][1])) continue;
    // (on a smooth face in both pictures: the neighbours agree with each other; a line or a silhouette that moved by
    // a fraction of a pixel between the meshes is not a speck)
    // (a speck in one of the two pictures: the other one smooth around it; a line or a silhouette that moved by a
    // fraction of a pixel between the meshes has its edge in both)
    let smooth = false;
    for (const I of [A, B]) {
      let mr = 0, mg = 0, mb = 0, ok = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const p = ((y + dy) * W + x + dx) * ch; mr += I.data[p]; mg += I.data[p + 1]; mb += I.data[p + 2]; }
      mr /= 9; mg /= 9; mb /= 9;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const p = ((y + dy) * W + x + dx) * ch; if (Math.hypot(I.data[p] - mr, I.data[p + 1] - mg, I.data[p + 2] - mb) > 20) ok = false; }
      if (ok) smooth = true;
    }
    if (smooth) { n++; if (flips.pts.length < 40) flips.pts.push([x, y]); }
  }
  return n;
};
const sq0 = { type: 'root', params: { n: 2, cut: 180 }, on: true }, sn0 = { type: 'sin', params: {}, on: true };
const SPECK_CASES = [
  { id: 'user-t0.2-im-sheets', st: { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq0, sn0], srcView: { cx: 0, cy: 0, s: 60 }, sheets: true, height: 'im' }, T: 0.2 },
  { id: 'tan-re', st: { steps: [{ type: 'tan', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 }, sheets: false, height: 're' } },
  { id: 'sec-re', st: { steps: [cx('\\sec z')], srcView: { cx: 0, cy: 0, s: 60 }, sheets: false, height: 're' } },
];
if (PARTS.includes('speck')) for (const [vw, vh, mobile] of [[1440, 900, false], [390, 844, true]]) for (const dark of [false, true]) for (const page of ['r1/test.html', 'test.html']) for (const c of SPECK_CASES) {
  await view(vw, vh, dark, mobile);
  await ld(page, 'sp' + Date.now(), Object.assign({ shapes: [], pattern: 'checker', view: { main: 'land' } }, c.st));
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(1500);
  if (c.T != null) { await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900); await ev(`__cmwMorph({ T: ${c.T} })`); await settle(1500); }
  await settle(1500);
  const r = await ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left + 20), y: Math.round(b.top + 50), width: Math.round(b.width - 40), height: Math.round(b.height - 130) }; })()`);
  const A = await img(r);
  await ev(`__cmwSet('meshN', 480); 1`); await settle(2500);
  const B = await img(r);
  await ev(`__cmwSet('meshN', 240); 1`); await settle(800);
  const n = flips(A, B);
  out.speck.push({ page, id: c.id, tag: `${vw}-${dark ? 'dark' : 'light'}`, speckles: n });
  if (page === 'test.html' && n > 5) out.fails.push(`speckles: ${c.id} ${vw} ${dark ? 'dark' : 'light'}: ${n}`);
}
// ---- cold opens (round 2), base and this build alternating ----
if (PARTS.includes('cold')) {
// (round 3: All sheets on as well. Every formula is a fresh one at each run, its constants offset by K: the system's
// Metal shader cache outlives the browser's profile, and a formula met before, by this run or an earlier one, compiled
// in a fraction of the time, so a fixed list measured the cache, not the build)
const K = 1000 + Math.floor(Math.random() * 8000), k = (n) => K + 2 * n;
const RUNS = globalThis.__coldRuns || [
 ['base/test.html', `\\log(z^5+${k(1)})\\cos(z/5)`, false], ['test.html', `\\log(z^5+${k(2)})\\cos(z/7)`, false],
 ['test.html', `z^4/(\\sinh z+${k(3)})`, false], ['base/test.html', `z^4/(\\sinh z+${k(4)})`, false],
 ['base/test.html', `\\sqrt{z^4+z+${k(5)}}\\sinh(z/5)`, false], ['test.html', `\\sqrt{z^4+z+${k(6)}}\\sinh(z/7)`, false],
 ['test.html', `\\tanh(z^3/4)+\\sqrt{z-${k(7)}}`, false], ['base/test.html', `\\tanh(z^3/5)+\\sqrt{z-${k(8)}}`, false],
 ['base/test.html', `z^3/(\\cosh z+${k(9)})`, false], ['test.html', `z^3/(\\cosh z+${k(10)})`, false],
 ['test.html', `\\sqrt{z^5-${k(11)}z}\\cosh(z/5)`, false], ['base/test.html', `\\sqrt{z^5-${k(12)}z}\\cosh(z/6)`, false],
 ['base/test.html', `\\log(z^2+${k(13)})`, true], ['test.html', `\\log(z^2+${k(14)})`, true],
 ['test.html', `\\sqrt{z^3+${k(15)}}\\cos z`, true], ['base/test.html', `\\sqrt{z^3+${k(16)}}\\cos z`, true],
 ['base/test.html', `\\log(z^3+${k(17)})+z`, true], ['test.html', `\\log(z^3+${k(18)})+z`, true],
 ['test.html', `\\sqrt{z^2+${k(19)}}`, true], ['base/test.html', `\\sqrt{z^2+${k(20)}}`, true],
 ['base/test.html', `\\log(z^4+${k(21)})`, true], ['test.html', `\\log(z^4+${k(22)})`, true],
 ['test.html', `\\sqrt{z^4+${k(23)}}\\sin z`, true], ['base/test.html', `\\sqrt{z^4+${k(24)}}\\sin z`, true],
];
await view(1440, 900, false, false);
for (const [page, f, shs] of RUNS) {
  await ld(page, 'cold' + Date.now(), { shapes: [], steps: [{ type: 'custom', params: { expr: f, cut: 180 }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 }, sheets: !!shs, height: 'im' });
  await sleep(3000);
  await ev(`(() => { window.__gap = { gaps: [], last: performance.now(), t0: performance.now(), on: true }; const f = () => { const t = performance.now(); const d = t - __gap.last; if (d > 100) __gap.gaps.push([Math.round(__gap.last - __gap.t0), Math.round(d)]); __gap.last = t; if (__gap.on) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
  if (globalThis.__lwSet && !page.includes('base')) await ev(`GLR._lw = ${JSON.stringify(globalThis.__lwSet)}; 1`);
  const t0 = Date.now();
  if (!page.includes('base')) await ev('GLR._lwLog = []; 1');
  await ev('__gap.t0 = performance.now(); __cmwSetMain("land")');
  const r = await ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width * 0.3), y: Math.round(b.top + b.height * 0.3), width: Math.round(b.width * 0.4), height: Math.round(b.height * 0.4) }; })()`);
  const frames = [];
  while (Date.now() - t0 < 9000) { const ts = Date.now() - t0; const im = await img(r); frames.push({ ts, te: Date.now() - t0, img: im }); await sleep(40); }
  const gaps = await ev('(() => { __gap.on = false; return __gap.gaps; })()');
  const plog = page.includes('base') ? null : await ev('(GLR._lwLog || []).map(([n, t]) => n + "@" + Math.round(t - __gap.t0)).join(" ")');
  const fin = frames[frames.length - 1].img;
  let drawn = null;
  for (const fr of frames) {
    let same = 0, n = 0;
    for (let i = 0; i < fin.data.length; i += fin.ch * 7) { n++; if (Math.abs(fr.img.data[i] - fin.data[i]) <= 6 && Math.abs(fr.img.data[i + 1] - fin.data[i + 1]) <= 6 && Math.abs(fr.img.data[i + 2] - fin.data[i + 2]) <= 6) same++; }
    if (same / n >= 0.9) { drawn = fr.te; break; }
  }
  const maxGap = gaps.reduce((m, g) => Math.max(m, g[1]), 0);
  out.cold.push({ page, f, sheets: !!shs, firstSurfaceMs: drawn, longestGapMs: maxGap, gaps, plog });
}
  out.coldSummary = {};
  for (const shs of [false, true]) {
    const C = out.cold.filter((c) => c.sheets === shs);
    if (!C.length) continue;
    const gb = Math.max(0, ...C.filter((c) => c.page.includes('base')).map((c) => c.longestGapMs));
    const gn = Math.max(0, ...C.filter((c) => !c.page.includes('base')).map((c) => c.longestGapMs));
    const sb = C.filter((c) => c.page.includes('base')).reduce((m, c) => m + c.gaps.length, 0), sn = C.filter((c) => !c.page.includes('base')).reduce((m, c) => m + c.gaps.length, 0);
    out.coldSummary[shs ? 'allSheets' : 'principal'] = { baseLongestGapMs: gb, thisLongestGapMs: gn, baseStalls: sb, thisStalls: sn };
    if (gn > gb + 100) out.fails.push(`cold open${shs ? ', All sheets' : ''}: longest gap ${gn} ms against the base's ${gb} ms`);
  }
}
// ---- motion (round 3) ----
const lineOf = (I, box, ref, thr = 6) => {
  const [x0, y0, x1, y1] = box, lum = (x, y) => { const p = (y * I.w + x) * I.ch; return 0.2126 * I.data[p] + 0.7152 * I.data[p + 1] + 0.0722 * I.data[p + 2]; };
  const pts = []; let miss = 0;
  for (let x = x0; x <= x1; x++) {
    const col = []; for (let y = y0; y <= y1; y++) col.push(lum(x, y));
    const med = col.slice().sort((a, b) => a - b)[col.length >> 1];
    let ys = col.map((_, i) => i);
    if (ref) { const yr = ref[0] * x + ref[1] - y0; ys = ys.filter((i) => Math.abs(i - yr) <= 4); }
    if (!ys.length) { miss++; continue; }
    const best = ys.reduce((m, i) => (col[i] > col[m] ? i : m), ys[0]);
    if (col[best] - med < thr) { miss++; continue; }
    let sw = 0, sy = 0;
    for (let i = Math.max(0, best - 2); i <= Math.min(col.length - 1, best + 2); i++) { const w = Math.max(col[i] - med, 0); sw += w; sy += i * w; }
    pts.push([x, y0 + sy / sw]);
  }
  const fit = (P) => { const n = P.length, mx = P.reduce((a, p) => a + p[0], 0) / n, my = P.reduce((a, p) => a + p[1], 0) / n; let sxx = 0, sxy = 0; for (const p of P) { sxx += (p[0] - mx) ** 2; sxy += (p[0] - mx) * (p[1] - my); } const a = sxy / sxx; return [a, my - a * mx]; };
  if (pts.length < 5) return { n: pts.length, miss };
  let [a, b] = fit(pts);
  if (!ref) for (let k = 0; k < 4; k++) { const keep = pts.filter((p) => Math.abs(p[1] - (a * p[0] + b)) <= 1.5); if (keep.length < 5) break; [a, b] = fit(keep); }
  const dev = Math.max(...pts.map((p) => Math.abs(p[1] - (a * p[0] + b))));
  return { n: pts.length, gapPct: +(100 * miss / (x1 - x0 + 1)).toFixed(1), maxDev: +dev.toFixed(2), fit: [a, b] };
};
out.motion = [];
// (r3 review pictures-1: the Max mesh too, and T stepped as real play steps it, about 0.013 a frame at 1x and 0.026
// at 2x, besides the former 0.006)
const MOTION = globalThis.__lwMotion || (process.env.LW_MOTION ? process.env.LW_MOTION.split(',').map((x) => x.split(':').map(Number)) : [[240, 0.006], [1920, 0.006], [1920, 0.013], [1920, 0.026], [240, 0.026]]);   // LW_MOTION=240:0.006,240:0.026: mesh:dT
if (PARTS.includes('motion')) for (const page of globalThis.__lwMotionPages || ['test.html']) for (const dark of [false, true]) for (const sh of [true, false]) for (const [meshN, dT] of MOTION) {
  await view(1440, 900, dark, false);
  await ld(page, 'mo' + Date.now(), { meshN, shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq0, sn0], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: sh, height: 'im' });
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(2000);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
  await ev('__cmwMorph({ T: 0.2 })'); await settle(3500);
  const pr = await ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) }; })()`);
  const rest = await img(pr);
  await ev(`__cmwMorph({ T: ${(0.2 - 12 * dT).toFixed(4)} })`); await settle(1500);
  await ev('GLR._lw = Object.assign(GLR._lw || {}, { motion: true }); 1');
  for (let t = 0.2 - 11 * dT; t < 0.2 - 1e-9; t += dT) { await ev(`__cmwMorph({ T: ${t.toFixed(4)} }); 1`); await ev('new Promise((r) => requestAnimationFrame(() => r(1)))'); await sleep(10); }
  await ev('__cmwMorph({ T: 0.2 }); 1'); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))');
  const move = await img(pr);
  await ev('GLR._lw.motion = false; 1');
  const box = [256, 266, 288, 292];
  const r0 = lineOf(rest, box), rr = r0.fit ? lineOf(rest, box, r0.fit) : r0, mm = r0.fit ? lineOf(move, box, r0.fit) : null;
  const row = { page, sheets: sh, tag: `${dark ? 'dark' : 'light'} mesh ${meshN} dT ${dT}`, rest: rr, move: mm };
  out.motion.push(row);
  if (page === 'test.html') {
    if (!mm || !(mm.maxDev <= Math.max(0.6, rr.maxDev + 0.15))) out.fails.push(`motion: ${sh ? 'All sheets' : 'principal'} ${row.tag}: left-wall contour off by ${mm && mm.maxDev} px moving (rest ${rr.maxDev})`);
    if (mm && mm.gapPct > rr.gapPct + 3) out.fails.push(`motion: ${sh ? 'All sheets' : 'principal'} ${row.tag}: the contour breaks while moving (${mm.gapPct} % of columns, rest ${rr.gapPct} %)`);
  }
}
for (const p of out.perf) if (!(p.fps >= 55 && p.p95 <= 20)) out.fails.push(`BUDGET60: ${p.tag} ${p.what}: ${p.fps} fps, p95 ${p.p95} ms`);
await view(1440, 900, false, false);
out.pass = out.fails.length === 0;
out.logs = logs().filter((l) => !/404/.test(l.m)).slice(0, 8);
return out;
