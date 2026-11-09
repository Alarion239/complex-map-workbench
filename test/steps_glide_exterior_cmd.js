// The steps view's glides of the maps that are one-to-one onto the outside of the unit disk and tangent to the identity at
// infinity (the Douady–Hubbard map, the Böttcher coordinate), under Everywhere: each frame is drawn by the inverse pass
// (__cmwSteps().glide.path === 'inverse'), not by the carried mesh. The ends of the glide are the parked planes':
// at u = END and 1 - END, away from the colour lines, more than 6 levels off in a channel on at most
// END_OVER of the pixels (the carried mesh differs by 0.9 % to 10.8 % there). The member at u = 0.5 is the CPU
// reference's (__giRef), as for the other inverse glides.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { GI_REF } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const ready = () => settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
const END = 1e-4;          // the glide's ends: u = END and 1 - END
const END_OVER = 0.005;    // at the ends, at most this share of the smooth pixels is more than 6 levels off the parked plane
const MID_OVER = 0.002;    // at u = 0.5, at most this share is more than 6 levels off the CPU reference
const MIN_PX = 2000;       // the smallest count of compared pixels that counts as a comparison
const FRAME_MS = 300000;   // a software renderer's time over a frame
const SRC = { cx: 0, cy: 0, s: 60 };
// (the page's helpers: the left pane's pixels, and the comparison of a frame with the CPU reference)
const HELPERS = `window.__gi = window.__gi || {};
window.__giGrab = () => { const cv = document.querySelector('#canvasL'), c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.drawImage(cv, 0, 0); return { W: c.width, H: c.height, d: g.getImageData(0, 0, c.width, c.height).data }; };
window.__giStat = (A, B) => { let n = 0, over = 0, sum = 0, max = 0; for (let i = 0; i < A.d.length; i += 4) { n++; let m = 0; for (let c = 0; c < 3; c++) { const d = Math.abs(A.d[i + c] - B.d[i + c]); sum += d; m = Math.max(m, d); } max = Math.max(max, m); if (m > 6) over++; } return { n, max, mean: +(sum / 3 / n).toFixed(3), over: +(over / n).toFixed(5) }; };
window.__giSmooth = (A, B) => { const W = A.W, H = A.H; let n = 0, over = 0; for (let y = 3; y < H - 3; y += 3) for (let x = 3; x < W - 3; x += 3) { if (__giRange(A.d, W, x, y) > 12 || __giRange(B.d, W, x, y) > 12) continue; n++; const i = 4 * (y * W + x); let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(A.d[i + c] - B.d[i + c])); if (m > 6) over++; } return { n, over: +(over / Math.max(1, n)).toFixed(5) }; };
${GI_REF}
1`;
// the frame at thread place x, once a frame there was drawn (by either path), and its record
// (max: a software renderer takes minutes over a frame of the Mountain King's plane F; ms: until that frame)
const at = async (x, want, max = 60000) => {
  const t0 = Date.now();
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  const until = `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(${Math.floor(x)} + g.u - ${x}) < 1e-9 && ${want ? `g.path === '${want}'` : 'true'}; })()`;
  await settled({ max, until });
  const ms = Date.now() - t0;
  await ev('await new Promise((r) => setTimeout(r, 1500)), 1');
  const g = await ev('(() => { const g = __cmwSteps().glide; return g ? { b: g.b, u: g.u, path: g.path, reason: g.reason } : null; })()');
  return g && Object.assign(g, { ms });
};
const park = async (k) => {
  await ev(`__cmwSteps({ park: ${k} }), 1`);
  await settled({ max: 60000, until: `__cmwSteps().x === ${k}` });
  await ev('await new Promise((r) => setTimeout(r, 2500)), 1');
};

const STEPS = [['dh', 'Douady–Hubbard', { N: 64 }], ['bottcher', 'Böttcher', { c: '-1', N: 64 }]];
await view(1440, 900, false, false);
for (const [id, name, params] of STEPS) {
  const ns = 'ge' + id + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [{ type: id, params, on: true }], nextId: 50, focus: 0, srcView: SRC };
  await go(`${BASE}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`${BASE}/test.html?ns=${ns}&lang=en&view=steps`);
  await ready();
  await ev(HELPERS);
  await ev("__cmwSteps({ bare: true, scope: 'all' }), 1");
  await settled({ max: 120000, until: '__cmwSteps().ready.ready' });
  await park(0); await ev('window.__gi.p0 = __giGrab(), 1');
  await park(1); await ev('window.__gi.p1 = __giGrab(), 1');
  for (const [x, ref] of [[END, 'p0'], [1 - END, 'p1']]) {
    const g = await at(x, null, FRAME_MS);
    const r = await ev(`(() => { const F = __giGrab(); return __giSmooth(F, window.__gi.${ref}); })()`);
    info[`${id} x ${x}`] = { g, r };
    ok(`${name} at u = ${x}: drawn by the inverse pass`, !!g && g.path === 'inverse', g);
    ok(`${name} at u = ${x}: the parked plane's frame (> 6 levels on at most ${END_OVER} of the smooth pixels)`, r.n > MIN_PX && r.over <= END_OVER, r);
  }
  {
    const g = await at(0.5, null, FRAME_MS);
    const r = await ev('__giRef(window.__gi.p0, __giGrab(), 6, 8)');
    info[`${id} x 0.5`] = { g, r };
    ok(`${name} at u = 0.5: drawn by the inverse pass`, !!g && g.path === 'inverse', g);
    ok(`${name} at u = 0.5: the CPU reference's colours (> 6 on at most ${MID_OVER})`, r.n > MIN_PX && r.over <= MID_OVER, r);
  }
  // negative control: the same step without the property takes the carried mesh, with the reason the glide names
  await ev(`(() => { const d = Funcs.DEFS.${id}, b = d.build; d.build = function () { const r = b.apply(this, arguments); r.props = Object.assign({}, r.props, { identitySeed: false }); return r; }; __cmwStepParam(0, 'N', 63); return 1; })()`);
  await settled({ max: 120000, until: '__cmwSteps().ready.ready' });
  {
    const g = await at(0.5, null, FRAME_MS);
    info[`${id} control`] = g;
    ok(`${name} without the property, at u = 0.5: the carried mesh (control)`, !!g && g.path === 'mesh' && /Newton inverse/.test(g.reason || ''), g);
  }
}
return { pass: fails.length === 0, fails, info };
