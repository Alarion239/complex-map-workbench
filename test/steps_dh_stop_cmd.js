// The certified early stop of the Douady–Hubbard / Böttcher orbit (src/glsl.js, the 'dh' / 'bottcher' plan: the orbit
// ends at the first n with 2^(1−n)|c|/|w_n|² ≤ DH_STOP_TOL = HIT/16) changes no frame: the steps view's glides of
// Φ_M and of φ_c at c = 0.3 + 0.6i under Everywhere, sheets off, whose frames the inverse pass draws (every Newton step
// evaluates H), at x = 0.5 and 0.9, and plane w₁ parked, against the same frames with every orbit run to |w| > 10⁴
// (?dhnostop, a test hook): at most SAME_FRAC of the pixels more than 32/255 apart in a channel (held_frames.js's
// compareKept), and each frame a picture (shown), the glide's drawn by the inverse pass. The control: some pixel of each
// chain's frames differs (the stop acts, and ?dhnostop does turn it off).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { grab, keep, compareKept } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const SAME_FRAC = 0.001;
const XS = [0.5, 0.9, 1];   // (1: plane w₁ parked)
const READY_MS = 60000, FRAME_MS = 300000, WARM_MS = 120000, SETTLE_MS = 1500;   // waits (ms): a page, a frame, the prestart, a frame's last draws
const SRC = { cx: 0, cy: 0, s: 60 };
const CHAINS = [{ tag: 'dh', type: 'dh', params: {} }, { tag: 'bottcher', type: 'bottcher', params: { c: '0.3+0.6i' } }];
const ready = () => settled({ max: READY_MS, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
// the frames of the one-step chain ch at XS, with the stop (stop true) or without it, kept out of the page by tag; the
// glide's record of each
async function frames(ch, stop) {
  const ns = 'ds' + ch.tag + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [{ type: ch.type, params: Object.assign({}, ch.params), on: true }], nextId: 50, focus: 0, srcView: SRC };
  await go(`${BASE}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`${BASE}/test.html?ns=${ns}&lang=en&view=steps${stop ? '' : '&dhnostop'}`);
  await ready();
  await ev("__cmwSet('sheets', false), __cmwSteps({ bare: true, scope: 'all' }), 1");
  await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
  const out = {};
  for (const x of XS) {
    if (x === 1) {
      await ev('__cmwSteps({ park: 1 }), 1');
      await settled({ max: FRAME_MS, until: '__cmwSteps().x === 1' });
    } else {
      await ev(`__cmwSteps({ x: ${x} }), 1`);
      await settled({ max: FRAME_MS, until: `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(g.u - ${x}) < 1e-9; })()` });
    }
    await ev(`new Promise((r) => setTimeout(r, ${SETTLE_MS})), 1`);
    const tag = `${ch.tag}${stop ? 'S' : 'F'}${x}`;
    await grab(tag);
    out[x] = { tag, kept: await keep(tag), path: await ev('(() => { const g = __cmwSteps().glide; return g ? g.path : null; })()') };
  }
  return out;
}
for (const ch of CHAINS) {
  const S = await frames(ch, true), F = await frames(ch, false);
  for (const x of XS) {
    const d = compareKept(S[x].tag, F[x].tag);
    const r = info[`${ch.tag} x=${x}`] = { paths: [S[x].path, F[x].path], d: d && { apart: d.apart, frac: d.frac, max: d.max, shown: d.shown } };
    if (x < 1) ok(`${ch.tag}, x = ${x}: the frames are the inverse pass's, with the stop and without it`, S[x].path === 'inverse' && F[x].path === 'inverse', r);
    ok(`${ch.tag}, x = ${x}: the early stop changes no frame (at most ${SAME_FRAC} of the pixels more than 32/255 apart from the full orbit's)`, !!d && d.shown.every(Boolean) && d.frac <= SAME_FRAC, r);
  }
  // (the control: ?dhnostop does run another orbit, some pixel of the frames differs)
  ok(`${ch.tag}: the stop acts (some pixel differs from the full orbit's frames)`, XS.some((x) => { const r = info[`${ch.tag} x=${x}`]; return !!r.d && r.d.apart > 0; }), XS.map((x) => info[`${ch.tag} x=${x}`]));
}
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, fails, info };
