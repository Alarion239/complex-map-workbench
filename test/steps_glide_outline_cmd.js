// Inside regions, the steps view's glide shows the outline of a region of the plane it reaches: parked on plane b, a
// region of plane b has its outline in the shape's colour (the outline pass's own-plane stroke); held still at u = 0.998
// on the glide a -> b = 0 -> 1, each of those outline pixels (the pixels of plane 1's parked frame within INK_TOL of the
// shape's edge colour) has a pixel of the same colour within RING_R px in the moving frame, for at least HIT_MIN of at
// least MIN_RING of them.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const HIT_MIN = 0.9, MIN_RING = 100, RING_R = 3, INK_TOL = 24, U_END = 0.998;
await view(1200, 800);
const ST = {
  pattern: 'phase', outline: true, lines: true, unit: false, alpha: 0.85, v3: true, v4: true, v5: true, nextId: 50,
  srcView: { cx: 0, cy: 0, s: 110 },
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'mobius', params: { a: '1', b: '0.5', c: '0', d: '1' }, on: true }],
  shapes: [
    { id: 'c1', kind: 'disc', c: [0.4, 0.3], r: 0.6, ci: 2, visible: true, stage: 1 },
    { id: 'd1', kind: 'disc', c: [-0.5, 0.4], r: 0.3, ci: 3, visible: true, stage: 1 },
  ],
  targets: [],
};
await load('svoutline' + Date.now(), ST);
await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR && GLR.pendingLinks === 0' });
ok('the page shows the steps view', await isSteps(), null);
await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'in', surf: 'plane' }), 1`);
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const still = async (tag) => { await ev(`__cmwSteps({ bare: false }), 1`); await settled({ max: 20000 }); ok(`the frame ${tag} settles`, await grab(tag), null); };
const at = async (x) => { await ev(`__cmwSteps({ x: ${x} }), 1`); await settled({ max: 60000, until: `Math.abs(__cmwSteps().x - ${x}) < 1e-9 && GLR.pendingLinks === 0` }); };
await ev(`__cmwSteps({ go: 1, now: true }), 1`);
await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === 1 && GLR.pendingLinks === 0` });
await still('P1');
await at(U_END); await still('M');
// (the outline's pixels of plane 1's parked frame, and the moving frame's pixels of the same colour near them)
for (const id of ST.shapes.map((x) => x.id)) {
  info[id] = await ev(`(() => {
    const K = window.__heldPx, P = K.P1, M = K.M, c = document.getElementById('canvasL'), W = c.width, H = c.height;
    const hex = __cmwLook(${JSON.stringify(id)}, 'L').edge.replace('#', ''), ink = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
    const near = (D, i) => Math.max(Math.abs(D[i] - ink[0]), Math.abs(D[i + 1] - ink[1]), Math.abs(D[i + 2] - ink[2])) <= ${INK_TOL};
    const R = ${RING_R};
    let n = 0, hit = 0;
    for (let y = R; y < H - R; y++) for (let x = R; x < W - R; x++) {
      if (!near(P, 4 * (y * W + x))) continue;
      n++;
      let f = false;
      for (let dy = -R; dy <= R && !f; dy++) for (let dx = -R; dx <= R && !f; dx++) if (near(M, 4 * ((y + dy) * W + x + dx))) f = true;
      if (f) hit++;
    }
    return { n, hit, frac: +(hit / Math.max(1, n)).toFixed(3), ink: hex };
  })()`);
  const q = info[id];
  ok(`${id}'s outline at u = ${U_END} is plane 1's parked outline (at least ${HIT_MIN * 100} % of ${MIN_RING}+ pixels, a pixel of the shape's colour within ${RING_R} px)`, q.n >= MIN_RING && q.frac >= HIT_MIN, q);
}
return { pass: fails.length === 0, fails, info };
