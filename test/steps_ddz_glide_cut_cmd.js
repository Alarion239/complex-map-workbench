// A glide into a d/dz plane shows the cut handles of the plane it is nearest to, inert, as the other glide frames do
// (#1688): the chain [z², d/dz, √z] (plane w₂, the d/dz plane, carries √z's cut and its handle at rest), Everywhere, on
// the plane, coloured from z (T = 0: both ends drawn by the carry core) and from w₂ (T = 2: w₂ coloured, drawn by the
// classic core), each case:
// - At rest on w₁ and on w₂: the handles each plane draws (__cmwCutHandles), w₂'s at least one;
// - a scrub held (not let go) at x = 1 + U_FAR, under way into w₂: the marks (__cmwCutMarks, the handles drawn and never
//   hit-tested) are w₂'s handles at rest, as many and each within PX CSS px of one, and no handle takes a press
//   (__cmwCutHandles empty); the glide record is the d/dz glide's;
// - held at x = 1 + U_NEAR, nearer w₁: the marks are w₁'s handles at rest, the same way;
// - parked between the planes (let go there, __cmwSteps({ park })): no mark and no handle, as a frame parked between
//   two other planes draws none.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// (U_FAR, U_NEAR: the glide's u either side of the middle; PX: the most a mark may be from its rest handle, CSS px)
const U_FAR = 0.75, U_NEAR = 0.25, PX = 1;
const QUIET_UNTIL = "window.__cmwSteps && __cmwSteps().ready.ready && !__cmwSteps().anim && GLR.pendingLinks === 0 && __cmwSvFixed()";
const quiet = async () => {
  await settled({ max: 60000, until: QUIET_UNTIL });
  await ev('await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), 1');
};
const state = {
  v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 },
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 2, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'deriv', params: {}, on: true }, { type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }],
};
const pts = (L) => L.map((h) => ({ step: h.step, x: +h.x.toFixed(1), y: +h.y.toFixed(1) }));
// marks M are the rest handles R: as many, each within PX of one of the same step
const same = (M, R) => M.length === R.length && M.every((m) => R.some((r) => r.step === m.step && Math.hypot(r.x - m.x, r.y - m.y) <= PX));

await view(1200, 800, false, false);
const ns = `svddzc${Date.now()}`;
await go(`http://localhost:${PORT}/gl-helpers.html`);
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && !!window.GLR && !!document.querySelector('.sv-rail')" });
await ev(`__cmwSet('morphPaths', false); __cmwSteps({ T: 0, scope: 'all', surf: 'plane', bare: false }); 1`);
ok('its planes are z, w1, the d/dz plane w2 and w3', JSON.stringify((await ev('__cmwSteps()')).planes) === '[0,1,2,3]', null);

for (const T of [0, 2]) {
  // ---- at rest ----
  await ev(`__cmwSteps({ T: ${T} }); 1`);
  const rest = {};
  for (const k of [1, 2]) {
    await ev(`__cmwSteps({ go: ${k}, now: true }); 1`);
    await quiet();
    rest[k] = pts(await ev('__cmwCutHandles()'));
  }
  info[`T=${T} rest`] = rest;
  ok(`T=${T}: at rest on w2 (the d/dz plane, the square root's cut on it) its cut handle is drawn`, rest[2].length > 0, rest);

  // ---- held under way ----
  for (const [u, k] of [[U_FAR, 2], [U_NEAR, 1]]) {
    const x = 1 + u, tag = `T=${T} held x=${x}`;
    await ev('__cmwSteps({ go: 0, now: true }); 1');
    await quiet();
    const held = (await hold(x)).ok;
    const r = info[tag] = await ev(`(() => { const s = __cmwSteps(), g = s.glide; return { x: s.x, moving: s.moving, marks: __cmwCutMarks(), handles: __cmwCutHandles().length, glide: g && { b: g.b, u: g.u, reason: g.reason } }; })()`);
    r.marks = pts(r.marks);
    await ev('window.__svScrubUp && window.__svScrubUp(), 1');
    ok(`${tag}: the scrub holds the glide into w2 there`, held && Math.abs(r.x - x) < 0.01 && r.moving, r);
    ok(`${tag}: the frame is the d/dz glide's`, !!r.glide && r.glide.b === 2 && r.glide.reason === 'a d/dz step', r);
    ok(`${tag}: its marks are plane w${k}'s handles at rest, the plane it is nearest to`, same(r.marks, rest[k]), { got: r.marks, want: rest[k] });
    ok(`${tag}: no handle takes a press mid-glide`, r.handles === 0, r);
  }
}

// ---- parked between the planes ----
await ev(`__cmwSteps({ park: ${1 + U_FAR} }); 1`);
await quiet();
info.parked = await ev('(() => { const s = __cmwSteps(); return { x: s.x, moving: s.moving, marks: __cmwCutMarks().length, handles: __cmwCutHandles().length }; })()');
ok(`parked at x = ${1 + U_FAR}: no mark and no handle`, Math.abs(info.parked.x - 1 - U_FAR) < 1e-9 && info.parked.marks === 0 && info.parked.handles === 0, info.parked);

info.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', info.logs.length === 0, info.logs);
return { pass: fails.length === 0, fails, info };
