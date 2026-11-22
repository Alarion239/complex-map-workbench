// Zeros and poles, classic view only. The steps view shows one plane and has no right pane's area renderer, so these
// cases stay in the classic view:
//   - while a zero is held still mid-drag the motion frame of Y is the rest frame (per pixel against the exact image);
//   - maps of degree 2 and 3 are drawn by the inverse renderer, a degree-5 one forward with its reason (the right pane's paths).
// (standards-ok: the deformation's rows went with the classic transport, #994; the steps view's natural paths are deform_nat_cmd)
// A command file for a CDP daemon (test/cdp_kit README).
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await settled({ floor: ms }); };
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
ok('degree 3: drawn exactly (inverse renderer)', paths.length && paths.every((p) => p.path === 'inverse'), paths);
info.deg3 = paths;
await load('zppaths5' + Date.now(), Object.assign({ shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1, 0.5i, 2, -2i', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } }, PLAIN));
await settle(1200); await grab();
paths = await pathsR();
ok('degree 5: forward, with the reason', paths.every((p) => p.path === 'forward' && /degree 5/.test(p.reason || '')), paths);
info.deg5 = paths;
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

await grab();
ok('no exceptions', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
