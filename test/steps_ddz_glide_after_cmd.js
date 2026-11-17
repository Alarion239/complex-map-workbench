// A glide between two planes past a d/dz step takes the exact (inverse) pass (#1679): the chain [z³ - 3z, d/dz, M],
// M(w) = (w - 1)/(w + 1),
// coloured from z, Everywhere, on the plane, the colour layer alone (SV.bare). Plane w₂ is the d/dz plane (its points
// 3z² - 3); the glide from w₂ to w₃ runs M's homotopy on them, which the inverse pass plans over the chain that stands
// in for the d/dz (the cubic off, its derivative in the d/dz's place, invHomBase).
// - A scrub held (held_frames' hold) at x = 2 + u, u = 0.25, 0.5 and 0.75: the glide's record is the step-3 glide's,
//   drawn by the inverse pass (__cmwSteps().glide.path 'inverse');
// - the frame is the exact picture at u: held_frames' judge against plane z's parked frame (each pixel w of the frame
//   the colour of its front point z, Newton's method on the frame's map, the front one by the glide's sheet key), at most
//   JUDGE_OVER of the pixels compared more than JUDGE_TOL apart. The reference solves 1/H = 1/w as well (judge's recip):
//   M's pole, at the points z with 3z² - 3 = -1, lies in the window, and next to it Newton's method on H misses roots.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, grab, judge, UNHELD, JUDGE_TOL, JUDGE_OVER } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const QUIET_UNTIL = `window.__cmwSteps && __cmwSteps().ready.ready && !__cmwSteps().anim && GLR.pendingLinks === 0 && __cmwSvFixed() && (${UNHELD})`;
const state = {
  v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, shapes: [], srcView: { cx: 0, cy: 0, s: 90 },
  steps: [{ type: 'custom', params: { expr: 'z^3-3z', cut: 180 }, on: true }, { type: 'deriv', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }],
};

await view(1200, 800, false, false);
const ns = `svddza${Date.now()}`;
await go(`http://localhost:${PORT}/gl-helpers.html`);
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && !!window.GLR && !!document.querySelector('.sv-rail')" });
// (opacity 1: the carried colour at the slider's opacity is the colour plot's only at full opacity)
await ev(`__cmwSet('morphPaths', false); __cmwSet('alpha', 1); __cmwSteps({ T: 0, scope: 'all', surf: 'plane', bare: true, go: 0, now: true }); 1`);
await settled({ max: 60000, until: QUIET_UNTIL });
ok('its planes are z, w1, the d/dz plane w2 and w3', JSON.stringify((await ev('__cmwSteps()')).planes) === '[0,1,2,3]', null);
ok('plane z at rest is kept', await grab('p0'), null);

for (const u of [0.25, 0.5, 0.75]) {
  const x = 2 + u, tag = `u=${u}`;
  const held = (await hold(x)).ok;
  ok(`${tag}: the scrub holds the glide from w2 to w3 there`, held, null);
  const kept = await grab(tag);
  const g = await ev('(() => { const g = __cmwSteps().glide; return g && { b: g.b, u: g.u, path: g.path, reason: g.reason }; })()');
  const j = await judge('p0', tag, { recip: true });
  info[tag] = { g, judge: j };
  await ev('window.__svScrubUp && window.__svScrubUp(), 1');
  ok(`${tag}: drawn by the inverse pass (the step-3 glide's record, path 'inverse')`, !!g && g.b === 3 && Math.abs(g.u - u) < 1e-6 && g.path === 'inverse', g);
  ok(`${tag}: the exact picture (at most ${100 * JUDGE_OVER} % of the pixels compared more than ${JUDGE_TOL} apart)`, kept && j.pass, j);
}

await ev('__cmwSteps({ bare: false }); 1');
info.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', info.logs.length === 0, info.logs);
return { pass: fails.length === 0, fails, info };
