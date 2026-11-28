// The steps view's carried Landscape against its exact surface on the screen (#1155): the chord error of each grid the
// carried draw keeps triangles of, read on the CPU by __cmwLandChordPx (each kept triangle's chord against the exact
// point (F(z), h(z)) at its centroid and its edges' midpoints, both projected with the frame's camera, in css px), and
// each frame's pixels against the same frame with the far rings drawn fine (GLR._lw.farN [512, 384]); and the carried
// grids' jump rule (LAND_CARRY_NRM_VS, mirrored on the CPU) against the carry's map, read by __cmwLandJumps's bisection
// oracle. Three scenes:
// - A: the log of an annulus, Im heights, coloured from z, held at u = .05, .1, .25, .5 and .75, and parked on w₁;
// - B: the default page (z, exp, Möbius), Everywhere, T = w₂, log |F|, held at u = .25, .5 and .75;
// - C: z³ parked on w₁, coloured from z: a carry whose map has no jump.
// Checked:
// (i) on a smooth part of B's box (its points of plane z with 0.4 <= |z| <= 1.5: the slope down to F's zero at 0, short
//     of its spike and away from F's poles at ±πi) the triangles read, and none is off by more than 0.5 px: where the
//     cells are fine for the surface, the hook's chord and exact point agree, so its larger readings elsewhere are the
//     chords';
// (ii) B's outer far ring at u = .25, .5 and .75 has kept triangles and none off by more than 3 px: the ring covers only
//     the ring outside the strip of its copies of the box and the inner ring (svDupTheta), with no cell reaching into the
//     strip across its edge;
// (iii) with the far rings drawn at 32 points a side (GLR._lw.farN), B's inner ring at u = .5 reads triangles off by more
//     than 3 px: the hook reads the rings the frame drew;
// (iv) A's box at u = .25, .5 and .75 keeps no triangle across a jump of the log's glide (the oracle finds jumps there,
//     and none is an edge of a kept triangle), and none off by more than 3 px: the jump rule leaves out the slivers that
//     bridged the slit along the cut;
// (iv') with the rule off (GLR._lw.noJump), A's box at those u keeps triangles off by more than 3 px: (iv) reads the rule;
// (v) B at u = .5 and C keep the same triangles, grid by grid, with and without the rule: it leaves out nothing where the
//     carry's map has no jump;
// (vi) A parked on w₁: at most PX_FINE_MAX of its surface's pixels apart from the fine-ring frame. Its height, z's own Im
//     z = e^Re w sin(Im w), has no cut, so its walls at Im w = 0 and ±π are drawn (carryStep), not left out in fins, and
//     the outer ring's columns crowd toward them (svLandFarWalls), so the frame is the fine-ring frame's;
// (vii) A parked on w₁: its far rings keep triangles, and no cell is off by more than 3 px from the surface (geo, in the
//     frame's world space at depth, both ways: a kept triangle against the surface over it, and the surface over a
//     triangle the height step left out against the kept ones, where no jump of the height explains the gap: geoCut). A
//     wall narrower than its cell leaves a chord parametrically far from the points of its z (off, info), while the surface
//     it draws is the exact one's; the fins of (vi) left the wall's surface out;
// (viii) geoCut's test (__cmwLandCutCell), on the triangle (0, 0), (1, 0), (0, 1) of a two-point grid over the plane: arg z
//     across its cut on the negative reals is a jump, and atan(10⁴ Re z) across 0, as steep but continuous, is not; a step
//     of 5 across Re z + Im z = 0.5 (on two edges) explains the cell, and with a wall 0.8 atan(10⁴ (Re z − Im z − 0.3)) does
//     not: under the step, it leaves edge (0, 0)–(1, 0) jumping, and its third edge steps by the wall alone;
// (ix) A at u = .75, whose carry has no period: at most DEPTH_FRAC of the surface's pixels apart from the same frame with
//     the far rings drawn by depth alone, without the stencil (GLR._lw.farDepth): where the outer ring lies in front of
//     the back of the box's corner, it is drawn there;
// (x) C, a carry with no period whose map is not one to one (z³: a ring point and a box point land on one spot at one
//     height in different colours): its rings are alone (svLandFar), and its frame is the same with the second pass off
//     (GLR._lw.noAlone), at most SAME_PX_FRAC of its pixels apart: no ring cell shows through the box where they meet;
// (xi) B at u = .5, a periodic carry (exp): its rings are not alone, so they keep only the stencil;
// (xii) D, z² over a disc about 0 held at u = .5, |F| heights (they follow the place), coloured from z: a carry with no
//     period whose glide is two to one about 0, so ring points z and box points -z land on one spot at one height in
//     different colours. As (x): its rings are alone, and its frame is the same with the second pass off.
// The rest is read, not checked (info): each frame's rows per grid ({tris, off, worst, at, place, height, inDisc, geo,
// geoWorst, geoAt, stepped, geoCut}), its
// jump rows ({edges, jumps, flagged, missed, extra, maxCont, minJump, across}: J's margin; at u = .05, early in the glide,
// a jump is small against its neighbours (ratio down to about 2.7, under CARRY_JUMP_J), so a few are not flagged and a
// kept triangle may bridge one: a lower J would come within reach of the continuous edges' ratios), and its pixel row:
// the share of the surface's pixels (a pixel coloured in either frame, its channels more than SAT apart) more than PX_TOL
// apart in a channel from the fine-ring frame.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = { A: {}, B: {} };
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const PNG = process.mainModule.require(path.join(DIR, 'png.js'));
const TOL = 3;                         // css px: a triangle off by more is counted (off)
const SMOOTH_TOL = 0.5;                // css px: (i)'s bound
const FINE = [512, 384], COARSE = [32, 32];   // the far rings' points a side for the reference frame and for (iii)
const PX_TOL = 30, SAT = 24;           // (the pixel rows: a channel more than PX_TOL apart; a surface pixel's channels span more than SAT)
const PX_FINE_MAX = 0.02;              // (vi)'s bound on the share of pixels apart from the fine-ring frame
const SAME_PX_FRAC = 0.001;            // (x)'s bound: 0 measured
const DEPTH_FRAC = 0.005;               // (ix)'s bound: the stencil hid 2.2 % of the surface there, the depth draw leaves 0.04 % apart
const LIM = 300000;

const chord = (o = '') => evJson(`JSON.stringify(__cmwLandChordPx(${o}))`, LIM);
const jumps = () => evJson('JSON.stringify(__cmwLandJumps())', LIM);
// the kept triangles per grid (the chord rows' tris)
const counts = (rows) => Object.fromEntries(Object.entries(rows || {}).map(([k, r]) => [k, r.tris]));
const carried = () => evJson('JSON.stringify((({ u, s, far }) => ({ u, s, far: (far || []).map((p) => p[4]), alone: (far || []).map((p) => !!p.alone) }))(__cmwLandCarry() || {}))');
const pane = () => ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(); return [o.left, o.top, o.width, o.height]; })()`);
// the frame redrawn with the knob set (null: unset), once it has settled
const redraw = async (lw) => {
  await ev(`(${lw ? `GLR._lw = ${JSON.stringify(lw)}` : 'delete GLR._lw'}, __cmwLandSeams(true), 1)`);
  await settled({ max: 120000 });
};
// the share of the surface's pixels in the pane more than PX_TOL apart between the frame now and the same frame with the
// knob lw set (the fine-ring frame by default)
const pixelRow = async (tag, lw = { farN: FINE }) => {
  const r = await pane(), a = PNG(fs.readFileSync(await shot(`chord-${tag}`)));
  await redraw(lw);
  const b = PNG(fs.readFileSync(await shot(`chord-${tag}-ref`)));
  await redraw(null);
  let n = 0, apart = 0;
  for (let y = Math.ceil(r[1]); y < r[1] + r[3]; y++) for (let x = Math.ceil(r[0]); x < r[0] + r[2]; x++) {
    const p = a.at(x, y), q = b.at(x, y), sat = (c) => Math.max(...c) - Math.min(...c);
    if (sat(p) <= SAT && sat(q) <= SAT) continue;
    n++;
    if (Math.max(...[0, 1, 2].map((k) => Math.abs(p[k] - q[k]))) > PX_TOL) apart++;
  }
  return { n, apart, share: n ? +(apart / n).toFixed(4) : null };
};
const held = async (u) => {
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  await settled({ max: 60000 });
  await hold(u);
  await settled({ max: 60000 });
};
const letGo = async () => { await ev('window.__svScrubUp(), 1'); await settled({ max: 60000 }); };
await view(1440, 900, false, false);

// ---- A: the log of an annulus, Im heights, coloured from z
await loadView('steps', `chordA${Date.now()}`, { shapes: [{ id: 'a1', kind: 'annulus', c: [0, 0], r: 1, r2: 3, visible: true }], steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], sheets: false, height: 'im' });
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 0, go: 0, now: true, clock: 0 }); 1`);
await settled({ max: 90000, until: '__cmwSteps().ready.ready' });
for (const u of [0.05, 0.1, 0.25, 0.5, 0.75]) {
  await held(u);
  const c = await carried();
  ok(`A, held at u = ${u}: a carried frame from plane z`, c.s === 0 && Math.abs(c.u - u) < 0.004, c);
  const rows = await chord(), jm = await jumps();
  info.A['u' + u] = { rows, jumps: jm };
  if (u === 0.5) info.A['u' + u].px = await pixelRow('A-u0.5');
  if (u >= 0.25) {
    ok(`A, held at u = ${u} (iv): the box keeps no triangle across a jump of the log's glide, and none off by more than ${TOL} px`, !!rows && !!jm && rows.box.off === 0 && jm.box.across === 0 && jm.box.jumps > 0, { box: rows && rows.box, jumps: jm && jm.box });
    await redraw({ noJump: true });
    const nj = await chord();
    info.A['u' + u].noJump = nj && nj.box;
    ok(`A, held at u = ${u} (iv'): with the jump rule off (GLR._lw.noJump) the box keeps triangles off by more than ${TOL} px`, !!nj && nj.box.off > 0, nj && nj.box);
    await redraw(null);
  }
  if (u === 0.75) {
    const fd = info.A['u' + u].farDepth = await pixelRow('A-u0.75-depth', { farDepth: true });
    ok(`A, held at u = ${u} (ix): the far rings are drawn where they lie in front of the box: at most ${DEPTH_FRAC * 100} % of the surface's pixels apart from the frame with them drawn by depth alone (GLR._lw.farDepth)`, fd.share !== null && fd.share <= DEPTH_FRAC, fd);
  }
  await letGo();
}
await ev(`__cmwSteps({ go: 1, now: true }); 1`);
await settled({ max: 90000, until: '__cmwSteps().ready.ready && __cmwSteps().i === 1' });
const cA = await carried();
ok('A, parked on w₁ coloured from z: a carried frame from plane z', cA.s === 0 && cA.u === 1, cA);
info.A.parked = { rows: await chord(), px: await pixelRow('A-parked') };
ok(`A, parked on w₁ (vi): at most ${PX_FINE_MAX} of the surface's pixels apart from the fine-ring frame`, !!info.A.parked.px && info.A.parked.px.n > 1000 && info.A.parked.px.share <= PX_FINE_MAX, info.A.parked.px);
const farA = Object.entries(info.A.parked.rows || {}).filter(([k]) => k.startsWith('far'));
ok(`A, parked on w₁ (vii): its far rings keep triangles, and no cell is off by more than ${TOL} px from the surface (geo)`, farA.length > 0 && farA.every(([, r]) => r.tris > 0 && r.geo === 0), Object.fromEntries(farA));

// ---- B: the default page, Everywhere, T = w₂
await go(`http://localhost:${PORT}/test.html?view=steps&ns=chordB${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 2, go: 0, now: true }); 1`);
await settled({ max: 60000 });
for (const u of [0.25, 0.5, 0.75]) {
  await held(u);
  const tag = `B, held at u = ${u}`, c = await carried();
  ok(`${tag}: a carried frame from plane z, with two far rings`, c.s === 0 && Math.abs(c.u - u) < 0.004 && c.far.length === 2, c);
  if (u === 0.5) ok(`${tag} (xi): a periodic carry's far rings are not alone (they keep only the stencil)`, c.alone.length === 2 && !c.alone.some(Boolean), c);
  const rows = await chord(), smooth = await chord(`{ tol: ${SMOOTH_TOL}, where: (x, y) => Math.hypot(x, y) >= 0.4 && Math.hypot(x, y) <= 1.5 }`);
  info.B['u' + u] = { rows, smooth: smooth && smooth.box, px: await pixelRow(`B-u${u}`) };
  ok(`${tag} (i): on the box's smooth part, triangles and none off by more than ${SMOOTH_TOL} px`, !!smooth && smooth.box.tris > 500 && smooth.box.worst <= SMOOTH_TOL, smooth && smooth.box);
  ok(`${tag} (ii): the outer far ring keeps triangles, none off by more than ${TOL} px`, !!rows && !!rows.far1 && rows.far1.tris > 0 && rows.far1.off === 0, rows && rows.far1);
  if (u === 0.5) {
    info.B.jumps = await jumps();
    await redraw({ noJump: true });
    const nj = await chord();
    ok(`${tag} (v): the jump rule leaves out no triangle of the default page's glide (the same kept triangles without it)`, JSON.stringify(counts(nj)) === JSON.stringify(counts(rows)), { rule: counts(rows), noJump: counts(nj) });
    await redraw(null);
    await redraw({ farN: COARSE });
    const cc = await carried(), coarse = await chord();
    info.B.coarse = { far: cc.far, far0: coarse && coarse.far0 };
    ok(`${tag} (iii): with the far rings at ${COARSE.join(' and ')} points a side, the inner ring reads triangles off by more than ${TOL} px`, cc.far[0] === COARSE[0] && !!coarse && !!coarse.far0 && coarse.far0.off > 0, info.B.coarse);
    await redraw(null);
  }
  await letGo();
}

// ---- C: z³ parked on w₁, coloured from z: a carry with no jump
await loadView('steps', `chordC${Date.now()}`, { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [{ type: 'custom', params: { expr: 'z^3' }, on: true }], nextId: 50, sheets: false });
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 0, go: 1, now: true }); 1`);
await settled({ max: 90000, until: '__cmwSteps().ready.ready && __cmwSteps().i === 1' });
const cC = await carried(), rC = await chord();
await redraw({ noJump: true });
const nC = await chord();
await redraw(null);
info.C = { rows: rC, jumps: await jumps() };
ok('C, z³ parked on w₁ coloured from z (v): a carried frame, and the jump rule leaves out none of its triangles', cC.s === 0 && !!rC && JSON.stringify(counts(nC)) === JSON.stringify(counts(rC)), { carried: cC, rule: counts(rC), noJump: counts(nC) });
info.C.noAlone = await pixelRow('C-noalone', { noAlone: true });
ok(`C (x): a carry with no period, its far rings alone, and the same frame with their second pass off (GLR._lw.noAlone): at most ${SAME_PX_FRAC * 100} % of its pixels apart`, cC.alone.length === 2 && cC.alone.every(Boolean) && info.C.noAlone.share !== null && info.C.noAlone.share <= SAME_PX_FRAC, { alone: cC.alone, px: info.C.noAlone });

// ---- D: z² over a disc about 0, |F| heights, coloured from z: a glide two to one about 0
await loadView('steps', `chordD${Date.now()}`, { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, visible: true }], steps: [{ type: 'pown', params: { n: 2 }, on: true }], sheets: false, height: 'abs' });
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 0, go: 0, now: true }); 1`);
await settled({ max: 90000, until: '__cmwSteps().ready.ready' });
await held(0.5);
const cD = await carried();
info.D = { carried: cD, noAlone: await pixelRow('D-noalone', { noAlone: true }) };
ok(`D, z² over a disc about 0 held at u = .5 (xii): a carry with no period, its far rings alone, and the same frame with their second pass off (GLR._lw.noAlone): at most ${SAME_PX_FRAC * 100} % of its pixels apart`, cD.s === 0 && Math.abs(cD.u - 0.5) < 0.004 && cD.alone.length === 2 && cD.alone.every(Boolean) && info.D.noAlone.share !== null && info.D.noAlone.share <= SAME_PX_FRAC, info.D);
await letGo();

// ---- (viii): geoCut's test on four cells
const cutCell = (place, hgt) => ev(`__cmwLandCutCell({ n: 2, place: ${place} }, [0, 1, 2], ${hgt}, 1)`);
const cuts = {
  arg: await cutCell('(i, j) => [-1, -0.5 + i + j]', '(z) => Math.atan2(z.im, z.re)'),
  wall: await cutCell('(i, j) => [-0.5 + i + j, 0]', '(z) => Math.atan(1e4 * z.re)'),
  step: await cutCell('(i, j) => [i, j]', '(z) => (z.re + z.im > 0.5 ? 5 : 0)'),
  stepWall: await cutCell('(i, j) => [i, j]', '(z) => (z.re + z.im > 0.5 ? 5 : 0) + 0.8 * Math.atan(1e4 * (z.re - z.im - 0.3))'),
};
ok('(viii): geoCut\'s test finds a cut (arg z, a step on two edges), and not a steep wall, alone or beside a cut', cuts.arg === true && cuts.wall === false && cuts.step === true && cuts.stepWall === false, cuts);
return { pass: fails.length === 0, fails, info };
