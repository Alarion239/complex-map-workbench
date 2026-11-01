// The steps view's Paths (#631): the paths t -> H_t(z) of the classic deformation, drawn in the steps view from its own
// deformation source (the glide's run of planes), with no classic transport open.
// - Paths is a toggle beside Loop on the strip, pressed as the saved S.morphPaths; a click and key P switch it;
// - parked between planes 0 and 1, and between 1 and 2, paths are drawn: T is the place in the run, the run starts at
//   the identity on plane z and at z ↦ z² past it, and every moving point drawn is H_T(z) of its start (within 1.5 px);
// - Paths off: none drawn;
// - a glide from plane z to plane w₂ is one run of two steps (a bar where they meet), and paths are drawn during it;
// - a d/dz in the chain turns the toggle off, with its reason.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// z → w₁ = z² → w₂ = i w₁ (a quarter turn: its paths are arcs), a disc of z
const chain = (extra) => ({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0,
  shapes: [{ id: 'd1', kind: 'disc', c: [0.3, 0.2], r: 1.4, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'affine', params: { a: 'i', b: '0' }, on: true }].concat(extra || []) });
const open = async (st) => {
  const ns = 'svpa' + Date.now();
  await go(`${BASE}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`${BASE}/test.html?ns=${ns}&lang=en&view=steps`);
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip')` });
};
const S = () => ev('__cmwSteps()');
// (parked at x: until a frame has drawn the paths of the finished selection, at most 20 s on a software renderer)
const parked = async (x) => {
  await ev(`__cmwSteps({ park: ${x} }), 1`);
  await settled({ max: 20000, until: `(() => { const p = __cmwSteps().paths; return !!p.src && p.ready && p.heads > 0 && Math.abs(p.T - p.src.T) < 1e-9; })()` });
  return (await S()).paths;
};
const btn = () => ev(`(() => { const b = document.querySelector('#svStrip .sv-paths'); if (!b) return null; const l = document.querySelector('#svStrip .sv-loop'); return { pressed: b.getAttribute('aria-pressed'), disabled: b.disabled, text: b.textContent, tip: b.dataset.tip || '', afterLoop: !!l && l.nextElementSibling === b }; })()`);
await view(1440, 900, false, false);
await open(chain());
const b0 = await btn();
ok('a Paths toggle beside Loop on the strip, pressed (the saved default)', !!b0 && b0.afterLoop && b0.pressed === 'true' && !b0.disabled && b0.text === 'Paths', b0);
const p1 = await parked(0.5);
info.p1 = p1;
ok('parked between z and w₁: the run is that step, from the identity', !!p1.src && Math.abs(p1.src.T - 0.5) < 1e-9 && p1.src.Tend === 1 && p1.src.startId === true && p1.src.seq === false, p1.src);
ok('parked between z and w₁: paths drawn, each moving point at H_T(z) of its start', p1.heads >= 3 && p1.err < 1.5, p1);
const p2 = await parked(1.5);
info.p2 = p2;
ok('parked between w₁ and w₂: the run is the second step, from plane w₁ (H_0 = z²)', !!p2.src && Math.abs(p2.src.T - 0.5) < 1e-9 && p2.src.Tend === 1 && p2.src.startId === false, p2.src);
ok('parked between w₁ and w₂: paths drawn, each moving point at H_T(z)', p2.heads >= 3 && p2.err < 1.5, p2);
// off by a click, back on by P
await ev(`document.querySelector('#svStrip .sv-paths').click(), 1`);
await settled({ max: 5000, until: `__cmwSteps().paths.heads === 0` });
const off = await S(), b1 = await btn();
ok('a click on Paths turns them off: none drawn, the toggle not pressed', !off.paths.on && off.paths.heads === 0 && !off.paths.src && b1.pressed === 'false', { paths: off.paths, btn: b1 });
await ev(`document.querySelector('#svStrip .sv-paths').focus(); document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true })), 1`);
await settled({ max: 20000, until: `__cmwSteps().paths.heads > 0` });
const on = await S(), b2 = await btn();
ok('key P turns them on again', on.paths.on && on.paths.heads > 0 && b2.pressed === 'true', { paths: on.paths, btn: b2 });
// a glide over two planes: one run
await ev(`__cmwSteps({ go: 0, now: true }), 1`);
await settled({ max: 5000, until: `!__cmwSteps().moving` });
// (the slowest glide: a software renderer's frames are far apart)
await ev(`(() => { const s = document.querySelector('#svStrip .sv-speed'); s.value = 'slower'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
await ev(`__cmwSteps({ go: 2 }), 1`);
let glide = null;
for (let i = 0; i < 200 && !glide; i++) {
  const s = await S();
  if (s.anim && s.paths.src && s.paths.heads > 0 && s.paths.T > 0.05) glide = s.paths;
  else if (!s.moving && i > 5) break;
  else await settled({ max: 200 });
}
info.glide = glide;
ok('a glide from z to w₂ is one run of two steps, with paths drawn as it goes', !!glide && glide.src.Tend === 2 && glide.src.seq === true && glide.src.startId === true && glide.err < 1.5, glide);
await settled({ max: 20000, until: `!__cmwSteps().moving` });
const atRest = await S();
ok('on a plane at rest: no run, no paths', !atRest.paths.src && atRest.paths.heads === 0, atRest.paths);
// a d/dz in the chain: no paths, the toggle off with its reason
await open(chain([{ type: 'deriv', params: {}, on: true }]));
const b3 = await btn();
ok('a d/dz in the chain turns Paths off, with its reason', !!b3 && b3.disabled && b3.pressed === 'false' && /d\/dz/.test(b3.tip), b3);
return { pass: fails.length === 0, fails, info };
