// The steps view's moving frames Inside regions are never black where both of the glide's planes have colour: the
// frames of a glide from plane z to the next, held still on the rail (a scrub not let go) at u = HOLD_U and read from
// the left pane's canvas, against the parked frames of the two planes. Inside regions on a coloured plane the colour
// layer is drawn over the regions' mask; a pixel of the regions the colour layer leaves empty (the inverse pass found
// no point of z over it) reads as the paper. The cases: the square root of a disc, the logarithm of an annulus and the
// partial sum of the exponential over a square, each Inside regions with the colour from w (the last plane). Per case
// and u, the check: no opaque pixel within BLACK of black (each channel at most BLACK of 255) in the moving frame where
// neither parked frame has one; the share of such pixels, the frame's glide path and the first few such pixels are
// reported.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const HOLD_U = [0.25, 0.5, 0.75], BLACK = 10;
await view(1200, 800, false, false);
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const ready = () => settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwExample === "function" && typeof __cmwSvX === "function" && !!window.GLR' });
// (at rest on plane i, its frame drawn)
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
// the pixels of kept frame tag black where neither parked frame (R0, R1) is: {n pixels, black, share, at: the first few [x, y]}
const blackIn = (tag) => ev(`(() => {
  const c = document.getElementById('canvasL'), W = c.width, H = c.height, P = window.__heldPx, F = P[${JSON.stringify(tag)}], A = P.R0, B = P.R1;
  const dark = (D, i) => D[i + 3] === 255 && D[i] <= ${BLACK} && D[i + 1] <= ${BLACK} && D[i + 2] <= ${BLACK};
  let n = 0, k = 0; const at = [];
  for (let i = 0; i < F.length; i += 4) {
    n++;
    if (!dark(F, i) || dark(A, i) || dark(B, i)) continue;
    k++; if (at.length < 6) at.push([(i / 4) % W, Math.floor(i / 4 / W)]);
  }
  return { n, black: k, share: +(k / n).toFixed(5), at };
})()`);
const CASES = [
  { tag: 'Square root of a disc', example: 'Square root and its sheets' },
  { tag: 'Logarithm of an annulus', example: 'Logarithm of an annulus' },
  { tag: 'Partial sum of the exponential', example: 'Partial sums of the exponential' },
  // (the cube root of a disc: a glide with three sheets, its first and last frames too)
  { tag: 'Cube root of a disc', chain: { shapes: [{ kind: 'disc', c: [0, 0], r: 2 }, { kind: 'circle', c: [0.5, 0.3], r: 0.9 }], steps: [{ type: 'root', params: { n: 3, cut: 180, k: 0 }, on: true }] }, us: [0.002, 0.25, 0.5, 0.75, 0.998] },
];
for (const c of CASES) {
  const r = info[c.tag] = {};
  if (c.chain) {
    await loadView('steps', `black${Date.now()}`, Object.assign({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 1, srcView: { cx: 0, cy: 0, s: 70 } }, c.chain));
    await ready();
  } else {
    await go(`http://localhost:${PORT}/test.html?ns=black${Date.now()}`);
    await ready();
    const ex = names.indexOf(c.example);
    ok(`${c.tag}: the example is found`, ex >= 0, names.length);
    await ev(`__cmwExample(${ex}); 1`);
    await adopted();
  }
  await settled({ max: 60000 });
  await ready();
  // (paths off: the glide's paths are drawn over the colour; the colour from the last plane)
  await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'in', surf: 'plane' }), __cmwSteps({ T: __cmwSteps().planes.slice(-1)[0] }), 1`);
  ok(`${c.tag}: the chain has two planes (z and the root's)`, (await ev('__cmwSteps().planes.length')) === 2, await ev('__cmwSteps().planes'));
  await rest(1);
  ok(`${c.tag}: plane 1's parked frame settles`, await grab('R1'), null);
  await rest(0);
  ok(`${c.tag}: plane z's parked frame settles`, await grab('R0'), null);
  for (const u of c.us || HOLD_U) {
    const held = (await hold(u)).ok, still = await grab('M' + u);
    const g = await ev('(() => { const g = __cmwSteps().glide; return g ? { u: +g.u.toFixed(3), path: g.path, reason: g.reason } : null; })()');
    r[u] = Object.assign({ held, still, glide: g }, await blackIn('M' + u));
    ok(`${c.tag}: the moving frame at u = ${u} has no black pixel where both parked frames have none (each channel at most ${BLACK}/255, opaque)`, held && still && r[u].black === 0, r[u]);
    await ev('window.__svScrubUp(), 1');
    await rest(0);
  }
}
return { pass: fails.length === 0, fails, info };
