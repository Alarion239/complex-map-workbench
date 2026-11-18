// The steps view at rest on a plane past a d/dz step, drawn by the exact pass: gallery example 15,
// [z³ - 3z, d/dz], at rest on w₂ past the colour plane. w₂'s points are D(z) = (z³ - 3z)′ = 3z² - 3, a map of z; the
// inverse pass draws each pixel w with the colour of its front point z, D(z) = w, so the frame's colour at w must be the
// colour the colour plane gives z, which plane z shows at z at rest when it is coloured from that plane (the reference,
// in the same camera, Everywhere). D takes z and -z to one w: the front one is the steps view's sheet key's (carry_kit
// fronts). A point counts as wrong when its pixel differs by more than 14 in a channel from all 9 pixels about z's; at
// most 1 % may be, and none may sit on the bare paper. The colour layer alone is read (SV.bare). Left out: points next
// to a colour line (the 9 pixels about z, or about w, spanning more than LINE levels in a channel), where a pixel's
// offset shows the next band or sector; and the seam where z and -z tie (w real past the branch point -3, z real),
// within SEAM_PX of it, where the front flips from one to the other.
// - Coloured from z (T = 0) and from w₁ (T = 1), Everywhere: the record at rest says 'inverse' (the exact pass), the
//   colour as above;
// - Inside regions (T = 0): 'inverse', and the colour inside the example's disc |z| < 1.6;
// - plane w₁ coloured from w₂ (T = 2), which is not coloured (the d/dz lies between it and the colour plane) and takes
//   the carried colour: 'inverse', each point w of w₁ the colour w₂ gives its front preimage z, z³ - 3z = w (the three
//   roots, carry_kit fronts on plane 1), against plane z coloured from w₂;
// - on the Sphere (T = 0): the globe at rest on w₂ carries its colour by the exact pass (__cmwSvGlobe's path 'inverse').
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { lpx, paneOf, tally, grid, shown, fronts } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
// (DISC_R: the example's disc; EDGE: kept inside its rim and off the D's branch point at w = -3, where z and -z meet)
// LINE: the levels the 9 pixels about a point may span off a colour line; SEAM_PX: the px kept off the seam
const DISC_R = 1.6, EDGE = 0.12, LINE = 24, SEAM_PX = 3;
const spread = (q) => !q ? 0 : Math.max(...[0, 1, 2].map((c) => Math.max(...q.map((p) => p[c])) - Math.min(...q.map((p) => p[c]))));
const QUIET_UNTIL = "window.__cmwSteps && __cmwSteps().ready.ready && !__cmwSteps().anim && GLR.pendingLinks === 0 && __cmwSvFixed() && !(window.__cmwSphere && __cmwSphere().running)";
const quiet = async () => {
  await settled({ max: 60000, until: QUIET_UNTIL });
  await ev('await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), 1');
};
const at = async (o) => { await ev(`__cmwSteps(${JSON.stringify(o)}); 1`); await quiet(); return ev('__cmwSteps()'); };

await view(1200, 800, false, false);
await go(`http://localhost:${PORT}/test.html?ns=svddzr${Date.now()}&view=steps`);
await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && typeof __cmwExample === 'function' && !!window.GLR" });
info.example = await ev(`(() => { for (let i = 0; i < 80; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && /derivative in the chain/i.test(l.textContent)) return i; } return -1; })()`);
ok('gallery example 15, The derivative in the chain, opens', info.example >= 0, info.example);
await quiet();
// (opacity 1: the carried colour at the slider's opacity is the colour plot's only at full opacity)
await ev(`__cmwSet('morphPaths', false); __cmwSet('alpha', 1); __cmwSteps({ bare: true }); 1`);
ok('its planes are z, w1 and the d/dz plane w2', JSON.stringify((await ev('__cmwSteps()')).planes) === '[0,1,2]', null);

// the points w of a grid over w₂'s pane, with their front preimage z (D(z) = w) where plane z's reference shows it
const pairs = async (P, keep) => {
  const W = [], Z = [], lists = [];
  for (const w of grid(P, 70, 70, 0.9)) {
    const r = Math.hypot(w[0] + 3, w[1]), a = Math.atan2(w[1], w[0] + 3) / 2, m = Math.sqrt(r / 3);
    if (r / 3 < EDGE * EDGE) continue;
    const z = [m * Math.cos(a), m * Math.sin(a)];
    lists.push([z, [-z[0], -z[1]]]);
    W.push(w);
  }
  const F = await fronts(lists, 2);
  const outW = [], outZ = [];
  F.forEach((i, k) => { const z = lists[k][i]; if (i >= 0 && shown(P, z) && keep(z)) { outW.push(W[k]); outZ.push(z); } });
  return { W: outW, Z: outZ };
};
const fmt = (v) => v.map((q) => +q.toFixed(3));
// the roots of z³ - 3z - w for each w of ws, as [x, y] (the page's CX.polyRoots)
const cubicRoots = (ws) => ev(`(${JSON.stringify(ws)}).map((w) => CX.polyRoots([CX.C(1), CX.C(0), CX.C(-3), CX.C(-w[0], -w[1])]).map((z) => [z.re, z.im]))`);
// the points w of a grid over w₁'s pane, with their front preimage z (z³ - 3z = w) where plane z's reference shows it
const pairs1 = async (P) => {
  const W = [], lists = [], G = grid(P, 70, 70, 0.9), R = await cubicRoots(G);
  for (const [n, w] of G.entries()) {
    const r = R[n];
    // (off the branch values w = ±2, where two roots meet)
    if (Math.min(Math.hypot(w[0] - 2, w[1]), Math.hypot(w[0] + 2, w[1])) < 0.2) continue;
    lists.push(r); W.push(w);
  }
  const F = await fronts(lists, 1);
  const outW = [], outZ = [];
  F.forEach((i, k) => { const z = lists[k][i]; if (i >= 0 && shown(P, z)) { outW.push(W[k]); outZ.push(z); } });
  return { W: outW, Z: outZ };
};

for (const c of [{ T: 0, scope: 'all' }, { T: 1, scope: 'all' }, { T: 0, scope: 'in' }]) {
  const tag = `T=${c.T} ${c.scope}`;
  // (the reference: plane z at rest, Everywhere, coloured from the same plane)
  await at({ go: 0, now: true, T: c.T, scope: 'all', surf: 'plane' });
  const P = await paneOf();
  const keep = c.scope === 'in' ? (z) => Math.hypot(z[0], z[1]) < DISC_R - EDGE : () => true;
  const { W, Z } = await pairs(P, keep);
  const ref = (await lpx(Z)).px;
  const st = await at({ go: 2, now: true, T: c.T, scope: c.scope, surf: 'plane' });
  const got = (await lpx(W)).px;
  const skip = (k) => spread(ref[k]) > LINE || spread(got[k]) > LINE || (W[k][0] > -3 && Math.abs(W[k][1]) * P.v.s < SEAM_PX);
  info[tag] = Object.assign(tally(got, ref, { skip, note: (k) => ({ w: fmt(W[k]), z: fmt(Z[k]) }) }), { rest: st.rest, x: st.x, T: st.T });
  ok(`${tag}: at rest on w2, coloured from plane ${c.T}`, st.x === 2 && st.T === c.T, info[tag]);
  ok(`${tag}: drawn by the exact pass (the record at rest: 'inverse')`, !!st.rest && st.rest.a === 2 && st.rest.path === 'inverse', info[tag]);
  ok(`${tag}: each point the colour plane's colour of its front preimage, at most 1 % wrong`, info[tag].n >= 300 && info[tag].wrong <= 0.01 * info[tag].n, info[tag]);
  ok(`${tag}: no point on the bare paper`, info[tag].paper === 0, info[tag]);
}

// plane w₁ coloured from w₂
{
  const tag = 'w1 T=2 all';
  await at({ go: 0, now: true, T: 2, scope: 'all', surf: 'plane' });
  const P = await paneOf();
  const { W, Z } = await pairs1(P);
  const ref = (await lpx(Z)).px;
  const st = await at({ go: 1, now: true, T: 2, scope: 'all', surf: 'plane' });
  const got = (await lpx(W)).px;
  // (the seam where the front changes sheet: two roots tie on the key; points whose neighbour pixels show both are left
  // out with the colour lines)
  const skip = (k) => spread(ref[k]) > LINE || spread(got[k]) > LINE;
  info[tag] = Object.assign(tally(got, ref, { skip, note: (k) => ({ w: fmt(W[k]), z: fmt(Z[k]) }) }), { rest: st.rest, x: st.x, T: st.T });
  ok(`${tag}: at rest on w1, coloured from plane 2`, st.x === 1 && st.T === 2, info[tag]);
  ok(`${tag}: drawn by the exact pass (the record at rest: 'inverse')`, !!st.rest && st.rest.a === 1 && st.rest.path === 'inverse', info[tag]);
  ok(`${tag}: each point the colour plane's colour of its front preimage, at most 1 % wrong`, info[tag].n >= 300 && info[tag].wrong <= 0.01 * info[tag].n, info[tag]);
  ok(`${tag}: no point on the bare paper`, info[tag].paper === 0, info[tag]);
}

// the globe at rest on w₂
await at({ go: 2, now: true, T: 0, scope: 'all', surf: 'sphere' });
info.globe = await ev('(() => { const g = __cmwSvGlobe(0, 0); return { path: g.path, carried: g.carried }; })()');
ok("the globe at rest on w2 carries its colour by the exact pass (path 'inverse')", info.globe.path === 'inverse', info.globe);

await ev('__cmwSteps({ bare: false }); 1');
info.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', info.logs.length === 0, info.logs);
return { pass: fails.length === 0, fails, info };
