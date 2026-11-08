// The steps view's Landscape glide is exact: a moving frame at u between plane z and the next is drawn like a parked
// frame, an N x N grid over the shown plane's box, but its height and colour at a place w come from the preimages
// z = H_u^-1(w) of the glide's map H_u (the inverse plan, src/inverse.js), not from plane z's grid pushed forward through
// H_u. The cases (Landscape of Im F, one pane and camera, each with Inside regions' sheets off or with All sheets):
// the square root under a Möbius map, the logarithm of an annulus, a cube root, the Joukowski airfoil, Roots as preimages
// and the partial sums of the exponential (the last two draw through the Newton's roots pass). Each is held at
// u = END_U, 0.5 and 1 - END_U of the glide from the first plane to the second, where:
// - the path: the frame's record says 'inverse' (render3D.carried.path), not 'mesh';
// - the geometry: at probe places w (a grid over the box and a pair either side of the real axis) the frame's per-vertex draw
//   data (window.__cmwLandFrameVerts(pts): per place the layers the frame draws there, { h: height, f: F, member, w }) is the CPU
//   reference's: Newton's method for H_u(z) = w from seeds over the plane's box, h = the height of the plane's value at z
//   (window.__cmwLandPick); All sheets: every member (the same number of layers, the same heights within HEIGHT_TOL; the seeds
//   span SEED_SPAN boxes for the far members); sheets off: one layer, the front member, the root continued along u from the first
//   probe; and the layers' colour is the members' (arg F within PHASE_TOL);
// - the coverage: COVER_NX x COVER_NY places over the box are each drawn (the frame has a layer at its grid vertex) or covered (the
//   reference has a preimage there), and at most CELL_TOL of them differ either way; at the ends also the surface pixels (saturation
//   over 30, the measure of steps_land_cover_cmd.js's surface(), counted on the kit's kept pixels) are at least the parked plane's
//   less COVER_TOL; negative controls: a hole, and a wall filled across the cut, fail the comparison;
// - the image: u = END_U is plane z's parked frame and u = 1 - END_U the next plane's, at most SAME_FRAC of the pixels more
//   than DIFF_TOL apart (the exact images' tolerance, steps_sm_standin_cmd.js).
// An expression for eval in a command file of a CDP daemon (test/cdp_kit README), which sees its globals (fs, DIR, ev, go,
// settled, loadView, view): `return await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'land_exact.js'), 'utf8'))(modes)`, with modes the
// Inside regions' sheets settings to run, [false] (sheets off) or [true] (All sheets). Answers {pass, fails, info}.
(async (MODES) => {
  const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
  const fails = [], info = {};
  const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
  const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
  const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
  const VIEW_W = 1440, VIEW_H = 900;
  const LOAD_MAX_MS = 60000;
  const GLIDE_U = [0.002, 0.5, 0.998];
  // The end probes are END_U from the planes for every case: a polynomial's step runs its path several times as fast as the glide's u,
  // and the height axis's scale is a log-lerp of the two planes' scales, so a correct frame at u = 0.002 or 0.998 differs from the parked
  // plane by O(1 - u) (a 1 px silhouette and contour shift: the cube root is 0.6 % against SAME_FRAC); END_U is where that is below it.
  const END_U = 1e-4;
  const { grab, compare, DIFF_TOL, SAME_FRAC } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));   // (the look suite's constants)
  // the share of the parked plane's surface pixels a frame at an end may lack: it is the parked plane's within SAME_FRAC of its pixels,
  // so a surface pixel it lacks is one of those
  const COVER_TOL = SAME_FRAC;
  // the coverage at every u, against the CPU reference: COVER_NX x COVER_NY places over the box, each drawn (the frame has a layer at
  // its grid vertex) or covered (the reference has a preimage there); the places that differ either way are at most CELL_TOL of them
  // (two places of the grid: a vertex beside a cut falls on either side of it); the controls' hole is 8 places and the wall fills one column
  const COVER_NX = 20, COVER_NY = 14, CELL_TOL = 0.02, HOLE_N = 8;
  const PHASE_TOL = 2 * Math.PI / 180, F_ABS_MIN = 1e-3;   // the member's colour (arg F): at most 2 degrees apart where |F| is not near 0
  const CUT_X = [0.1, 0.3], CUT_OFF = 0.01;                 // probes either side of the real axis: at these shares of the box's width, this share of its height off the axis
  const TRACK_STEPS = 10;                                   // the u steps between two probes along which the front member is continued
  const SEED_SPAN = 3;                                      // All sheets: the reference's seed window is this many times the box, for the far members drawn as their own layers
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
    { tag: 'Roots as preimages', example: 'Roots as preimages' },
    { tag: 'Partial sums of the exponential (Newton)', example: 'Partial sums of the exponential' },
  ];
  // the page's helpers: the surface pixels of the left pane, and the exact reference's preimages of a place
  const HELP = `window.__lx = {
    cover: (tag) => { const d = window.__heldPx[tag]; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > ${SAT_MIN}) n++; return n; }
  };
  window.__lxPick = null;
  window.__lxRoots = (pts, tracks, span) => {
    const g = __cmwSvGlobe(0, 0), H = g.H, pk = window.__lxPick, b0 = pk.box, C = (re, im) => ({ re, im });
    const cx = (b0.x0 + b0.x1) / 2, cy = (b0.y0 + b0.y1) / 2, sp = span || 1, b = { x0: cx - sp * (b0.x1 - b0.x0) / 2, x1: cx + sp * (b0.x1 - b0.x0) / 2, y0: cy - sp * (b0.y1 - b0.y0) / 2, y1: cy + sp * (b0.y1 - b0.y0) / 2 };
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
    return pts.map(([re, im], pi) => {
      const roots = [];
      if (tracks) {   // (the front member continued: Newton from the place's previous root alone)
        const t = tracks[pi], z = t && newton(C(t[0], t[1]), re, im);
        if (!z) return [];
        const f = pk.F(z);
        return [{ z: [z.re, z.im], f: [f.re, f.im], h: typeof __cmwLandFrameHeight === 'function' ? __cmwLandFrameHeight([f.re, f.im]) : pk.height(f) }];
      }
      // (the grid's seeds, and the dense sample's points whose image is nearest w: no member is left that the forward map of a plane 0 sample lands beside)
      const near = dense.slice().sort((p, q) => Math.hypot(p.f.re - re, p.f.im - im) - Math.hypot(q.f.re - re, q.f.im - im)).slice(0, ${NEAR_N}).map((p) => p.z);
      for (const s of seeds.concat(near)) {
        const z = newton(s, re, im);
        if (z && !roots.some((r) => Math.hypot(r.re - z.re, r.im - z.im) < ${SAME_ROOT})) roots.push(z);
      }
      // (the frame logLerps its height scale over u: the height is the frame's own, __cmwLandFrameHeight, when the page has it)
      return roots.map((z) => { const f = pk.F(z); return { z: [z.re, z.im], f: [f.re, f.im], h: typeof __cmwLandFrameHeight === 'function' ? __cmwLandFrameHeight([f.re, f.im]) : pk.height(f) }; });
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
    await settled({ max: LOAD_MAX_MS * 2, until: '__cmwSteps().ready.ready' });   // (the prestart's idle warm draw lands in the GL canvas next to a requested frame while it runs)
    await ev(HELP);
  }
  // the plane at index k parked and its frame kept as tag; its height reading kept for the references
  async function park(k, tag) {
    await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: ${k}, now: true, clock: 0 }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
    const still = await grab(tag);   // (the kit's grab: the first pixels that stay the same from one read to the next)
    return ev(`(() => { const p = __cmwLandPick(); if (p && ${k} === 0) window.__lxPick = p; return { still: ${still}, cover: __lx.cover(${JSON.stringify(tag)}), pick: !!p }; })()`);
  }
  // the places a frame is probed at: PROBES x PROBES cell centres of the box, and a pair either side of the real axis (the
  // cut of the square root, the cube root and the logarithm) at each of CUT_X
  const probes = (b) => {
    const o = [], w = b.x1 - b.x0, h = b.y1 - b.y0;
    for (let i = 0; i < PROBES; i++) for (let j = 0; j < PROBES; j++) o.push([b.x0 + (i + 0.5) * w / PROBES, b.y0 + (j + 0.5) * h / PROBES]);
    for (const xf of CUT_X) for (const s of [1, -1]) o.push([b.x0 + xf * w, s * CUT_OFF * h]);
    return o;
  };
  const cells = (b) => {
    const o = [];
    for (let j = 0; j < COVER_NY; j++) for (let i = 0; i < COVER_NX; i++) o.push([b.x0 + (i + 0.5) * (b.x1 - b.x0) / COVER_NX, b.y0 + (j + 0.5) * (b.y1 - b.y0) / COVER_NY]);
    return o;
  };
  // the places that differ between what a frame draws and what the reference covers, each way, as a share of all
  const coverDiff = (drawn, covered) => {
    let missing = 0, extra = 0;
    drawn.forEach((d, i) => { if (covered[i] && !d) missing++; else if (!covered[i] && d) extra++; });
    return { missing, extra, n: drawn.length, off: (missing + extra) / drawn.length };
  };
  // the controls: a frame equal to the reference passes; a frame with HOLE_N places of surface left out, and one that fills the
  // cut's column (a wall drawn across the cut) both fail
  {
    const cut = Math.floor(COVER_NX / 2), covered = [];
    for (let j = 0; j < COVER_NY; j++) for (let i = 0; i < COVER_NX; i++) covered.push(i !== cut);
    const hole = covered.slice(), wall = covered.slice();
    let k = 0;
    for (let i = 0; i < hole.length && k < HOLE_N; i++) if (hole[i]) { hole[i] = false; k++; }
    for (let i = 0; i < wall.length; i++) if (!wall[i]) wall[i] = true;
    ok('the coverage check passes a frame equal to the reference', coverDiff(covered, covered).off === 0, null);
    ok(`the coverage check fails a frame with a hole of ${HOLE_N} places`, coverDiff(hole, covered).off > CELL_TOL, coverDiff(hole, covered));
    ok('the coverage check fails a wall filled across the cut', coverDiff(wall, covered).off > CELL_TOL, coverDiff(wall, covered));
  }
  // the colour of a member: the angle between two values of F, or null where either is near 0
  const phaseGap = (a, b) => {
    if (Math.hypot(a[0], a[1]) < F_ABS_MIN || Math.hypot(b[0], b[1]) < F_ABS_MIN) return null;
    return Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));
  };
  const setU = async (x) => { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2); };
  await view(VIEW_W, VIEW_H, false, false);
  for (const c of CASES) for (const sheets of MODES) {
    const name = `${c.tag}, ${sheets ? 'All sheets' : 'sheets off'}`;
    const r = info[name] = {};
    await load(c, sheets);
    const last = 1;   // (the glide from plane 0 to plane 1)
    const p0 = await park(0, 'P0'), p1 = await park(last, 'P1');
    ok(`${name}: the parked frames are still and have a height reading`, p0.still && p1.still && p0.pick && p1.pick, { p0, p1 });
    await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`);
    // the front member of sheets off, continued along u from the first probe: the place's root, per probe place
    let track = null, vfirst = null, prevU = null;
    for (const u0 of GLIDE_U) {
      const u = u0 < 0.5 ? END_U : u0 > 0.5 ? 1 - END_U : u0, first = u0 === GLIDE_U[0], lastU = u0 === GLIDE_U[GLIDE_U.length - 1];
      const t = `${name}, u=${u}`;
      if (track) {
        for (let k = 1; k < TRACK_STEPS; k++) {
          await setU(prevU + (u - prevU) * k / TRACK_STEPS);
          track = (await ev(`__lxRoots(${JSON.stringify(vfirst)}, ${JSON.stringify(track)})`)).map((x) => (x[0] ? x[0].z : null));
        }
      }
      await setU(u);
      const still = await grab('cur');
      const carry = await ev('(() => { const c = __cmwLandCarry(); return c && { path: c.path || null, u: c.u }; })()');
      const cov = { still, n: await ev(`__lx.cover('cur')`), d0: (await compare('cur', 'P0')).frac, d1: (await compare('cur', 'P1')).frac };
      r[u] = { carry, cov, p0: p0.cover, p1: p1.cover };
      ok(`${t}: a still, carried frame`, cov.still && !!carry, { carry, still: cov.still });
      // the path
      ok(`${t}: the frame is drawn by the inverse path`, carry && carry.path === 'inverse', carry);
      // the image at the ends
      if (first) ok(`${t}: plane z's parked frame (at most ${SAME_FRAC * 100} % of pixels over ${DIFF_TOL})`, cov.d0 <= SAME_FRAC, cov);
      if (lastU) ok(`${t}: the next plane's parked frame (at most ${SAME_FRAC * 100} % of pixels over ${DIFF_TOL})`, cov.d1 <= SAME_FRAC, cov);
      // the surface pixels at the ends
      if (first || lastU) {
        const base = first ? p0.cover : p1.cover;
        ok(`${t}: at least the parked plane's surface pixels less ${COVER_TOL * 100} %`, cov.n >= (1 - COVER_TOL) * base, { n: cov.n, base });
      }
      // the geometry
      const box = await ev('(() => { const b = __cmwLandCarry(true) || (window.__lxPick && window.__lxPick.box); return b ? { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 } : null; })()');
      ok(`${t}: the frame's box is readable`, !!box, null);
      if (!box) { prevU = u; continue; }
      const pts = probes(box), cpts = cells(box);
      const hook = (q) => ev(`typeof __cmwLandFrameVerts === 'function' ? __cmwLandFrameVerts(${JSON.stringify(q)}) : null`);
      const got = await hook(pts), cgot = await hook(cpts);
      // (the place the frame draws a probe at is its nearest grid vertex: the reference is read there, where a cut or a steep height would make the probe's own offset a false failure)
      const at1 = (g, q) => q.map((p, i) => (g && g[i] && g[i][0] && g[i][0].w) || p);
      const vpts = at1(got, pts), cw = at1(cgot, cpts);
      const ref = await ev(`__lxRoots(${JSON.stringify(vpts)}, null, ${sheets ? SEED_SPAN : 1})`);
      const refN = ref.filter((x) => x.length).length;
      r[u] = Object.assign(r[u], { refPlaces: refN });
      ok(`${t}: the CPU reference finds preimages at a probe place (${refN} of ${pts.length})`, refN > 0, { refN });
      ok(`${t}: the frame's draw data is readable (window.__cmwLandFrameVerts)`, Array.isArray(got) && Array.isArray(cgot), null);
      if (!Array.isArray(got) || !Array.isArray(cgot)) { prevU = u; continue; }
      // the front member of sheets off: at the first probe the root nearest the place (the glide is the plane there), then continued
      if (!sheets) {
        if (!track) {
          vfirst = vpts;
          track = ref.map((x, i) => (x.length ? x.reduce((a, b) => (Math.hypot(a.z[0] - vpts[i][0], a.z[1] - vpts[i][1]) <= Math.hypot(b.z[0] - vpts[i][0], b.z[1] - vpts[i][1]) ? a : b)).z : null));
        } else {
          track = (await ev(`__lxRoots(${JSON.stringify(vfirst)}, ${JSON.stringify(track)})`)).map((x) => (x[0] ? x[0].z : null));
        }
      }
      const front = !sheets ? await ev(`__lxRoots(${JSON.stringify(vfirst)}, ${JSON.stringify(track)})`) : null;
      let bad = 0, n = 0, lost = 0, badPh = 0, phN = 0, noF = 0; const at = [], atPh = [];
      pts.forEach((p, i) => {
        const wantAll = ref[i] || [], haveAll = got[i] || [];
        if (!wantAll.length) return;   // (a place with no preimage in the reference is not compared; the reference's own check says it finds some)
        let want = wantAll;
        if (!sheets) {
          if (!front[i] || !front[i][0]) { lost++; return; }
          want = front[i];
        }
        n++;
        const hs = (a) => a.map((x) => x.h).sort((x, y) => x - y), wh = hs(want), hh = hs(haveAll);
        const same = sheets ? wh.length === hh.length && wh.every((h, k) => Math.abs(h - hh[k]) <= HEIGHT_TOL)
          : hh.length === 1 && Math.abs(hh[0] - wh[0]) <= HEIGHT_TOL;
        if (!same) { bad++; if (at.length < 4) at.push({ p, want: wh, have: hh }); return; }
        // (the member's colour: the layers sorted by height pair up with the reference's members)
        const wo = want.slice().sort((x, y) => x.h - y.h), ho = haveAll.slice().sort((x, y) => x.h - y.h);
        wo.forEach((m, k) => {
          if (!ho[k].f) { noF++; return; }
          const gap = phaseGap(ho[k].f, m.f);
          if (gap === null) return;
          phN++;
          if (gap > PHASE_TOL) { badPh++; if (atPh.length < 4) atPh.push({ p, have: ho[k].f, want: m.f }); }
        });
      });
      r[u].geometry = { n, bad, lost, at, phN, badPh, noF };
      ok(`${t}: ${sheets ? 'every member' : 'the front member'} at every probe place (${n} places)`, n > 0 && bad === 0, { n, bad, at });
      if (!sheets) ok(`${t}: the front member is continued along u at every probe place (${lost} lost)`, lost === 0, { lost });
      ok(`${t}: the members' colour (arg F) within ${PHASE_TOL * 180 / Math.PI} degrees (${phN} members; the draw data carries F: ${noF} without)`, noF === 0 && badPh === 0, { phN, badPh, noF, atPh });
      // the coverage: the places the frame draws against the places the reference covers
      const cref = await ev(`__lxRoots(${JSON.stringify(cw)}, null, ${sheets ? SEED_SPAN : 1})`);
      const cd = coverDiff(cgot.map((x) => !!(x && x.length)), cref.map((x) => x.length > 0));
      r[u].coverage = cd;
      ok(`${t}: the places drawn are the places covered, both ways (${cd.missing} missing, ${cd.extra} extra of ${cd.n}; at most ${CELL_TOL * 100} % differ)`, cd.off <= CELL_TOL, cd);
      prevU = u;
    }
  }
  return { pass: !fails.length, fails, info };
})
