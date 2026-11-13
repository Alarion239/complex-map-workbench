// The steps view's later planes take constructions on their own objects: on plane 1 of a Möbius chain a 3-point circle
// is made from three clicks, its points and the circle belong to plane 1 (stage = 1), one Undo takes them all, the chip
// says "· on w₁" while the construction is under way, and a point of plane z carried to plane 1 (z₀′) is an input too.
// A command file for a CDP daemon (test/cdp_kit README).
const fails = [], info = {};
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
// waits, in ms: the floor before a quiet page is read, how long a glide or a quiet page may take, how long the page and
// its chain may take to load, how long a pick may take to show, and the pause between moving to a pick and clicking it
// (the hover snap lands in it)
const QUIET_FLOOR = 300, QUIET_MAX = 15000, LOAD_MAX = 30000, PICK_MAX = 8000, HOVER_PAUSE = 150;
const NEW_SHAPES = 4;   // a 3-point circle and its three points
const quiet = () => settled({ floor: QUIET_FLOOR, max: QUIET_MAX, until: "window.__cmwSteps && !__cmwSteps().moving" });
const shapes = async () => (await ev('__cmwShapes()')).shapes;
const chip = async () => ev(`(() => { const e = [...document.querySelectorAll('.cm-chip')].find((x) => x.offsetParent); return e ? e.textContent : ''; })()`);
const at = async (re, im) => ev(`__cmwPlaneMenu().w2s('L', ${re}, ${im})`);
await view(1200, 800, false, false);
const ns = 'svcp' + Date.now();
await send('Page.navigate', { url: `${BASE}/gl-helpers.html` }); await sleep(350);
const o = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', shapes: [{ id: 'z0', kind: 'point', p: [0.5, 0.5], ci: 0, visible: true, num: 0 }], steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }] };
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
await send('Page.navigate', { url: `${BASE}/test.html?ns=${ns}&view=steps` });
// the app is driven once the page has loaded and the chain is in (a glide to plane 1 needs two planes), and a pick is
// read once it has landed: the stage is plane 1, and the chip counts the picks made
await settled({ max: LOAD_MAX, until: "typeof __cmwSteps === 'function' && typeof __cmwPlaneMenu === 'function' && __cmwSteps().on && __cmwSteps().planes.length > 1" });
await ev(`__cmwSteps({ go: 1, now: true }); 1`);
const onPlane1 = () => settled({ floor: QUIET_FLOOR, max: QUIET_MAX, until: "__cmwSteps().stage === 1 && !__cmwSteps().moving" });
await onPlane1();
const picked = (n) => settled({ max: PICK_MAX, until: `[...document.querySelectorAll('.cm-chip')].some((e) => !!e.offsetParent && e.textContent.includes('${n} of 3'))` });
await ev(`(() => { const b = [...document.querySelectorAll('[data-tool="circle3"]')].find((e) => e.offsetParent) || document.querySelector('[data-tool="circle3"]'); b.click(); return 1; })()`); await onPlane1();
const n0 = (await shapes()).length;
const P = [[0.35, 0.45], [0.7, -0.35], [-0.45, -0.4]];
const p0 = await at(P[0][0], P[0][1]);
await move(p0[0], p0[1]); await settled({ max: 3000, until: `[...document.querySelectorAll('.cm-chip')].some((e) => !!e.offsetParent)` });
await click(p0[0], p0[1]); await picked(2);
const c1 = await chip();
ok('a 3-point circle on plane 1: the chip names the plane while picks are under way', /on w₁/.test(c1), c1);
for (const [i, q] of P.slice(1).entries()) {
  const s = await at(q[0], q[1]); await move(s[0], s[1]); await settle(HOVER_PAUSE); await click(s[0], s[1]);
  if (i === 0) await picked(3); else await settled({ max: PICK_MAX, until: `__cmwShapes().shapes.length === ${n0 + NEW_SHAPES}` });
}
await quiet();
const S1 = await shapes(), circle = S1.find((s) => s.def && s.def.op === 'circle3');
ok('a 3-point circle on plane 1: the circle is made', !!circle && S1.length === n0 + NEW_SHAPES, S1);
ok('a 3-point circle on plane 1: it and its three points belong to plane 1', !!circle && S1.slice(n0).every((s) => s.stage === 1), S1.slice(n0));
ok('a 3-point circle on plane 1: its points are plane 1\'s own (no reference to plane z)', !!circle && circle.def.args.every((r) => { const t = S1.find((s) => s.id === r.s); return !!t && t.stage === 1; }), circle && circle.def);
const stageNow = await ev('__cmwSteps().stage');
ok('a 3-point circle on plane 1: the view stays on plane 1', stageNow === 1, stageNow);
await key('z', 4); await quiet();
ok('a 3-point circle on plane 1: one Undo takes the circle and its points', (await shapes()).length === n0, (await shapes()).length);
// a point of plane z carried to plane 1 is an input: two plane-1 points and z₀′
const carriedPt = await ev(`__cmwPlaneMenu().stage(1, 0.5, 0.5)`), carriedAt = await at(carriedPt[0], carriedPt[1]);
const pickA = await at(0.35, 0.45), pickB = await at(0.7, -0.35);
for (const s of [pickA, pickB, carriedAt]) { await move(s[0], s[1]); await settle(HOVER_PAUSE); await click(s[0], s[1]); await settle(300); }
await quiet();
const S2 = await shapes(), carriedCircle = S2.find((s) => s.def && s.def.op === 'circle3');
ok('a 3-point circle on plane 1 through a carried point: its third input is the image of z₀', !!carriedCircle && carriedCircle.stage === 1 && carriedCircle.def.args.some((r) => r.img === 'z0'), carriedCircle && carriedCircle.def);
return { pass: fails.length === 0, fails, info };
