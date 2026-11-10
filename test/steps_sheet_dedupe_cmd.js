// All sheets draws coinciding sheets once. On the Landscape with All sheets on, the layers drawn (render3D.sheetsInfo.K)
// are the distinct sheets of the map's values:
// - √, cos, log: cos is even, so the √'s two branches coincide under each of the log's five (10 combos, 5 sheets):
//   5 layers at rest and parked in the glide to the next plane;
// - in the glide (u .5, .9, .98, held with x so that it stays a glide: the exact inverse path) the layers are the distinct members of the
//   composite: two layers are one only when their z and height agree at every probe place within LAYER_SAME, and the frame's distinct layers
//   (from its drawn z and h) equal the enumerator's distinct members at each probe place; the √'s two members split continuously, so the
//   largest distance from a layer's height to the nearest other layer's at the probe places falls toward 0 as u goes to 1 (and to 0);
// - √ then √ (distinct sheets): the count is the product, so nothing distinct is dropped.
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
// (the sheets drawn: K of the sheet mesh, or, in a glide drawn by the exact inverse, one layer for each of its sheets: the carried frame's layers)
const drawn = () => ev('JSON.stringify((__cmwLandSheets().drawn) || (() => { const c = __cmwLandCarry(); return c && c.path === "inverse" ? { K: c.layers } : null; })())').then((c) => JSON.parse(c));
const open = async (steps) => {
  const ns = 'sheetdedupe' + Date.now();
  await loadView('steps', ns, { shapes: [], steps, sheets: true, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
  await settled({ max: 60000 });
};
const ROOT = { type: 'root', params: { n: 2 }, on: true }, LOG = { type: 'log', params: {}, on: true }, COS = { type: 'custom', params: { expr: 'cos(z)' }, on: true };
// the layers drawn at plane 0 at rest, parked at 0.5 and 0.98 of the glide to plane 1, and at plane 1 at rest
const counts = async (name, steps) => {
  await open(steps);
  const r = {};
  await rest(0); r.rest0 = (await drawn() || {}).K || 0;
  r.title = await ev('__cmwLandSheets().title.replace(/<[^>]*>/g, "")');
  await park(0.5); r.mid = (await drawn() || {}).K || 0;
  await rest(1); r.rest1 = (await drawn() || {}).K || 0;
  info[name] = r;
  return r;
};
// √, cos, log: cos is even, so the √'s two branches give the same surface under each of the log's five: 5 sheets, not 10
const a = await counts('root_cos_log', [ROOT, COS, LOG]);
ok('√, cos, log: the coinciding sheets are drawn once (5 layers at rest, not 10)', a.rest0 === 5, a);
ok('√, cos, log: the same 5 layers at the next plane at rest', a.rest1 === 5, a);
ok('√, cos, log: the pane title counts the 5 sheets drawn', /\b5 sheets\b/.test(a.title) && !/\b10 sheets\b/.test(a.title), a.title);
// √ then √: four distinct sheets, none dropped
const b = await counts('root_root', [ROOT, ROOT]);
ok('√ then √ (distinct sheets): all 4 are drawn at rest and parked in the glide', b.rest0 === 4 && b.mid === 4, b);
// the glide's layers: the distinct members of the composite
await open([ROOT, COS, LOG]);
const CONT_CODE = 10.25;   // (the texel code of a vertex continued onto a layer past its range, CARRY_CONT_CODE: a layer's own vertices are below it)
const LAYER_SAME = 1e-4, PROBES = [], PN = 8;   // (relative to 1 + |z|, and in height units: float noise of the walk and of the frame's textures)
for (let i = 0; i < PN; i++) for (let j = 0; j < PN; j++) PROBES.push([-6 + 12 * (i + 0.5) / PN, -5 + 10 * (j + 0.5) / PN]);
// the distinct layers among {z, h}: one when its z and height agree with an earlier one's within tol; the distinct members among {z}: by z alone
const near = (o, l, tol) => Math.hypot(o.z[0] - l.z[0], o.z[1] - l.z[1]) <= tol * (1 + Math.hypot(l.z[0], l.z[1]));
const distinct = (ls, tol) => { const out = []; for (const l of ls) if (!out.some((o) => near(o, l, tol) && Math.abs(o.h - l.h) <= tol)) out.push(l); return out; };
const members = (ls, tol) => { const out = []; for (const l of ls) if (!out.some((o) => near(o, l, tol))) out.push(l); return out; };
const SPLIT_MERGE = 0.3;   // (a height difference the pair has at u .9 or less: the sheets are 0.85 apart)
const SHEETS = 5;   // (the log's sheets k = -2..2: the same member's layers, a height step apart)
// the layers expected at a place: the enumerator's distinct members, each with the log's sheets
const expected = (en, tol) => members(en, tol).length * SHEETS;
// a place with two members: the largest height difference between the two members' sheets (the layers sorted by height in each)
const split = (ls, tol) => {
  const ms = members(ls, tol);
  if (ms.length < 2) return null;
  const hs = ms.slice(0, 2).map((m) => ls.filter((l) => near(m, l, tol)).map((l) => l.h).sort((x, y) => x - y));
  return Math.max(...hs[0].map((h, i) => Math.abs(h - (hs[1][i] === undefined ? h : hs[1][i]))));
};
const probeGlide = async (u) => {
  await ev(`__cmwSteps({ x: ${u} }); 1`); await settled({ max: 60000 }); await ev(rAF2);
  const gl = JSON.parse(await ev('JSON.stringify((() => { const c = __cmwLandCarry(); return { carried: !!c, path: c && c.path }; })())'));
  const all = JSON.parse(await ev(`JSON.stringify(__cmwLandFrameVerts(${JSON.stringify(PROBES)}).map((ls) => ls.map((l) => ({ z: l.z || null, h: l.h, c: l.c }))))`));
  const noZ = all.reduce((n, ls) => n + ls.filter((l) => !l.z).length, 0);   // (a texel with no preimage is no layer: the frame has none at a probe place)
  const fv = all.map((ls) => ls.filter((l) => l.z));
  const en = JSON.parse(await ev(`JSON.stringify(__cmwLandEnum(${JSON.stringify(PROBES)}).map((ms) => ms.map((m) => ({ z: m.z, h: m.h }))))`));
  return { gl, fv, en, noZ };
};
const GLIDE_AT = [0.002, 0.02, 0.2, 0.5, 0.9, 0.98, 0.998];
const G = {};
for (const u of GLIDE_AT) G[u] = await probeGlide(u);
const badAt = (g, f, tol) => { let bad = 0, n = 0; const at = []; g.fv.forEach((ls, i) => { if (!g.en[i].length) return; n++; const have = f(ls).length, want = expected(g.en[i], tol); if (have !== want) { bad++; if (at.length < 3) at.push({ p: PROBES[i], have, want }); } }); return { n, bad, at }; };
for (const u of [0.5, 0.9, 0.98]) {
  const g = G[u];
  ok(`√, cos, log, u=${u}: the view is still a glide drawn by the exact inverse path`, g.gl.carried && g.gl.path === 'inverse', g.gl);
  ok(`√, cos, log, u=${u}: no probe place has a layer without a preimage (${g.noZ})`, g.noZ === 0, { noZ: g.noZ });
  const r = badAt(g, (ls) => distinct(ls, LAYER_SAME), LAYER_SAME);
  ok(`√, cos, log, u=${u}: the frame's distinct layers are the enumerator's distinct members with the ${SHEETS} sheets, at every probe place (${r.n} places)`, r.n > 0 && r.bad === 0, r);
  // the whole frame: its most layers at a place (own and continued, each distinct one counted) are the most the enumerator's members give
  const kFrame = Math.max(...g.fv.map((ls) => distinct(ls, LAYER_SAME).length)), kWant = Math.max(...g.en.map((ms) => expected(ms, LAYER_SAME)));
  ok(`√, cos, log, u=${u}: the frame's most layers at a place are the scene's (${kFrame}, the enumerator's ${kWant})`, kFrame === kWant, { kFrame, kWant });
  info[`places with two members, u=${u}`] = g.fv.filter((ls) => members(ls, LAYER_SAME).length === 2).length;
}
// the controls
const c5 = badAt(G[0.5], (ls) => distinct(ls.concat(ls.slice(0, 1)), LAYER_SAME), LAYER_SAME);
ok('control: a duplicate layer appended to every place is counted once', c5.bad === 0, c5);
// (the members' z are far apart (about opposite at the end) and their layers' heights close: a merge by closeness of the heights, which are the surface's values,
// would drop the second member)
// (a continued layer that is no member's, put at every place: it is counted, so the row goes red; leaving the continued layers out would hide it)
const EXTRA = { z: [1e3, 1e3], h: 0, c: CONT_CODE };
const cExtra = badAt(G[0.5], (ls) => distinct(ls.concat([EXTRA]), LAYER_SAME), LAYER_SAME);
ok('control: a continued layer that is no member is counted, so the row at u .5 goes red', cExtra.bad === cExtra.n && cExtra.n > 0, cExtra);
const cHide = badAt(G[0.5], (ls) => distinct(ls.concat([EXTRA]).filter((l) => !(l.c >= CONT_CODE)), LAYER_SAME), LAYER_SAME);
ok('control: leaving the continued layers out hides that layer, which is what the row must not do', cHide.bad === 0, cHide);
const c98 = badAt(G[0.9], (ls) => ls.filter((l, i) => !ls.slice(0, i).some((o) => Math.abs(o.h - l.h) <= SPLIT_MERGE)), LAYER_SAME);
ok('control: a merge of layers whose heights are within ' + SPLIT_MERGE + ' at u .9 turns the row red', c98.bad > 0, c98);
const cDrop = badAt(G[0.5], (ls) => ls.filter((l) => near(members(ls, LAYER_SAME)[0], l, LAYER_SAME)), LAYER_SAME);
ok('control: dropping one of the members of the √ at u .5 turns the row red', cDrop.bad > 0, cDrop);
// the √'s two members change continuously: toward u = 1 they take a half of the plane each, so the share of probe places that hold both falls to 0; toward u = 0
// they coincide, so the largest distance between their preimages (relative to 1 + |z|) falls to 0
const share = (u) => G[u].fv.filter((ls) => members(ls, LAYER_SAME).length > 1).length / PROBES.length;
const zsep = (u) => Math.max(...G[u].fv.map((ls) => { const ms = members(ls, LAYER_SAME); return ms.length > 1 ? Math.hypot(ms[0].z[0] - ms[1].z[0], ms[0].z[1] - ms[1].z[1]) / (1 + Math.hypot(ms[0].z[0], ms[0].z[1])) : 0; }));
const down = [0.5, 0.9, 0.98, 0.998].map(share), up = [0.002, 0.02, 0.2].map(zsep);
info.shareOfTwo = down; info.zSeparation = up;
const STEP_MAX = 0.5;   // (the largest share a step between neighbouring probes of u may change by)
ok('√, cos, log: the share of places with both members falls to 0 as u goes to 1 (.5, .9, .98, .998), by steps of at most ' + STEP_MAX, down.every((v, i) => i === 0 || (v <= down[i - 1] && down[i - 1] - v <= STEP_MAX)) && down[3] < 0.05, down);
ok('√, cos, log: the distance between the two members falls monotonically toward 0 as u goes to 0 (.2, .02, .002)', up[0] < up[1] && up[1] < up[2] && up[0] < up[2] / 10, up);
return { pass: !fails.length, fails, info };
