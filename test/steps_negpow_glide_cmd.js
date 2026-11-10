// The steps view's glide of a real negative exponent (z^(-1/2), z^(-3/2)): the homotopy takes z^{|a|}'s path, then the
// Möbius arc to 1/w, so no frame is a constant map and the end frames are the parked plane's.
// For each case (the powa step, the Formula z^(-1/2), the powa step with a = -3/2) in the plane, the sphere and the
// Landscape, the plane z glides to the step's plane (w1):
// - no blank frame: at the u of U_ROW (K1 and K2 pass through the old constant map at 2/3) the frame's coloured pixels
//   are at least COVER_MIN of parked w1's;
// - control: with __svCarryProbe set to the powOnePhase preset (the one-phase exponent 1 + (a - 1) t) the same row fails
//   near 1/(1 - a), in each view;
// - end frames (plane and sphere): at u of U_END every pixel the glide colours is within COLOUR_TOL of parked w1's
//   (all but at most WRONG_MAX of them); the control with the colour channels shifted fails.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard. Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const COVER_MIN = 0.5;
const WRONG_MAX = 0.02;      // of the pixels the glide colours
const U_ROW = [0.6, 0.65, 0.66, 2 / 3, 0.67, 0.68, 0.7, 0.75];
const NEAR_ZERO = [-0.02, -0.005, 0, 0.005, 0.02];
const U_END = [0.998, 0.9999];
const SHARE_TOL = 0.05;        // the glide's coloured share of parked's is within this of the expected share
const EXPECT_DIFF_MIN = 0.1;   // the expected share at two u of different phases differs by more than this
const COMPARE_MIN_SHARE = 0.4; // of parked w1's coloured pixels: the compare reads at least this many
const SHIFT = 40;            // the control's colour shift, of 255
const VIEWS = ['plane', 'sphere', 'land'];
const CASES = [
  { name: 'K1 powa -1/2', step: { type: 'powa', params: { alpha: '-0.5', cut: 180, k: 0 }, on: true }, a: -0.5 },
  { name: 'K2 Formula z^(-1/2)', step: { type: 'custom', params: { expr: 'z^{-1/2}' }, on: true }, a: -0.5 },
  { name: 'K3 powa -3/2', step: { type: 'powa', params: { alpha: '-1.5', cut: 180, k: 0 }, on: true }, a: -1.5 },
];
const quiet = () => settled({ max: 60000, until: '__cmwSteps().ready.ready' });
const { grab, coloured: colouredN, compare, expected } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'frame_compare.js'), 'utf8'));
const { paneOf } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
// the plane window the left pane shows
const windowOf = async () => { const P = await paneOf(); return { x0: P.v.cx - P.w / 2 / P.v.s, x1: P.v.cx + P.w / 2 / P.v.s, y0: P.v.cy - P.h / 2 / P.v.s, y1: P.v.cy + P.h / 2 / P.v.s }; };
const U_CTRL = [0.25, 0.75];
const followsU = (ea, eb) => Math.abs(ea - eb) > EXPECT_DIFF_MIN;
// the u of a case's row: U_ROW and the places around the one-phase exponent's zero, u = 1/(1 - a)
const rowOf = (c) => [...new Set([...U_ROW, ...U_CTRL, ...NEAR_ZERO.map((d) => 1 / (1 - c.a) + d)].map((x) => +x.toFixed(6)))].sort((x, y) => x - y);
await view(1200, 800, false, false);
const seedCase = async (c, i) => {
  const ns = 'npg' + i + Date.now();
  await seed(ns, { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }], steps: [c.step] });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && !!window.GLR` });
};
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await quiet(); };
// the coverage row of one case and view, parked w1's frame as the reference; probe: a __svCarryProbeSettings name or null
const row = async (c, v, probe) => {
  await ev(`__svCarryProbe = ${probe ? `__svCarryProbeSettings.${probe}` : 'null'}; __cmwSteps({ go: 1, now: true, surf: '${v}', scope: 'all', T: 1 }); 1`); await quiet();
  await grab('p1'); const ref = await colouredN('p1');
  const win = await windowOf(), low = [], rows = {};
  for (const u of rowOf(c)) {
    await ev(`__cmwSteps({ go: 0, now: true }); 1`); await quiet();
    await park(u); await grab('u'); const n = await colouredN('u'), exp = await expected(c.a, u, win);
    rows[u] = { n, exp };
    if (!(n >= COVER_MIN * exp * ref)) low.push({ u, n, exp, ref });
  }
  return { ref, low, rows };
};
for (const [i, c] of CASES.entries()) {
  await seedCase(c, i);
  R[c.name] = {};
  for (const v of VIEWS) {
    // control: the one-phase exponent blanks the frame near 1/(1 - a)
    const r1 = await row(c, v, 'powOnePhase');
    R[c.name][v + ' onePhase'] = r1;
    ok(`${c.name} ${v}: control, the one-phase exponent leaves a blank frame near u = ${(1 / (1 - c.a)).toFixed(3)}`, r1.low.length > 0, r1);
    await ev('__svCarryProbe = null; 1');
    const r = await row(c, v, null);
    R[c.name][v] = r;
    ok(`${c.name} ${v}: no blank frame (coloured pixels >= ${COVER_MIN} of the expected share of parked w1's at every u of the row)`, r.ref > 0 && r.low.length === 0, r);
    if (v === 'plane') {
      // the reference follows u: for |a| < 1 the expected share at U_CTRL[0] (phase 1, a wider sector) differs from the one at U_CTRL[1]
      const win = await windowOf(), e0 = await expected(c.a, U_CTRL[0], win), e1 = await expected(c.a, U_CTRL[1], win);
      const exps = Object.entries(r.rows).map(([u, x]) => ({ u, exp: x.exp })), minExp = Math.min(...exps.map((x) => x.exp));
      R[c.name].expectedAt = { [U_CTRL[0]]: e0, [U_CTRL[1]]: e1, minExpOverRow: minExp };
      // (an expected share of 0 at some u makes that u's coverage row vacuous: n >= 0)
      ok(`${c.name} plane: the expected share is above 0 at every u of the row (min ${minExp})`, minExp > 0, exps);
      if (Math.abs(c.a) < 1) {
        ok(`${c.name} plane: the expected share follows u (u=${U_CTRL[0]}: ${e0}, u=${U_CTRL[1]}: ${e1}, differing by more than ${EXPECT_DIFF_MIN})`, followsU(e0, e1), R[c.name].expectedAt);
        // the frame-based wrong-u control: the glide's coloured share at u (n / parked's) is within SHARE_TOL of the expected
        // share at that u, at both ends of U_CTRL; the frame the glide drew at U_CTRL[1], judged against the expected
        // share at U_CTRL[0], is not
        const share = (u) => r.rows[u].n / r.ref;
        R[c.name].shares = { [U_CTRL[0]]: share(U_CTRL[0]), [U_CTRL[1]]: share(U_CTRL[1]) };
        ok(`${c.name} plane: the glide's coloured share is the expected share at u=${U_CTRL[0]} (${share(U_CTRL[0])} vs ${e0}) and u=${U_CTRL[1]} (${share(U_CTRL[1])} vs ${e1}), within ${SHARE_TOL}`, Math.abs(share(U_CTRL[0]) - e0) <= SHARE_TOL && Math.abs(share(U_CTRL[1]) - e1) <= SHARE_TOL, R[c.name].shares);
        ok(`${c.name} plane: control, a frame drawn at the wrong u (u=${U_CTRL[1]}, judged against the expected share at u=${U_CTRL[0]}) is not within the tolerance (${share(U_CTRL[1])} vs ${e0})`, Math.abs(share(U_CTRL[1]) - e0) > SHARE_TOL, R[c.name].shares);
      } else {
        const K = await ev(`Funcs.sheetCount(CX.C(${c.a}, 0))`);
        R[c.name].wrongU = `the coverage control cannot bite: |a| > 1, every w has members, the expected share is 1 at every u (${e0}, ${e1}); the scene has K = ${K} surfaces; the colour control against parked w1 below bites`;
        ok(`${c.name} plane: the expected share is 1 at every u (|a| > 1, K = ${K} surfaces: no u moves the share, so the coverage control cannot bite; the colour control below does)`, e0 === 1 && e1 === 1, R[c.name].expectedAt);
      }
    }
    if (v === 'land') {
      // the Landscape's end frames (Ruling C) read the shared refImage of the P0 suite (#1317), absent here: a loud failure
      ok(`${c.name} land: the Landscape end frames need the shared refImage (test/lib/ref_image.js, #1317)`, fs.existsSync(path.join(DIR, '..', 'lib', 'ref_image.js')), 'test/lib/ref_image.js is missing');
      continue;
    }
    // the end frames: what the glide colours is parked w1's colour
    await ev(`__svCarryProbe = null; __cmwSteps({ go: 1, now: true, surf: '${v}', scope: 'all', T: 1 }); 1`); await quiet();
    await grab('p1');
    for (const u of U_END) {
      await ev(`__cmwSteps({ go: 0, now: true }); 1`); await quiet();
      await park(u); await grab('e');
      const r = await compare('e', 'p1', 0), cr = await compare('e', 'p1', SHIFT), ref = await colouredN('p1');
      R[c.name][v + ' end ' + u] = { r, cr, ref };
      ok(`${c.name} ${v} u=${u}: end frame is parked w1's (compared ${r && r.n} px of parked's ${ref}; wrong share ${r && r.wrong} <= ${WRONG_MAX})`, !!r && r.wrong != null && r.n >= COMPARE_MIN_SHARE * ref && r.wrong <= WRONG_MAX, { r, ref });
      ok(`${c.name} ${v} u=${u}: control, a colour shift fails the compare (${cr && cr.wrong})`, !!cr && cr.wrong != null && cr.wrong > WRONG_MAX, cr);
    }
    // control: a frame at the wrong u is not parked w1's colour (it bites where the coverage control cannot: K3)
    await ev(`__cmwSteps({ go: 0, now: true }); 1`); await quiet();
    await park(U_CTRL[1]); await grab('m');
    const rm = await compare('m', 'p1', 0);
    ok(`${c.name} ${v}: control, the frame at u=${U_CTRL[1]} is not parked w1's colour (wrong share ${rm && rm.wrong} > ${WRONG_MAX})`, !!rm && rm.wrong != null && rm.wrong > WRONG_MAX, rm);

  }
}
// The slot cap: the most uniform vectors any chain program's other uniforms take, counted from the program sources (every chain program,
// each map mode, vertex and fragment stage), is GLChain.OTHER_UNIFORM_VECS; the control counts a source with a known
// uniform set (mat4 + vec4[3] = 7, a sampler and uChain not counted)
{
  const ev0 = await ev(`(() => {
    const COST = { float: 1, int: 1, uint: 1, bool: 1, vec2: 1, vec3: 1, vec4: 1, ivec2: 1, ivec3: 1, ivec4: 1, uvec2: 1, uvec3: 1, uvec4: 1, bvec2: 1, bvec3: 1, bvec4: 1, mat2: 2, mat3: 3, mat4: 4 };
    const count = (src) => { let n = 0; const re = /uniform\\s+(?:(?:highp|mediump|lowp)\\s+)?(\\w+)\\s+([^;]+);/g; let m; while ((m = re.exec(src))) { const c = COST[m[1]]; if (c == null) continue; for (const d of m[2].split(',')) { if (/\\buChain\\b/.test(d)) continue; const a = /\\[\\s*(\\d+)\\s*\\]/.exec(d); n += c * (a ? +a[1] : 1); } } return n; };
    const ctl = count('uniform vec4 uChain[9];\\nuniform mat4 b;\\nuniform sampler2D t;\\nuniform vec4 d[3];');
    let worst = { n: 0 }, progs = 0;
    for (const name of Object.keys(GLR._src.DEFS)) {
      if (!GLR._src.DEFS[name].chain) continue;
      for (let mode = 0; mode < 3; mode++) {
        let pair; try { pair = GLR.landSrc(name, mode); } catch (e) { continue; }
        if (!pair) continue;
        progs++;
        pair.forEach((src, k) => { const n = count(src); if (n > worst.n) worst = { n, name, mode, stage: k ? 'fs' : 'vs' }; });
      }
    }
    return { ctl, worst, progs, named: GLChain.OTHER_UNIFORM_VECS };
  })()`);
  R.slotCap = ev0;
  ok('slot cap: the counter reads the control source as mat4 + vec4[3] = 7 vectors', ev0.ctl === 7, ev0);
  ok(`slot cap: ${ev0.progs} chain programs counted; the most other uniform vectors of any program is ${ev0.worst.n} (${ev0.worst.name} mode ${ev0.worst.mode} ${ev0.worst.stage}), equal to GLChain.OTHER_UNIFORM_VECS (${ev0.named})`, ev0.progs > 0 && ev0.worst.n === ev0.named, ev0);
}
// A chain the build refuses (Möbius steps, 11 slots each, over the GPU's slot cap) is not drawn from an earlier version: the pane's GL status
// reads the refusal in plain words, and the step is not accepted silently
{
  await seedCase(CASES[0], 0);
  const defs = await ev("Funcs.defaults('mobius')");
  // one step over the live cap: the cap for the page's GPU limit, over the slots one Möbius step takes
  const nSteps = await ev(`(() => { const st = { type: 'mobius', params: Funcs.defaults('mobius'), on: true }; const per = GLChain.build([st], [Funcs.build(st)]).slots; const vecs = Math.min(GLR.gl.getParameter(GLR.gl.MAX_FRAGMENT_UNIFORM_VECTORS), GLR.gl.getParameter(GLR.gl.MAX_VERTEX_UNIFORM_VECTORS)); return Math.floor(GLChain.maxChainSlots(vecs) / per) + 1; })()`);
  const ns = 'npgcap' + Date.now();
  await seed(ns, { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', shapes: [], steps: Array.from({ length: nSteps }, () => ({ type: 'mobius', params: defs, on: true })) });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && !!window.GLR" });
  await ev('1'); await new Promise((r) => setTimeout(r, 1500));
  const st = await ev('JSON.stringify({ err: GLR.frameStatus().error, last: GLR.error })');
  R.refusedChain = { st, nSteps };
  ok(`refused chain: the pane's GL status says the chain needs more shader parameters (${st})`, /more shader parameters/.test(String(st)), st);
}
return { pass: fails.length === 0, fails, results: R };
