// The steps view's glide on the Sphere surface: parked between plane z and plane w1, Inside regions keeps the
// globe's colour inside the moving regions, as at rest, and the paths t -> H_t(z) of the glide are drawn on the globe.
//  - colour: the pixels of the left pane in a saturated phase colour (max - min channel > 60), at rest on plane z with
//    Inside regions and parked half-way; parked, about as many as at rest (the region's image moves and shrinks), not
//    the whole globe
//  - paths: parked, the frame draws the paths' moving points (__cmwSteps().paths.globeHeads > 0), and they threw nothing
//    (globeError: a throw's message, named in the check)
//  - the arrival on √'s plane (#2391, 'Square root and its sheets', Everywhere): the glide frame just short of plane w1
//    draws every sheet, so it is the parked globe; the control, the principal sheet alone, is not; the same on the
//    carried mesh's path, z⁵ − 5z (no inverse plan) then √, onto √'s plane w2; at u = 1/2 the principal sheet is in front:
//    wherever it alone colours the globe, the frame with every sheet shows its colour
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (quiet: the programs and jobs are ready, no glide or play is under way and the sphere is idle; __cmwSteps().moving is also
// true for a place parked between two planes, which is a still view, so it is not the wait)
const QUIET_UNTIL = "window.__cmwSteps && __cmwSteps().ready.ready && !__cmwSteps().anim && !__cmwSteps().play && !(window.__cmwSphere && __cmwSphere().running)";
const quiet = () => settled({
  floor: 400, max: 20000,
  until: QUIET_UNTIL,
});
// (the left pane's pixels in a saturated colour: the phase portrait's, not the globe's paper or its grey marks)
const coloured = () => ev(`(() => {
  const c = document.getElementById('canvasL'), s = document.createElement('canvas');
  s.width = c.width; s.height = c.height;
  const g = s.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, s.width, s.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 60) n++;
  }
  return n;
})()`);
await view(1200, 800, false, false);
const ns = 'svsg' + Date.now();
const st = {
  v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image',
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }],
};
await seed(ns, st);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 60000, until: `typeof __cmwSteps === 'function'` });
await ev(`__cmwSteps({ go: 0, now: true, surf: 'sphere', scope: 'in', T: 1 }); 1`); await quiet();
// (the quiet wait does not come during a glide: a plane step is under way right after it starts)
await ev(`__cmwSteps({ go: 1 }); 1`);
ok('a glide under way is not quiet', (await ev(QUIET_UNTIL)) === false, await ev('__cmwSteps().anim'));
await ev(`__cmwSteps({ go: 0, now: true }); 1`); await quiet();
const where = await ev('(() => { const s = __cmwSteps(); return { i: s.i, T: s.T, scope: s.scope, surf: s.surf }; })()');
R.rest = { steps: where, coloured: await coloured() };
ok('at rest on plane z: the globe shows the region in colour', R.rest.coloured > 0, R.rest);
await ev(`__cmwSteps({ park: 0.5 }); 1`);
await quiet();
// (the paths' choice waits for 150 ms of stillness, then a frame draws them)
let p = null;
for (let i = 0; i < 40; i++) { p = await ev('__cmwSteps().paths'); if (p && p.globeHeads > 0) break; await sleep(250); }
R.parked = { x: await ev('__cmwSvX()'), coloured: await coloured(), paths: p };
ok('parked: the view is between plane z and plane w1', R.parked.x > 0.3 && R.parked.x < 0.7, R.parked.x);
ok('parked: the colour shows inside the moving region', R.parked.coloured > 0, R.parked);
ok('parked: Inside regions keeps the colour inside the region (at most 1.5 times the coloured pixels at rest)',
  R.parked.coloured <= 1.5 * R.rest.coloured, { rest: R.rest.coloured, parked: R.parked.coloured });
ok(`parked: the paths of the glide are drawn on the globe${p && p.globeError ? ' (they threw: ' + p.globeError + ')' : ''}`, !!p && p.on && p.globeHeads > 0 && !p.globeError, p);
// The arrival on √'s plane (#2391): 'Square root and its sheets', Everywhere, lines, the glide's paths and the strokes
// hidden. Parked on plane w1 with All sheets the globe is coloured everywhere; the glide frame ARRIVE_EPS short of it
// draws a copy per sheet, the principal one in front, so it is the parked globe: at most ARRIVE_MAX of the pixels more
// than held_frames' DIFF_TOL apart. Control: the principal sheet alone (__cmwSteps({ glideSheets: 1 })), more than
// ARRIVE_CONTROL apart. Every frame leaves out the arrival plane's colour under the carried colour (__cmwSteps({
// restPaint: 0 })), which is the parked globe's and would cover a missing sheet
const { hold, grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const ARRIVE_EPS = 1e-4, ARRIVE_MAX = 0.01, ARRIVE_CONTROL = 0.05;
await ev(`__cmwExample(${exampleNames().indexOf('Square root and its sheets')}); 1`); await settled({ max: 20000 });
const frameAt = async (state) => {
  await ev('if (window.__svScrubUp) { window.__svScrubUp(); window.__svScrubUp = null; } 1');
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'sphere', go: 0, now: true }); __cmwSteps({ restPaint: 0 }); ${state}; 1`);
  await quiet();
};
const heldAt = async (u) => { await frameAt('__cmwSteps({ park: 0 })'); await hold(u); await ev(`__cmwSteps({ x: ${u} }); 1`); await settled({ max: 20000 }); };
await frameAt('__cmwSteps({ park: 1 })');
ok('the parked globe on plane w1 is drawn', !!(await grab('sphParked1')), null);
await heldAt(1 - ARRIVE_EPS);
ok('the glide frame near plane w1 is drawn', !!(await grab('sphArrive')), null);
R.arriveRec = await ev('(() => { const g = __cmwSvGlobe(0, 0); return { path: g.path, sheets: g.sheets }; })()');
ok('the glide frame near plane w1 is carried by the inverse pass, on both of the root\'s sheets', R.arriveRec.path === 'inverse' && R.arriveRec.sheets === 2, R.arriveRec);
await ev('__cmwSteps({ glideSheets: 1 }); 1');
await heldAt(1 - ARRIVE_EPS);
ok('the glide frame near plane w1, the principal sheet alone, is drawn', !!(await grab('sphArriveOne')), null);
await ev('__cmwSteps({ glideSheets: 0 }); 1');
R.arrival = { all: await compare('sphArrive', 'sphParked1'), one: await compare('sphArriveOne', 'sphParked1') };
// Mid-glide, the principal sheet is in front: at u = 1/2 the two sheets' images overlap on the globe, and wherever the
// principal sheet alone colours a pixel (saturation over FRONT_SAT) the frame with every sheet shows that colour (at most
// FRONT_MAX of those pixels more than FRONT_TOL apart in a channel); a copy drawn over it would show its own sheet's colour
// there. Control: the frame with every sheet differs from the principal one somewhere (the copy fills its holes)
const FRONT_SAT = 40, FRONT_TOL = 32, FRONT_MAX = 0.005;
await heldAt(0.5);
ok('the glide frame at u = 1/2 is drawn', !!(await grab('sphMid')), null);
await ev('__cmwSteps({ glideSheets: 1 }); 1');
await heldAt(0.5);
ok('the glide frame at u = 1/2, the principal sheet alone, is drawn', !!(await grab('sphMidOne')), null);
await ev('__cmwSteps({ glideSheets: 0 }); 1');
R.front = await ev(`(() => {
  const A = window.__heldPx.sphMid, P = window.__heldPx.sphMidOne;
  let n = 0, off = 0, other = 0;
  for (let i = 0; i < P.length; i += 4) {
    const d = Math.max(Math.abs(A[i] - P[i]), Math.abs(A[i + 1] - P[i + 1]), Math.abs(A[i + 2] - P[i + 2]));
    if (Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) > ${FRONT_SAT}) { n++; if (d > ${FRONT_TOL}) off++; } else if (d > ${FRONT_TOL}) other++;
  }
  return { principal: n, off, frac: n ? +(off / n).toFixed(4) : null, copiesShow: other };
})()`);
ok(`u = 1/2: wherever the principal sheet colours the globe, the frame with every sheet shows its colour (at most ${FRONT_MAX * 100} % apart)`, R.front.principal > 1000 && R.front.frac <= FRONT_MAX, R.front);
ok('u = 1/2: the copy fills the principal sheet\'s holes (the frames differ there)', R.front.copiesShow > 1000, R.front);
ok(`the glide frame ${ARRIVE_EPS} short of plane w1 is the parked globe: at most ${ARRIVE_MAX * 100} % of the pixels apart`, !!R.arrival.all && R.arrival.all.frac <= ARRIVE_MAX, R.arrival);
ok(`the control: the principal sheet alone, more than ${ARRIVE_CONTROL * 100} % apart`, !!R.arrival.one && R.arrival.one.frac > ARRIVE_CONTROL, R.arrival);
// The same on the carried mesh's path: z⁵ − 5z (no inverse plan) then √, onto √'s plane w2
{
  const st5 = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, shapes: [], steps: [{ type: 'custom', params: { expr: 'z^5-5z', cut: 180 }, on: true }, { type: 'root', params: { n: 2, cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 90 } };
  const ns5 = 'svsgm' + Date.now();
  await seed(ns5, st5);
  await go(`http://localhost:${PORT}/test.html?ns=${ns5}&view=steps`);
  await settled({ max: 60000, until: `typeof __cmwSteps === 'function'` });
  const frameAt5 = async (state) => {
    await ev('if (window.__svScrubUp) { window.__svScrubUp(); window.__svScrubUp = null; } 1');
    await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'sphere', go: 1, now: true }); ${state}; 1`);
    await quiet();
  };
  const heldAt5 = async (u) => { await frameAt5('__cmwSteps({ park: 1 })'); await hold(1 + u); await ev(`__cmwSteps({ x: ${1 + u} }); 1`); await settled({ max: 20000 }); };
  await frameAt5('__cmwSteps({ park: 2 })');
  ok('mesh: the parked globe on plane w2 is drawn', !!(await grab('sphParked2')), null);
  await heldAt5(1 - ARRIVE_EPS);
  ok('mesh: the glide frame near plane w2 is drawn', !!(await grab('sphArrive2')), null);
  R.arriveRecMesh = await ev('(() => { const g = __cmwSvGlobe(0, 0); return { path: g.path, sheets: g.sheets }; })()');
  ok('mesh: the glide frame near plane w2 is carried by the mesh, on both of the root\'s sheets', R.arriveRecMesh.path === 'mesh' && R.arriveRecMesh.sheets === 2, R.arriveRecMesh);
  await ev('__cmwSteps({ glideSheets: 1 }); 1');
  await heldAt5(1 - ARRIVE_EPS);
  ok('mesh: the glide frame near plane w2, the principal sheet alone, is drawn', !!(await grab('sphArrive2One')), null);
  await ev('__cmwSteps({ glideSheets: 0 }); 1');
  R.arrivalMesh = { all: await compare('sphArrive2', 'sphParked2'), one: await compare('sphArrive2One', 'sphParked2') };
  ok(`mesh: the glide frame ${ARRIVE_EPS} short of plane w2 is the parked globe: at most ${ARRIVE_MAX * 100} % of the pixels apart`, !!R.arrivalMesh.all && R.arrivalMesh.all.frac <= ARRIVE_MAX, R.arrivalMesh);
  ok(`mesh: the control, the principal sheet alone, more than ${ARRIVE_CONTROL * 100} % apart`, !!R.arrivalMesh.one && R.arrivalMesh.one.frac > ARRIVE_CONTROL, R.arrivalMesh);
}
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
