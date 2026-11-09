// The pixels of a plane that the glide's map does not reach (issue #1443, part of #620; the standing rule: moving frames look like
// parked planes). The Douady-Hubbard map sends the plane onto the outside of the unit disc, so the glide has no preimage for the disc, yet
// the parked plane it leaves and the one it arrives at colour it. A glide frame near either end must show what the parked plane shows
// at the pixel: of the pixels the parked plane colours, at most SAME_FRAC may be paper in the glide frame, and, compared as pixels,
// at most SAME_FRAC without a pixel of the parked frame's 3 x 3 within TOL levels. Frames: END_EPS past plane 0 and short of plane 1
// (the glide's own motion is sub-pixel there, so the parked plane stands for the picture), and U_NEAR past and short, where the
// share of paper is what is measured (the glide has moved a little, so only the paper is compared). Controls: an all-paper frame
// in the glide's place has all its pixels paper; the parked plane against itself passes the pixel measure and, shifted EDGE_SHIFT_PX px, fails it.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js names. Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (TOL levels of 255 per channel; SAME_FRAC the share allowed; CONTROL_FACTOR how many times SAME_FRAC a control must exceed;
// MIN_PIXELS the least count of parked-coloured pixels; WHITE a channel above which a pixel is paper; EDGE_SHIFT_PX the shift of
// the pixel measure's control; END_EPS the distance of a frame from its parked plane; U_NEAR the distance of the moved frames;
// RELOAD_MS the wait for the page a figure's opening reloads)
const TOL = 6, SAME_FRAC = 0.005, CONTROL_FACTOR = 10, MIN_PIXELS = 5000, WHITE = 250, EDGE_SHIFT_PX = 2, END_EPS = 1e-4, U_NEAR = 0.002, RELOAD_MS = 4000, GREY_SPREAD = 8, MIN_HATCH = 2000;
const DH = 'The Douady–Hubbard map', SQRT = 'Square root and its sheets', MIN_SAMPLES = 20;
const { exampleNames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const names = exampleNames();
// the frames kept once still: grab, test/lib/held_frames.js; the example opened in the steps view
const open = async (example) => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?view=steps&ns=noimage${Date.now()}` });
  await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function"' });
  await ev(`__cmwExample(${names.indexOf(example)}); 1`); await settled({ max: 20000 });
};
// the glide frame at gx against the parked plane px: {coloured, paper (of the parked-coloured pixels, the glide's paper ones),
// paperShare, grey (of them, the grey ones: the no-value hatch) and greyPaper (the paper ones of those), greyPaperShare, noMatch (share of the parked-coloured pixels with no pixel of the glide frame's 3 x 3 within TOL of theirs),
// noMatchShifted (the same with the glide frame replaced by the parked plane shifted EDGE_SHIFT_PX px)}
const measure = async (gx, px, blank = false, example = DH) => {
  await open(example);
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true }); __cmwSteps({ park: ${px} }); 1`);
  await settled({ max: 20000 }); ok(`the parked plane ${px} is drawn`, await grab('parked'), null);
  await ev(`__cmwSteps({ x: ${gx} }); 1`);
  await settled({ max: 20000 }); ok(`the glide frame at ${gx} is drawn`, await grab('glide'), null);
  const mem = await ev('typeof __cmwGlideMemberless === "function" ? __cmwGlideMemberless() : "no hook"');
  const r = await ev(`(() => {
    const cv = document.getElementById('canvasL'), W = cv.width, H = cv.height, P = window.__heldPx.parked, G = ${blank} ? new Uint8ClampedArray(P.length).fill(255) : window.__heldPx.glide;
    const paper = (A, i) => A[i] > ${WHITE} && A[i + 1] > ${WHITE} && A[i + 2] > ${WHITE};
    const matches = (A, x, y) => {
      const gi = 4 * (y * W + x);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const i = 4 * (Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx)));
        if (Math.max(Math.abs(A[gi] - P[i]), Math.abs(A[gi + 1] - P[i + 1]), Math.abs(A[gi + 2] - P[i + 2])) <= ${TOL}) return true;
      }
      return false;
    };
    const S = new Uint8ClampedArray(P.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) S[4 * (y * W + x) + c] = P[4 * (y * W + Math.min(W - 1, x + ${EDGE_SHIFT_PX})) + c];
    let coloured = 0, pap = 0, bad = 0, badShifted = 0, grey = 0, greyPaper = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = 4 * (y * W + x);
      if (paper(P, i)) continue;
      coloured++;
      const isGrey = Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) <= ${GREY_SPREAD};
      if (isGrey) grey++;
      if (paper(G, i)) { pap++; if (isGrey) greyPaper++; }
      if (!matches(G, x, y)) bad++;
      if (!matches(S, x, y)) badShifted++;
    }
    // the hook's samples of destination-painted pixels, each { x, y, w, colour, cert }: the glide frame's pixel is the parked plane's there
    const smp = (${JSON.stringify(mem && mem.samples || [])}), certs = {}; let off = 0;
    for (const m of smp) { const i = 4 * (m.y * W + m.x); certs[m.cert] = (certs[m.cert] || 0) + 1; if (Math.max(Math.abs(G[i] - P[i]), Math.abs(G[i + 1] - P[i + 1]), Math.abs(G[i + 2] - P[i + 2])) > ${TOL}) off++; }
    return { coloured, paper: pap, grey, greyPaper, greyPaperShare: grey ? +(greyPaper / grey).toFixed(4) : null, paperShare: coloured ? +(pap / coloured).toFixed(4) : null, noMatch: coloured ? +(bad / coloured).toFixed(4) : null, noMatchShifted: coloured ? +(badShifted / coloured).toFixed(4) : null, samples: smp.length, sampleOff: smp.length ? +(off / smp.length).toFixed(4) : null, certs };
  })()`);
  return Object.assign(r, { mem });
};
// the memberless pixels of a glide frame are all accounted for: __cmwGlideMemberless() -> {pixels, hatch, rest, uncertified, samples}: the
// memberless pixels, those drawn as plane 0's no-value hatch, those drawn as the destination's paint (only where no root is certified), those
// left without a certificate (a solver miss, which must fail the frame), and samples of the destination-painted ones, each {x, y, w, colour,
// cert} with cert the plan or enumerator that certified "no root" there
const accounted = (m) => !!m && typeof m === 'object' && m.pixels === m.hatch + m.rest && m.uncertified === 0;
const CERTS = ['plan', 'enumerator'];
// (plane 0 -> plane 1: [u of the glide frame, the plane it is compared with, whether the pixel measure applies, whether the hook's hatch
// outweighs its destination paint (departure) or the reverse (arrival), null for neither])
const ROWS = [[END_EPS, 0, true, 'hatch'], [U_NEAR, 0, false, 'hatch'], [0.5, 1, false, null], [1 - U_NEAR, 1, false, 'rest'], [1 - END_EPS, 1, true, 'rest']];
for (const [u, p, exact, mostly] of ROWS) {
  const r = await measure(u, p);
  info[`glide at ${u} against plane ${p}`] = r;
  ok(`the frame at ${u}: every memberless pixel is hatch or certified destination paint, none uncertified (__cmwGlideMemberless)`, accounted(r.mem), r.mem);
  if (mostly && accounted(r.mem)) ok(`the frame at ${u}: the memberless pixels are mostly the ${mostly === 'hatch' ? "departure's hatch" : "destination's paint"}`, mostly === 'hatch' ? r.mem.hatch > r.mem.rest : r.mem.rest > r.mem.hatch, r.mem);
  if (u === 0.5) {
    ok(`the frame at ${u}: the hook samples at least ${MIN_SAMPLES} destination-painted pixels, each certified by a plan or an enumerator`, r.samples >= MIN_SAMPLES && Object.keys(r.certs).every((k) => CERTS.includes(k)), r);
    // the samples' w is the place plane p shows at (x, y), within one pixel's width in w (__cmwPlaceAt(plane, x, y) -> [re, im], the plane's
    // own view read back); so plane p's pixel at (x, y) is the destination's paint at w. A sample read against plane 0's view must fail it
    // whenever the two planes' places differ (the control)
    const places = await ev(`(() => {
      const S = ${JSON.stringify(r.mem && r.mem.samples || [])};
      if (typeof __cmwPlaceAt !== 'function') return 'no hook';
      const agree = (pl) => S.every((m) => { const a = __cmwPlaceAt(pl, m.x, m.y), b = __cmwPlaceAt(pl, m.x + 1, m.y); return Math.hypot(m.w[0] - a[0], m.w[1] - a[1]) <= Math.hypot(b[0] - a[0], b[1] - a[1]); });
      const same = S.every((m) => { const a = __cmwPlaceAt(0, m.x, m.y), b = __cmwPlaceAt(1, m.x, m.y), c = __cmwPlaceAt(1, m.x + 1, m.y); return Math.hypot(a[0] - b[0], a[1] - b[1]) <= Math.hypot(c[0] - b[0], c[1] - b[1]); });
      return { n: S.length, onPlane: agree(${p}), onOther: agree(${1 - p}), same };
    })()`);
    info['samples against the places'] = places;
    ok(`the frame at ${u}: every sample's w is plane ${p}'s place at its pixel within one pixel's width (__cmwPlaceAt)`, !!places && places !== 'no hook' && places.n >= MIN_SAMPLES && places.onPlane === true, places);
    ok(`control: the samples read against plane ${1 - p}'s places fail that check whenever the two planes' places differ`, !!places && places !== 'no hook' && (places.same ? places.onOther === true : places.onOther === false), places);
    ok(`the frame at ${u}: the sampled destination-painted pixels are plane ${p}'s own pixel there (at most ${SAME_FRAC * 100} % more than ${TOL} levels off)`, r.sampleOff !== null && r.sampleOff <= SAME_FRAC, r);
    continue;
  }
  ok(`the frame at ${u}: more than ${MIN_PIXELS} pixels of plane ${p} are coloured`, r.coloured > MIN_PIXELS, r);
  ok(`the frame at ${u}: of the pixels plane ${p} colours, at most ${SAME_FRAC * 100} % are paper`, r.paperShare !== null && r.paperShare <= SAME_FRAC, r);
  if (p === 0) ok(`the frame at ${u}: of the grey no-value hatch of plane 0 (at least ${MIN_HATCH} pixels), at most ${SAME_FRAC * 100} % are paper`, r.grey >= MIN_HATCH && r.greyPaperShare <= SAME_FRAC, r);
  if (exact) ok(`the frame at ${u}: of the pixels plane ${p} colours, at most ${SAME_FRAC * 100} % have no pixel of the glide's 3 x 3 within ${TOL} levels`, r.noMatch !== null && r.noMatch <= SAME_FRAC, r);
}
// the square root's glide (the sheets example): its memberless pixels are accounted for at the middle and near the arrival
for (const u of [0.5, 1 - END_EPS]) {
  const r = await measure(u, 1, false, SQRT);
  info[`square root: glide at ${u}`] = r;
  ok(`square root, the frame at ${u}: every memberless pixel is hatch or certified destination paint, none uncertified (__cmwGlideMemberless)`, accounted(r.mem), r.mem);
}
// the product control: with the solver starved (the carry probe starveSolver), the frame has uncertified memberless pixels, which the accounting refuses
await open(DH);
await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true }); GLR.carryProbes({ starveSolver: true }); __cmwSteps({ x: 0.5 }); 1`);
await settled({ max: 20000 });
const starved = await ev('typeof __cmwGlideMemberless === "function" ? __cmwGlideMemberless() : "no hook"');
await ev('GLR.carryProbes({}); 1');
info['control: the solver starved'] = starved;
ok('control: with the solver starved the hook reports uncertified memberless pixels and the accounting refuses the frame', !!starved && starved.uncertified > 0 && !accounted(starved), starved);
// controls: the parked plane against itself, and shifted
const self = await measure(0, 0);
info['control: plane 0 against itself'] = self;
ok('control: the parked plane against itself: every pixel matches', self.noMatch === 0 && self.paperShare === 0, self);
ok(`control: the parked plane against itself shifted ${EDGE_SHIFT_PX} px: more than ${SAME_FRAC * 100} % of its pixels have no match (the bound the frames are held to)`, self.noMatchShifted > SAME_FRAC, self);
// an all-paper frame in the glide's place: every pixel the parked plane colours is paper, and the measure fails it
const blank = await measure(0, 0, true);
info['control: an all-paper frame'] = blank;
ok(`control: an all-paper frame has every pixel of plane 0 paper (over ${CONTROL_FACTOR * SAME_FRAC * 100} %)`, blank.paperShare === 1 && blank.paperShare > CONTROL_FACTOR * SAME_FRAC, blank);
ok('control: a report with one uncertified memberless pixel is not accounted for', !accounted({ pixels: 5, hatch: 2, rest: 3, uncertified: 1 }), null);
ok('control: a report whose parts do not add up to its pixels is not accounted for', !accounted({ pixels: 5, hatch: 2, rest: 2, uncertified: 0 }), null);
ok('control: a frame with no memberless pixel and no uncertified one is accounted for', accounted({ pixels: 0, hatch: 0, rest: 0, uncertified: 0 }), null);
return { pass: fails.length === 0, fails, info };
