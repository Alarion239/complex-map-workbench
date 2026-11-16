// The stand-ins while a chain's first programs link, on a cold load with ?glhold, which keeps every chain program's link
// pending (GLR.holdLinks), in the steps view:
// - the SphereMesh stand-in (issue #72, I): example 15 (Γ/ζ) with its last plane past the colour plane (T = 0). The pane
//   shows the CPU-mapped stand-in once the link has waited past ~250 ms, not a blank pane; on release it swaps to the
//   GPU picture with no frame that is pending and draws nothing;
// - the colour plot's stand-in (colourStandIn): a typed (z²−1)/(z²+1) on its colour plane's planes, Everywhere. The pane
//   is coloured from F's values on a CPU grid, the frame still pending, on plane z and on the colour plane w₁; Inside
//   regions, the region is coloured (not black) and the pane says it is compiling; on release the plot takes its place
//   with no frame where it drew nothing, in the stand-in's colours. An expensive series' stand-in keeps to its CPU budget;
// - the carried colour past a colour plane other than z (carriedW): z² then z + 0.2 conj(z), colour plane w₁, w₂ parked,
//   Everywhere. The pane is coloured from the SphereMeshes' points' colours of w₁, the frame still pending; on release
//   the carried colour takes its place with no frame where it drew nothing, in the stand-in's colours. About a zero and
//   a pole of the colour (w₁ = z − 1, then w₁ + 0.2 conj(w₁); w₁ = 1/(z − 1), then 1/w₁ + 0.2 conj(1/w₁): w₂ = 0),
//   every point of rings held within 16 levels of the carried colour once linked;
// - the carried colour from the SphereMeshes while their chain's programs link (colour plane z, T = 0): the default
//   example's w₁, the colour layer alone (bare). Held, it is the carried colour itself: against the exact pass's frame
//   once linked, at least 99 % of a pane grid within 3 levels, and every point of rings about the colour's zero (w₁ = 1,
//   z = 0) too.
// A command file for a CDP daemon:  <runner> test/link_standin_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// Releases the held links and records, in the page, a verdict on each frame from then on, until REC_AFTER frames past the
// first 'gpu' one (or REC_MS): fn names the GLR draw the verdicts watch; verdict, a page-side function's source, turns a
// frame's {calls of fn, drew (those that returned true), pending (GLR.frameStatus())} into 'blank', 'gpu' or another
// name. -> {list, runs}: the verdicts (null when the record did not end) and their runs, [verdict, count] each
const REC_AFTER = 8, REC_MS = 30000;
const releaseFrames = async (fn, verdict) => {
  await ev(`(() => { window.__lsFr = null;
    const orig = GLR.${fn}, verdict = ${verdict}, f = { calls: 0, drew: 0 }, fr = [], t1 = performance.now();
    GLR.${fn} = function () { const r = orig.apply(this, arguments); f.calls++; if (r) f.drew++; return r; };
    let gpu = -1;
    const tick = () => {
      fr.push(verdict({ calls: f.calls, drew: f.drew, pending: GLR.frameStatus().pending })); f.calls = f.drew = 0;
      if (gpu < 0 && fr[fr.length - 1] === 'gpu') gpu = fr.length;
      if ((gpu < 0 || fr.length - gpu < ${REC_AFTER}) && performance.now() - t1 < ${REC_MS}) requestAnimationFrame(() => setTimeout(tick, 0));
      else { GLR.${fn} = orig; window.__lsFr = fr; }
    };
    GLR.holdLinks(false); requestAnimationFrame(() => setTimeout(tick, 0)); return 1; })()`);
  const done = await settled({ only: true, max: REC_MS + 5000, until: 'Array.isArray(window.__lsFr)' });
  const list = done.ok ? await ev('window.__lsFr') : null, runs = [];
  for (const x of list || []) { if (runs.length && runs[runs.length - 1][0] === x) runs[runs.length - 1][1]++; else runs.push([x, 1]); }
  return { list, runs };
};
await view(1440, 900, false);
const ns = 'lsi' + Date.now();
await load(ns, {});
await ev('(__cmwExample(15), 1)');
await adopted();
await ev('(__cmwSteps({ T: 0, go: 99, now: true }), 1)');
await sleep(3000);
// (the share of the pane in the shape's blue: the stand-in and the GPU picture both draw it)
const rect = await ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
const blue = async () => { const p = await img(rect); let n = 0, t = 0; for (let i = 0; i < p.data.length; i += 4 * p.ch) { t++; if (p.data[i + 2] > 150 && p.data[i] < 120) n++; } return n / t; };
const base = await ev('location.origin');
await nav(`${base}/test.html?ns=${ns}&glhold`);
let held = null, last = null;
for (let i = 0; i < 60 && !held; i++) {
  // (asked before the app's state is up, the hook throws: the answer's exception is noted and the loop asks again)
  if (i === 0 || i === 4) { const r = await ev(`(typeof __cmwSteps === 'function' && (__cmwSteps({ T: 0, go: 99, now: true }), 1))`); if (r && r.__exc !== undefined) info.early = r.__exc; }
  const st = await ev(`(() => typeof GLR === 'object' && GLR.ok ? { pending: GLR.frameStatus().pending, why: __cmwSmVerdict('SV').map((v) => v.why) } : null)()`);
  if (st && st.why.includes('linking')) { const f = await blue(); if (f > 0.05) held = Object.assign(st, { blue: +f.toFixed(3) }); }
  last = st && Object.assign({}, st, { blue: +(await blue()).toFixed(3) });
  if (!held) await sleep(500);
}
info.held = held;
info.last = last;
ok('while the link is held: the stand-in is drawn (verdict linking, the shape on the pane)', !!held, held || last);
ok('while the link is held: the frame counts as pending', held && held.pending === true, held);
// (the frames after the release: blank = the frame is pending and drew nothing)
const after = await releaseFrames('drawPreMapped', "(f) => (f.pending && !f.calls ? 'blank' : f.pending ? 'stand-in' : 'gpu')");
info.after = after.list ? after.runs : null;
ok('after the release: no frame pending with nothing drawn', !!after.list && !after.list.includes('blank'), info.after);
const finWait = await settled({ max: 20000 });
const fin = { blue: +(await blue()).toFixed(3), pending: await ev('GLR.frameStatus().pending'), why: await ev(`__cmwSmVerdict('SV').map((v) => v.why)`) };
info.final = Object.assign({ wait: finWait }, fin);
ok('after the release: the GPU picture, settled', finWait.ok && fin.pending === false && !fin.why.includes('linking') && fin.blue > 0.05, fin);
// the colour plot's stand-in: (z²−1)/(z²+1), its colour plane w₁, Everywhere, a disc on z; colourStandIn's levels go to 4 px
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const loaded = "typeof __cmwSteps === 'function' && !!window.GLR";
const standIn = () => ev("typeof __cmwStandIn === 'function' ? __cmwStandIn() : null");
const levelDone = () => settled({ only: true, max: 20000, until: "typeof __cmwStandIn === 'function' && !!__cmwStandIn() && __cmwStandIn().cell === 4" });
// (the share of the pane in a colour, any hue: the plot's colours and the stand-in's)
const hue = async () => { const p = await img(rect); let n = 0, t = 0; for (let i = 0; i < p.data.length; i += 4 * p.ch) { t++; if (Math.max(p.data[i], p.data[i + 1], p.data[i + 2]) - Math.min(p.data[i], p.data[i + 1], p.data[i + 2]) > 40) n++; } return +(n / t).toFixed(3); };
const ns2 = 'lsc' + Date.now();
await seed(ns2, { steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }], shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1' }], sv: { at: 0, T: 1, scope: 'all', surf: 'plane' } });
await go(`${base}/test.html?ns=${ns2}&glhold`);
await settled({ max: 20000, panes: false, until: loaded });
const zWait = await levelDone();
await settled({ panes: false });
const P = await K.paneOf();
// (points away from the zeros ±1 and the poles ±i, where the colours turn fastest, and from the "Preparing the GPU…"
// note below the pane's centre)
const away = ([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => Math.hypot(x - a, y - b) > 0.3)
  && !(Math.abs((x - P.v.cx) * P.v.s) < 200 && (P.v.cy - y) * P.v.s > 15 && (P.v.cy - y) * P.v.s < 95);
const pts = K.grid(P, 12, 8).filter(away);
const heldZ = { wait: zWait, standIn: await standIn(), hue: await hue(), pending: await ev('GLR.frameStatus().pending'), px: (await K.lpx(pts)).px };
info.colourZ = Object.assign({}, heldZ, { px: undefined });
ok('the colour plot, its program held: plane z is drawn from the stand-in (in colour, the frame pending)', zWait.ok && heldZ.hue > 0.6 && heldZ.pending === true, info.colourZ);
await ev('__cmwSteps({ go: 1, now: true }), 1');
await settled({ panes: false });
const w1Wait = await levelDone();
await settled({ panes: false });
info.colourW1 = { wait: w1Wait, standIn: await standIn(), hue: await hue(), stage: await ev('__cmwSteps().stage') };
ok('the colour plot, its program held: the colour plane w₁ is drawn from the stand-in', w1Wait.ok && info.colourW1.stage === 1 && info.colourW1.hue > 0.6, info.colourW1);
await ev("__cmwSteps({ go: 0, now: true, scope: 'in' }), 1");
await settled({ panes: false });
const inWait = await levelDone();
await settled({ panes: false });
// (inside the disc, off the axes)
const inDisc = [];
for (const r of [0.35, 0.6]) for (let a = 15; a < 360; a += 30) inDisc.push([r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)]);
const inPx = (await K.lpx(inDisc)).px.filter(Boolean).map((q) => q[4]);
const sat = (p) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]);
info.colourIn = { wait: inWait, standIn: await standIn(), n: inPx.length, black: inPx.filter((p) => Math.max(p[0], p[1], p[2]) < 40).length, coloured: inPx.filter((p) => sat(p) > 40).length, pane: await ev("__cmwPaneStatus('L')") };
ok('Inside regions, the program held: the region is coloured, not black, and the pane says it is compiling', inWait.ok && info.colourIn.n >= 20 && info.colourIn.black === 0 && info.colourIn.coloured >= 0.8 * info.colourIn.n && !!info.colourIn.pane && info.colourIn.pane.compiling === true, info.colourIn);
await ev("__cmwSteps({ scope: 'all' }), 1");
await settled({ panes: false });
// (after the release, each frame's colour plots: blank = one of them drew nothing)
const colourAfter = await releaseFrames('drawColorPlot', "(f) => (!f.calls ? 'none' : f.drew < f.calls ? 'blank' : f.pending ? 'pending' : 'gpu')");
info.colourAfter = colourAfter.list ? colourAfter.runs : null;
ok('the colour plot, after the release: no frame where it drew nothing', !!colourAfter.list && colourAfter.list.includes('gpu') && !colourAfter.list.includes('blank'), info.colourAfter);
const linked = await settled({ max: 20000 });
const gpuPx = (await K.lpx(pts)).px;
info.colourMatch = K.tally(heldZ.px, gpuPx, { tol: 24 });
ok('the colour plot, once linked: the stand-in had its colours (at least 90 % of the points within 24 levels)', linked.ok && info.colourMatch.n >= 40 && info.colourMatch.wrong <= 0.1 * info.colourMatch.n, info.colourMatch);
// an expensive series (about half a millisecond an evaluation): its stand-in stops within its CPU budget
const ns3 = 'lse' + Date.now();
await seed(ns3, { steps: [{ type: 'custom', params: { expr: '\\sum_{n=1}^{10000} \\frac{z^n}{n}', cut: 180 } }], sv: { at: 0, T: 1, scope: 'all', surf: 'plane' } });
await go(`${base}/test.html?ns=${ns3}&glhold`);
await settled({ max: 20000, panes: false, until: loaded });
const exWait = await settled({ only: true, max: 30000, until: "typeof __cmwStandIn === 'function' && !!__cmwStandIn() && !!__cmwStandIn().end" });
info.expensive = { wait: exWait, standIn: await standIn() };
ok('timing: an expensive series\' stand-in keeps to its CPU budget (250 ms and a slice)', exWait.ok && !!info.expensive.standIn && info.expensive.standIn.ms <= 280, info.expensive);
// the carried colour past a colour plane other than z: z² then z + 0.2 conj(z) (no inverse plan), colour plane w₁, the
// plane w₂ parked, Everywhere: while the links are held, the pane is coloured from the SphereMeshes' points' colours
const ns4 = 'lsk' + Date.now();
await seed(ns4, { steps: [{ type: 'pown', params: { n: 2 } }, { type: 'custom', params: { expr: 'z+0.2\\overline{z}', cut: 180 } }], sv: { at: 2, T: 1, scope: 'all', surf: 'plane' } });
await go(`${base}/test.html?ns=${ns4}&glhold`);
await settled({ max: 20000, panes: false, until: loaded });
const onW2 = await settled({ only: true, max: 30000, until: `(() => { const s = __cmwSteps(); return s.stage === 2 && s.T === 1; })()` });
// (in colour: at least 60 % of a 16 x 10 grid of the pane's points, read in the page)
const P4 = await K.paneOf(), pts4 = JSON.stringify(K.grid(P4, 16, 10));
const carriedWait = await settled({ only: true, max: 30000, until: `(() => { const q = __cmwLPx(${pts4}).px.filter(Boolean).map((p) => p[4]); return q.filter((p) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) > 40).length > 0.6 * q.length; })()` });
const carriedPx = (await K.lpx(K.grid(P4, 16, 10))).px;
info.carriedT1 = { onW2, wait: carriedWait, hue: await hue(), pending: await ev('GLR.frameStatus().pending'), sv: await ev('(() => { const s = __cmwSteps(); return { stage: s.stage, T: s.T, core: s.core, rest: s.rest }; })()') };
ok('the carried colour past colour plane w₁, its programs held: w₂ is drawn in colour (the frame pending)', onW2.ok && carriedWait.ok && info.carriedT1.pending === true, info.carriedT1);
// (after the release, each frame's pre-mapped draws: blank = it drew none of them)
const carriedAfter = await releaseFrames('drawPreMapped', "(f) => (!f.calls ? 'none' : !f.drew ? 'blank' : f.pending ? 'stand-in' : 'gpu')");
info.carriedAfter = carriedAfter.list ? carriedAfter.runs : null;
ok('the carried colour past colour plane w₁, after the release: no frame where it drew nothing', !!carriedAfter.list && carriedAfter.list.includes('gpu') && !carriedAfter.list.includes('blank'), info.carriedAfter);
const carriedLinked = await settled({ max: 20000 });
// (the points the held stand-in coloured: the 'linking' mesh leaves the pane's far corners bare)
info.carriedMatch = K.tally(carriedPx, (await K.lpx(K.grid(P4, 16, 10))).px, { tol: 24, skip: (k) => !carriedPx[k] || K.bare(carriedPx[k][4]) });
ok('the carried colour past colour plane w₁, once linked: the stand-in had its colours (at least 90 % of the points within 24 levels)', carriedLinked.ok && info.carriedMatch.n >= 96 && info.carriedMatch.wrong <= 0.1 * info.carriedMatch.n, info.carriedMatch);
// the same stand-in about a zero and a pole of the colour, away from z = 0 and with no inverse plan, the plane real-linear
// in z − 1 there: w₁ = z − 1 then w₂ = w₁ + 0.2 conj(w₁) (the zero at w₂ = 0), and w₁ = 1/(z − 1) then w₂ = 1/w₁ +
// 0.2 conj(1/w₁) (the pole at w₂ = 0). Rings of 12 points about w₂ = 0, 4, 8 and 12 px out, read while the links are
// held and again from the carried colour once they are not, within 16 levels: the stand-in colours a triangle from its
// vertices' points of w₁ and the linked program from each fragment's own, up to 9 levels apart on these rings (at 4, 8
// and 12 px alike); (ln |w₁|, arg w₁) interpolated across the zero or the pole put them over 100 levels apart
for (const [name, e1, e2] of [['zero', 'z-1', 'z+0.2\\overline{z}'], ['pole', '\\frac{1}{z-1}', '\\frac{1}{z}+\\frac{0.2}{\\overline{z}}']]) {
  const nsw = 'lsw' + name + Date.now();
  await seed(nsw, { steps: [{ type: 'custom', params: { expr: e1, cut: 180 } }, { type: 'custom', params: { expr: e2, cut: 180 } }], sv: { at: 2, T: 1, scope: 'all', surf: 'plane' } });
  await go(`${base}/test.html?ns=${nsw}&glhold`);
  await settled({ max: 20000, panes: false, until: loaded });
  const Pw = await K.paneOf(), ring = [];
  for (const px of [4, 8, 12]) for (let i = 0; i < 12; i++) ring.push([px / Pw.v.s * Math.cos((i + 0.5) * Math.PI / 6), px / Pw.v.s * Math.sin((i + 0.5) * Math.PI / 6)]);
  const hw = await settled({ only: true, max: 30000, until: `(() => { const s = __cmwSteps(); if (s.stage !== 2 || s.T !== 1) return false; const q = __cmwLPx(${JSON.stringify(ring)}).px.filter(Boolean).map((p) => p[4]); return q.length > 0 && q.filter((p) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) > 40).length > 0.5 * q.length; })()` });
  await settled({ panes: false });
  const heldPx = (await K.lpx(ring)).px, pending = await ev('GLR.frameStatus().pending');
  await ev('GLR.holdLinks(false), 1');
  const linkedW = await settled({ max: 20000 });
  const rw = info['carried' + name] = Object.assign(K.tally(heldPx, (await K.lpx(ring)).px, { tol: 16, note: (k) => ({ px: [4, 8, 12][Math.floor(k / 12)], i: k % 12 }) }), { held: hw, pending, linked: linkedW, after: await ev('GLR.frameStatus().pending') });
  ok(`the carried colour past colour plane w₁ about its ${name} (w₂ = 0), the links held: every point within 16 levels of the linked frame`, hw.ok && pending === true && linkedW.ok && rw.after === false && rw.n >= 30 && rw.wrong === 0, rw);
}
// the carried colour from the SphereMeshes at T = 0: the default example, colour plane z, w₁ at rest, bare
const ns5 = 'lsz' + Date.now();
await go(`${base}/test.html?ns=${ns5}&glhold`);
await settled({ max: 20000, panes: false, until: loaded });
await ev("__cmwSteps({ T: 0, go: 1, now: true, bare: true }), 1");
const P5 = await K.paneOf(), grid5 = K.grid(P5, 24, 16);
// (rings of 12 points about w₁ = 1, the image of the colour's zero z = 0, 4, 8 and 12 px out)
const ring5 = [];
for (const px of [4, 8, 12]) for (let i = 0; i < 12; i++) ring5.push([1 + px / P5.v.s * Math.cos((i + 0.5) * Math.PI / 6), px / P5.v.s * Math.sin((i + 0.5) * Math.PI / 6)]);
const smWait = await settled({ only: true, max: 30000, until: `(() => { if (!__cmwSmVerdict('SV').some((v) => v.why === 'linking')) return false; const q = __cmwLPx(${JSON.stringify(ring5)}).px.filter(Boolean).map((p) => p[4]); return q.length > 0 && q.filter((p) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) > 40).length > 0.5 * q.length; })()` });
await settled({ panes: false });
const heldGrid = (await K.lpx(grid5)).px, heldRing = (await K.lpx(ring5)).px;
info.zeroHeld = { wait: smWait, pending: await ev('GLR.frameStatus().pending'), verdict: await ev("__cmwSmVerdict('SV').map((v) => v.why)") };
await ev('GLR.holdLinks(false), 1');
// (the frame to match: the plane at rest drawn by the exact pass, svCarryExact)
const zLinked = await settled({ only: true, max: 30000, until: "(() => { const r = __cmwSteps().rest; return !!r && r.a === 1 && r.path === 'inverse'; })()" });
await settled({ panes: false });
info.zeroHeld.linked = zLinked;
info.zeroGrid = K.tally(heldGrid, (await K.lpx(grid5)).px, { tol: 3 });
info.zeroRing = K.tally(heldRing, (await K.lpx(ring5)).px, { tol: 3 });
ok('the SphereMeshes\' carried colour while the links are held (T = 0): the colour itself (at least 99 % of the pane within 3 levels once linked)', smWait.ok && zLinked.ok && info.zeroGrid.n >= 300 && info.zeroGrid.wrong <= 0.01 * info.zeroGrid.n, { held: info.zeroHeld, grid: info.zeroGrid });
ok('the SphereMeshes\' carried colour about the colour\'s zero (w₁ = 1): every point within 3 levels once linked', smWait.ok && zLinked.ok && info.zeroRing.n >= 30 && info.zeroRing.wrong === 0, info.zeroRing);
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
