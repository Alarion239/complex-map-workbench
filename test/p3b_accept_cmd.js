// P3b acceptance (notes/ui-design/panels.md 9, 11): drawing shapes on the X Sphere and targets on the Y Sphere.
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/p3b_accept_cmd.js
// Prints {pass, fails, results}; pass is true when every check holds.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const CAY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
await view(1440, 900, false);
const paneR0 = async (side) => ev(`(() => { const r = document.getElementById('${side === 'L' ? 'canvasL' : 'canvasR'}').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
// a plane point's CSS pixel on a globe, in page coordinates
const at = async (side, x, y) => { const o = await paneR0(side); const q = await ev(`__cmwGlobeXY('${side}', ${x}, ${y})`); return q ? [o[0] + q[0], o[1] + q[1]] : null; };
const tool = async (t) => ev(`document.querySelector('#tools .tool[data-tool="${t}"]').click(); 1`);
const shapes = async () => ev('__cmwShapes()');

await load('p3bA' + Date.now(), { shapes: [], steps: [CAY], srcView: { cx: 0, cy: 0, s: 80 }, snap: true });
await ev('__cmwSetView("L", "sphere"); 1'); await settle(1500);
// look at the northern hemisphere from above, N in view
await ev('__cmwCam("L", { pitch: 0.55, yaw: -1.0 }); 1'); await settle(800);
R.inf = await at('L', NaN, NaN);
ok('N is on screen', !!R.inf, R.inf);

// 1. a Disc whose rim is dragged onto N (the ∞ snap): a half-plane
await tool('disc');
let c0 = await at('L', 0, 1.2);
await drag(c0[0], c0[1], R.inf[0] + 3, R.inf[1] + 2, 12, 16); await settle();
let S1 = await shapes();
R.half = S1.shapes.map((s) => ({ kind: s.kind, a: s.a, b: s.b, c: s.c, r: s.r, complement: s.complement }));
ok('Disc on the X globe with its rim through ∞: stored as a half-plane', S1.shapes.length === 1 && S1.shapes[0].kind === 'halfplane', R.half);
// its edge passes through the stored centre's antipode side: the half-plane contains the press point z = 1.2i
const hp = S1.shapes[0];
const inHP = (s, x, y) => { const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1]; return dx * (y - s.a[1]) - dy * (x - s.a[0]) > 0; };
ok('the half-plane holds the cap centre 1.2i', hp && hp.a && inHP(hp, 0, 1.2), hp);

// 2. a Disc centred on ∞ (the centre snaps to ∞): the complement of a disc around 0
const p1 = await at('L', 0.3, 2.5);
await drag(R.inf[0] + 2, R.inf[1] - 1, p1[0], p1[1], 12, 16); await settle();
let S2 = await shapes();
const comp = S2.shapes[1];
R.comp = comp;
ok('Disc centred on ∞: the complement of a disc about 0', S2.shapes.length === 2 && comp.kind === 'disc' && comp.complement === true && Math.hypot(comp.c[0], comp.c[1]) < 1e-9, comp);
await shot('p3b_xglobe_caps');

// 3. a Circle through two marked points ... (rim on 1): |z - c| = r through 1
await tool('circle');
const cc = await at('L', 2, -0.5), one = await at('L', 1, 0);
await drag(cc[0], cc[1], one[0] + 2, one[1] - 2, 10, 16); await settle();
let S3 = await shapes();
const circ = S3.shapes[2];
R.circ = circ;
const onRim = circ && circ.kind === 'circle' ? Math.abs(Math.hypot(1 - circ.c[0], -circ.c[1]) - circ.r) : 1;
ok('Circle on the X globe: a circle whose rim snapped to the marked point 1', circ && circ.kind === 'circle' && onRim < 1e-9, { circ, onRim });

// 4. Point tool: within 10 px of N nothing is placed; elsewhere a point (snapped to the polar net)
await tool('point');
await click(R.inf[0] + 3, R.inf[1]); await settle(300);
const nAfterInf = (await shapes()).shapes.length;
ok('the Point tool places nothing within 10 px of ∞', nAfterInf === 3, nAfterInf);
const pp = await at('L', 0.51, 0.49);
await click(pp[0], pp[1]); await settle(300);
const S4 = await shapes();
const pt = S4.shapes[3];
R.pt = pt;
const ptR = pt ? Math.hypot(pt.p[0], pt.p[1]) : 0, ptA = pt ? Math.atan2(pt.p[1], pt.p[0]) * 180 / Math.PI : 0;
ok('a point snaps to the polar net (|z| = 1/2 or arg a multiple of 15 deg)', pt && pt.kind === 'point' && (Math.abs(ptR - 0.5) < 1e-9 || Math.abs(ptA / 15 - Math.round(ptA / 15)) < 1e-9), { pt, ptR, ptA });

// 5. Segment: the Cartesian lattice snap (short numbers)
await tool('segment');
// (near the point of the globe that faces the camera, 1 + 1.5i: the lattice tier there is 0.1 or 0.5; near the
// limb, foreshortened, it is coarser, as the graticule draws it)
const s0 = await at('L', 0.52, 1.49), s1 = await at('L', 1.97, 2.03);
await drag(s0[0], s0[1], s1[0], s1[1], 10, 16); await settle();
const S5 = await shapes();
const seg = S5.shapes[4];
R.seg = seg;
const short = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;   // the tiers there: 0.5 and 1
ok('Segment on the globe: endpoints on the lifted lattice', seg && seg.kind === 'segment' && [...seg.a, ...seg.b].every(short), seg);

// 6. Annulus, Sector, Polar grid are off on the globes: dimmed, a press turns the globe and draws nothing
await tool('annulus');
const dim = await ev(`document.querySelector('#tools .tool[data-tool="sector"]').classList.contains('globe-off') && document.querySelector('#tools .tool[data-tool="annulus"]').classList.contains('globe-off')`);
const yaw0 = (await ev('__cmwCam("L")')).yaw;
const a0 = await at('L', 1.5, -1);
await drag(a0[0], a0[1], a0[0] + 60, a0[1] + 10, 8, 16); await settle();
const S6 = await shapes(), yaw1 = (await ev('__cmwCam("L")')).yaw;
const chipL = await ev(`(() => { const c = document.getElementById('sphereChipL'); return c && !c.hidden ? c.textContent : ''; })()`);
ok('Annulus on the globe: dimmed, draws nothing, turns the globe, says where it draws', dim && S6.shapes.length === 5 && Math.abs(yaw1 - yaw0) > 0.05 && /Plane/.test(chipL), { dim, n: S6.shapes.length, yaw0, yaw1, chipL });
await ev('__cmwCam("L", { pitch: 0.55, yaw: -1.0 }); 1'); await settle(600);

// 7. Select: press the complement (around ∞) near N and slide it: it stays a cap of the disc family; slid off ∞ far
// enough it becomes a disc; the move is one undo step
await tool('select');
await ev(`__cmwSelect('${comp.id}'); 1`); await settle(300);
const H = await ev(`__cmwGlobeHandles('L')`);
R.handles = H;
ok('the selected cap shows a centre and a rim handle on the facing hemisphere', H.length === 2 && H[0][0] === 'C' && H[0][1] && H[1][0] === 'rim', H);
// drag the centre handle (at ∞) to 1.5 - 1.5i: the cap leaves ∞ -> a disc
const o = await paneR0('L');
const hc = H[0][1];
const south = await at('L', 1.5, -1.5);
if (hc && south) { await drag(o[0] + hc[0], o[1] + hc[1], south[0], south[1], 20, 16); await settle(); }
const S7 = await shapes();
const moved = S7.shapes.find((s) => s.id === comp.id);
R.moved = moved;
ok('its centre dragged from ∞ to 1.5 - 1.5i: the complement becomes a disc (the kind follows the geometry)', moved && moved.kind === 'disc' && !moved.complement, moved);
// a slide (move by rotation) of the half-plane: off ∞ it becomes a disc or a complement, never stays a half-plane
// (pressed at 2.5i and slid along its meridian to 1.1i: the cap moves away from N, its rim leaves ∞)
const hz = await at('L', 0, 2.5), hz1 = await at('L', 0, 1.1);
if (hz && hz1) { await drag(hz[0], hz[1], hz1[0], hz1[1], 12, 16); await settle(); }
const S8 = await shapes();
const slid = S8.shapes.find((s) => s.id === hp.id);
R.slid = slid;
ok('the half-plane slid on the sphere becomes a disc or the complement of a disc', slid && slid.kind === 'disc', slid);
await shot('p3b_xglobe_edit');

// 8. targets on the Y globe: a Disc target drawn on the w-globe; it is listed with the targets and pulled back in X
await ev('__cmwSetView("L", "plane"); __cmwSetView("R", "sphere"); 1'); await settle(1500);
await ev('__cmwCam("R", { pitch: 0.4, yaw: -0.9 }); 1'); await settle(600);
await tool('disc');
const w0 = await at('R', 0.3, 0.3), w1 = await at('R', 0.8, 0.3);
await drag(w0[0], w0[1], w1[0], w1[1], 10, 16); await settle(1200);
const S9 = await shapes();
R.target = S9.targets;
ok('Disc on the Y globe: a target disc', S9.targets.length === 1 && S9.targets[0].kind === 'disc', S9.targets);
// the w-globe shows the target: pixels of its fill colour inside its projected rim
const look = await ev(`(() => { const t = __cmwShapes().targets[0]; if (!t) return null; const cv = document.getElementById('canvasR'); const g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height; const x = g.getContext('2d'); x.drawImage(cv, 0, 0); const q = __cmwGlobeXY('R', t.c[0], t.c[1]); const d = window.devicePixelRatio || 1; const px = x.getImageData(Math.round(q[0] * d), Math.round(q[1] * d), 1, 1).data; return { q, px: [px[0], px[1], px[2]] }; })()`);
R.look = look;
ok('the target is drawn on the w-globe (not the globe colour at its centre)', look && look.px && Math.max(...look.px) - Math.min(...look.px) > 25, look);
await shot('p3b_yglobe_target');
R.logs = logs().filter((l) => /error|exception/i.test(l.t) && !/404/.test(l.m)).slice(0, 6);
ok('no errors in the console', !R.logs.length, R.logs);
return { pass: !fails.length, fails, results: R };
