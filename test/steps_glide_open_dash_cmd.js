// The steps view's glide strokes an open region of the plane it reaches dashed, as that plane's parked frame strokes it
// (OPEN_DASH along the outline's arc at rest), not solid. On the glide 0 -> 1 (step 1 the Cayley map h, step 2 a
// translation), plane 1 holds an open region: the outside of a disc (complement), whose outline is dashed at rest. Points
// w of that outline are sampled every SAMPLE_PX CSS px in plane 1's parked frame (P1, strokes hidden P10) and sorted by
// the frame: a dash centre (its ink within 1 device px of the sample and of those SPAN_PX to each side) or a gap centre
// (none within 1 px of any of them). Each is carried to its place in the frame parked at U_END (M, strokes hidden M0), H_u(h^-1(w)): there a dash
// centre has its ink within 1 device px for at least ON_MIN of them, and a gap centre has no ink at a pixel within
// GAP_SLACK_PX CSS px of it along the outline for at least GAP_MIN of them. A solid outline (no dash mid-glide) fails the gaps. Control: plane 1's parked frame has at least MIN_N
// of each. Inside regions and Everywhere (SCOPES).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const U_END = 0.998, SCOPES = ['in', 'all'], INK_TOL = 24, SAMPLE_PX = 0.25, SPAN_PX = 1, GAP_SLACK_PX = 0.5, MIN_N = 20, ON_MIN = 0.9, GAP_MIN = 0.85;
const H1 = { a: [1, 0], b: [0, -1], c: [1, 0], d: [0, 1] };
const CAYLEY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
// (the open region: the outside of the disc |w - O| <= R on plane 1)
const O = [0.2, 0.1], R = 0.7;
const ST = { pattern: 'phase', outline: true, lines: true, unit: false, alpha: 0.85, v3: true, v4: true, v5: true, nextId: 50, srcView: { cx: 0, cy: 0, s: 110 }, targets: [],
  steps: [CAYLEY, { type: 'mobius', params: { a: '1', b: '0.5', c: '0', d: '1' }, on: true }],
  shapes: [{ id: 'o1', kind: 'disc', c: O, r: R, complement: true, ci: 2, visible: true, stage: 1 }] };
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
let SCOPE_NOW = '';
const snap = async (tag, hide) => {
  await ev(`__cmwHideStrokes(${!!hide}), __cmwSteps({ bare: false }), 1`);
  await settled({ max: 20000 });
  ok(`[${SCOPE_NOW}] the frame ${tag} settles`, await grab(tag), null);
  if (hide) { await ev('__cmwHideStrokes(false), 1'); await settled({ max: 20000 }); }
};
const park = async (x) => { await ev(`__cmwSteps({ x: ${x} }), 1`); await settled({ max: 60000, until: `Math.abs(__cmwSteps().x - ${x}) < 1e-9 && GLR.pendingLinks === 0 && !__cmwSteps().hold` }); };
// the outline's samples sorted in plane 1's parked frame and looked up, carried, in the frame at U_END
const dashes = () => ev(`(() => {
  const g = __cmwSteps().glide, K = window.__heldPx, P = K.P1, P0 = K.P10, M = K.M, M0 = K.M0, c = document.getElementById('canvasL');
  const W = c.width, H = c.height, dpr = W / g.w, v = g.view, look = __cmwLook('o1', 'L');
  const rgb = (h) => [0, 2, 4].map((k) => parseInt(h.replace('#', '').slice(k, k + 2), 16));
  const ink = rgb(look.edge), halo = rgb(look.halo), sk = __cmwStroke('o1'), A = sk.alpha, CA = sk.casingAlpha || 0;
  // (the ink at the stroke's alpha over its casing over the frame with the strokes hidden, within INK_TOL)
  const near = (D, D0, i) => [0, 1, 2].every((k) => { const q = D0[i + k] + CA * (halo[k] - D0[i + k]); return Math.abs(D[i + k] - q - A * (ink[k] - q)) <= ${INK_TOL}; });
  const px = (w) => [Math.round(((w.re - v.cx) * v.s + g.w / 2) * dpr - 0.5), Math.round((g.h / 2 - (w.im - v.cy) * v.s) * dpr - 0.5)];
  const inside = (p, r) => p[0] >= r && p[1] >= r && p[0] < W - r && p[1] < H - r;
  const at = (D, D0, p) => near(D, D0, 4 * (p[1] * W + p[0]));
  const within1 = (D, D0, p) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(D, D0, [p[0] + dx, p[1] + dy])) return true; return false; };
  // (h^-1(w) = (d w - b) / (a - c w))
  const { a, b, c: cc, d } = ${JSON.stringify(H1)};
  const mul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
  const inv = (w) => { const n = mul(d, w), m = mul(cc, w), num = [n[0] - b[0], n[1] - b[1]], den = [a[0] - m[0], a[1] - m[1]], q = den[0] * den[0] + den[1] * den[1]; return { re: (num[0] * den[0] + num[1] * den[1]) / q, im: (num[1] * den[0] - num[0] * den[1]) / q }; };
  const N = Math.round(2 * Math.PI * ${R} * v.s / ${SAMPLE_PX}), span = Math.round(${SPAN_PX} / ${SAMPLE_PX}), slack = Math.round(${GAP_SLACK_PX} / ${SAMPLE_PX});
  const w = [], rest = [];
  for (let j = 0; j < N; j++) {
    const t = 2 * Math.PI * j / N, z = { re: ${O[0]} + ${R} * Math.cos(t), im: ${O[1]} + ${R} * Math.sin(t) }, p = px(z);
    w.push(z); rest.push(inside(p, 2) ? within1(P, P0, p) : null);
  }
  const all = (j, val) => { for (let k = -span; k <= span; k++) if (rest[(j + k + N) % N] !== val) return false; return true; };
  let on = 0, onHit = 0, gap = 0, gapClear = 0;
  for (let j = 0; j < N; j++) {
    const isOn = all(j, true), isGap = all(j, false);
    if (!isOn && !isGap) continue;
    const carried = (k) => px(g.Hb(inv([w[(j + k + N) % N].re, w[(j + k + N) % N].im]))), q = carried(0);
    if (!inside(q, 2)) continue;
    if (isOn) { on++; if (within1(M, M0, q)) onHit++; }
    else {
      // (a gap is clear where a pixel within GAP_SLACK_PX along the outline has no ink: the dash's anti-aliased ends land
      // a fraction of a pixel apart in the two frames; a solid outline has ink at every one)
      gap++;
      let clear = false;
      for (let k = -slack; k <= slack && !clear; k++) { const qk = carried(k); clear = inside(qk, 2) && !at(M, M0, qk); }
      if (clear) gapClear++;
    }
  }
  return { N, on, onHit, onFrac: +(onHit / Math.max(1, on)).toFixed(3), gap, gapClear, gapFrac: +(gapClear / Math.max(1, gap)).toFixed(3) };
})()`);
await view(1200, 800);
await load(`svopendash-${Date.now()}`, ST);
await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR && GLR.pendingLinks === 0' });
ok('the page shows the steps view', await isSteps(), null);
for (const scope of SCOPES) {
  SCOPE_NOW = scope;
  await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: '${scope}', surf: 'plane' }), 1`);
  await ev(`__cmwSteps({ go: 1, now: true }), 1`);
  await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === 1 && GLR.pendingLinks === 0` });
  await snap('P1'); await snap('P10', true);
  await park(0);
  await park(U_END);
  await snap('M'); await snap('M0', true);
  const q = info[scope] = await dashes();
  ok(`[${scope}] plane 1's parked frame dashes the open region's outline (at least ${MIN_N} dash centres and ${MIN_N} gap centres) (control)`, q.on >= MIN_N && q.gap >= MIN_N, q);
  ok(`[${scope}] at u = ${U_END} the outline's dashes are plane 1's carried there (its ink within 1 px at ${ON_MIN * 100} % of the dash centres)`, q.on >= MIN_N && q.onFrac >= ON_MIN, q);
  ok(`[${scope}] at u = ${U_END} the outline's gaps are plane 1's carried there (no ink at ${GAP_MIN * 100} % of the gap centres): dashed, not solid`, q.gap >= MIN_N && q.gapFrac >= GAP_MIN, q);
}
return { pass: fails.length === 0, fails, info };
