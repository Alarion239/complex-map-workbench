// Zeros and poles, classic view only. The steps view shows one plane and has neither the right pane's area renderer nor
// the deformation transport, so these cases stay in the classic view:
//   - while a zero is held still mid-drag the motion frame of Y is the rest frame (per pixel against the exact image);
//   - a degree-2 map is drawn by the inverse renderer, a degree-3 one forward with its reason (the right pane's paths);
//   - the deformation of a polynomial and of a rational map (natural path, figure caption, 60 fps).
// A command file for a CDP daemon (test/cdp_kit README).
const fails = [], info = {}, shots = [];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const errs = [];
const grab = async () => { errs.push(...exc(await logs())); };
const DISC = { id: 's1', kind: 'disc', c: [0, 1.2], r: 0.8 };
const PLAIN = { pattern: 'solid', alpha: 1, lines: false, unit: false, fov: false, outline: false, chev: false };
const EXACT_SRC = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'zp_kit.js'), 'utf8'))(DISC);
const zp = () => ev('__cmwZp()');
const pathsR = async () => (await ev('__cmwPaths()')).filter((p) => p.role === 'R');

await view(1440, 900, false);
// the right pane's renderer by degree
await load('zppaths' + Date.now(), Object.assign({ shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } }, PLAIN));
await settle(1200); await grab();
let paths = await pathsR();
ok('degree 2: drawn exactly (inverse renderer)', paths.length && paths.every((p) => p.path === 'inverse'), paths);
await load('zppaths3' + Date.now(), Object.assign({ shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1, 0.5i', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } }, PLAIN));
await settle(1200); await grab();
paths = await pathsR();
ok('degree 3: forward, with the reason', paths.every((p) => p.path === 'forward' && /degree 3/.test(p.reason || '')), paths);
info.deg3 = paths;
await load('zppaths2' + Date.now(), Object.assign({ shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } }, PLAIN));
await settle(1200); await grab();
paths = await pathsR();
ok('back to degree 2: exact again', paths.every((p) => p.path === 'inverse'), paths);

// the held frame
await load('zpheld' + Date.now(), Object.assign({ shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } }, PLAIN));
await settled({ until: '__cmwZp().handles.length === 3' });
const h = (await zp()).handles.find((q) => q.kind === 'zeros' && q.i === 1);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.x, y: h.y });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: h.x, y: h.y, button: 'left', clickCount: 1 });
for (let i = 1; i <= 12; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.x - 3 * i, y: h.y + 4 * i, button: 'left', buttons: 1 }); await sleep(16); }
await settled({ floor: 250 });
const exHeld = await ev(EXACT_SRC('R'), 60000);
ok('exact mid-drag (pointer held still)', exHeld.n > 2000 && exHeld.rate < 0.002, exHeld);
info.exactHeld = exHeld;
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: h.x - 36, y: h.y + 48, button: 'left', clickCount: 1 });
await settle(400);

// 7. the deformation: the natural path of a polynomial (zeros fly in), and a figure with its caption
await load('zpacc3' + Date.now(), { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1.5 }, { id: 's2', kind: 'pgrid', c: [0, 0], r: 1.5, nc: 5, nr: 16 }],
  steps: [{ type: 'zp', params: { a: '1', zeros: '1, -0.5+0.8i, -0.5-0.8i', poles: '' }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200); await grab();
await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
await ev('__cmwMorph({ T: 0.5 })'); await settle(900);
const st = await ev('__cmwState()');
ok('deformation: a natural path (mode 1)', st.homView && st.homView.map.mode === 1, st.homView && st.homView.map);
await shot('zp-deform-light'); shots.push('zp-deform-light');
const fig = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['R'], morph: true, caption: true, widthIn: 3.4 }); return f ? { n: f.morph ? f.morph.kept.length : -1, cap: f.captionTex } : null; })()`, 60000);
ok('figure: arrows and the zoom path about zeta_1 in the caption (only true claims)', fig && fig.n > 0 && /zoom homotopy/.test(fig.cap) && /about \$c=1\$, a zero of/.test(fig.cap) && !/never meet/.test(fig.cap) && !/zeros fly/.test(fig.cap), fig && { n: fig.n, cap: fig.cap.slice(0, 500) });
info.figCaption = fig && fig.cap.slice(0, 600);
await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(300);
const pf = await ev('await (async () => await __qa.frames(2000))()', 30000);
info.playFrames = pf;
ok('deformation plays at 60 fps', pf.fps >= 55, pf);
await ev('__cmwMorph({ playing: false, open: false })'); await settle(400);
// with a pole: the rational zoom path
await load('zpacc4' + Date.now(), { shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0.3i' }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1000);
await ev('__cmwMorph({ open: true, playing: false })'); await settle(500);
await ev('__cmwMorph({ T: 0.6 })'); await settle(900);
const st2 = await ev('__cmwState()');
ok('with a pole: a natural path too', st2.homView && st2.homView.map.mode === 1, st2.homView && st2.homView.map);
await shot('zp-deform-pole-light'); shots.push('zp-deform-pole-light');
await ev('__cmwMorph({ open: false })'); await settle(300);

await grab();
ok('no exceptions', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info, shots };
