// The steps view's Landscape glide is exact: a moving frame at u between plane z and the next is drawn like a parked
// frame, an N x N grid over the shown plane's box, but its height and colour at a place w come from the preimages
// z = H_u^-1(w) of the glide's map H_u (the inverse plan, src/inverse.js), not from plane z's grid pushed forward through
// H_u. The cases (Landscape of Im F, one pane and camera, each with Inside regions' sheets off and with All sheets):
// the square root under a Möbius map, the logarithm of an annulus, a cube root, the Joukowski airfoil, Roots as preimages
// and the partial sums of the exponential (the last two draw through the Newton's roots pass). Each is held at
// u = 0.002, 0.5 and 0.998 of the glide from the first plane to the second, where:
// - the path: the frame's record says 'inverse' (render3D.carried.path), not 'mesh';
// - the geometry: at probe places w the frame's per-vertex draw data (window.__cmwLandFrameVerts(pts): per place the
//   layers the frame draws there, { h: height, member }) is the CPU reference's: Newton's method for H_u(z) = w from seeds
//   over the plane's box, h = the height of the plane's value at z (window.__cmwLandPick); All sheets: every member
//   (the same number of layers, the same heights within HEIGHT_TOL); sheets off: one layer, a member's height;
// - the image: u = 0.002 is plane z's parked frame and u = 0.998 the next plane's, at most SAME_FRAC of the pixels more
//   than DIFF_TOL apart (the exact images' tolerance, steps_sm_standin_cmd.js);
// - the coverage: the frame has at least the surface pixels (saturation over 30) of the parked planes less COVER_TOL,
//   the smaller of the two at u = 0.5.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const VIEW_W = 1440, VIEW_H = 900;
const LOAD_MAX_MS = 60000;
// (settled() answers once the programs are linked; the frame itself is drawn a few animation frames later, and lavapipe draws a
// Landscape frame in under a second, so FRAME_MS leaves room for the slowest: there is no frame counter on a Landscape frame to wait on)
const FRAME_MS = 1500;
const GLIDE_U = [0.002, 0.5, 0.998];
const NEWTON_END = 1e-4;   // a polynomial's step runs its path several times as fast as the glide's u: its ends are this far from the planes
// (#859's look suite: DIFF_TOL is test/lib/held_frames.js's, SAME_FRAC steps_glide_look_cmd.js:54)
const DIFF_TOL = 32, SAME_FRAC = 0.005;
const COVER_TOL = 0.05;                       // the share of the parked planes' surface pixels a frame may lack
const HEIGHT_TOL = 0.02;                      // the drawn height, world units (a box is about 2 wide)
const PROBES = 5, SEED_N = 12, NEWTON_STEPS = 40, ROOT_TOL = 1e-9, SAT_MIN = 30;
// the reference's numerics: FD_STEP the finite-difference step of H's Jacobian, DET_MIN a Jacobian determinant below which Newton's
// step is not taken, RESIDUAL_MAX the largest |H(z) - w| of a member, SAME_ROOT the distance under which two roots are one
const FD_STEP = 1e-6, DET_MIN = 1e-14, RESIDUAL_MAX = 1e-6, SAME_ROOT = 1e-5;
const DENSE_N = 48, NEAR_N = 12;   // the completeness sample: DENSE_N x DENSE_N points of plane 0's box; the NEAR_N whose image is nearest w are polished too
const ANN = [{ id: 'a1', kind: 'annulus', c: [0, 0], r: 1, r2: 3, visible: true }];
const CASES = [
  { tag: 'Möbius, √', steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }], shapes: [] },
  { tag: 'log of an annulus', steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], shapes: ANN },
  { tag: 'cube root', steps: [{ type: 'root', params: { n: 3 }, on: true }], shapes: [] },
  { tag: 'Joukowski airfoil', example: 'Joukowski airfoil' },
  { tag: 'Roots as preimages', example: 'Roots as preimages', end: NEWTON_END },
  { tag: 'Partial sums of the exponential (Newton)', example: 'Partial sums of the exponential', end: NEWTON_END },
];
// the page's helpers: the surface pixels of the left pane, and the exact reference's preimages of a place
const HELP = `window.__lx = {
  grab: () => { const c = document.getElementById('canvasL'); return { W: c.width, H: c.height, d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data }; },
  cover: (F) => { let n = 0; for (let i = 0; i < F.d.length; i += 4) if (Math.max(F.d[i], F.d[i + 1], F.d[i + 2]) - Math.min(F.d[i], F.d[i + 1], F.d[i + 2]) > ${SAT_MIN}) n++; return n; },
  diff: (A, B) => { let over = 0, n = A.d.length / 4; for (let i = 0; i < A.d.length; i += 4) if (Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2])) > ${DIFF_TOL}) over++; return over / n; },
};
window.__lxPick = null;
window.__lxRoots = (pts) => {
  const g = __cmwSvGlobe(0, 0), H = g.H, pk = window.__lxPick, b = pk.box, C = (re, im) => ({ re, im });
  const seeds = [];
  for (let i = 0; i < ${SEED_N}; i++) for (let j = 0; j < ${SEED_N}; j++) seeds.push(C(b.x0 + (i + 0.5) * (b.x1 - b.x0) / ${SEED_N}, b.y0 + (j + 0.5) * (b.y1 - b.y0) / ${SEED_N}));
  const dense = [];
  for (let i = 0; i < ${DENSE_N}; i++) for (let j = 0; j < ${DENSE_N}; j++) { const z = C(b.x0 + (i + 0.5) * (b.x1 - b.x0) / ${DENSE_N}, b.y0 + (j + 0.5) * (b.y1 - b.y0) / ${DENSE_N}), f = H(z); if (f && Number.isFinite(f.re) && Number.isFinite(f.im)) dense.push({ z, f }); }
  const newton = (s, re, im) => {
    let z = s;
    for (let k = 0; k < ${NEWTON_STEPS}; k++) {
      const h = ${FD_STEP}, f = H(z), fr = H(C(z.re + h, z.im)), fi = H(C(z.re, z.im + h));
      if (!f || !fr || !fi || ![f.re, f.im, fr.re, fr.im, fi.re, fi.im].every(Number.isFinite)) return null;
      const a = (fr.re - f.re) / h, c = (fr.im - f.im) / h, bb = (fi.re - f.re) / h, d = (fi.im - f.im) / h, det = a * d - bb * c;
      if (!(Math.abs(det) > ${DET_MIN})) return null;
      const er = f.re - re, ei = f.im - im, dr = (d * er - bb * ei) / det, di = (-c * er + a * ei) / det;
      z = C(z.re - dr, z.im - di);
      if (Math.hypot(dr, di) < ${ROOT_TOL}) break;
    }
    const f = H(z);
    return f && Math.hypot(f.re - re, f.im - im) <= ${RESIDUAL_MAX} ? z : null;   // (the residual of each member)
  };
  return pts.map(([re, im]) => {
    const roots = [];
    // (the grid's seeds, and the dense sample's points whose image is nearest w: no member is left that the forward map of a plane 0 sample lands beside)
    const near = dense.slice().sort((p, q) => Math.hypot(p.f.re - re, p.f.im - im) - Math.hypot(q.f.re - re, q.f.im - im)).slice(0, ${NEAR_N}).map((p) => p.z);
    for (const s of seeds.concat(near)) {
      const z = newton(s, re, im);
      if (z && !roots.some((r) => Math.hypot(r.re - z.re, r.im - z.im) < ${SAME_ROOT})) roots.push(z);
    }
    return roots.map((z) => ({ z: [z.re, z.im], h: pk.height(pk.F(z)) }));
  });
};
1`;
async function load(c, sheets) {
  const ns = 'landexact' + Date.now();
  if (c.example) {
    await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
    await settled({ max: LOAD_MAX_MS, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
    await ev(`__cmwExample(${names.indexOf(c.example)}); 1`); await settled({ max: LOAD_MAX_MS });
    await ev(`__cmwSet('alpha', 1), __cmwSet('height', 'im'), __cmwSet('sheets', ${sheets}), 1`);
  } else {
    await loadView('steps', ns, { shapes: c.shapes, steps: c.steps, sheets, height: 'im' });
    await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
    await settled({ max: LOAD_MAX_MS, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  }
  await ev(HELP);
}
// the plane at index k parked and its frame kept as tag; its height reading kept for the references
async function park(k, tag) {
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: ${k}, now: true, clock: 0 }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2); await sleep(FRAME_MS);
  return ev(`(() => { window.__lx[${JSON.stringify(tag)}] = __lx.grab(); const p = __cmwLandPick(); if (p && ${k} === 0) window.__lxPick = p; return { cover: __lx.cover(__lx[${JSON.stringify(tag)}]), pick: !!p }; })()`);
}
await view(VIEW_W, VIEW_H, false, false);
for (const c of CASES) for (const sheets of [false, true]) {
  const name = `${c.tag}, ${sheets ? 'All sheets' : 'sheets off'}`;
  const r = info[name] = {};
  await load(c, sheets);
  const last = 1;   // (the glide from plane 0 to plane 1)
  const p0 = await park(0, 'P0'), p1 = await park(last, 'P1');
  ok(`${name}: the parked frames have a height reading`, p0.pick && p1.pick, { p0, p1 });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`);
  for (const u0 of GLIDE_U) {
    const u = c.end ? (u0 < 0.5 ? c.end : u0 > 0.5 ? 1 - c.end : u0) : u0, first = u0 === GLIDE_U[0], lastU = u0 === GLIDE_U[GLIDE_U.length - 1];
    const t = `${name}, u=${u}`;
    await ev(`__cmwSteps({ x: ${u} }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2); await sleep(FRAME_MS);
    const carry = await ev('(() => { const c = __cmwLandCarry(); return c && { path: c.path || null, u: c.u }; })()');
    const cov = await ev(`(() => { const F = __lx.grab(); window.__lx.cur = F; return { n: __lx.cover(F), d0: __lx.diff(F, __lx.P0), d1: __lx.diff(F, __lx.P1) }; })()`);
    r[u] = { carry, cov, p0: p0.cover, p1: p1.cover };
    ok(`${t}: a carried frame`, !!carry, carry);
    // the path
    ok(`${t}: the frame is drawn by the inverse path`, carry && carry.path === 'inverse', carry);
    // the image at the ends
    if (first) ok(`${t}: plane z's parked frame (at most ${SAME_FRAC * 100} % of pixels over ${DIFF_TOL})`, cov.d0 <= SAME_FRAC, cov);
    if (lastU) ok(`${t}: the next plane's parked frame (at most ${SAME_FRAC * 100} % of pixels over ${DIFF_TOL})`, cov.d1 <= SAME_FRAC, cov);
    // the coverage
    const base = first ? p0.cover : lastU ? p1.cover : Math.min(p0.cover, p1.cover);
    ok(`${t}: at least the parked planes' surface pixels less ${COVER_TOL * 100} %`, cov.n >= (1 - COVER_TOL) * base, { n: cov.n, base });
    // the geometry
    const pts = await ev(`(() => { const b = __cmwLandCarry(true) || __lxPick.box; const o = []; for (let i = 0; i < ${PROBES}; i++) for (let j = 0; j < ${PROBES}; j++) o.push([b.x0 + (i + 0.5) * (b.x1 - b.x0) / ${PROBES}, b.y0 + (j + 0.5) * (b.y1 - b.y0) / ${PROBES}]); return o; })()`);
    const ref = await ev(`__lxRoots(${JSON.stringify(pts)})`);
    const refN = ref.filter((x) => x.length).length;
    r[u] = Object.assign(r[u], { refPlaces: refN });
    ok(`${t}: the CPU reference finds preimages at a probe place (${refN} of ${pts.length})`, refN > 0, { refN });
    const got = await ev(`typeof __cmwLandFrameVerts === 'function' ? __cmwLandFrameVerts(${JSON.stringify(pts)}) : null`);
    ok(`${t}: the frame's draw data is readable (window.__cmwLandFrameVerts)`, Array.isArray(got), null);
    if (Array.isArray(got)) {
      let bad = 0, n = 0; const at = [];
      pts.forEach((p, i) => {
        const want = (ref[i] || []).map((x) => x.h).sort((a, b) => a - b), have = (got[i] || []).map((x) => x.h).sort((a, b) => a - b);
        if (!want.length && !have.length) return;
        n++;
        const same = sheets ? want.length === have.length && want.every((h, k) => Math.abs(h - have[k]) <= HEIGHT_TOL)
          : have.length === 1 && want.some((h) => Math.abs(h - have[0]) <= HEIGHT_TOL);
        if (!same) { bad++; if (at.length < 4) at.push({ p, want, have }); }
      });
      r[u].geometry = { n, bad, at };
      ok(`${t}: ${sheets ? 'every member' : 'the front member'} at every probe place (${n} places)`, n > 0 && bad === 0, { n, bad, at });
    }
  }
}
return { pass: !fails.length, fails, info };
