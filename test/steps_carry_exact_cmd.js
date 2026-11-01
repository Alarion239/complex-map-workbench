// #584: the steps view's carried colour at rest, against the exact colour pulled back pixel by pixel. The Joukowski
// airfoil w = (z + 1/z) / 2 with its region, the outside of the circle through 1, Inside regions, on the plane: plane
// w1 at rest coloured from z ("colour of z, carried") must show at each point w the colour plane z shows at the
// region's own preimage of w (the one outside the circle: J is one to one there), the same exact mapping the region
// tiling uses. The reference is plane z itself, Everywhere, coloured from z, in the same camera. A point counts as
// wrong when its pixel differs by more than 14 in a channel from all 9 pixels around the preimage's (a phase edge or a
// contour between two pixels is not an error). Points near the circle's image (the outlines), near the trailing edge's
// mark and label, and near the rulers are left out.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/steps_carry_exact_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const EX = names.indexOf('Joukowski airfoil');
ok('the Joukowski example is found', EX >= 0, names.length);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?view=steps&ns=cex${Date.now()}` }); await sleep(2300);
for (let i = 0; i < 120 && !(await ev('typeof __cmwExample === "function" && typeof __cmwLPx === "function"').catch(() => false)); i++) await sleep(250);
await ev(`__cmwExample(${EX}); 1`);
await sleep(1500);
const wait = async () => { await sleep(400); await settled({ max: 20000 }); };
// the region: outside the circle |z - c| = r
const c = [-0.12, 0.1], r = 1.1244998888;
const outside = (z) => Math.hypot(z[0] - c[0], z[1] - c[1]) - r;
// the preimage of w in the region: z = w +- sqrt(w^2 - 1), the one outside the circle
function pre(w) {
  const ax = w[0] * w[0] - w[1] * w[1] - 1, ay = 2 * w[0] * w[1], m = Math.hypot(ax, ay);
  const sx = Math.sqrt(Math.max(0, (m + ax) / 2)), sy = (ay < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (m - ax) / 2));
  const z1 = [w[0] + sx, w[1] + sy], z2 = [w[0] - sx, w[1] - sy];
  return outside(z1) > outside(z2) ? z1 : z2;
}
const J = (z) => { const d = z[0] * z[0] + z[1] * z[1]; return [(z[0] + z[0] / d) / 2, (z[1] - z[1] / d) / 2]; };
// the reference: plane z, Everywhere, coloured from z
await ev(`__cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true }); __cmwSteps({ T: 0 }); 1`);
await wait();
const st0 = await ev('__cmwSteps()');
info.ref = { i: st0.i, T: st0.T, x: st0.x, scope: st0.scope };
const v = (await ev('__cmwLPx([]).view'));
info.view = v;
// the points of plane w1: a grid over the inner 80 % of the pane
const pane = await ev('({ w: __cmwLPx([]).pw / __cmwLPx([]).dpr, h: __cmwLPx([]).ph / __cmwLPx([]).dpr })');
// (A: every region point there, for the paper check; W, Z: those whose preimage the reference shows, compared)
const A = [], W = [], Z = [];
for (let j = 0; j < 40; j++) for (let i = 0; i < 60; i++) {
  const w = [v.cx + (i / 59 - 0.5) * 0.8 * pane.w / v.s, v.cy + (j / 39 - 0.5) * 0.8 * pane.h / v.s];
  const z = pre(w);
  // (away from the outlines in both planes and the trailing edge's mark and label)
  if (outside(z) < 0.12 || Math.hypot(w[0] - 1.6, w[1] - 0.1) < 1.1 || Math.hypot(J(z)[0] - w[0], J(z)[1] - w[1]) > 1e-9) continue;
  A.push(w);
  if (Math.abs(z[0] - v.cx) > 0.45 * pane.w / v.s || Math.abs(z[1] - v.cy) > 0.45 * pane.h / v.s) continue;
  W.push(w); Z.push(z);
}
info.points = W.length; info.regionPoints = A.length;
ok('enough points to compare', W.length > 400 && A.length > 1500, [W.length, A.length]);
const ref = (await ev(`__cmwLPx(${JSON.stringify(Z)}).px`));
// plane w1 at rest, Inside regions, coloured from z
await ev(`__cmwSteps({ scope: 'in', surf: 'plane', go: 1, now: true }); __cmwSteps({ T: 0 }); 1`);
await wait();
const st1 = await ev('__cmwSteps()');
info.case = { i: st1.i, T: st1.T, x: st1.x, scope: st1.scope };
ok('at rest on plane w1, coloured from z', st1.i === 1 && st1.T === 0 && Math.abs(st1.x - 1) < 1e-9 && st1.scope === 'in', info.case);
const got = await ev(`__cmwLPx(${JSON.stringify(W)}).px`);
// (the region reaches past the reference's window: there the colour must still be on, not the paper)
const all = await ev(`__cmwLPx(${JSON.stringify(A)}).px`);
const paper = all.filter((q) => q && Math.max(q[4][0], q[4][1], q[4][2]) - Math.min(q[4][0], q[4][1], q[4][2]) < 6).length;
info.paper = paper;
ok('at rest on w1: every region point is coloured, past the window too (none on the bare paper)', paper === 0, { n: all.length, paper });
let bad = 0, n = 0, worst = 0;
const badAt = [];
for (let k = 0; k < W.length; k++) {
  if (!got[k] || !ref[k]) continue;
  n++;
  const p = got[k][4];
  let best = 1e9;
  for (const q of ref[k]) best = Math.min(best, Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])));
  worst = Math.max(worst, best);
  if (best > 14) { bad++; if (badAt.length < 12) badAt.push({ w: W[k].map((t) => +t.toFixed(2)), got: p.slice(0, 3), want: ref[k][4].slice(0, 3), d: best }); }
}
info.compared = n; info.wrong = bad; info.worst = worst; info.wrongAt = badAt;
ok('at rest on w1: each region point has the colour of its exact preimage (at most 1 % wrong)', n > 400 && bad <= 0.01 * n, { n, bad, worst });
return { pass: fails.length === 0, fails, info };
