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
ok('while parked, the plane\'s label and the thread\'s value say where it is', await ev(`/Between z and w₁/.test(document.getElementById('paneL').getAttribute('aria-label')) && /Between z and w₁/.test(document.querySelector('#svStrip .sv-rail').getAttribute('aria-valuetext'))`), null);
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
// (ux's review of #448) the arrows of a focused radio group, or of an open pop-up, are theirs: the plane stays
const before = (await S()).x;
await ev(`(() => { const b = document.querySelector('#svHead .sv-surf [role=radio][aria-checked=true]'); b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); return 1; })()`); await settle(600);
const rg = await S();
ok('→ on a focused Surface radio picks the next surface, not the next plane', rg.x === before && rg.surf === 'sphere', rg);
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

// ---- the phone: a swipe from the right edge of the plane moves on a plane ----
await open(390, 844, true, true);
const ph = await S();
ok('on a phone: the steps view, on z', ph.on && ph.i === 0, ph);
await ev(`(() => { const p = document.getElementById('plotL'), r = p.getBoundingClientRect(), y = r.top + r.height / 2;
  const e = (type, x) => p.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  e('pointerdown', r.right - 10); for (let i = 1; i <= 4; i++) e('pointermove', r.right - 10 - i * 30); e('pointerup', r.right - 130); return 1; })()`);
const sw = await rest();
ok('a flick from the right edge goes on to w₁', sw.i === 1 && Math.abs(sw.x - 1) < 1e-9, sw);
const head = await ev(`(() => { const t = document.getElementById('top'), h = document.getElementById('svHead'); return { inTop: !!h && h.parentNode === t, fits: t.scrollWidth <= t.clientWidth + 1 }; })()`);
ok('the plane\'s controls are in the header, which does not scroll sideways', head.inTop && head.fits, head);

// ---- without the flag: the classic view ----
await open(1280, 800, false, false);
const cl = await ev(`({ sv: document.documentElement.classList.contains('sv'), strip: !!document.getElementById('svStrip'), on: __cmwSteps().on, R: document.getElementById('paneR').getBoundingClientRect().width > 0 })`);
ok('without ?view=steps the app is the classic view', !cl.sv && !cl.strip && !cl.on && cl.R, cl);

info.checks = 'steps view: desktop, parking, colour plane, Inside regions, reduced motion, phone swipe, classic';
return { pass: fails.length === 0, fails, info };
