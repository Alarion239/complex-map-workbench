// The steps view (#366, issue #434, behind ?view=steps):
// - one plane fills the stage, with the chain strip (a thread) under it;
// - ← → glide to the next plane and land on it;
// - a view parked between two planes shows the deformation there;
// - C makes the shown plane the colour plane;
// - Inside regions keeps the colour to the regions;
// - reduced motion jumps;
// - on a phone, a swipe from the plane's edge moves on a plane;
// - without the flag, the app is the classic view.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
// (a picture's FNV-1a hash: the suite has no require)
const fnv = (b) => { let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
const ns = 'sv' + Date.now();
// Cayley, then cube's chain with the upper half-plane: z → w₁ (Möbius) → w₂ (cube)
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
const open = async (w, h, mobile, flag) => {
  await view(w, h, false, mobile);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en${flag ? '&view=steps' : ''}` }); await sleep(3000); await settle(500);
};
const S = () => ev('__cmwSteps()');
// (a glide: until it lands, at most 15 s on a software renderer)
const rest = async () => { for (let i = 0; i < 150; i++) { const s = await S(); if (!s.moving) return s; await sleep(100); } return S(); };
const plot = async () => ev(`(() => { const b = document.getElementById('plotL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height, scale: 1 }; })()`);
const hash = async (name) => { await settle(400); await shot(name, await plot()); return fnv(fs.readFileSync(`${DIR}/shots/${name}.png`)); };
// (#471) axe over the steps view's own markup: the plane, its head and the thread (test.html's own lang and the draw
// tools' contrast are the base's, a11y_axe_cmd's)
const AXE = fs.readFileSync(path.join(DIR, '..', '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const axe = async () => {
  if (!(await ev("typeof axe !== 'undefined'"))) await ev(AXE + '\n;1');
  await ev(`(() => { window.__axe = null; const inc = ['#paneL', '#svHead', '#svStrip'].filter((q) => document.querySelector(q)).map((q) => [q]);
    axe.run({ include: inc }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }).then((r) => { window.__axe = r.violations.map((v) => ({ id: v.id, n: v.nodes.length, t: v.nodes.slice(0, 3).map((x) => x.target.join(' ')) })); }); return 1; })()`);
  for (let i = 0; i < 150; i++) { const r = await ev('window.__axe'); if (r) return r; await sleep(100); }
  return [{ id: 'axe did not finish' }];
};
// (a pixel of the plot's canvas, as [r, g, b], at a fraction of its size)
const px = (fx, fy) => ev(`(() => { const c = document.getElementById('canvasL'), d = c.getContext('2d').getImageData(Math.round(c.width * ${fx}), Math.round(c.height * ${fy}), 1, 1).data; return [d[0], d[1], d[2]]; })()`);
const grey = (c) => Math.abs(c[0] - c[1]) + Math.abs(c[1] - c[2]) < 24;
const press = (k) => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true, cancelable: true })); 1`);

// ---- the desktop ----
await open(1280, 800, false, true);
const s0 = await S();
ok('the steps view is on, on the z-plane, coloured from the last plane', s0.on && s0.i === 0 && s0.T === 2 && s0.planes.join() === '0,1,2' && s0.solo === 'L', s0);
const dom = await ev(`({ sv: document.documentElement.classList.contains('sv'), strip: !!document.getElementById('svStrip'), steps: document.querySelectorAll('#svStrip .sv-fchip').length,
  dots: document.querySelectorAll('#svStrip .sv-plane').length, chain: getComputedStyle(document.querySelector('.pipe-wrap')).display, R: document.getElementById('paneR').getBoundingClientRect().width })`);
ok('one plane, the strip with 2 steps and 3 planes, no chain row and no Y pane', dom.sv && dom.strip && dom.steps === 2 && dom.dots === 3 && dom.chain === 'none' && dom.R === 0, dom);
// (an area example opens with Inside regions: Everywhere first, for the pictures below)
await ev(`__cmwSteps({ scope: 'all' }); 1`);
const hZ = await hash('sv_z');
await press('ArrowRight');
const m1 = await S();
ok('→ starts a glide', m1.moving === true && !!m1.anim && m1.anim.to === 1, m1);
const s1 = await rest();
ok('… which lands on w₁, coloured from w₂', s1.moving === false && s1.i === 1 && Math.abs(s1.x - 1) < 1e-9 && s1.stage === 1 && /w₁/.test(s1.label), s1);
const h1 = await hash('sv_w1');
ok('w₁\'s picture is not z\'s', h1 !== hZ, [h1, hZ]);
ok('the view is the same camera on every plane', await ev(`(() => { const a = __cmwPlaneMenu().view('L'); return Math.abs(a.s - 90) < 1e-6 && Math.abs(a.cx) < 1e-9; })()`), await ev(`__cmwPlaneMenu().view('L')`));
// parked half-way between z and w₁
await ev(`__cmwSteps({ park: 0.5 }); 1`); await settle(800);
const sp = await S();
ok('parked at 0.5: the deformation there, between z and w₁', Math.abs(sp.x - 0.5) < 1e-9 && sp.moving === true && !sp.anim, sp);
const hP = await hash('sv_park');
ok('the parked picture is neither plane\'s', hP !== hZ && hP !== h1, [hP, hZ, h1]);
ok('while parked, the plane\'s label and the thread\'s value say where it is', await ev(`/Between z and w₁/.test(document.getElementById('paneL').getAttribute('aria-label')) && /Between z and w₁/.test(document.querySelector('#svStrip .sv-thumb').getAttribute('aria-valuetext'))`), null);
// (#492) a parked frame, Everywhere: the grid, the colour layer and the outlines are one GL frame, one copy into the page
// (GLR.blit), once the glide's programs are ready (while one compiles, the CPU carry's layers go one by one)
let blits = -1;
for (let i = 0; i < 40 && blits !== 1; i++) {
  const rb = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `new Promise((r) => { const b = GLR.blit; let n = 0; GLR.blit = function (...x) { n++; return b.apply(this, x); }; __cmwSteps({ scope: 'all' }); requestAnimationFrame(() => requestAnimationFrame(() => { GLR.blit = b; r(n); })); })` });
  blits = rb.result ? rb.result.value : rb;
  if (blits !== 1) await sleep(500);
}
ok('a parked frame reaches the page in one GL copy', blits === 1, blits);
await press('ArrowRight'); const sn = await rest();
ok('→ from 0.5 goes on to w₁', sn.i === 1 && Math.abs(sn.x - 1) < 1e-9, sn);
// Shift+→: a quarter of a step, and the view stays there
await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true })); 1`); await settle(400);
const sq = await S();
ok('Shift+→ stops a quarter of a step on', Math.abs(sq.x - 1.25) < 1e-9 && !sq.anim, sq);
await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true, cancelable: true })); 1`); await settle(400);
const sb = await S();
ok('Shift+← back settles on w₁', Math.abs(sb.x - 1) < 1e-9 && sb.i === 1 && sb.moving === false, sb);
// C: the colour plane is w₁
await press('c'); await settle(500);
const sc = await S();
ok('C makes w₁ the colour plane', sc.T === 1 && /the colour plane/.test(sc.label), sc);
await press('ArrowRight'); const s2 = await rest();
ok('w₂ is past the colour plane, and still coloured (the carried colour)', s2.i === 2 && s2.main === 'xy' && /after the colour plane w₁/.test(s2.label), s2);
const h2 = await hash('sv_w2');
ok('w₂\'s picture is not w₁\'s', h2 !== h1, null);
// back to z, coloured from the last plane: Inside regions keeps the colour to the half-plane
await ev(`__cmwSteps({ go: 0, now: true, T: 2 }); 1`); await settle(800);
const hAll = await hash('sv_all');
ok('back on z, coloured from w₂ everywhere: z\'s first picture', hAll === hZ, [hAll, hZ]);
await ev(`__cmwSteps({ scope: 'in' }); 1`);
const hIn = await hash('sv_in');
ok('Inside regions changes the picture', hIn !== hAll, null);
ok('… and leaves the lower half-plane paper', await ev(`(() => { const c = document.getElementById('canvasL'), x = c.getContext('2d'), d = x.getImageData(Math.round(c.width * 0.3), Math.round(c.height * 0.85), 1, 1).data,
  u = x.getImageData(Math.round(c.width * 0.3), Math.round(c.height * 0.15), 1, 1).data; return Math.abs(d[0] - d[1]) + Math.abs(d[1] - d[2]) < 24 && Math.abs(u[0] - u[1]) + Math.abs(u[1] - u[2]) >= 24; })()`), null);
// (#471) on the globe, Inside regions keeps the colour to the half-plane too (the colour-key mask)
await ev(`__cmwSteps({ surf: 'sphere' }); 1`); await settle(1500);
// (seen from the default camera, the lower half-plane is the sliver at the globe's right, about (0.82, 0.62))
const gIn = await hash('sv_globe_in'), gUp = await px(0.5, 0.5), gLo = await px(0.82, 0.62);
await ev(`__cmwSteps({ scope: 'all' }); 1`); await settle(1500);
const gAll = await hash('sv_globe_all'), aLo = await px(0.82, 0.62);
info.globe = { gUp, gLo, aLo };
ok('on the globe, Inside regions changes the picture', gIn !== gAll, [gIn, gAll]);
ok('… the upper half-plane coloured and the lower one paper; coloured everywhere without it', !grey(gUp) && grey(gLo) && !grey(aLo), info.globe);
await ev(`__cmwSteps({ scope: 'in', surf: 'plane' }); 1`); await settle(800);
// (#440) Inside regions is drawn on the GPU: no read-back of a canvas at rest, parked, while gliding, or on the globe
await ev(`(() => { const P = CanvasRenderingContext2D.prototype, f = P.getImageData; window.__gid = 0; P.getImageData = function (...a) { window.__gid++; return f.apply(this, a); }; window.__gidF = f; return 1; })()`);
await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settle(600);
await ev(`__cmwSteps({ park: 0.5 }); 1`); await settle(600);
await ev(`__cmwSteps({ go: 0 }); 1`); await rest();
await ev(`__cmwSteps({ surf: 'sphere' }); 1`); await settle(1500);
await ev(`__cmwSteps({ surf: 'plane' }); 1`); await settle(800);
const gid = await ev(`(() => { CanvasRenderingContext2D.prototype.getImageData = window.__gidF; return window.__gid; })()`);
ok('Inside regions reads no canvas back (at rest, parked, gliding, on the globe)', gid === 0, gid);
// (#471) axe on the steps view: on z, parked between planes, on the globe
const ax = {};
ax.z = await axe();
await ev(`__cmwSteps({ park: 0.5 }); 1`); await settle(600); ax.parked = await axe();
await ev(`__cmwSteps({ go: 0, now: true, surf: 'sphere' }); 1`); await settle(1200); ax.sphere = await axe();
await ev(`__cmwSteps({ surf: 'plane' }); 1`); await settle(600);
ok('desktop: no axe violation in the steps view (z, parked, Sphere)', !ax.z.length && !ax.parked.length && !ax.sphere.length, ax);
// (ux's review of #448) the arrows of a focused radio group, or of an open pop-up, are theirs: the plane stays
const before = (await S()).x;
await ev(`__cmwSteps({ scope: 'all' }); 1`); await settle(300);
await ev(`(() => { const b = document.querySelector('#svHead .sv-scope [role=radio][aria-checked=true]'); b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); return 1; })()`); await settle(600);
const rg = await S();
ok('→ on a focused scope radio picks the next one, not the next plane', rg.x === before && rg.scope === 'in', rg);
// (#441) the surface is one button with a menu: its keys are the menu's, and a pick changes the surface, not the plane
await ev(`document.querySelector('#svHead .sv-surf1').click(); 1`); await settle(400);
await ev(`(() => { const m = document.querySelector('.pop.menu'); const t = document.activeElement; t.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); return !!m; })()`); await settle(300);
await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu [role=menuitemradio]')].find((e) => /Sphere/.test(e.textContent)); if (b) b.click(); return !!b; })()`); await settle(600);
const sm = await S();
ok('the surface menu picks Sphere, and its keys leave the plane alone', sm.x === before && sm.surf === 'sphere', sm);
await ev(`__cmwSteps({ surf: 'plane' }); document.activeElement.blur(); 1`); await settle(600);
await ev(`document.getElementById('examplesBtn').click(); 1`); await settle(600);
await press('ArrowRight');
const pop = await S();
ok('→ with the Examples gallery open leaves the plane alone', pop.x === before && !pop.anim, pop);
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`); await settle(400);
// reduced motion: a move is a jump
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await press('ArrowRight');
const sr = await S();
ok('under reduced motion, → jumps to w₁', sr.moving === false && sr.i === 1 && !sr.anim, sr);
await send('Emulation.setEmulatedMedia', { features: [] });
// the strip's and the plane's accessible names
const a11y = await ev(`({ strip: document.getElementById('svStrip').getAttribute('aria-label'), pane: document.getElementById('paneL').getAttribute('aria-label'),
  chips: [...document.querySelectorAll('#svStrip .sv-fchip')].map((b) => b.getAttribute('aria-label')) })`);
ok('the strip, the plane and the steps have names', /Planes of the chain/.test(a11y.strip) && /Plane w₁, 2 of 3/.test(a11y.pane) && a11y.chips.length === 2 && /Möbius/.test(a11y.chips[0]), a11y);

// a view parked past half-way across the colour plane stays where it is: the plane it rounds to has another view
// (Phase before the colour plane, X → Y after it) than the one last set, which is not a state from outside
await ev(`__cmwSteps({ go: 0, now: true, T: 0 }); 1`); await settle(600);
await ev(`__cmwSteps({ park: 0.6 }); 1`); await settle(600);
await ev(`__cmwSteps({ scope: 'in' }); 1`); await settle(800);
const pk = await S();
ok('parked at 0.6 past the colour plane z, the view stays there', Math.abs(pk.x - 0.6) < 1e-9 && pk.T === 0 && pk.scope === 'in', pk);
await ev(`__cmwSteps({ T: 2 }); 1`);
// (perf on #460) parked between two planes, the view still takes an example: it opens on it, from its first plane
await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settle(400);
await ev(`__cmwSteps({ park: 1.5 }); 1`); await settle(600);
const before2 = await S();
await ev(`__cmwExample(0); 1`); await settle(1500);
const ex = await S();
ok('parked at 1.5, an example still opens: on its first plane, at rest', Math.abs(before2.x - 1.5) < 1e-9 && ex.x === 0 && ex.i === 0 && ex.moving === false, { before2, ex });

// ---- the phone: a swipe from the right edge of the plane moves on a plane ----
await open(390, 844, true, true);
const ph = await S();
ok('on a phone: the steps view, on z', ph.on && ph.i === 0, ph);
await ev(`(() => { const p = document.getElementById('plotL'), r = p.getBoundingClientRect(), y = r.top + r.height / 2;
  const e = (type, x) => p.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  e('pointerdown', r.right - 10); for (let i = 1; i <= 4; i++) e('pointermove', r.right - 10 - i * 30); e('pointerup', r.right - 130); return 1; })()`);
const sw = await rest();
ok('a flick from the right edge goes on to w₁', sw.i === 1 && Math.abs(sw.x - 1) < 1e-9, sw);
// (#471) a flick is judged by the events' own times: a frame stalled between them does not make it a park
await ev(`__cmwSteps({ go: 0, now: true }); 1`); await settle(500);
await ev(`(() => { const p = document.getElementById('plotL'), r = p.getBoundingClientRect(), y = r.top + r.height / 2;
  const mk = (type, x) => new PointerEvent(type, { pointerId: 8, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 });
  const evs = [mk('pointerdown', r.right - 10), ...[1, 2, 3, 4].map((i) => mk('pointermove', r.right - 10 - i * 30)), mk('pointerup', r.right - 130)];
  p.dispatchEvent(evs[0]); const t = performance.now(); while (performance.now() - t < 450) { /* a stalled frame */ }
  for (const e of evs.slice(1)) p.dispatchEvent(e); return 1; })()`);
const sst = await rest();
ok('a flick with a stalled frame inside it still goes on to w₁', sst.i === 1 && Math.abs(sst.x - 1) < 1e-9, sst);
// (#471) the plane's own Sphere key switches the view's surface, and says so
await ev(`document.querySelector('#paneL .ph-sph').click(); 1`); await settle(600);
const sk = await ev(`({ surf: __cmwSteps().surf, pressed: document.querySelector('#paneL .ph-sph').getAttribute('aria-pressed') })`);
ok('the plane\'s Sphere key puts the plane on the sphere', sk.surf === 'sphere' && sk.pressed === 'true', sk);
await ev(`document.querySelector('#paneL .ph-sph').click(); 1`); await settle(600);
const sk2 = await ev(`({ surf: __cmwSteps().surf, pressed: document.querySelector('#paneL .ph-sph').getAttribute('aria-pressed') })`);
ok('… and back on the plane', sk2.surf === 'plane' && sk2.pressed === 'false', sk2);
const axP = await axe();
ok('phone: no axe violation in the steps view', !axP.length, axP);
const head = await ev(`(() => { const t = document.getElementById('top'), h = document.getElementById('svHead'); return { inTop: !!h && h.parentNode === t, fits: t.scrollWidth <= t.clientWidth + 1 }; })()`);
ok('the plane\'s controls are in the header, which does not scroll sideways', head.inTop && head.fits, head);
// (ux on #448: the folded key is an image with a name, for axe's role-img-alt)
const leg = await ev(`(() => { const l = document.getElementById('leftLegend'); return { role: l.getAttribute('role'), name: l.getAttribute('aria-label') }; })()`);
ok('the folded key on the phone has a name', leg.role !== 'img' || !!leg.name, leg);

// ---- without the flag: the classic view ----
await open(1280, 800, false, false);
const cl = await ev(`({ sv: document.documentElement.classList.contains('sv'), strip: !!document.getElementById('svStrip'), on: __cmwSteps().on, R: document.getElementById('paneR').getBoundingClientRect().width > 0 })`);
ok('without ?view=steps the app is the classic view', !cl.sv && !cl.strip && !cl.on && cl.R, cl);

info.checks = 'steps view: desktop, parking, one GL copy, colour plane, Inside regions, reduced motion, phone swipe, classic';
return { pass: fails.length === 0, fails, info };
