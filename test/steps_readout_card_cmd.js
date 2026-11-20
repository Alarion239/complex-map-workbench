// The readout card of a disc of a later plane, in the Inspector of the steps view (the Stack's P1b, #1983): selected on
// plane z, a disc on w₁ reads its preimage there. The plan's test maps:
//  - M3 z³ − 1.2z + 0.3, the disc |w − 1.1| < 0.25: "3 preimages · 3 pieces", red ticks on the r slider at the join
//    radii 0.294 and 1.306 (the distances from 1.1 to the critical values 0.3 ∓ 0.8√0.4), placed on the track at r over
//    the slider's top, and the radii in words; the slider moved to about 0.35, the disc's radius follows and the card reads
//    "3 preimages · 2 pieces · one covers the disc twice"; the counts in Russian;
//  - M2 Joukowski, |w − 0.6 − 0.5i| < 0.35: 2 pieces, the first tick at 0.64; at r = 1.70, one piece with a hole;
//  - M1 z², |w − 1| < 0.5, with the camera on z = 1 close up: the piece about −1 is off the window, and the card says
//    "1 piece off view", as the plane's description does (#1770); with a second disc of w₁ counted as well (about 1.6,
//    its piece about −1.26 off the window too), each count on the plane carries its disc's name (#1892);
//  - a disc of plane z itself, selected on z, gets no card.
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
const open = async (lang, steps, shapes, cam = [0, 0, 80]) => {
  const ns = `readoutcard-${lang}-${Date.now()}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes, steps, nextId: 50, focus: 0, srcView: { cx: cam[0], cy: cam[1], s: cam[2] } };
  await view(1440, 900, false, false);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')", LOAD_MS);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
  await frames();
};
// the card of shape id, selected, or null
const card = async (id) => { await ev(`__cmwSelect(${JSON.stringify(id)}); 1`); await until(`__cmwShapes().selected === ${JSON.stringify(id)}`); await frames(); await frames(); return ev('typeof __cmwReadout === "function" ? __cmwReadout() : null'); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// a tick sits on the track at r / top of the way from the thumb's centre at 0 (5 css px in) to its centre at the top
const tickAt = (t, top) => near(t.x, 5 + (t.w - 10) * (t.r / top), 1.5);
const said = () => ev(`(() => { const c = document.getElementById('overlayL'), id = c && c.getAttribute('aria-describedby'), e = id && document.getElementById(id); return e ? e.textContent : ''; })()`);

// M3
const S4 = Math.sqrt(0.4), J3 = [1.1 - (0.3 - 0.8 * S4), 0.3 + 0.8 * S4 - 1.1].map(Math.abs).sort((a, b) => a - b);
await open('en', M3, [{ id: 'm3', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }]);
let c = await card('m3');
info.m3 = c;
ok('M3: the selected disc of w₁ has a readout card', !!c && c.id === 'm3', c);
ok('M3 at r = 0.25: "3 preimages · 3 pieces"', !!c && c.counts === '3 preimages · 3 pieces', c && c.counts);
ok('M3: a tick at each join radius, 0.294 and 1.306', !!c && c.ticks.length === 2 && c.ticks.every((t, i) => near(t.r, J3[i], 1e-6)), c && c.ticks);
ok('M3: the ticks sit on the track at r over the slider\'s top', !!c && c.ticks.length > 0 && c.ticks.every((t) => tickAt(t, c.max)), c && [c.ticks, c.max]);
ok('M3: the join radii in words', !!c && c.joins === 'Pieces join at r = 0.294, 1.306', c && c.joins);
ok('M3: the slider at the disc\'s radius', !!c && near(c.r, 0.25, 1e-9), c && c.r);
// (the slider moved to about 0.35: it takes the nearest of its steps)
const moved = await ev(`(() => { const r = document.querySelector('#propsPanel .ro-r'); r.value = '0.35'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); return +r.value; })()`);
await until(`__cmwShapes().shapes.some((s) => s.id === 'm3' && Math.abs(s.r - ${moved}) < 1e-12)`);
await frames(); await frames();
c = await ev('__cmwReadout()');
info.m3b = [moved, c];
ok('M3: the slider moved to about 0.35 sets the disc\'s radius', near(moved, 0.35, 0.01) && near(await ev(`__cmwShapes().shapes.find((s) => s.id === 'm3').r`), moved, 1e-12), moved);
ok('M3 at r ≈ 0.35: "3 preimages · 2 pieces · one covers the disc twice"', !!c && c.counts === '3 preimages · 2 pieces · one covers the disc twice', c && c.counts);
await open('ru', M3, [{ id: 'm3', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }]);
c = await card('m3');
ok('M3 in Russian: "3 прообраза · 3 части"', !!c && c.counts === '3 прообраза · 3 части', c && c.counts);

// M2
await open('en', M2, [{ id: 'm2', kind: 'disc', c: [0.6, 0.5], r: 0.35, stage: 1 }, { id: 'm2b', kind: 'disc', c: [0.6, 0.5], r: 1.7, stage: 1 }]);
c = await card('m2');
info.m2 = c;
ok('M2 at r = 0.35: "2 preimages · 2 pieces"', !!c && c.counts === '2 preimages · 2 pieces', c && c.counts);
ok('M2: the first tick at 0.64', !!c && c.ticks.length > 0 && near(c.ticks[0].r, Math.hypot(0.4, 0.5), 1e-6), c && c.ticks);
c = await card('m2b');
info.m2b = c;
ok('M2 at r = 1.70: one piece with a hole', !!c && /· 1 piece\b/.test(c.counts) && / 1 hole$/.test(c.counts), c && c.counts);

// M1, a piece off the window
await open('en', M1, [{ id: 'm1', kind: 'disc', c: [1, 0], r: 0.5, stage: 1 }], [1, 0, 400]);
c = await card('m1');
info.m1 = c;
ok('M1: "2 preimages · 2 pieces"', !!c && c.counts === '2 preimages · 2 pieces', c && c.counts);
ok('M1, the camera on z = 1: the card says "1 piece off view"', !!c && c.off === '1 piece off view', c && c.off);
const sm1 = await said();
info.saidM1 = sm1;
ok('M1: the plane\'s description says 1 of its 2 pieces is off view', /: 1 of its 2 pieces is off view\./.test(sm1), sm1);
await open('en', M1, [{ id: 'm1', kind: 'disc', c: [1, 0], r: 0.5, stage: 1 }, { id: 'm1b', kind: 'disc', c: [1.6, 0], r: 0.08, stage: 1 }], [1, 0, 400]);
const two = await ev('__cmwPullOff()');
info.two = two;
ok('M1 with two discs counted: each count on the plane carries its disc\'s name', Array.isArray(two) && two.length === 2 && two.every((e) => /^.+: \+\d+ off view$/.test(e.text)), two);

// a disc of plane z
await open('en', M1, [{ id: 'z1', kind: 'disc', c: [0.5, 0.5], r: 0.3 }]);
c = await card('z1');
ok('a disc of plane z itself gets no card on z', c === null, c);
return { pass: fails.length === 0, passed: pass, fails, info };
