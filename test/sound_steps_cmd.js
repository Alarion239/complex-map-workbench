// Hear the function in the steps view (#580, behind ?view=steps). The sound plays what the colours show: the map from
// the shown plane into the colour plane, which the probe readout reads too (Pietro's call, 1 Nov). On the chain
// z → w₁ = z² → w₂ = (w₁ − 1)/(w₁ + 1), with Hear the function on (Notes):
//  * at rest the probe hears that map: F on z, f₂ on w₁ (also on the Sphere and the Landscape), and on a phone a
//    finger's hold-and-slide, whose lift feeds one last step;
//  * the map changes under a still pointer: a glide to another plane, C (the colour plane), a view parked past the
//    half-way point, ▶ to its end, another plane on the Landscape. The tone re-seats on the new map at the pointer's
//    point, silently (a seat): never one stroke across two maps, which the tracker reads as a branch cut (the crack, and
//    "Branch cut: F jumps by a factor …");
//  * the keyboard probe's Z and D on w₁ read f₂'s one zero and one pole under f₂'s name, not z's landmarks;
//  * Listen along a circle of plane w₁ plays it where it is drawn on w₁ (W = 0 round 0.8i), and from z it says the curve
//    is in a later plane; a loop drawn on w₁ has f₂'s winding number.
// What the stream hears is read from Sound.hear's calls (seat, step, cut, pathless, gap) and __cmwSound().
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, R }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
logs();
const ns = 'sndsv' + Date.now();
// (a circle of plane w₁ round 0.8i, r 0.3: f₂ has no zero or pole inside; its points read as points of z and squared
// would enclose f₂'s pole −1)
const ST = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 120 },
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'custom', params: { expr: '(z-1)/(z+1)' }, on: true }],
  shapes: [{ id: 'c1', kind: 'circle', c: [0, 0.8], r: 0.3, ci: 0, visible: true, stage: 1 }] };
const open = async (w, h, mobile) => {
  await view(w, h, false, mobile);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(ST))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function'` }); await settle(600);
  // sound with Hear the function in Notes, and Mathematical events (Listen along); the stream's calls logged in __hl
  await ev(`Sound.set({ on: true, sonify: true, events: true, glide: false }); 1`); await settle(500);
  await ev(`(() => { const H = Sound.hear; window.__hl = []; for (const k of ['step', 'seat', 'cut', 'pathless', 'gap']) { const f = H[k]; H[k] = function (s) { __hl.push(k === 'gap' ? { k } : { k, phi: s.phi, ln: s.ln, src: s.src, lift: !!s.lift }); return f.apply(this, arguments); }; } return 1; })()`);
};
const hl = () => ev(`(() => { const l = (window.__hl || []).slice(); __hl.length = 0; return l; })()`);
const S = () => ev('__cmwSteps()');
const rest = async () => { for (let i = 0; i < 150; i++) { const s = await S(); if (!s.moving) return s; await sleep(100); } return S(); };
const snd = () => ev('__cmwSound()');
const W = (re, im) => ev(`__cmwW2S('L', ${re}, ${im})`);
const svDo = async (o, ms = 600) => { await ev(`__cmwSteps(${JSON.stringify(o)}); 1`); await settle(ms); };
// the maps heard: F on z, f₂ on w₁, and the plane's own variable on the colour plane w₂
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const F = (z) => { const z2 = mul(z, z); return div([z2[0] - 1, z2[1]], [z2[0] + 1, z2[1]]); };
const f2 = (w) => div([w[0] - 1, w[1]], [w[0] + 1, w[1]]);
const id = (w) => w;
const near = (a, b) => !!a && !!b && Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-9 * Math.max(1, Math.hypot(b[0], b[1]));
// a hover that ends on the plane's point (re, im), from 12 px to its left (the rope then trails 3 px behind it)
const hover = async (re, im) => { const p = await W(re, im); for (let i = 4; i >= 0; i--) { await move(p[0] - 3 * i, p[1]); await sleep(30); } await settle(300); return p; };
// the value heard, against the map at the probe's own (roped) point
const heard = async (Fk) => { const s = await snd(); return { g: s.g, z: s.rest && s.rest.z, ok: !!(s.g && s.rest) && near(s.g, Fk(s.rest.z)) }; };
const noCut = (L, live) => !L.some((e) => e.k === 'cut') && !/Branch cut/.test(live || '');
const seat = (L) => L.some((e) => e.k === 'seat');
// (the re-pick waits for a frame drawn on the new plane: until the stream has a seat, at most ms; the relief's first
// frame of a new plane takes seconds on a software renderer)
const seated = async (ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(`(window.__hl || []).some((e) => e.k === 'seat')`)) return true; await sleep(100); } return false; };
// (a pointer still on the plane's point (re, im): its own point once a re-pick let the rope go)
const atPtr = (z) => !!z && Math.hypot(z[0] - 0.3, z[1] - 0.5) < 0.02;

await open(1440, 900, false);
R.prefs = await ev('Sound.prefs()');
ok('setup: sound and Hear the function on', R.prefs.on && R.prefs.sonify, R.prefs);

// 1. at rest: F on z, f₂ on w₁ as the readout reads it
await svDo({ go: 0, now: true });
await hover(0.3, 0.5);
R.z = await heard(F);
ok('at rest on z: the probe hears F', R.z.ok, R.z);
await svDo({ go: 1, now: true });
let p = await hover(0.3, 0.5);
R.w1 = Object.assign(await heard(f2), { readout: await ev(`(document.getElementById('leftReadout') || {}).innerText || ''`) });
ok('at rest on w₁: the probe hears f₂, the map into the colour plane, as the readout reads it', R.w1.ok && /f₂\(w₁\)/.test(R.w1.readout), R.w1);

// 2. the shown plane changes under a still pointer: a glide from w₁ to w₂, the colour plane
await hl();
await svDo({ go: 2 }, 100); await rest(); await settle(600); await seated();
let s = await snd(), L = await hl();
R.glide = { kinds: L.map((e) => e.k), g: s.g, z: s.rest && s.rest.z, live: s.live };
ok('a glide to w₂ under a still pointer: no branch cut, and the tone re-seats on w₂ at the pointer', noCut(L, s.live) && seat(L) && !!s.rest && near(s.g, id(s.rest.z)) && atPtr(s.rest.z), R.glide);
await sleep(300); await move(p[0] + 6, p[1]); await settle(300);   // (after the 250 ms a view change keeps quiet)
s = await snd(); L = await hl();
R.glideMove = { kinds: L.map((e) => e.k), g: s.g, z: s.rest && s.rest.z, live: s.live };
ok('after the glide the next move is a step on w₂, no branch cut', noCut(L, s.live) && L.some((e) => e.k === 'step') && !!s.rest && near(s.g, id(s.rest.z)), R.glideMove);

// 3. the colour plane changes under a still pointer: C on w₁ makes it the colour plane, then back
await svDo({ go: 1, now: true });
p = await hover(0.3, 0.5); await hl();
await svDo({ T: 1 }, 400); await seated();
s = await snd(); L = await hl();
R.colourPlane = { label: (await S()).label, kinds: L.map((e) => e.k), g: s.g, z: s.rest && s.rest.z, live: s.live };
ok('C on w₁ under a still pointer: the tone re-seats on w₁ as the colour plane, before any move', /the colour plane/.test(R.colourPlane.label) && seat(L) && noCut(L, s.live) && !!s.rest && near(s.g, id(s.rest.z)), R.colourPlane);
await sleep(300); await move(p[0] + 6, p[1]); await settle(300);   // (after the 250 ms a view change keeps quiet)
s = await snd(); L = await hl();
R.colourMove = { kinds: L.map((e) => e.k), live: s.live };
ok('after C the next move is a step, no branch cut', noCut(L, s.live) && L.some((e) => e.k === 'step'), R.colourMove);
await svDo({ T: 2 }, 400); await seated(); await hl();

// 4. a view parked between z and w₁: past the half-way point the nearer plane is w₁
await svDo({ go: 0, now: true });
p = await hover(0.3, 0.5);
await svDo({ park: 0.4 }, 500); await hl();
await svDo({ park: 0.6 }, 500); await seated();
s = await snd(); L = await hl();
R.park = { x: await ev('__cmwSvX()'), kinds: L.map((e) => e.k), g: s.g, z: s.rest && s.rest.z, live: s.live };
ok('parked past the half-way point: the tone re-seats on the nearer plane\'s map, f₂, with no branch cut', seat(L) && noCut(L, s.live) && !!s.rest && near(s.g, f2(s.rest.z)), R.park);
await sleep(300); await move(p[0] + 6, p[1]); await settle(300);   // (after the 250 ms a view change keeps quiet)
s = await snd(); L = await hl();
R.parkMove = { kinds: L.map((e) => e.k), live: s.live };
ok('parked: the next move is a step, no branch cut', noCut(L, s.live) && L.some((e) => e.k === 'step'), R.parkMove);

// 5. ▶ along the thread under a still pointer, from z to w₂
await svDo({ go: 0, now: true });
await hover(0.3, 0.5); await hl();
await svDo({ play: true }, 100);
// (the thread's place alone: the full __cmwSteps() poll starves a play's frames)
for (let i = 0; i < 300; i++) { await sleep(100); if ((await ev('__cmwSvX()')) >= 1.999) break; }
await rest(); await settle(800); await seated();
s = await snd(); L = await hl();
R.play = { label: (await S()).label, kinds: L.map((e) => e.k), g: s.g, z: s.rest && s.rest.z, live: s.live };
ok('▶ under a still pointer: no branch cut on the way or at the end, where the tone is w₂\'s', noCut(L, s.live) && seat(L) && /Plane w₂/.test(R.play.label) && !!s.rest && near(s.g, id(s.rest.z)), R.play);

// 6. the keyboard probe on z, then on w₁: Z and D read the shown plane's map
await svDo({ go: 0, now: true });
await ev(`document.getElementById('overlayL').focus(); 1`); await sleep(100);
await key('z'); await settle(300); R.kz0 = (await snd()).live;
await key('d'); await settle(300); R.kd0 = (await snd()).live;
ok('keyboard probe on z: Z and D read F (two zeros, two poles)', /of 4/.test(R.kz0) && /^F in this view: 2 zeros: [-−]1, 1; 2 poles: [-−]i, i\.$/.test(R.kd0), [R.kz0, R.kd0]);
await svDo({ go: 1, now: true });
await ev(`document.getElementById('overlayL').focus(); 1`); await sleep(100);
await key('z'); await settle(300); R.kz1 = (await snd()).live;
await key('d'); await settle(300); R.kd1 = (await snd()).live;
ok('keyboard probe on w₁: Z goes to one of f₂\'s two landmarks, and D names f₂ with its zero 1 and pole −1', /of 2/.test(R.kz1) && /^f₂ in this view: 1 zero: 1; 1 pole: [-−]1\.$/.test(R.kd1), [R.kz1, R.kd1]);
await key('Escape'); await settle(200);
await ev(`document.getElementById('overlayL').blur(); 1`);

// 7. Listen along the circle of plane w₁ (its editor's button): on w₁ where it is drawn, from z not at all
const listen = async () => { await ev(`__cmwSelect('c1'); 1`); await settle(500); const b = await ev(`(() => { const b = document.querySelector('[data-act=listen-along]'); if (b) b.click(); return !!b; })()`); await sleep(500); const s1 = await snd(); return { button: b, live: s1.live, play: s1.play, fn: s1.listenFn }; };
await svDo({ go: 1, now: true });
R.listen = await listen();
ok('Listen along a circle of w₁, on w₁: the circle as drawn, winding number 0', R.listen.button && /Listening along the loop: 0 turns/.test(R.listen.live), R.listen);
await key('Escape'); await settle(300);
await svDo({ go: 0, now: true });
R.listenLater = await listen();
ok('Listen along a circle of w₁, from z: it says the curve is in a later plane, and plays nothing', R.listenLater.button && /This curve is in w₁, a later plane/.test(R.listenLater.live) && !R.listenLater.play, R.listenLater);
await key('Escape'); await settle(300);
await ev(`__cmwSelect(null); 1`);

// 8. a loop drawn on w₁ round 0.9i: f₂'s winding number 0 (F's would be −1: its pole i)
await svDo({ go: 1, now: true });
const LOOP = Array.from({ length: 48 }, (_, j) => [0.3 * Math.cos(2 * Math.PI * j / 48), 0.9 + 0.3 * Math.sin(2 * Math.PI * j / 48)]);
await ev(`__cmwSound({ loop: ${JSON.stringify(LOOP)} }); 1`); await sleep(300);
R.loop = (await snd()).live;
ok('a loop drawn on w₁: f₂\'s winding number, 0', /^Winding number 0:/.test(R.loop), R.loop);
await key('Escape'); await settle(300);

// 9. the Sphere and the Landscape on w₁; on the Landscape another plane under a still pointer re-seats on its relief
await svDo({ surf: 'sphere' }, 1500);
const c = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
for (let i = 4; i >= 0; i--) { await move(c[0] + 30 - 3 * i, c[1] - 20); await sleep(30); }
await settle(400);
R.sphere = await heard(f2);
ok('the Sphere on w₁: f₂ at the point under the pointer', R.sphere.ok, R.sphere);
await svDo({ surf: 'land' }, 2500);
for (let i = 4; i >= 0; i--) { await move(c[0] + 40 - 3 * i, c[1] + 30); await sleep(30); }
await settle(500);
R.land = await heard(f2);
ok('the Landscape on w₁: f₂ at the point under the pointer', R.land.ok, R.land);
await hl();
await svDo({ go: 2 }, 100); await rest(); await settle(800); await seated(12000);
s = await snd(); L = await hl();
R.landGo ={ kinds: L.map((e) => e.k), g: s.g, z: s.rest && s.rest.z, live: s.live };
ok('the Landscape, w₁ to w₂ under a still pointer: the tone re-seats on w₂\'s relief, no branch cut', seat(L) && noCut(L, s.live) && !!s.rest && near(s.g, id(s.rest.z)), R.landGo);
await svDo({ surf: 'plane' }, 800);
const exc1 = logs().filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || ''));

// 10. a phone: a finger's hold-and-slide on w₁ hears f₂, and its lift feeds one last step
await open(390, 844, true);
await svDo({ go: 1, now: true }, 800);
const b = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
const touch = (type, x, y) => send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const x0 = b[0] - 40, y0 = b[1] - 30;
await touch('touchStart', x0, y0); await sleep(800);
for (let i = 1; i <= 12; i++) { await touch('touchMove', x0 + 5 * i, y0); await sleep(30); }
await sleep(200);
R.phone = Object.assign(await heard(f2), { ptype: (await snd()).ptype });
await touch('touchEnd', x0 + 60, y0); await settle(300);
L = await hl();
R.phone.kinds = L.map((e) => e.k + (e.lift ? '+lift' : '')).join(',');
ok('phone, w₁: a finger\'s hold-and-slide hears f₂', R.phone.ok && R.phone.ptype === 'touch', R.phone);
ok('phone: the lift feeds a last step on the finger\'s point', L.some((e) => e.lift) && noCut(L, ''), R.phone.kinds);

const exc = exc1.concat(logs().filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || '')));
ok('no exceptions', !exc.length, exc.slice(0, 5));
return { pass: !fails.length, nfail: fails.length, fails, R };
