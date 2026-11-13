// The stand-ins while a chain's first programs link, on a cold load with ?glhold, which keeps every chain program's link
// pending (GLR.holdLinks), in the steps view:
// - the SphereMesh stand-in (issue #72, I): example 15 (Γ/ζ) with its last plane past the colour plane (T = 0). The pane
//   shows the CPU-mapped stand-in once the link has waited past ~250 ms, not a blank pane; on release it swaps to the
//   GPU picture with no frame that is pending and draws nothing;
// - the colour plot's stand-in (colourStandIn): a typed (z²−1)/(z²+1) on its colour plane's planes, Everywhere. The pane
//   is coloured from F's values on a CPU grid, the frame still pending, on plane z and on the colour plane w₁; Inside
//   regions, the region is coloured (not black) and the pane says it is compiling; on release the plot takes its place
//   with no frame where it drew nothing, in the stand-in's colours. An expensive series' stand-in keeps to its CPU budget.
// A command file for a CDP daemon:  <runner> test/link_standin_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
const ns = 'lsi' + Date.now();
await load(ns, {});
await ev('(__cmwExample(15), 1)');
await ev('(__cmwSteps({ T: 0, go: 99, now: true }), 1)');
await sleep(3000);
// (the share of the pane in the shape's blue: the stand-in and the GPU picture both draw it)
const rect = await ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
const blue = async () => { const p = await img(rect); let n = 0, t = 0; for (let i = 0; i < p.data.length; i += 4 * p.ch) { t++; if (p.data[i + 2] > 150 && p.data[i] < 120) n++; } return n / t; };
const base = await ev('location.origin');
await nav(`${base}/test.html?ns=${ns}&glhold`);
let held = null, last = null;
for (let i = 0; i < 60 && !held; i++) {
  if (i === 0 || i === 4) await ev(`(typeof __cmwSteps === 'function' && (__cmwSteps({ T: 0, go: 99, now: true }), 1))`).catch(() => 0);
  const st = await ev(`(() => typeof GLR === 'object' && GLR.ok ? { pending: GLR.frameStatus().pending, why: __cmwSmVerdict('SV').map((v) => v.why) } : null)()`);
  if (st && st.why.includes('linking')) { const f = await blue(); if (f > 0.05) held = Object.assign(st, { blue: +f.toFixed(3) }); }
  last = st && Object.assign({}, st, { blue: +(await blue()).toFixed(3) });
  if (!held) await sleep(500);
}
info.held = held;
info.last = last;
ok('while the link is held: the stand-in is drawn (verdict linking, the shape on the pane)', !!held, held || last);
ok('while the link is held: the frame counts as pending', held && held.pending === true, held);
// (the frames after the release, collected in the page: blank = the frame is pending and drew nothing)
await ev(`(() => { window.__lsiFr = null;
  let pre = false; const dp = GLR.drawPreMapped; GLR.drawPreMapped = function () { pre = true; return dp.apply(this, arguments); };
  const fr = [], t1 = performance.now();
  const tick = () => { const st = GLR.frameStatus(); fr.push(st.pending && !pre ? 'blank' : st.pending ? 'stand-in' : 'gpu'); pre = false;
    if (performance.now() - t1 < 4000) requestAnimationFrame(() => setTimeout(tick, 0)); else { GLR.drawPreMapped = dp; window.__lsiFr = fr; } };
  GLR.holdLinks(false); requestAnimationFrame(() => setTimeout(tick, 0)); return 1; })()`);
let after = null;
for (let i = 0; i < 60 && !Array.isArray(after); i++) { await sleep(500); after = await ev('window.__lsiFr'); }
const runs = []; for (const x of Array.isArray(after) ? after : []) { if (runs.length && runs[runs.length - 1][0] === x) runs[runs.length - 1][1]++; else runs.push([x, 1]); }
info.after = Array.isArray(after) ? runs : after;
ok('after the release: no frame pending with nothing drawn', Array.isArray(after) && !after.includes('blank'), info.after);
await sleep(2500);
const fin = { blue: +(await blue()).toFixed(3), pending: await ev('GLR.frameStatus().pending'), why: await ev(`__cmwSmVerdict('SV').map((v) => v.why)`) };
info.final = fin;
ok('after the release: the GPU picture, settled', fin.pending === false && !fin.why.includes('linking') && fin.blue > 0.05, fin);
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
info.colourIn = { wait: inWait, n: inPx.length, black: inPx.filter((p) => Math.max(p[0], p[1], p[2]) < 40).length, coloured: inPx.filter((p) => sat(p) > 40).length, pane: await ev("__cmwPaneStatus('L')") };
ok('Inside regions, the program held: the region is coloured, not black, and the pane says it is compiling', inWait.ok && info.colourIn.n >= 20 && info.colourIn.black === 0 && info.colourIn.coloured >= 0.8 * info.colourIn.n && !!info.colourIn.pane && info.colourIn.pane.compiling === true, info.colourIn);
await ev("__cmwSteps({ scope: 'all' }), 1");
await settled({ panes: false });
// (after the release, each frame's colour plots, collected in the page: blank = one drew nothing)
await ev(`(() => { window.__lscFr = null;
  let calls = 0, drew = 0; const dc = GLR.drawColorPlot; GLR.drawColorPlot = function () { const r = dc.apply(this, arguments); calls++; if (r) drew++; return r; };
  const fr = [], t1 = performance.now();
  const tick = () => { fr.push(!calls ? 'none' : drew < calls ? 'blank' : GLR.frameStatus().pending ? 'pending' : 'gpu'); calls = drew = 0;
    if (performance.now() - t1 < 4000) requestAnimationFrame(() => setTimeout(tick, 0)); else { GLR.drawColorPlot = dc; window.__lscFr = fr; } };
  GLR.holdLinks(false); requestAnimationFrame(() => setTimeout(tick, 0)); return 1; })()`);
let colourAfter = null;
for (let i = 0; i < 60 && !Array.isArray(colourAfter); i++) { await sleep(500); colourAfter = await ev('window.__lscFr'); }
const cruns = []; for (const x of Array.isArray(colourAfter) ? colourAfter : []) { if (cruns.length && cruns[cruns.length - 1][0] === x) cruns[cruns.length - 1][1]++; else cruns.push([x, 1]); }
info.colourAfter = Array.isArray(colourAfter) ? cruns : colourAfter;
ok('the colour plot, after the release: no frame where it drew nothing', Array.isArray(colourAfter) && colourAfter.includes('gpu') && !colourAfter.includes('blank'), info.colourAfter);
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
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
