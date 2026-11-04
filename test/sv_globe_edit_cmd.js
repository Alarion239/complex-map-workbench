// The steps view's plane z with the Sphere surface edits like the classic X Sphere (p3b_accept's three globe-editing
// behaviours, at points that do not depend on the globe's size in pixels): a Point snaps to the polar net; the centre
// handle of the complement of a disc, dragged off ∞, makes it a disc; a half-plane slid along its meridian off ∞
// becomes a disc. The Point's click lies about 2 px from a meridian, inside the 4 px reach of a net line.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// waits for a condition of the page (the kit's settled), with a short floor so that the frame after an action has been drawn
const until = (expr, max = 15000) => settled({ floor: 300, max, until: expr });
const quiet = () => until('window.__cmwSteps && !__cmwSteps().moving && !(window.__cmwSphere && __cmwSphere().running)');
const nShapes = (n) => until(`__cmwShapes().shapes.length === ${n}`);
const CAY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
await view(1440, 900, false);
const paneR0 = async () => ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return [r.left, r.top]; })()`);
const at = async (x, y) => { const o = await paneR0(), q = await ev(`__cmwGlobeXY('L', ${x}, ${y})`); return q ? [o[0] + q[0], o[1] + q[1]] : null; };
const tool = async (t) => ev(`document.querySelector('#tools .tool[data-tool="${t}"]').click(); 1`);
const shapes = async () => ev('__cmwShapes()');
// a globe of plane z looking at the northern hemisphere from above, the given shapes on it
const scene = async (name, list) => {
  await load(name + Date.now(), { shapes: list, steps: [CAY], srcView: { cx: 0, cy: 0, s: 80 }, snap: true });
  await until("typeof __cmwSteps === 'function' && typeof __cmwGlobeXY === 'function'");
  await ev("__cmwSteps({ surf: 'sphere' }); 1");
  await until("__cmwSteps().surf === 'sphere'");
  await quiet();
  await ev('__cmwCam("L", { pitch: 0.55, yaw: -1.0 }); 1');
  await until('Math.abs(__cmwCam("L").yaw + 1) < 1e-9 && !!__cmwGlobeXY("L", NaN, NaN)');
  await quiet();
  R[name + 'Surf'] = await ev('__cmwSteps().surf');
  ok(`${name}: the surface is the Sphere`, R[name + 'Surf'] === 'sphere', R[name + 'Surf']);
};

// 1. Point tool: a press 2 px from the 45 deg meridian lands on it
await scene('pt', []);
await tool('point');
const pp = await at(0.5043, 0.4956);
await click(pp[0], pp[1]); await nShapes(1);
const pt = (await shapes()).shapes[0];
R.pt = pt;
const ptA = pt ? Math.atan2(pt.p[1], pt.p[0]) * 180 / Math.PI : 0;
ok('a point snaps to the polar net (arg a multiple of 15 deg)', pt && pt.kind === 'point' && Math.abs(ptA / 15 - Math.round(ptA / 15)) < 1e-9, { pt, ptA });

// 2. Select: the centre handle of the complement of a disc, dragged from ∞ to 1.5i (on the facing side, farther from ∞ than the cap's rim, so the cap leaves ∞)
await scene('comp', [{ id: 'k1', kind: 'disc', c: [0, 0], r: 2.5, complement: true, ci: 1, visible: true }]);
await tool('select');
await ev(`__cmwSelect('k1'); 1`);
await until("__cmwGlobeHandles('L').length === 2");
const H = await ev(`__cmwGlobeHandles('L')`);
ok('the selected cap shows a centre and a rim handle on the facing hemisphere', H.length === 2 && H[0][0] === 'C' && H[0][1] && H[1][0] === 'rim', H);
const o = await paneR0(), to = await at(0, 1.5);
ok('the target of the centre handle is on the facing hemisphere', !!to, to);
if (H[0][1] && to) { await drag(o[0] + H[0][1][0], o[1] + H[0][1][1], to[0], to[1], 20, 16); await until("__cmwShapes().shapes.some((s) => s.id === 'k1' && !s.complement)").catch(() => 0); }
const moved = (await shapes()).shapes.find((s) => s.id === 'k1');
R.moved = moved;
ok('its centre dragged from ∞ to 1.5i: the complement becomes a disc', moved && moved.kind === 'disc' && !moved.complement, moved);

// 3. Select: a half-plane pressed at 2.5i and slid along its meridian to 1.1i leaves ∞ and becomes a disc
await scene('slide', [{ id: 'h1', kind: 'halfplane', a: [0, 0.18333], b: [1, 0.18333], ci: 0, visible: true }]);
await tool('select');
const hz = await at(0, 2.5), hz1 = await at(0, 1.1);
if (hz && hz1) { await drag(hz[0], hz[1], hz1[0], hz1[1], 12, 16); await until("__cmwShapes().shapes.some((s) => s.id === 'h1' && s.kind === 'disc')").catch(() => 0); }
const slid = (await shapes()).shapes.find((s) => s.id === 'h1');
R.slid = slid;
ok('the half-plane slid on the sphere becomes a disc', slid && slid.kind === 'disc', slid);
return { pass: fails.length === 0, fails, results: R };
