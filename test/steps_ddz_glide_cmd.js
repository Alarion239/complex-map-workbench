// The steps view's glide into a d/dz plane (#1322): the step has no homotopy, so its frames are the two planes'
// pictures at rest cross-faded, (1 - u) plane a + u plane b, each drawn as its plane draws at rest. Gallery example 15,
// [z³ - 3z, d/dz], glided from w₁ to w₂: in each case below, the frames parked at u = 1/4 and u = 3/4 are compared,
// colour layer alone (SV.bare), with the cross-fade of the two planes' frames at rest (held_frames' fade): at most
// FADE_OFF of the pixels may be more than DIFF_TOL apart. A frame that fades through the bare paper, or that leaves an
// end out, is far off it. Each plane's frame at rest must show colour: its mean luminance under PAPER_LUM.
// - On the plane, both planes past the colour plane z (T = 0), Everywhere and Inside regions: plane w₁ at rest by the
//   exact pass, plane w₂ by the carried meshes (the inverse planner has no plan past a d/dz, #1645);
// - on the plane, the colour plane w₁ (T = 1), Inside regions: plane w₁ coloured, plane w₂ past it;
// - on the plane, the colour plane w₂ (T = 2), Everywhere: plane w₂ coloured, plane w₁ before it but past a d/dz on
//   the way to it, so not coloured;
// - on the Sphere, T = 0 and T = 2, Everywhere.
// Each frame's glide record (__cmwSteps().glide) is the d/dz glide's: its u, reason 'a d/dz step', and an end path
// for each plane, neither 'none'.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { grab, compare, fade, UNHELD, DIFF_TOL } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// (FADE_OFF: the share of a frame's pixels that may be more than DIFF_TOL from the cross-fade, where an outline of
// the regions' antialiased edge or a sample of the meshes' fix-up lands a pixel apart; GRABS: the tries at a still
// frame, a quiet wait between them; PAPER_LUM: a frame's mean luminance under which it is not the bare paper, about 253)
const FADE_OFF = 0.01, GRABS = 4, PAPER_LUM = 245;
const QUIET_UNTIL = `window.__cmwSteps && __cmwSteps().ready.ready && !__cmwSteps().anim && !__cmwSteps().play && GLR.pendingLinks === 0 && __cmwSvFixed() && !(window.__cmwSphere && __cmwSphere().running) && (${UNHELD})`;
const quiet = () => settled({ max: 60000, until: QUIET_UNTIL });
// the frame where the state o puts it (go: a plane, arrived at; x: a place between two), still and kept as tag
const frameAt = async (o, tag) => {
  await ev(`__cmwSteps(${JSON.stringify(o)}); 1`);
  await ev('await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), 1');
  await quiet();
  for (let n = 0; n < GRABS; n++) {
    if (await grab(tag)) return true;
    await quiet();
  }
  return false;
};

await view(1200, 800, false, false);
await go(`http://localhost:${PORT}/test.html?ns=svddz${Date.now()}&view=steps`);
await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && typeof __cmwExample === 'function' && !!window.GLR" });
// (gallery example 15, found by its name)
R.example = await ev(`(() => { for (let i = 0; i < 80; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && /derivative in the chain/i.test(l.textContent)) return i; } return -1; })()`);
ok('gallery example 15, The derivative in the chain, opens', R.example >= 0, R.example);
await quiet();
await ev(`__cmwSet('morphPaths', false); 1`);
const planes = (await ev('__cmwSteps()')).planes;
ok('its planes are z, w1 and the d/dz plane w2', JSON.stringify(planes) === '[0,1,2]', planes);

const CASES = [
  { surf: 'plane', T: 0, scope: 'all' }, { surf: 'plane', T: 0, scope: 'in' }, { surf: 'plane', T: 1, scope: 'in' },
  { surf: 'plane', T: 2, scope: 'all' }, { surf: 'sphere', T: 0, scope: 'all' }, { surf: 'sphere', T: 2, scope: 'all' },
];
for (const c of CASES) {
  const tag = `${c.surf} T=${c.T} ${c.scope}`, r = R[tag] = {};
  await ev(`__cmwSteps(${JSON.stringify({ T: c.T, scope: c.scope, surf: c.surf, bare: true })}); 1`);
  ok(`${tag}: the frame at rest on w1 settles`, await frameAt({ go: 1, now: true }, tag + ' w1'), null);
  ok(`${tag}: the frame at rest on w2 settles`, await frameAt({ go: 2, now: true }, tag + ' w2'), null);
  const rest = await compare(tag + ' w1', tag + ' w2');
  r.restLum = rest && rest.lum.map((v) => +v.toFixed(1));
  ok(`${tag}: each plane at rest shows colour, not the bare paper (its mean luminance under ${PAPER_LUM})`, !!rest && rest.lum.every((l) => l < PAPER_LUM), r.restLum);
  for (const u of [0.25, 0.75]) {
    const at = `${tag} u=${u}`;
    ok(`${at}: the frame settles`, await frameAt({ x: 1 + u }, at), null);
    await fade(tag + ' w1', tag + ' w2', u, at + ' fade');
    const d = await compare(at, at + ' fade'), st = await ev('__cmwSteps()'), g = st.glide;
    r[u] = { off: d && +d.frac.toFixed(4), mean: d && +d.mean.toFixed(1), lum: d && d.lum.map((v) => +v.toFixed(1)), glide: g && { b: g.b, u: g.u, path: g.path, reason: g.reason, ends: g.ends } };
    ok(`${at}: parked at x = ${1 + u}, ${c.surf}, coloured from plane ${c.T}, scope ${c.scope}`, Math.abs(st.x - 1 - u) < 1e-9 && st.T === c.T && st.surf === c.surf && st.scope === c.scope, { x: st.x, T: st.T, surf: st.surf, scope: st.scope });
    ok(`${at}: the cross-fade of the two planes at rest (at most ${100 * FADE_OFF} % of the pixels more than ${DIFF_TOL} apart)`, !!d && d.frac <= FADE_OFF, r[u]);
    ok(`${at}: the d/dz glide's record, an end path for each plane and neither 'none'`, !!g && g.b === 2 && Math.abs(g.u - u) < 1e-9 && g.reason === 'a d/dz step' && Array.isArray(g.ends) && g.ends.length === 2 && !g.ends.includes('none'), r[u]);
  }
}
await ev('__cmwSteps({ bare: false }); 1');
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
