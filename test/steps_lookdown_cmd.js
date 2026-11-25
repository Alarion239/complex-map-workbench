// Look down: with a disc of w₁ selected on plane z of the steps view, the plane draws
// the target as an outline ring, a line from each preimage of its centre to the centre, the critical points (red
// crosses) and values (red dots), the next join radius (a dashed red ring) and a key chip. Every mark's place is
// measured against the page's own coordinates (__cmwPlaneMenu().w2s), and the plane's overlay holds ink there:
//  - M1 z², |w − 1| < 0.5: the ring about 1 of radius 0.5, lines from ±1, the critical point 0 and its value 0, the
//    join ring of radius 1;
//  - M3 z³ − 1.2z + 0.3, |w − 1.1| < 0.25: lines from its three roots, crosses at ±√0.4, dots at 0.3 ∓ 0.8√0.4, the
//    join ring of radius 0.294;
//  - M2 Joukowski, |w − 0.6 − 0.5i| < 0.35: crosses and dots at ±1, the join ring of radius 0.64;
//  - the key chip names the marks, clear of the plane's other controls; the card's Look down switch turns it all off;
//  - with the Pick tool, a press 7 css px inside the ring (within its 16 px to the touch) drags the target;
//  - M3 with the Pick tool: a drag on the ring (at its top, and over a lit patch) or on a line moves the target with the
//    pointer, its centre and its ring to a pixel;
//  - sin z, |w − 0.5| < 0.2, infinitely many critical points: crosses at π/2 + kπ in the window, again after a pan;
//  - on a phone the card is in the disc's row in Shapes, and Look down draws (steps_lookdown_phone_cmd.js has the rest).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LOAD_MS = 40000, READY_MS = 60000;
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const until = (expr, max = READY_MS) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const M1 = [{ type: 'pown', params: { n: 2 }, on: true }];
const M2 = [{ type: 'joukowski', params: {}, on: true }];
const M3 = [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }];
const open = async (steps, shapes, cam = [0, 0, 80], phone = false) => {
  const ns = `lookdown-${Date.now()}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes, steps, nextId: 50, focus: 0, srcView: { cx: cam[0], cy: cam[1], s: cam[2] } };
  await (phone ? view(360, 640, false, true) : view(1440, 900, false, false));
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')", LOAD_MS);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
  await frames();
};
const select = async (id) => { await ev(`__cmwSelect(${JSON.stringify(id)}); 1`); await until(`__cmwShapes().selected === ${JSON.stringify(id)}`); await frames(); await frames(); };
const look = () => ev('typeof __cmwLookDown === "function" ? __cmwLookDown() : null');
// a plane point's place in the pane's css px (the marks' frame), from the page's own coordinates
const at = async (re, im) => { const [x, y] = await ev(`__cmwPlaneMenu().w2s('L', ${re}, ${im})`), o = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left, r.top]; })()`); return [x - o[0], y - o[1]]; };
const near = (p, q, tol = 0.75) => !!p && !!q && Math.hypot(p[0] - q[0], p[1] - q[1]) <= tol;
const has = (list, q) => (list || []).some((p) => near(p, q));
const ink = (re, im, r = 3) => ev(`__cmwOverlayInk('L', [${re}, ${im}], ${r})`);
const S4 = Math.sqrt(0.4);

// M1
await open(M1, [{ id: 'd', kind: 'disc', c: [1, 0], r: 0.5, stage: 1 }]);
await select('d');
let L = await look();
const c1 = await at(1, 0), e1 = await at(1.5, 0), j1 = await at(2, 0), o1 = await at(0, 0), m1 = await at(-1, 0);
info.m1 = L;
ok('M1: Look down draws for the selected disc of w₁', !!L && L.id === 'd', L);
ok('M1: the ring about 1, of radius 0.5', !!L && near(L.c, c1) && Math.abs(L.r - (e1[0] - c1[0])) <= 0.75, L && [L.c, L.r, c1, e1]);
ok('M1: lines from the preimages ±1 to the target', !!L && L.lines.length === 2 && L.lines.every((l) => near([l[2], l[3]], c1)) && L.lines.some((l) => near([l[0], l[1]], m1)), L && L.lines);
ok('M1: the critical point 0, a cross, and its value 0, a dot', !!L && has(L.crit, o1) && has(L.vals, o1), L && [L.crit, L.vals]);
ok('M1: the join ring of radius 1', !!L && Math.abs(L.join - (j1[0] - c1[0])) <= 0.75, L && L.join);
const inks = [await ink(1.5, 0), await ink(0, 0), await ink(1, 1)];
ok('M1: the overlay holds ink on the ring, at the critical point and on the join ring', inks.every((n) => n > 0), inks);
const chip = await ev(`(() => { const k = document.querySelector('#plotL .ld-key'); if (!k || k.hidden) return null; const r = k.getBoundingClientRect(), o = document.getElementById('overlayL').getBoundingClientRect(); return { text: k.textContent, box: [r.left - o.left, r.top - o.top, r.right - o.left, r.bottom - o.top], pane: [o.width, o.height] }; })()`);
info.key = chip;
ok('the key chip names the marks', !!chip && ['target', 'to the target', 'critical point', 'critical value', 'join radius'].every((w) => chip.text.includes(w)), chip);
ok('the key\'s marks are a list of five, said one by one', !!L && L.key === 'Look down; target; to the target; critical point; critical value; join radius' && (await ev(`document.querySelectorAll('#plotL .ld-key [role=list] > [role=listitem]').length`)) === 5, L && L.key);
const chrome = await ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(); return [...document.querySelectorAll('#plotL > .chip, #plotL > .legend-chip, #plotL > .options, #plotL > .viewstack, #plotL > .empty-chip')].filter((e) => !e.hidden && e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return [r.left - o.left, r.top - o.top, r.right - o.left, r.bottom - o.top]; }); })()`);
const meets = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
ok('the key chip lies in the pane, clear of its other controls', !!chip && chip.box[0] >= 0 && chip.box[1] >= 0 && chip.box[2] <= chip.pane[0] && chip.box[3] <= chip.pane[1] && !chrome.some((b) => meets(b, chip.box)), { chip, chrome });

// the Pick tool: a press inside the ring's 16 px drags the target
await ev(`(() => { const b = document.querySelector('.tool[data-tool="pick"]'); if (b) b.click(); return 1; })()`);
await until(`__cmwPick().tool === 'pick'`);
const o = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left, r.top]; })()`);
const p0 = [o[0] + e1[0] - 7, o[1] + e1[1]];
await drag(p0[0], p0[1], p0[0], p0[1] - 40, 10, 16);
await until(`__cmwShapes().shapes.some((s) => s.id === 'd' && Math.abs(s.c[1]) > 0.05)`, 10000);
const moved = await ev(`__cmwShapes().shapes.find((s) => s.id === 'd').c`);
info.moved = moved;
ok('with the Pick tool, a press 7 px inside the ring drags the target', Math.abs(moved[1]) > 0.05, moved);

// the switch
await open(M1, [{ id: 'd', kind: 'disc', c: [1, 0], r: 0.5, stage: 1 }]);
await select('d');
await ev(`(() => { const c = document.querySelector('#propsPanel .ro-card input[type=checkbox]'); c.click(); return 1; })()`);
await frames(); await frames();
ok('the card\'s Look down switch turns the marks and the key off', (await look()) === null && (await ev(`(() => { const k = document.querySelector('#plotL .ld-key'); return !k || k.hidden; })()`)), await look());

// M3
await open(M3, [{ id: 'd', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }]);
await select('d');
L = await look();
info.m3 = L;
const c3 = await at(1.1, 0), j3 = await at(1.1 + Math.abs(1.1 - (0.3 + 0.8 * S4)), 0);
ok('M3: three lines to the target', !!L && L.lines.length === 3 && L.lines.every((l) => near([l[2], l[3]], c3)), L && L.lines);
ok('M3: crosses at ±√0.4', !!L && has(L.crit, await at(S4, 0)) && has(L.crit, await at(-S4, 0)), L && L.crit);
ok('M3: dots at 0.3 ∓ 0.8√0.4', !!L && has(L.vals, await at(0.3 - 0.8 * S4, 0)) && has(L.vals, await at(0.3 + 0.8 * S4, 0)), L && L.vals);
ok('M3: the join ring of radius 0.294', !!L && Math.abs(L.join - (j3[0] - c3[0])) <= 0.75, L && [L.join, j3[0] - c3[0]]);

// M3 with the Pick tool: a press on the target's marks, 30 px right, drags the target with the pointer: its centre moves in
// the plane as the pointer does, and the ring is drawn about the pointer's new place. Pressed at the ring's top, at its right
// end (where it crosses the lit patch of the preimage 1.34) and at the middle of the line from −0.67 + 0.38i
const dragMark = async (name, where) => {
  await open(M3, [{ id: 'd', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }]);
  await select('d');
  await ev(`(() => { const b = document.querySelector('.tool[data-tool="pick"]'); if (b) b.click(); return 1; })()`);
  await until(`__cmwPick().tool === 'pick'`);
  const L0 = await look(), o = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left, r.top]; })()`);
  const p = await where(L0), a = [o[0] + p[0], o[1] + p[1]], b = [a[0] + 30, a[1]];
  const za = await ev(`__cmwPlaneMenu().s2w('L', ${a[0]}, ${a[1]})`), zb = await ev(`__cmwPlaneMenu().s2w('L', ${b[0]}, ${b[1]})`);
  const want = [1.1 + zb[0] - za[0], zb[1] - za[1]], px = Math.hypot(zb[0] - za[0], zb[1] - za[1]) / 30;
  await drag(a[0], a[1], b[0], b[1], 10, 16);
  await until(`__cmwShapes().shapes.some((s) => s.id === 'd' && s.c[0] !== 1.1)`, 10000);
  await frames(); await frames();
  const c = await ev(`__cmwShapes().shapes.find((s) => s.id === 'd').c`), L1 = await look();
  info['pick ' + name] = { p, c, want, from: L0 && L0.c, to: L1 && L1.c };
  ok(`M3, Pick: a drag on ${name} moves the target's centre with the pointer, to a pixel`, Math.hypot(c[0] - want[0], c[1] - want[1]) <= 1.5 * px, { c, want, px });
  ok(`M3, Pick: after a drag on ${name} the ring is drawn 30 px right of where it was, to a pixel`, !!L0 && !!L1 && Math.hypot(L1.c[0] - L0.c[0] - 30, L1.c[1] - L0.c[1]) <= 1.5, { from: L0 && L0.c, to: L1 && L1.c });
};
await dragMark('the ring\'s top', () => at(1.1, 0.25));
await dragMark('the ring\'s right end, over a lit patch', () => at(1.35, 0));
await dragMark('a line', (L) => { const l = L.lines.find((q) => q[1] < q[3] - 10); return [(l[0] + l[2]) / 2, (l[1] + l[3]) / 2]; });

// M2
await open(M2, [{ id: 'd', kind: 'disc', c: [0.6, 0.5], r: 0.35, stage: 1 }]);
await select('d');
L = await look();
info.m2 = L;
const c2 = await at(0.6, 0.5), j2 = await at(0.6 + Math.hypot(0.4, 0.5), 0.5);
ok('M2: crosses and dots at ±1', !!L && has(L.crit, await at(1, 0)) && has(L.crit, await at(-1, 0)) && has(L.vals, await at(1, 0)) && has(L.vals, await at(-1, 0)), L && [L.crit, L.vals]);
ok('M2: the join ring of radius 0.64', !!L && Math.abs(L.join - (j2[0] - c2[0])) <= 0.75, L && L.join);

// sin z: the critical points π/2 + kπ are infinitely many; those in the window are drawn, and again after a pan
const SIN = [{ type: 'custom', params: { expr: 'sin(z)' }, on: true }];
await open(SIN, [{ id: 'd', kind: 'disc', c: [0.5, 0], r: 0.2, stage: 1 }], [0, 0, 60]);
await select('d');
const crossesAt = async () => {
  const L = await look(), want = [];
  for (let k = -12; k <= 12; k++) { const p = await at(Math.PI / 2 + k * Math.PI, 0), pane = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.width, r.height]; })()`); if (p[0] > 4 && p[0] < pane[0] - 4 && p[1] > 4 && p[1] < pane[1] - 4) want.push(p); }
  return { L, want, okay: !!L && want.length >= 3 && want.every((p) => has(L.crit, p)) && L.crit.length === want.length };
};
let sx = await crossesAt();
info.sin = [sx.L && sx.L.crit, sx.want];
ok('sin z: a cross at each π/2 + kπ in the window, and no other', sx.okay, [sx.L && sx.L.crit, sx.want]);
const pc = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
await drag(pc[0], pc[1], pc[0] - 230, pc[1], 12, 16);
await frames(); await frames();
const panned = await ev(`__cmwPlaneMenu().view('L').cx`);
// (the press on the plane let go of the disc: it is selected again)
await select('d');
sx = await crossesAt();
info.sinPan = [sx.L && sx.L.crit, sx.want];
ok('sin z, the view panned: the crosses follow, at each π/2 + kπ in the window', panned > 1 && sx.okay, [panned, sx.L && sx.L.crit, sx.want]);

// on a phone the card is in the disc's row, and Look down draws
await open(M1, [{ id: 'd', kind: 'disc', c: [1, 0], r: 0.5, stage: 1 }], [0, 0, 80], true);
await select('d');
const phoneL = await look(), phoneKey = await ev(`(() => { const k = document.querySelector('#plotL .ld-key'); return !!k && !k.hidden; })()`);
info.phone = [phoneL, phoneKey];
ok('on a phone, the card in the disc\'s row, Look down draws, with its key', !!phoneL && phoneL.id === 'd' && phoneKey, info.phone);
return { pass: fails.length === 0, passed: pass, fails, info };
