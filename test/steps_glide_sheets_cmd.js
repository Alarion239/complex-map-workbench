// The steps view's 2D glide over a multivalued step draws every sheet, as the plane it arrives at does: the glide's
// frames are the copies of plane z, one per sheet combo of the steps it crosses, each placed by the glide's map
// continued on its combo and coloured on it. The Plane surface, Everywhere, the colour plane the last plane (so the
// plane a glide arrives at is coloured by its own variable over the whole plane), no lines, paths or strokes:
// - square root alone (the inverse path) and z³ − 3z then square root (the mesh path: the cubic has no inverse plan),
//   the glide onto the square root's plane at u = SHORT, 1/2 and 1 − SHORT, and at u = TINY and 1 − TINY:
//   - no frame leaves paper where the copies' images cover the plane: its paper share is at most PAPER_MAX (one sheet
//     leaves the left half paper, about 0.5);
//   - at u = 1 − TINY the frame is as close to the plane it arrives at, parked, as the frame at u = TINY is to the
//     plane it leaves (no sheet is missing at either end): the share of pixels more than DIFF_TOL apart (held_frames.js)
//     at most SAME_FRAC over the departure's. (A glide frame and a parked plane are drawn by different passes, whose
//     colour bands meet a pixel apart: a few per cent of the pane at either end, with the principal sheet alone too;
//     one sheet missing on arrival is half the pane);
// - the K = 1 control (__cmwSteps({ glideSheets: 1 }): the principal combo alone) leaves the left half paper again, so
//   the rows above read the sheets the glide draws.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const SHORT = 0.002, TINY = 1e-4;     // the glide's places near its ends: u and 1 − u
const PAPER_MAX = 0.005;              // the share of the pane a frame may leave paper (the cut's seam, the pane's rim)
const SAME_FRAC = 0.005;              // how much further the arrival frame may be from its plane than the departure frame from its own
const ONE_SHEET = 0.4;                // with the principal combo alone, at least this share is paper near u = 1
const READY = 'typeof __cmwSteps === "function" && !!window.GLR';
const step = (type, params) => ({ type, params: params || {}, on: true });
const ROOT = step('root', { n: 2, cut: 180 }), CUBIC = step('custom', { expr: 'z^3-3z', cut: 180 });
await view(1440, 900, false, false);
// (the share of the kept frame tag that is paper: every channel over 250)
const paper = (tag) => ev(`(() => { const P = window.__heldPx[${JSON.stringify(tag)}]; let n = 0, p = 0; for (let i = 0; i < P.length; i += 4) { n++; if (P[i] > 250 && P[i + 1] > 250 && P[i + 2] > 250) p++; } return +(p / n).toFixed(4); })()`);
const at = async (x, tag) => {
  await ev(`__cmwSteps({ x: ${x} }); 1`);
  await settled({ max: 60000 });
  ok(`${tag}: the frame is still`, await grab(tag), null);
  return { paper: await paper(tag), glide: JSON.parse(await ev('JSON.stringify((({ path, u }) => ({ path, u }))(__cmwSteps().glide || {}))')) };
};
for (const [name, steps, path] of [['square root', [ROOT], 'inverse'], ['z³ − 3z then square root', [CUBIC, ROOT], 'mesh']]) {
  const r = info[name] = {};
  await loadView('steps', 'glidesheets' + Date.now(), { shapes: [], steps, srcView: { cx: 0, cy: 0, s: 90 } });
  await settled({ max: 30000, until: READY });
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true, bare: true }); 1`);
  await settled({ max: 60000 });
  const b = steps.length, a = b - 1;
  // the planes at the glide's ends, parked
  for (const k of [a, b]) {
    await ev(`__cmwSteps({ go: ${k}, now: true }); 1`);
    await settled({ max: 60000 });
    ok(`${name}: plane ${k} parked is still`, await grab(`p${k}`), null);
    r[`parked ${k}`] = await paper(`p${k}`);
  }
  await ev(`__cmwSteps({ go: ${a}, now: true }); 1`);
  await settled({ max: 60000 });
  for (const u of [SHORT, 0.5, 1 - SHORT]) {
    const f = r[`u ${u}`] = await at(a + u, `u${u}`);
    ok(`${name}, u = ${u}: the ${path} path draws the glide`, f.glide.path === path, f);
    ok(`${name}, u = ${u}: every sheet's copy is drawn (paper ≤ ${PAPER_MAX})`, f.paper <= PAPER_MAX, f);
  }
  const d = {};
  for (const [u, end] of [[TINY, a], [1 - TINY, b]]) {
    r[`u ${u}`] = await at(a + u, `t${u}`);
    d[end] = r[`u ${u} against ${end}`] = await compare(`t${u}`, `p${end}`);
  }
  ok(`${name}, u = ${1 - TINY}: the frame is as close to plane ${b} parked as u = ${TINY} is to plane ${a} (within ${SAME_FRAC})`, !!d[a] && !!d[b] && d[b].frac <= d[a].frac + SAME_FRAC, d);
  // the K = 1 control: the principal combo alone leaves the left half paper
  await ev('__cmwSteps({ glideSheets: 1 }); 1');
  const c = r.control = await at(a + 1 - SHORT, 'k1');
  ok(`${name}: with the principal combo alone (K = 1) the frame near u = 1 is about half paper (≥ ${ONE_SHEET})`, c.paper >= ONE_SHEET, c);
  await ev('__cmwSteps({ glideSheets: 0 }); 1');
}
return { pass: fails.length === 0, fails, info };
