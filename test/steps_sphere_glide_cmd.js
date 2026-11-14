// The steps view's glide on the Sphere surface: parked between plane z and plane w1, Inside regions keeps the
// globe's colour inside the moving regions, as at rest, and the paths t -> H_t(z) of the glide are drawn on the globe.
//  - colour: the pixels of the left pane in a saturated phase colour (max - min channel > 60), at rest on plane z with
//    Inside regions and parked half-way; parked, about as many as at rest (the region's image moves and shrinks), not
//    the whole globe
//  - paths: parked, the frame draws the paths' moving points (__cmwSteps().paths.globeHeads > 0), and they threw nothing
//    (globeError: a throw's message, named in the check)
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
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
