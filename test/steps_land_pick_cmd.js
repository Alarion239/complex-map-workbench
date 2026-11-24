// The pick on the Landscape's sheets (19-land-pick.js, #1995): the steps view's Landscape parked on w₁ and coloured from z
// carries plane z's points to w₁, so over each w it draws a sheet for each preimage of w in z's box, at its height (Re z).
// On M3, z³ − 1.2z + 0.3, with real pointer events:
//  - the Pick tool picks here, and choosing it says nothing about drawing being off;
//  - the point under the pointer is a sheet's: over a grid of the pane, each pixel where the pick meets a sheet gives a
//    point z of plane z with M3(z) = w, the point of w₁ under it; the pick meets sheets on both sides of the real axis;
//  - a click lights the twins of the point it picked: the three preimages of its w (M3's roots, to 1e-9), said in the
//    live region, the pressed point a mark at the click and each twin a mark on its own sheet, one shown whole being
//    the sheet's point under it; they are the floor picker's lit twins, the very record a click at z on plane z writes
//    (the same three points, to the click's pixel, 1e-6);
//  - Esc puts the twins out; a press held lights the twins of the point under it and follows the pointer over the sheets,
//    and where it lifts the live region says them; a press that moves before the hold turns the camera, with no point
//    lit; Enter on the focused plane lights the twins of the point under the centre, or says there is none;
//  - z² lights two twins, z and −z; sin z (no exact inverse: Newton's method from a grid) lights twins that each map to
//    the picked point's image, the picked point among them;
//  - no page exception or console error.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return !!cond; };
const until = (expr, max = 60000) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const REL = 1e-9;             // the twins against M3's roots, and against the floor picker's
const MAP_TOL = 1e-6;         // a picked point's image against the point of w₁ under it, relative
const Z_TOL = 1e-6;           // the same point of z found two ways (a pick, a mark's, a lit record's), relative
const PX_TOL = 0.5;           // css px: the pressed point's mark against the pixel clicked
const GRID = 16;              // the grid of the pane the pick is tried at, GRID − 1 a side
const MIN_HITS = 20;          // the grid's pixels where the pick meets a sheet, at least (M3; half of it for z², sin z)
const HOLD_WAIT = 4000;       // ms: a held press's twins light within this (the hold is STACK_HOLD_MS, 450)
const TURN = 0.05;            // rad: a quick drag turns the camera at least this much
// the chains' maps of plane z to w₁ ([re, im] points)
const mul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
const M3 = ([x, y]) => { const z3 = mul(mul([x, y], [x, y]), [x, y]); return [z3[0] - 1.2 * x + 0.3, z3[1] - 1.2 * y]; };
const SQ = (z) => mul(z, z);
const SIN = ([x, y]) => [Math.sin(x) * Math.cosh(y), Math.cos(x) * Math.sinh(y)];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const close = (a, b, tol = REL) => !!a && !!b && dist(a, b) <= tol * (1 + Math.hypot(...b));
// the three roots of z³ − 1.2z + 0.3 − w (Durand–Kerner)
const roots3 = (w) => {
  const div = ([a, b], [c, d]) => { const n = c * c + d * d; return [(a * c + b * d) / n, (b * c - a * d) / n]; };
  let r = [[0.4, 0.9], [-0.65, 0.72], [-0.92, -0.36]];
  for (let it = 0; it < 200; it++) {
    r = r.map((z, i) => {
      let q = [1, 0];
      r.forEach((u, j) => { if (j !== i) q = mul(q, [z[0] - u[0], z[1] - u[1]]); });
      const v = M3(z), d = div([v[0] - w[0], v[1] - w[1]], q);
      return [z[0] - d[0], z[1] - d[1]];
    });
  }
  return r;
};
// each of a's points within tol of one of b's, and as many
const sameSet = (a, b, tol = REL) => !!a && !!b && a.length === b.length && a.every((p) => b.some((q) => close(p, q, tol)));
const pts = (l) => (l ? l.zs.map((q) => [q[0], q[1]]) : null);

const open = async (expr) => {
  const ns = `lpick-${Date.now()}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [{ type: 'custom', params: { expr }, on: true }], nextId: 50 };
  await view(1440, 900, false, false);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')", 40000);
  await until('__cmwSteps().ready.ready');
  await ev(`__cmwSteps({ T: 0, surf: 'land' }); 1`);
  await ev(`__cmwSteps({ go: 1, now: true }); 1`);
  await until(`__cmwSteps().i === 1 && __cmwSteps().surf === 'land' && !__cmwSteps().moving`, 40000);
  await ev(`(document.querySelector('#heightSeg button[data-v="re"]') || {}).click?.(), 1`);
  await settled({ max: 60000 });
  await frames();
  await key('x');
  await settled({ panes: false, until: `__cmwPick().tool === 'pick'` });
};
const pane = () => ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(); return [o.left, o.top, o.width, o.height]; })()`);
const LP = (x, y) => ev(`typeof __cmwLandPick === 'function' ? __cmwLandPick(${x == null ? '' : `${x}, ${y}`}) : { on: false, s: null, size: null, hit: null, marks: [] }`);
const mouse = (type, x, y, o = {}) => send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'none', pointerType: 'mouse' }, o));
const pressAt = (x, y) => mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 });
const liftAt = (x, y) => mouse('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 });
const clickAt = async (x, y) => { await mouse('mouseMoved', x, y); await pressAt(x, y); await liftAt(x, y); await frames(); };
// the grid's pixels where the pick meets a sheet: [{x, y (pane css px), X, Y (page px), z, w, h}]
const grid = async () => {
  const r = await pane(), out = [];
  for (let j = 1; j < GRID; j++) for (let i = 1; i < GRID; i++) {
    const x = (r[2] * i) / GRID, y = (r[3] * j) / GRID, h = (await LP(x, y)).hit;
    if (h) out.push(Object.assign({ x, y, X: r[0] + x, Y: r[1] + y }, h));
  }
  return out;
};
const lit = () => ev('__cmwPick().lit');
const live = () => ev('__cmwPick().live');
logs(true);

// ---- M3, parked on w₁, coloured from z
await open('z^3-1.2z+0.3');
const lp0 = await LP(), pk0 = await ev('__cmwPick()');
ok('the Landscape on w₁ coloured from z picks on its sheets, of plane z', lp0.on && lp0.s === 0, lp0);
ok('the Pick tool picks here, and its button shows', pk0.avail && pk0.shown, pk0);
const chip = await ev(`(document.getElementById('sphereChipL') || {}).textContent || ''`);
ok('choosing the Pick tool on the sheets says nothing about drawing being off', !/Drawing is off/.test(chip), chip);

const hits = await grid();
info.hits = hits.length;
ok(`the pick meets a sheet at ${MIN_HITS} or more of the grid's pixels`, hits.length >= MIN_HITS, hits.length);
const badMap = hits.filter((h) => !close(M3(h.z), h.w, MAP_TOL));
ok('each point picked maps to the point of w₁ under it', hits.length > 0 && badMap.length === 0, badMap.slice(0, 3));
ok('the pick meets sheets on both sides of the real axis of z', hits.some((h) => h.z[1] > 0.05) && hits.some((h) => h.z[1] < -0.05), hits.map((h) => h.z));

// (with no sheet picked, the rows below have nothing to press)
if (!hits.length) return { pass: false, fails, info };

// a click lights the twins
const h = hits[Math.floor(hits.length / 2)];
await clickAt(h.X, h.Y);
const l1 = await lit(), live1 = await live();
info.click = { h, lit: l1, live: live1 };
ok('a click lights the twins of the point it picked: the three preimages of its w', !!l1 && l1.k === 0 && l1.T === 1 && close(l1.z0, h.z, Z_TOL) && sameSet(pts(l1), roots3(l1.w)), l1);
ok('the live region says how many', /3 preimages on z/.test(live1 || ''), live1);
const m1 = (await LP()).marks, own = m1.find((m) => m.own);
ok('the pressed point is a mark at the click, shown whole, and each twin a mark', m1.length === 3 && !!own && Math.hypot(own.x - h.x, own.y - h.y) <= PX_TOL && !own.hidden, m1);
for (const m of m1.filter((q) => !q.own && !q.hidden)) {
  const q = (await LP(m.x, m.y)).hit;
  ok(`a twin's mark shown whole is its sheet's point under it (${m.z.map((v) => v.toFixed(3))})`, !!q && close(q.z, m.z, Z_TOL), { m, q });
}

// one record: the floor picker's click at that z on plane z
const z0 = l1.z0;
await ev(`__cmwSteps({ surf: 'plane', go: 0, now: true }); 1`);
await until(`__cmwSteps().i === 0 && __cmwSteps().surf === 'plane' && !__cmwSteps().moving`, 40000);
await ev(`__cmwSteps({ T: 1 }); 1`);
await settled({ max: 40000 });
// (a change of Surface takes the tool back to Select)
await key('x');
await settled({ panes: false, until: `__cmwPick().tool === 'pick' && __cmwPick().avail` });
const zp = await ev(`__cmwPlaneMenu().w2s('L', ${z0[0]}, ${z0[1]})`);
await clickAt(zp[0], zp[1]);
const lf = await lit();
info.floor = lf;
// (the floor's click picks the pixel's point, within a pixel's rounding of z: Z_TOL)
ok('a click at that z on plane z (the floor picker) writes the same twins', !!lf && lf.k === 0 && lf.T === 1 && close(lf.z0, z0, Z_TOL) && sameSet(pts(lf), pts(l1), Z_TOL), { landscape: l1, floor: lf });

// back on the sheets: Esc, a held press, a quick drag, Enter
await ev(`__cmwSteps({ T: 0 }); 1`);
await ev(`__cmwSteps({ surf: 'land', go: 1, now: true }); 1`);
await until(`__cmwSteps().i === 1 && __cmwSteps().surf === 'land' && !__cmwSteps().moving && __cmwLandPick().on`, 40000);
await settled({ max: 40000 });
await key('x');
await settled({ panes: false, until: `__cmwPick().tool === 'pick'` });
await frames();
await clickAt(h.X, h.Y);
const lb = await lit();
ok('back on the sheets, a click at the same pixel lights the same twins', !!lb && sameSet(pts(lb), pts(l1)), lb);
await key('Escape');
await frames();
ok('Esc puts the lit twins out', !(await lit()), await lit());
const [a, b] = [hits[Math.floor(hits.length / 3)], hits[Math.floor((2 * hits.length) / 3)]];
await mouse('mouseMoved', a.X, a.Y);
await pressAt(a.X, a.Y);
await until('!!__cmwPick().lit', HOLD_WAIT);
const lh = await lit();
ok('a press held lights the twins of the point under it', !!lh && close(lh.z0, a.z, Z_TOL), { lh, a });
for (let i = 1; i <= 8; i++) await mouse('mouseMoved', a.X + ((b.X - a.X) * i) / 8, a.Y + ((b.Y - a.Y) * i) / 8, { button: 'left', buttons: 1 });
await frames();
const lm = await lit();
ok('it follows the pointer over the sheets', !!lm && close(lm.z0, b.z, Z_TOL) && close(M3(lm.z0), lm.w, MAP_TOL), { lm, b });
await liftAt(b.X, b.Y);
await frames();
const live3 = await live();
ok('where it lifts, the live region says the twins', /3 preimages on z/.test(live3 || ''), live3);
await key('Escape');
const yaw0 = (await ev(`__cmwCam('L')`)).yaw;
await mouse('mouseMoved', a.X, a.Y);
await pressAt(a.X, a.Y);
for (let i = 1; i <= 8; i++) await mouse('mouseMoved', a.X + 10 * i, a.Y, { button: 'left', buttons: 1 });
await liftAt(a.X + 80, a.Y);
await frames();
const yaw1 = (await ev(`__cmwCam('L')`)).yaw, l4 = await lit();
ok('a press that moves before the hold turns the camera, with no point lit', Math.abs(yaw1 - yaw0) > TURN && !l4, { yaw0, yaw1, lit: l4 });
// (the drag left the camera turning on its momentum: stopped where it is, so the centre's point stays put)
await ev(`(() => { const c = __cmwCam('L'); __cmwCam('L', { yaw: c.yaw, pitch: c.pitch }); return 1; })()`);
await frames();
for (let i = 0; i < 8 && (await ev('document.activeElement && document.activeElement.id')) !== 'overlayL'; i++) await key('F6');
await key('Enter');
await frames();
const sz = (await LP()).size, lk = await lit(), live2 = await live(), centre = (await LP(sz[0] / 2, sz[1] / 2)).hit;
ok('Enter on the focused plane lights the twins of the point under the centre, or says there is none', centre ? !!lk && close(lk.z0, centre.z, Z_TOL) : /No sheet under the centre/.test(live2 || ''), { lk, centre, live2 });

// ---- z²: two twins, z and −z
await open('z^2');
const h2 = await grid();
if (ok('z²: the pick meets its sheets', h2.length >= MIN_HITS / 2, h2.length)) {
  const p = h2[Math.floor(h2.length / 2)];
  await clickAt(p.X, p.Y);
  const l = await lit(), z = pts(l);
  ok('z²: a click lights two twins, z and −z', !!z && z.length === 2 && z.every((q) => close(SQ(q), l.w, MAP_TOL)) && close([-z[0][0], -z[0][1]], z[1], Z_TOL), l);
}

// ---- sin z: no exact inverse, the twins from Newton's method
await open('sin(z)');
const hs = await grid();
if (ok('sin z: the pick meets its sheets', hs.length >= MIN_HITS / 2, hs.length)) {
  const p = hs[Math.floor(hs.length / 2)];
  ok('sin z: the point picked maps to the point of w₁ under it', close(SIN(p.z), p.w, MAP_TOL), p);
  await clickAt(p.X, p.Y);
  const l = await lit(), z = pts(l);
  info.sin = l;
  ok('sin z: a click lights twins that each map to the picked point\'s image, the picked point among them', !!z && z.length >= 1 && z.every((q) => close(SIN(q), l.w, MAP_TOL)) && z.some((q) => close(q, p.z, Z_TOL)), l);
}

const bad = logs(true).filter((e) => e.t === 'EXC' || e.t === 'error');
ok('no page exception or console error', bad.length === 0, bad.slice(0, 3));
return { pass: fails.length === 0, fails, info };
