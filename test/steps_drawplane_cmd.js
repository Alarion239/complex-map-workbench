// The steps view's left plane is drawn through one function, svDrawPlane, which hands each plane to one of two cores:
// - the carry core (svRenderMoving) for a flat plane past the colour plane and for the frames between planes;
// - the classic core for a coloured plane, and for the globe and the relief of a plane past it.
// This checks which core drew the plane in each of those places (the test hook's `core`) and that each draws a picture.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svdp' + Date.now();
const { MOB, EXP, S2, WHOLEMAP_UP, openChain } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'steps_chain_kit.js'), 'utf8'))({ ev, go, view, settled, PORT });
const { ctl, quiet, planePixels } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'plane_pixels.js'), 'utf8'));
await openChain({ ns, w: 1440, h: 900, shapes: [S2], steps: [EXP, MOB], srcView: { cx: 0, cy: 0, s: 80 }, until: WHOLEMAP_UP, max: 30000 });
// (the colour plane is z, plane 0)
await ev(`document.querySelector('.sv-cp').click(); 1`);
await settled({});
// (a press waits for the prestart and its idle jobs: the suite presses once the chain is prepared)
const kit = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'wait_kit.js'), 'utf8'))({ settled, ev, sleep, fails });
const calm = () => kit.prepared('true', 120000, { only: true });
const toPlane = async (i) => { await calm(); await ev(`document.querySelector('#svStrip .sv-plane[data-i="${i}"]').click(); 1`); await quiet(); await settled({ floor: 400 }); return ctl(); };
// (a picture: the plane's pixels are not all one colour)
const picture = async () => { const r = await planePixels('', '(r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) > 40 || r < 235'); return r.__exc ? r : r.n > 50; };
let s = await toPlane(0);
ok('the colour plane is drawn by the classic core', s.paint === 'pull' && s.core === 'still', { paint: s.paint, core: s.core });
ok('the colour plane draws a picture', await picture(), null);
s = await toPlane(2);
ok('a flat plane past the colour plane is drawn by the carry core', s.paint === 'push' && s.core === 'carry', { paint: s.paint, core: s.core });
ok('the plane past the colour plane draws a picture', await picture(), null);
await ctl({ surf: 'sphere' }); await quiet(); await settled({ floor: 600 });
s = await ctl();
ok('the globe of a plane past the colour plane is drawn by the classic core', s.paint === 'push' && s.core === 'still', { paint: s.paint, core: s.core, surf: s.surf });
await ctl({ surf: 'plane' }); await quiet(); await settled({ floor: 400 });
await ctl({ go: 0 }); await quiet();
await calm();
await ctl({ go: 1 });
let mid = null;
for (let i = 0; i < 40 && !(mid && mid.core === 'carry' && mid.moving); i++) { await new Promise((r) => setTimeout(r, 25)); mid = await ctl(); }
ok('a frame between two planes is drawn by the carry core', !!mid && mid.core === 'carry' && mid.moving, mid && { core: mid.core, moving: mid.moving });
await quiet();
return { pass: fails.length === 0, fails, info };
