// The steps view's Paths: the paths t -> H_t(z) of the classic deformation, drawn in the steps view from its own
// deformation source (the glide's run of planes), with no classic transport open.
// - Paths is a toggle in the Playback popover (its button says On or Off), pressed as the saved S.morphPaths;
//   a click and key P switch it;
// - parked between planes 0 and 1, and between 1 and 2, paths are drawn: T is the place in the run, the run starts at
//   the identity on plane z and at z ↦ z² past it, and every moving point drawn is H_T(z) of its start (within 1.5 px);
// - Paths off: none drawn;
// - a glide from plane z to plane w₂ is one run of two steps (a bar where they meet), and paths are drawn during it;
// - a d/dz in the chain turns the toggle off, with its reason.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// z → w₁ = z² → w₂ = i w₁ (a quarter turn: its paths are arcs), a disc of z
const chain = (extra) => ({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0,
  shapes: [{ id: 'd1', kind: 'disc', c: [0.3, 0.2], r: 1.4, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'affine', params: { a: 'i', b: '0' }, on: true }].concat(extra || []) });
let lastNs = null;
const open = async (st) => {
  await loadView('steps', lastNs = 'svpa' + Date.now(), st, { lang: 'en' });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip')` });
};
const { S, parked } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'steps_paths_kit.js'), 'utf8'))({ ev, settled });
const btn = () => ev(`(() => {
  const b = document.querySelector('#svStrip .sv-playpop .sv-paths');
  if (!b) return null;
  return {
    pressed: b.getAttribute('aria-pressed'), disabled: b.disabled, text: b.textContent,
    label: ((b.closest('label') || {}).firstElementChild || {}).textContent || '', tip: b.dataset.tip || '',
    inPopover: !!b.closest('.sv-playpop'), onStrip: !!document.querySelector('#svStrip > .sv-paths'),
  };
})()`);
await view(1440, 900, false, false);
await open(chain());
const b0 = await btn();
ok('a Paths toggle in the Playback popover (not on the strip), pressed (the saved default)', !!b0 && b0.inPopover && !b0.onStrip && b0.label === 'Paths' && b0.pressed === 'true' && !b0.disabled && b0.text === 'On', b0);
const p1 = await parked(0.5);
info.p1 = p1;
ok('parked between z and w₁: the run is that step, from the identity', !!p1.src && Math.abs(p1.src.T - 0.5) < 1e-9 && p1.src.Tend === 1 && p1.src.startId === true && p1.src.seq === false, p1.src);
ok('parked between z and w₁: paths drawn, each moving point at H_T(z) of its start', p1.heads >= 3 && p1.err < 1.5, p1);
// (the next step's run is re-traced ahead, off the frame: crossing into it re-traces nothing in a frame)
const ah = await settled({ max: 20000, until: '__cmwSteps().paths.ahead >= 1' });
ok('parked between z and w₁: the next step\'s run is re-traced ahead', ah.ok, ah);
await ev(`(() => { const f = MorphPaths.pathRetrace; window.__svRetrace = f; window.__svRetraceIn = 0; MorphPaths.pathRetrace = function (...a) { if ((new Error().stack || '').includes('morphSelScreen')) window.__svRetraceIn++; return f.apply(this, a); }; return 1; })()`);
// (the spy is taken off whatever the waits and reads do)
let cross;
try {
  await ev(`__cmwSteps({ park: 1.5 }), 1`);
  await settled({ max: 20000, until: `(() => { const p = __cmwSteps().paths; return !!p.src && p.heads > 0 && !p.src.startId && Math.abs(p.T - 0.5) < 1e-9; })()` });
  cross = Object.assign(await S().then((s) => s.paths), { inFrame: await ev('window.__svRetraceIn') });
} finally {
  await ev('MorphPaths.pathRetrace = window.__svRetrace, 1');
}
info.cross = cross;
ok('crossing into the next step: its first frames draw the paths re-traced ahead (none in a frame), each moving point at H_T(z)', cross.inFrame === 0 && cross.heads >= 3 && cross.err < 1.5, cross);
const p2 = await parked(1.5);
info.p2 = p2;
ok('parked between w₁ and w₂: the run is the second step, from plane w₁ (H_0 = z²)', !!p2.src && Math.abs(p2.src.T - 0.5) < 1e-9 && p2.src.Tend === 1 && p2.src.startId === false, p2.src);
ok('parked between w₁ and w₂: paths drawn, each moving point at H_T(z)', p2.heads >= 3 && p2.err < 1.5, p2);
// off by a click, back on by P
await ev(`document.querySelector('#svStrip .sv-playmore').click(), document.querySelector('#svStrip .sv-playpop .sv-paths').click(), document.querySelector('#svStrip .sv-playmore').click(), 1`);
await settled({ max: 5000, until: `__cmwSteps().paths.heads === 0` });
const off = await S(), b1 = await btn();
ok('a click on Paths turns them off: none drawn, the toggle not pressed and saying Off', !off.paths.on && off.paths.heads === 0 && !off.paths.src && b1.pressed === 'false' && b1.text === 'Off', { paths: off.paths, btn: b1 });
await ev(`document.querySelector('#svStrip .sv-playmore').focus(); document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true })), 1`);
await settled({ max: 20000, until: `__cmwSteps().paths.heads > 0` });
const on = await S(), b2 = await btn();
ok('key P turns them on again', on.paths.on && on.paths.heads > 0 && b2.pressed === 'true' && b2.text === 'On', { paths: on.paths, btn: b2 });
// a glide over two planes: one run
await ev(`__cmwSteps({ go: 0, now: true }), 1`);
await settled({ max: 5000, until: `!__cmwSteps().moving` });
// (the slowest glide: a software renderer's frames are far apart)
await choose('#svStrip .sv-speed', 'slower');
await ev(`__cmwSteps({ go: 2 }), 1`);
// (the first frame mid-glide with paths drawn, kept where the wait found it: the glide moves on meanwhile; the panes are
// never quiet during a glide)
await settled({ panes: false, max: 20000, until: `(() => { const s = __cmwSteps(); if (s.anim && s.paths.src && s.paths.heads > 0 && s.paths.T > 0.05) window.__svGlide = s.paths; return !!window.__svGlide || !s.moving; })()` });
const glide = await ev(`window.__svGlide || null`);
info.glide = glide;
ok('a glide from z to w₂ is one run of two steps, with paths drawn as it goes', !!glide && glide.src.Tend === 2 && glide.src.seq === true && glide.src.startId === true && glide.err < 1.5, glide);
await settled({ max: 20000, until: `!__cmwSteps().moving` });
const atRest = await S();
ok('on a plane at rest: no run, no paths', !atRest.paths.src && atRest.paths.heads === 0, atRest.paths);
// all at once (the order the classic dock has too): the glide from z to w₂ is one homotopy over [0, 1], not two steps in a
// sequence; the order is saved
await open(Object.assign(chain(), { homAll: true }));
await ev(`__cmwSteps({ go: 0, now: true }), 1`);
await settled({ max: 5000, until: `!__cmwSteps().moving` });
await choose('#svStrip .sv-speed', 'slower');
await ev(`__cmwSteps({ go: 2 }), 1`);
await settled({ panes: false, max: 20000, until: `(() => { const s = __cmwSteps(); if (s.anim && s.paths.src && s.paths.src.T > 0.05) window.__svGlideAll = s.paths; return !!window.__svGlideAll || !s.moving; })()` });
const glideAll = await ev(`window.__svGlideAll || null`);
info.glideAll = glideAll;
ok('all at once: a glide from z to w₂ is one homotopy over [0, 1] (the dock\'s), not two steps in a sequence', !!glideAll && glideAll.src.Tend === 1 && glideAll.src.seq === false && glideAll.src.startId === true && glideAll.src.T > 0 && glideAll.src.T < 1, glideAll);
await settled({ max: 20000, until: `!__cmwSteps().moving` });
const savedAll = await ev(`JSON.parse(localStorage.getItem('complex-map-workbench-v1:${lastNs}') || '{}').homAll`);
ok('all at once is saved', savedAll === true, savedAll);
// a d/dz in the chain: no paths, the toggle off with its reason
await open(chain([{ type: 'deriv', params: {}, on: true }]));
const b3 = await btn();
ok('a d/dz in the chain turns Paths off, with its reason', !!b3 && b3.disabled && b3.pressed === 'false' && /d\/dz/.test(b3.tip), b3);
return { pass: fails.length === 0, fails, info };
