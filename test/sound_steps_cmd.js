// Hear the function in the steps view (#580, #726, behind ?view=steps). Pietro's calls (1 and 2 Nov): the sound plays what
// the colours and the probe readout show, the map from the plane into the colour plane; between two planes the colour as
// it deforms, G_a(p) with h_{b,u}(p) = q, followed exactly as u moves (#726); past the colour plane no tone, and one line
// saying where the colour comes from; ▶ Play along the thread and the strip's scrub ring the Deformation's events. On the
// chain z → w₁ = z² → w₂ = (w₁ − 1)/(w₁ + 1), with Hear the function on (Notes):
//  * at rest the probe hears that map: F on z, f₂ on w₁ (also on the Sphere and the Landscape), and on a phone a
//    finger's hold-and-slide, whose lift feeds one last step;
//  * the colour deforms under a still pointer: a glide to another plane (a slow one heard in every frame it draws), a
//    view parked between z and w₁ (the deformed colour there), ▶ to its end, another plane on the Landscape. The tone
//    follows it with steps, no seat and no branch cut, and lands on the new plane's map;
//  * the map changes under a still pointer: C (the colour plane). The tone re-seats on the new map at the pointer's point,
//    silently (a seat): never one stroke across two maps, which the tracker reads as a branch cut (the crack, and "Branch
//    cut: F jumps by a factor …");
//  * past the colour plane: no tone (the pointer, the click query, Listen along, a loop), one line once a plane, and the
//    keyboard probe's D and Z say it too;
//  * the keyboard probe's Z and D on w₁ read f₂'s one zero and one pole under f₂'s name, not z's landmarks;
//  * Listen along a circle of plane w₁ plays it where it is drawn on w₁ (W = 0 round 0.8i), and from z (in the classic
//    view too) it says the curve is in a later plane; a loop drawn on w₁ has f₂'s winding number;
//  * ▶: the swell once and the arrival once; with Loop on, no arrival on a repeat; the strip's scrub rings its landmarks.
// #726's own checks, on z → w₁ = z⁵ and on z → w₁ = z − 1 (the classic Deformation's z⁵ and z − 1, sound_deform_cmd):
//  * ▶ with the pointer still: a voice update in every frame the thread moved, at that frame's place; the run's turns are
//    the winding of u ↦ G_0(h_{1,u}⁻¹(q)) = q^(5/(1+4u)) at the probe, −4 arg q;
//  * the zero of the colour q + u − 1 passing the still probe as the thread moves: one ping of order 1, and its line.
// What the stream hears is read from Sound.hear's calls (seat, step, cut, pathless, gap, query, each with the thread's place
// then), the cues made from Sound.CATALOG, and __cmwSound().
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
// (st: the state the page opens with, ST by default)
const open = async (w, h, mobile, classic, st = ST) => {
  await view(w, h, false, mobile);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en${classic ? '' : '&view=steps'}` });
  await settled({ max: 30000, until: classic ? `typeof __cmwSound === 'function'` : `typeof __cmwSteps === 'function'` }); await settle(600);
  // sound with Hear the function in Notes, and Mathematical events (Listen along, the play's events); the stream's calls
  // logged in __hl, the cues made in __made
  await ev(`Sound.set({ on: true, sonify: true, events: true, glide: false }); 1`); await settle(500);
  await ev(`(() => { const H = Sound.hear, X = () => (typeof __cmwSvX === 'function' ? __cmwSvX() : null); window.__hl = []; for (const k of ['step', 'seat', 'cut', 'pathless', 'gap', 'query']) { const f = H[k]; H[k] = function (s) { __hl.push(k === 'gap' ? { k, x: X() } : { k, phi: s.phi, ln: s.ln, src: s.src, lift: !!s.lift, x: X() }); return f.apply(this, arguments); }; } return 1; })()`);
  await ev(`(() => { window.__made = []; for (const [k, d] of Object.entries(Sound.CATALOG)) { if (d.__spy) continue; const m = d.make; d.make = (Pt, o) => { __made.push(k); return m(Pt, o); }; d.__spy = 1; } return 1; })()`);
};
const hl = () => ev(`(() => { const l = (window.__hl || []).slice(); __hl.length = 0; return l; })()`);
const made = () => ev(`(() => { const m = (window.__made || []).slice(); __made.length = 0; return m; })()`);
const count = (list, name) => list.filter((x) => x === name).length;
const S = () => ev('__cmwSteps()');
const rest = async () => { for (let i = 0; i < 150; i++) { const s = await S(); if (!s.moving) return s; await sleep(100); } return S(); };
const snd = () => ev('__cmwSound()');
const W = (re, im) => ev(`__cmwW2S('L', ${re}, ${im})`);
const svDo = async (o, ms = 600) => { await ev(`__cmwSteps(${JSON.stringify(o)}); 1`); await settle(ms); };
const speed = (v) => ev(`(() => { const e = document.querySelector('.sv-speed'); if (!e) return false; e.value = '${v}'; e.dispatchEvent(new Event('change')); return true; })()`);
const live = async () => (await snd()).live;
const quiet = () => ev(`(() => { const e = document.getElementById('sndLive'); if (e) e.textContent = ''; return 1; })()`);
// the maps heard: F on z, f₂ on w₁, and the plane's own variable on the colour plane w₂
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const F = (z) => { const z2 = mul(z, z); return div([z2[0] - 1, z2[1]], [z2[0] + 1, z2[1]]); };
const f2 = (w) => div([w[0] - 1, w[1]], [w[0] + 1, w[1]]);
const id = (w) => w;
// (tol: 1e-9 for a map evaluated at the point; the colour deformed between two planes is G at a point found by Newton's
// method, to 1e-9 of q in the glide's map, so to about 1e-7 in G)
const near = (a, b, tol = 1e-9) => !!a && !!b && Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol * Math.max(1, Math.hypot(b[0], b[1]));
// a hover that ends on the plane's point (re, im), from 12 px to its left (the rope then trails 3 px behind it)
const hover = async (re, im) => { const p = await W(re, im); for (let i = 4; i >= 0; i--) { await move(p[0] - 3 * i, p[1]); await sleep(30); } await settle(300); return p; };
// the value heard, against the map at the probe's own (roped) point
const heard = async (Fk) => { const s = await snd(); return { g: s.g, z: s.rest && s.rest.z, ok: !!(s.g && s.rest) && near(s.g, Fk(s.rest.z)) }; };
const noCut = (L, said) => !L.some((e) => e.k === 'cut') && !/Branch cut/.test(said || '');
const seat = (L) => L.some((e) => e.k === 'seat');
const tone = (L) => L.some((e) => e.k !== 'gap');
// (the re-pick waits for a frame drawn on the new plane: until the stream has a seat, at most ms; the relief's first
// frame of a new plane takes seconds on a software renderer)
const seated = async (ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(`(window.__hl || []).some((e) => e.k === 'seat')`)) return true; await sleep(100); } return false; };
// (a pointer still on the plane's point (re, im): its own point once a re-pick let the rope go)
const atPtr = (z) => !!z && Math.hypot(z[0] - 0.3, z[1] - 0.5) < 0.02;
const PAST = /^No tone past the colour plane: the colour here comes from w₁\.$/;
// (#726) the tone follows the colour as it deforms: steps, at least one, and no seat, pathless step or gap among them
const follows = (L) => L.some((e) => e.k === 'step') && !L.some((e) => e.k === 'seat' || e.k === 'pathless' || e.k === 'gap');
// z^s on the principal branch, s real; the colour between z and w₁ at u: F(p), p^(1+u) = q (z²'s path z^(1+u), p continued
// from q at u = 0: the principal root)
const cpow = (z, s) => { const r = Math.pow(Math.hypot(z[0], z[1]), s), a = s * Math.atan2(z[1], z[0]); return [r * Math.cos(a), r * Math.sin(a)]; };
const phiZW1 = (u, q) => F(cpow(q, 1 / (1 + u)));
// (the tone at the thread's place x: until the stream has a call made there, at most ms)
const voicedAt = async (x, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(`(window.__hl || []).some((e) => e.x === ${x})`)) return true; await sleep(100); } return false; };
// (the thread's place at each frame drawn, recorded in the page from now until stopFrames(): ▶'s frames, which a software
// renderer draws seconds apart)
const recFrames = () => ev(`(() => { window.__fx = []; window.__fxOn = true; const f = () => { __fx.push(__cmwSvX()); if (__fxOn) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
const stopFrames = () => ev(`(() => { window.__fxOn = false; return window.__fx || []; })()`);
// every frame in which the thread moved has a call of the stream made at that frame's place (a frame callback of this test
// runs before or after the app's frame, so a frame's place is the one it saw then: its own or the frame before's)
const perFrame = (fx, L) => {
  const voiced = new Set(L.map((e) => e.x));
  let moved = 0, missed = 0;
  for (let i = 1; i < fx.length; i++) { if (fx[i] === fx[i - 1]) continue; moved++; if (!voiced.has(fx[i])) missed++; }
  return { frames: fx.length, moved, missed, calls: L.length };
};

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

// 2. a glide from w₁ to w₂, the colour plane, under a still pointer: the colour deforms from f₂ to w₂'s own variable (#726)
await hl();
await svDo({ go: 2 }, 100); await rest(); await settle(600); await voicedAt(2);
let s = await snd(), L = await hl();
R.glide = { kinds: L.map((e) => e.k), g: s.g, z: s.rest && s.rest.z, live: s.live };
ok('a glide to w₂ under a still pointer: the tone follows the colour as it deforms (steps, no seat), no branch cut, and lands on w₂ at the pointer', noCut(L, s.live) && follows(L) && !!s.rest && near(s.g, id(s.rest.z)) && atPtr(s.rest.z), R.glide);
await sleep(300); await move(p[0] + 6, p[1]); await settle(300);   // (after the 250 ms a view change keeps quiet)
s = await snd(); L = await hl();
R.glideMove = { kinds: L.map((e) => e.k), g: s.g, z: s.rest && s.rest.z, live: s.live };
ok('after the glide the next move is a step on w₂, no branch cut', noCut(L, s.live) && L.some((e) => e.k === 'step') && !!s.rest && near(s.g, id(s.rest.z)), R.glideMove);

// 2b. a slow glide from w₁ to w₂ under a still pointer (#726): the tone is updated in every frame the thread moved, at that
// frame's place, with steps (the half-way point is no switch of map), and it lands on w₂'s map
await svDo({ go: 1, now: true });
p = await hover(0.3, 0.5);
R.slow = await speed('slower');
await hl(); await recFrames();
await svDo({ go: 2 }, 50);
await rest(); await settle(400); await speed('normal');
const fx = await stopFrames();
s = await snd(); L = await hl();
R.mid = Object.assign(perFrame(fx, L), { g: s.g, z: s.rest && s.rest.z, kinds: [...new Set(L.map((e) => e.k))] });
ok('a slow glide under a still pointer: a voice update in every frame the thread moved, steps only, no branch cut, and it lands on w₂\'s map', R.mid.moved >= 2 && R.mid.missed === 0 && follows(L) && noCut(L, await live()) && !!s.rest && near(s.g, id(s.rest.z)), Object.assign({ speed: R.slow }, R.mid));

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

// 3b. past the colour plane (Pietro's call, 2 Nov): w₂ with the colour plane w₁ makes no tone and says once where the colour
// comes from; the click query, Listen along and a loop are silent with the same line; the keyboard probe's D and Z say it
await quiet();
await svDo({ go: 2, now: true });
p = await hover(0.3, 0.5);
L = await hl();
R.past = { label: (await S()).label, kinds: L.map((e) => e.k), live: await live() };
ok('past the colour plane: the pointer makes no tone, and the line says where the colour comes from', /after the colour plane w₁/.test(R.past.label) && !tone(L) && PAST.test(R.past.live), R.past);
await quiet();
await hover(0.1, 0.6); await click(p[0] + 30, p[1] + 20); await settle(300);
L = await hl();
R.pastAgain = { kinds: L.map((e) => e.k), live: await live() };
ok('past the colour plane: the line once a plane, and a click there plays no query', !tone(L) && R.pastAgain.live === '', R.pastAgain);
// (the keyboard probe answers a focus from the keyboard only: more than 400 ms after the click's press)
await ev(`document.getElementById('overlayL').blur(); 1`); await sleep(450);
await ev(`document.getElementById('overlayL').focus(); 1`); await sleep(100);
await key('d'); await settle(300); R.pastD = await live();
await quiet(); await key('z'); await settle(300); R.pastZ = await live();
ok('past the colour plane: the keyboard probe\'s D and Z say where the colour comes from, not the plane\'s own zeros', PAST.test(R.pastD) && PAST.test(R.pastZ), [R.pastD, R.pastZ]);
await key('Escape'); await settle(200);
await ev(`document.getElementById('overlayL').blur(); 1`);
await quiet();
await ev(`__cmwSelect('c1'); 1`); await settle(500);
R.pastListen = { button: await ev(`(() => { const b = document.querySelector('[data-act=listen-along]'); if (b) b.click(); return !!b; })()`) };
await sleep(400);
Object.assign(R.pastListen, { live: await live(), play: (await snd()).play });
await ev(`__cmwSelect(null); 1`);
const LOOP = Array.from({ length: 48 }, (_, j) => [0.3 * Math.cos(2 * Math.PI * j / 48), 0.9 + 0.3 * Math.sin(2 * Math.PI * j / 48)]);
await quiet();
await ev(`__cmwSound({ loop: ${JSON.stringify(LOOP)} }); 1`); await sleep(300);
R.pastLoop = await live();
ok('past the colour plane: Listen along and a loop play nothing and say where the colour comes from', R.pastListen.button && PAST.test(R.pastListen.live) && !R.pastListen.play && PAST.test(R.pastLoop), [R.pastListen, R.pastLoop]);
await key('Escape'); await settle(200);
await svDo({ T: 2 }, 400); await hl();

// 4. a view parked between z and w₁ (#726): parked at 0.4, then at 0.6 past the half-way point, the tone follows the colour as
// it deforms, and hears it there, F(p) with p^1.6 = q (z²'s path z^(1+u)), not the nearer plane's map f₂
await svDo({ go: 0, now: true });
p = await hover(0.3, 0.5);
await svDo({ park: 0.4 }, 500); await hl();
await svDo({ park: 0.6 }, 500); await voicedAt(0.6);
s = await snd(); L = await hl();
R.park = { x: await ev('__cmwSvX()'), kinds: L.map((e) => e.k), g: s.g, z: s.rest && s.rest.z, live: s.live, want: s.rest && phiZW1(0.6, s.rest.z) };
ok('parked past the half-way point: the tone follows with steps and no branch cut, and hears the colour deformed there, F(p) with p^1.6 = q', follows(L) && noCut(L, s.live) && !!s.rest && near(s.g, R.park.want, 1e-7), R.park);
await sleep(300); await move(p[0] + 6, p[1]); await settle(300);
s = await snd(); L = await hl();
R.parkMove = { kinds: L.map((e) => e.k), live: s.live, g: s.g, want: s.rest && phiZW1(0.6, s.rest.z) };
ok('parked: the next move is a step on the deformed colour, no branch cut', noCut(L, s.live) && L.some((e) => e.k === 'step') && near(s.g, R.parkMove.want, 1e-7), R.parkMove);

// 5. ▶ along the thread under a still pointer, from z to w₂: the tone follows the colour as it deforms, with no cut; one swell
// and one arrival (Pietro's call, 2 Nov)
await svDo({ go: 0, now: true });
await hover(0.3, 0.5); await hl(); await made();
await svDo({ play: true }, 100);
// (the thread's place alone: the full __cmwSteps() poll starves a play's frames; up to 60 s where frames are seconds apart)
for (let i = 0; i < 600; i++) { await sleep(100); if ((await ev('__cmwSvX()')) >= 1.999) break; }
await rest(); await settle(800); await voicedAt(2);
s = await snd(); L = await hl();
R.play = { label: (await S()).label, kinds: L.map((e) => e.k), g: s.g, z: s.rest && s.rest.z, live: s.live, made: await made() };
ok('▶ under a still pointer: the tone follows the colour with steps, no branch cut on the way or at the end, where the tone is w₂\'s', noCut(L, s.live) && follows(L) && /Plane w₂/.test(R.play.label) && !!s.rest && near(s.g, id(s.rest.z)), R.play);
ok('▶: the swell once at the start and the arrival once at its end', count(R.play.made, 'morphStart') === 1 && count(R.play.made, 'morphEnd') === 1, R.play.made);
// with Loop on it starts over at the end: the arrival never comes on a repeat; a pause brings none either
// (at the fast speed, and the wrap watched in the page once a frame, up to 60 s where frames are seconds apart)
await svDo({ loop: true }, 200); R.wrapSpeed = await speed('fast');
await svDo({ go: 0, now: true }); await made();
await ev(`(() => { window.__wr = { hi: 0, wrapped: false }; const f = () => { const x = __cmwSvX(), w = window.__wr; if (x < w.hi - 0.5) w.wrapped = true; w.hi = Math.max(w.hi, x); if (!w.wrapped) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
await svDo({ play: true }, 100);
for (const t0 = Date.now(); Date.now() - t0 < 60000;) { if (await ev('window.__wr.wrapped')) break; await sleep(200); }
R.wrap = await ev('window.__wr');
await svDo({ play: false }, 300); await rest();
R.wrap.made = await made();
await svDo({ loop: false }, 200); await speed('normal');
ok('▶ with Loop on: the swell once, no arrival on its repeat or at a pause', R.wrap.wrapped && count(R.wrap.made, 'morphStart') === 1 && count(R.wrap.made, 'morphEnd') === 0, R.wrap);
// the strip's scrub: its landmarks ring as the Deformation's slider's do (the pointer off the plane: no resting probe)
const rail = await ev(`(() => { const r = document.querySelector('.sv-rail').getBoundingClientRect(), ns = [...document.querySelectorAll('#svStrip .sv-plane')].map((b) => { const q = b.getBoundingClientRect(); return q.left + q.width / 2; }); return { x: r.left + 10, y: r.top + r.height / 2, end: ns[ns.length - 1] + 4 }; })()`);
await svDo({ go: 0, now: true }); await move(rail.x, rail.y); await settle(200); await made();
await drag(rail.x, rail.y, rail.end, rail.y, 24, 40); await settle(400);
R.scrub = { made: await made(), tex: await ev('Sound.scrubState().tex') };
await rest();
ok('a scrub of the strip rings its landmarks, and its texture ends at the release', count(R.scrub.made, 'landmark') >= 1 && R.scrub.tex === false, R.scrub);

// 6. the keyboard probe on z, then on w₁: Z and D read the shown plane's map
await svDo({ go: 0, now: true });
await ev(`document.getElementById('overlayL').focus(); 1`); await sleep(100);
await key('z'); await settle(300); R.kz0 = await live();
await key('d'); await settle(300); R.kd0 = await live();
ok('keyboard probe on z: Z and D read F (two zeros, two poles)', /of 4/.test(R.kz0) && /^F in this view: 2 zeros: [-−]1, 1; 2 poles: [-−]i, i\.$/.test(R.kd0), [R.kz0, R.kd0]);
await svDo({ go: 1, now: true });
await ev(`document.getElementById('overlayL').focus(); 1`); await sleep(100);
await key('z'); await settle(300); R.kz1 = await live();
await key('d'); await settle(300); R.kd1 = await live();
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
await ev(`__cmwSound({ loop: ${JSON.stringify(LOOP)} }); 1`); await sleep(300);
R.loop = await live();
ok('a loop drawn on w₁: f₂\'s winding number, 0', /^Winding number 0:/.test(R.loop), R.loop);
await key('Escape'); await settle(300);

// 9. the Sphere and the Landscape on w₁; on the Landscape a glide to another plane under a still pointer lands on its relief
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
await svDo({ go: 2 }, 100); await rest(); await settle(800); await voicedAt(2, 12000);
s = await snd(); L = await hl();
R.landGo = { kinds: L.map((e) => e.k), g: s.g, z: s.rest && s.rest.z, live: s.live };
ok('the Landscape, w₁ to w₂ under a still pointer: the tone lands on w₂\'s relief, no branch cut', tone(L) && noCut(L, s.live) && !!s.rest && near(s.g, id(s.rest.z)), R.landGo);
await svDo({ surf: 'plane' }, 800);
const exc1 = logs().filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || ''));

// 10. the classic view: X at the whole chain is z; Listen along the circle of w₁ there says it is in a later plane too
await open(1440, 900, false, true);
R.classic = { steps: await ev(`typeof __cmwSteps === 'function' ? __cmwSteps().on : null`) };
await ev(`__cmwSelect('c1'); 1`); await settle(500);
R.classic.button = await ev(`(() => { const b = document.querySelector('[data-act=listen-along]'); if (b) b.click(); return !!b; })()`);
await sleep(400);
Object.assign(R.classic, { live: await live(), play: (await snd()).play });
ok('classic view, X on z: Listen along a curve of w₁ says it is in a later plane, and plays nothing', R.classic.steps !== true && R.classic.button && /This curve is in w₁, a later plane/.test(R.classic.live) && !R.classic.play, R.classic);
const exc2 = logs().filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || ''));

// 11. a phone: a finger's hold-and-slide on w₁ hears f₂, and its lift feeds one last step
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

// 12. (#726) ▶ from z to w₁ = z⁵ with the pointer still at 1.2 e^(170°i), the classic Deformation's z⁵: the colour at q is
// G_0(p) = p⁵ with p^(1+4u) = q (z⁵'s path z^(1+4u)), q^(5/(1+4u)), from q⁵ to q. A voice update in every frame the thread
// moved, and the run's turns are the winding of u ↦ q^(5/(1+4u)) at the probe, −4 arg q (−1.889 turns)
const one = (step) => Object.assign({}, ST, { steps: [step], shapes: [] });
await open(1440, 900, false, false, one({ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }));
const th = 170 * Math.PI / 180;
await svDo({ go: 0, now: true });
await hover(1.2 * Math.cos(th), 1.2 * Math.sin(th));
// (a re-pick lets the rope go: the probe on the pointer's own point, which the arrival's re-pick then finds unchanged, so the
// run is still there after the arrival)
await svDo({ go: 0, now: true }); await settle(400);
// (at the slowest speed: a software renderer draws a frame a second or two apart, and a frame's path is followed exactly
// within the probe's 3 ms a step, whose calls of the colour grow with the turns it makes)
R.z5speed = await speed('slower');
await hl(); await made(); await recFrames();
await svDo({ play: true }, 100);
for (let i = 0; i < 600; i++) { await sleep(100); if ((await ev('__cmwSvX()')) >= 0.999) break; }
await rest(); await settle(600); await voicedAt(1);
const fz = await stopFrames();
await speed('normal');
s = await snd(); L = await hl();
const za = s.rest ? Math.atan2(s.rest.z[1], s.rest.z[0]) : NaN;
R.z5 = Object.assign(perFrame(fz, L), { run: s.run, rest: s.rest, kinds: [...new Set(L.map((e) => e.k))], made: await made(), want: -4 * za / (2 * Math.PI) });
ok('z⁵, ▶ with the pointer still: a voice update in every frame the thread moved, steps only', R.z5.moved >= 2 && R.z5.missed === 0 && follows(L), R.z5);
ok('z⁵, ▶: the run is the winding of u ↦ q^(5/(1+4u)) at the probe, −4 arg q (−1.889 turns at 170°)', !!s.run && Math.abs(s.run.phi - R.z5.want) < 1e-6 && Math.abs(za - th) < 0.03, R.z5);
ok('z⁵, ▶: no zero, pole, cut or dense cue', !R.z5.made.some((x) => /^(zero|pole|cut|dense)$/.test(x)), R.z5.made);

// 13. (#726) a zero of the colour passing the still probe: z → w₁ = z − 1, the classic Deformation's z − 1. The colour at q
// between z and w₁ is p − 1 with p − u = q (z − 1's path z − u), q + u − 1, whose zero runs from 1 to 0. The pointer still
// at 0.5 + 0.003i and the thread moved towards w₁ in 39 steps of 1/40, one frame each (as the classic Deformation's slider;
// the thread's place set as a scrub sets it, so it stops short of w₁, a plane it would arrive at): the tone follows every
// step, one ping of order 1 and its line, no cut, and the run is arg(q − 1/40) − arg(q − 1), −0.49 turns
await open(1440, 900, false, false, one({ type: 'custom', params: { expr: 'z-1', cut: 180 }, on: true }));
await svDo({ go: 0, now: true });
await hover(0.5, 0.003);
await svDo({ go: 0, now: true }); await settle(400);
await hl(); await made(); await quiet();
const xs = await ev(`await (async () => { const out = []; for (let i = 1; i < 40; i++) { __cmwSteps({ x: i / 40 }); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); out.push([__cmwSvX(), __cmwSound().g]); } return out; })()`, 120000);
await settle(300);
s = await snd(); L = await hl();
const zq = s.rest ? s.rest.z : [0.5, 0.003], arg = (w) => Math.atan2(w[1], w[0]);
R.zero = { follows: xs.filter(([x, g]) => near(g, [zq[0] + x - 1, zq[1]], 1e-7)).length, made: await made(), live: s.live, run: s.run, rest: s.rest, kinds: [...new Set(L.map((e) => e.k))], want: (arg([zq[0] - 1 / 40, zq[1]]) - arg([zq[0] - 1, zq[1]])) / (2 * Math.PI) };
ok('z − 1, the thread moved in 39 steps under the still pointer: the tone follows every step, q + u − 1', R.zero.follows === 39 && follows(L) && Math.hypot(zq[0] - 0.5, zq[1] - 0.003) < 0.03, R.zero);
ok('z − 1: the zero passing the probe pings once, order 1, "Zero of order 1 here.", and no cut', count(R.zero.made, 'zero') === 1 && !R.zero.made.some((x) => /^(pole|cut|dense)$/.test(x)) && /Zero of order 1 here/.test(R.zero.live) && noCut(L, ''), R.zero);
ok('z − 1: the run is arg(q − 1/40) − arg(q − 1) at the probe (−0.49 turns)', !!s.run && Math.abs(s.run.phi - R.zero.want) < 1e-6, R.zero);

const exc = exc1.concat(exc2, logs().filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || '')));
ok('no exceptions', !exc.length, exc.slice(0, 5));
return { pass: !fails.length, nfail: fails.length, fails, R };
