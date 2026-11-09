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
const TOL = 6, SAME_FRAC = 0.005, CONTROL_FACTOR = 10, MIN_PIXELS = 5000, WHITE = 250, EDGE_SHIFT_PX = 2, END_EPS = 1e-4, U_NEAR = 0.002, RELOAD_MS = 4000;
const EXAMPLE = 'The Douady–Hubbard map';
const { exampleNames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const names = exampleNames();
// the frames kept once still: grab, test/lib/held_frames.js; the example opened in the steps view
const open = async () => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?view=steps&ns=noimage${Date.now()}` });
  await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function"' });
  await ev(`__cmwExample(${names.indexOf(EXAMPLE)}); 1`); await settled({ max: 20000 });
};
// the glide frame at gx against the parked plane px: {coloured, paper (of the parked-coloured pixels, the glide's paper ones),
// paperShare, noMatch (share of the parked-coloured pixels with no pixel of the glide frame's 3 x 3 within TOL of theirs),
// noMatchShifted (the same with the glide frame replaced by the parked plane shifted EDGE_SHIFT_PX px)}
const measure = async (gx, px, blank = false) => {
  await open();
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true }); __cmwSteps({ park: ${px} }); 1`);
  await settled({ max: 20000 }); ok(`the parked plane ${px} is drawn`, await grab('parked'), null);
  await ev(`__cmwSteps({ x: ${gx} }); 1`);
  await settled({ max: 20000 }); ok(`the glide frame at ${gx} is drawn`, await grab('glide'), null);
  return ev(`(() => {
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
    let coloured = 0, pap = 0, bad = 0, badShifted = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = 4 * (y * W + x);
      if (paper(P, i)) continue;
      coloured++;
      if (paper(G, i)) pap++;
      if (!matches(G, x, y)) bad++;
      if (!matches(S, x, y)) badShifted++;
    }
    return { coloured, paper: pap, paperShare: coloured ? +(pap / coloured).toFixed(4) : null, noMatch: coloured ? +(bad / coloured).toFixed(4) : null, noMatchShifted: coloured ? +(badShifted / coloured).toFixed(4) : null };
  })()`);
};
// (plane 0 -> plane 1: [u of the glide frame, the plane it is compared with, whether the pixel measure applies])
const ROWS = [[END_EPS, 0, true], [U_NEAR, 0, false], [1 - U_NEAR, 1, false], [1 - END_EPS, 1, true]];
for (const [u, p, exact] of ROWS) {
  const r = await measure(u, p);
  info[`glide at ${u} against plane ${p}`] = r;
  ok(`the frame at ${u}: more than ${MIN_PIXELS} pixels of plane ${p} are coloured`, r.coloured > MIN_PIXELS, r);
  ok(`the frame at ${u}: of the pixels plane ${p} colours, at most ${SAME_FRAC * 100} % are paper`, r.paperShare !== null && r.paperShare <= SAME_FRAC, r);
  if (exact) ok(`the frame at ${u}: of the pixels plane ${p} colours, at most ${SAME_FRAC * 100} % have no pixel of the glide's 3 x 3 within ${TOL} levels`, r.noMatch !== null && r.noMatch <= SAME_FRAC, r);
}
// controls: the parked plane against itself, and shifted
const self = await measure(0, 0);
info['control: plane 0 against itself'] = self;
ok('control: the parked plane against itself: every pixel matches', self.noMatch === 0 && self.paperShare === 0, self);
ok(`control: the parked plane against itself shifted ${EDGE_SHIFT_PX} px: more than ${SAME_FRAC * 100} % of its pixels have no match (the bound the frames are held to)`, self.noMatchShifted > SAME_FRAC, self);
// an all-paper frame in the glide's place: every pixel the parked plane colours is paper, and the measure fails it
const blank = await measure(0, 0, true);
info['control: an all-paper frame'] = blank;
ok(`control: an all-paper frame has every pixel of plane 0 paper (over ${CONTROL_FACTOR * SAME_FRAC * 100} %)`, blank.paperShare === 1 && blank.paperShare > CONTROL_FACTOR * SAME_FRAC, blank);
return { pass: fails.length === 0, fails, info };
