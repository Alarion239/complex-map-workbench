// The steps view's glide of a real negative exponent (z^(-1/2), z^(-3/2)): the homotopy takes z^{|a|}'s path, then the
// Möbius arc to 1/w, so no frame is a constant map and the end frames are the parked plane's.
// For each case (the powa step, the Formula z^(-1/2), the powa step with a = -3/2) in the plane, the sphere and the
// Landscape, the plane z glides to the step's plane (w1):
// - no blank frame: at the u of U_ROW (K1 and K2 pass through the old constant map at 2/3) the frame's coloured pixels
//   are at least COVER_MIN of parked w1's;
// - control: with __svCarryProbe set to the powOnePhase preset (the one-phase exponent 1 + (a - 1) t) the same row fails
//   near 1/(1 - a);
// - end frames (plane and sphere): at u of U_END every pixel the glide colours is within COLOUR_TOL of parked w1's
//   (all but at most WRONG_MAX of them); the control with the colour channels shifted fails.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard. Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const COVER_MIN = 0.5;
const COLOUR_TOL = 32;       // of 255, per channel
const WRONG_MAX = 0.02;      // of the pixels the glide colours
const SAT_MIN = 60;          // max - min channel: a phase colour, not paper or a grey mark
const U_ROW = [0.6, 0.65, 0.66, 2 / 3, 0.67, 0.68, 0.7, 0.75];
const NEAR_ZERO = [-0.02, -0.005, 0, 0.005, 0.02];
const U_END = [0.998, 0.9999];
const SHIFT = 40;            // the control's colour shift, of 255
const VIEWS = ['plane', 'sphere', 'land'];
const CASES = [
  { name: 'K1 powa -1/2', step: { type: 'powa', params: { alpha: '-0.5', cut: 180, k: 0 }, on: true }, a: -0.5 },
  { name: 'K2 Formula z^(-1/2)', step: { type: 'custom', params: { expr: 'z^{-1/2}' }, on: true }, a: -0.5 },
  { name: 'K3 powa -3/2', step: { type: 'powa', params: { alpha: '-1.5', cut: 180, k: 0 }, on: true }, a: -1.5 },
];
// (the sphere's and the Landscape's glides never report settled: their frames wait a fixed time)
const SETTLE_MS = 1200;
let surf = 'plane';
const quiet = () => (surf === 'plane'
  ? settled({ floor: 400, max: 20000, until: 'window.__cmwSteps && !__cmwSteps().moving' })
  : sleep(SETTLE_MS));
// the left pane's pixels, kept in the page under tag
const grab = (tag) => ev(`(() => { const c = document.getElementById('canvasL'), s = document.createElement('canvas'); s.width = c.width; s.height = c.height; const g = s.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0); window.__np = window.__np || {}; window.__np[${JSON.stringify(tag)}] = g.getImageData(0, 0, s.width, s.height).data; return 1; })()`);
// the number of saturated pixels of a tagged frame
const colouredN = (tag) => ev(`(() => { const d = window.__np[${JSON.stringify(tag)}]; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > ${SAT_MIN}) n++; return n; })()`);
// of the pixels tag a colours, the share more than COLOUR_TOL apart from tag b (a's channels shifted by shift)
const wrongShare = (a, b, shift) => ev(`(() => { const A = window.__np[${JSON.stringify(a)}], B = window.__np[${JSON.stringify(b)}]; if (!A || !B || A.length !== B.length) return null; let n = 0, bad = 0; for (let i = 0; i < A.length; i += 4) { if (Math.max(A[i], A[i + 1], A[i + 2]) - Math.min(A[i], A[i + 1], A[i + 2]) <= ${SAT_MIN}) continue; n++; if (Math.max(Math.abs(A[i] + ${shift} - B[i]), Math.abs(A[i + 1] + ${shift} - B[i + 1]), Math.abs(A[i + 2] + ${shift} - B[i + 2])) > ${COLOUR_TOL}) bad++; } return n ? bad / n : null; })()`);
await view(1200, 800, false, false);
const seedCase = async (c, i) => {
  const ns = 'npg' + i + Date.now();
  await seed(ns, { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }], steps: [c.step] });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && !!window.GLR` });
};
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await quiet(); };
// the u of a case's row: U_ROW and the places around the one-phase exponent's zero, u = 1/(1 - a)
const rowOf = (c) => [...new Set([...U_ROW, ...NEAR_ZERO.map((d) => 1 / (1 - c.a) + d)].map((x) => +x.toFixed(6)))].sort((x, y) => x - y);
// the coverage row of one case and view, parked w1's frame as the reference; probe: a __svCarryProbeSettings name or null
const row = async (c, v, probe) => {
  surf = v;
  await ev(`__svCarryProbe = ${probe ? `__svCarryProbeSettings.${probe}` : 'null'}; __cmwSteps({ go: 1, now: true, surf: '${v}', scope: 'all', T: 1 }); 1`); await quiet();
  await grab('p1'); const ref = await colouredN('p1');
  const low = [];
  for (const u of rowOf(c)) {
    await ev(`__cmwSteps({ go: 0, now: true }); 1`); await quiet();
    await park(u); await grab('u'); const n = await colouredN('u');
    if (!(n >= COVER_MIN * ref)) low.push({ u, n, ref });
  }
  return { ref, low };
};
for (const [i, c] of CASES.entries()) {
  await seedCase(c, i);
  R[c.name] = {};
  for (const v of VIEWS) {
    const r = await row(c, v, null);
    R[c.name][v] = r;
    ok(`${c.name} ${v}: no blank frame (coloured pixels >= ${COVER_MIN} of parked w1's at every u of the row)`, r.ref > 0 && r.low.length === 0, r);
    if (v === 'land') continue;
    // the end frames: what the glide colours is parked w1's colour
    surf = v;
    await ev(`__svCarryProbe = null; __cmwSteps({ go: 1, now: true, surf: '${v}', scope: 'all', T: 1 }); 1`); await quiet();
    await grab('p1');
    for (const u of U_END) {
      await ev(`__cmwSteps({ go: 0, now: true }); 1`); await quiet();
      await park(u); await grab('e');
      const w = await wrongShare('e', 'p1', 0), cw = await wrongShare('e', 'p1', SHIFT);
      ok(`${c.name} ${v} u=${u}: end frame is parked w1's (wrong share ${w} <= ${WRONG_MAX})`, w != null && w <= WRONG_MAX, { w });
      ok(`${c.name} ${v} u=${u}: control, a colour shift fails the compare (${cw})`, cw != null && cw > WRONG_MAX, { cw });
    }
  }
  // control: the one-phase exponent blanks the frame near 1/(1 - a)
  const r1 = await row(c, 'plane', 'powOnePhase');
  R[c.name].onePhase = r1;
  ok(`${c.name} plane: control, the one-phase exponent leaves a blank frame near u = ${(1 / (1 - c.a)).toFixed(3)}`, r1.low.length > 0, r1);
  await ev('__svCarryProbe = null; 1');
}
return { pass: fails.length === 0, fails, results: R };
