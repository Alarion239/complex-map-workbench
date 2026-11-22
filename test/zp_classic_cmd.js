// Zeros and poles, classic view only: maps of degree 2 and 3 are drawn by the inverse renderer, a degree-5 one forward
// with its reason. X's pane at stage 1 of [zp, z^2] (focus on step 2) shows the image plane w1 = zp(z), and its paths are
// read there. (standards-ok: the frame held mid-drag was read on Y's pane, not drawn since #994; the steps view cannot show
// the image plane while a handle of the domain is held)
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
const pathsR = async () => (await ev('__cmwPaths()')).filter((p) => p.role === 'L');
const POW2 = { type: 'pown', params: { n: 2 }, on: true };

await view(1440, 900, false);
// the image plane's renderer by degree
await load('zppaths' + Date.now(), Object.assign({ shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }, POW2], focus: 2, srcView: { cx: 0, cy: 0, s: 110 } }, PLAIN));
await settle(1200); await grab();
let paths = await pathsR();
ok('degree 2: drawn exactly (inverse renderer)', paths.length && paths.every((p) => p.path === 'inverse'), paths);
await load('zppaths3' + Date.now(), Object.assign({ shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1, 0.5i', poles: '0' }, on: true }, POW2], focus: 2, srcView: { cx: 0, cy: 0, s: 110 } }, PLAIN));
await settle(1200); await grab();
paths = await pathsR();
ok('degree 3: drawn exactly (inverse renderer)', paths.length && paths.every((p) => p.path === 'inverse'), paths);
info.deg3 = paths;
await load('zppaths5' + Date.now(), Object.assign({ shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1, 0.5i, 2, -2i', poles: '0' }, on: true }, POW2], focus: 2, srcView: { cx: 0, cy: 0, s: 110 } }, PLAIN));
await settle(1200); await grab();
paths = await pathsR();
ok('degree 5: forward, with the reason', paths.every((p) => p.path === 'forward' && /degree 5/.test(p.reason || '')), paths);
info.deg5 = paths;
await load('zppaths2' + Date.now(), Object.assign({ shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }, POW2], focus: 2, srcView: { cx: 0, cy: 0, s: 110 } }, PLAIN));
await settle(1200); await grab();
paths = await pathsR();
ok('back to degree 2: exact again', paths.every((p) => p.path === 'inverse'), paths);


await grab();
ok('no exceptions', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
