// A view parked between two planes pans and zooms its picture (#548, behind ?view=steps):
// - at ?view=steps with the thread's place between two planes (a glide stopped half-way), a drag on the plane and the wheel
//   change what is drawn, not only the axis scales: the picture's interior pixels differ (the rulers' margin is left out);
// - in Plane and in Sphere; parked nearer the first plane (the stage whose camera is S.srcView itself) and nearer a later one
//   (whose camera is V.left, the one a pan changes);
// - the view stays parked: a pan or a zoom does not settle it onto a plane.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ns = 'svp' + Date.now();
// Cayley, then cube's chain with the upper half-plane: z → w₁ (Möbius) → w₂ (cube)
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
const open = async () => {
  await view(1280, 800, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function'` }); await settle(500);
};
const S = () => ev('__cmwSteps()');
const ctl = (o) => ev(`__cmwSteps(${JSON.stringify(o)})`);
// the picture's interior as a grey byte a pixel, kept in the page (the rulers' margin is left out), and how many pixels of it
// differ from the one kept before; the screenshot's png would carry the axis scales too
const grab = () => ev(`(() => { const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], x = c && c.getContext('2d'); if (!x) return { __exc: 'no 2d canvas in #plotL: ' + cs.length };
  const m = Math.round(Math.min(c.width, c.height) * 0.14), w = c.width - 2 * m, h = c.height - 2 * m;
  const d = x.getImageData(m, m, w, h).data, o = new Uint8Array(d.length / 4); for (let i = 0; i < o.length; i++) o[i] = (d[4 * i] * 3 + d[4 * i + 1] * 6 + d[4 * i + 2]) / 10 | 0;
  window.__pixPrev = window.__pix; window.__pix = o; return [w, h]; })()`);
const diff = () => ev(`(() => { const a = window.__pixPrev, b = window.__pix; if (!a || !b || a.length !== b.length) return null; let n = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 12) n++; return { n, of: a.length, frac: +(n / a.length).toFixed(4) }; })()`);
// a picture at rest: grabbed again until two grabs agree (a frame still compiling its programs, fading in or easing is not one),
// at most `tries` times (a globe let go of glides on for about nine seconds); the last difference and the sequence
const calm = async (tries = 12) => {
  const seq = []; let d = null;
  for (let i = 0; i < tries; i++) { await settle(400); await grab(); d = await diff(); seq.push(d && d.frac); if (d && d.frac < 0.002) break; }
  return { d, seq };
};
const plot = () => ev(`(() => { const b = document.getElementById('plotL').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()`);
const wheel = async (x, y, dy) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy }); };

const surfs = ['plane', 'sphere'];
// (the first is nearer plane 1, whose camera is V.left; the second is nearer plane 0, whose camera is S.srcView: the control)
// (the least share of the interior's pixels a pan or a zoom must change: well over the 0.002 a picture at rest is held to; a globe turns less
// than a plane moves for the same drag)
const least = { plane: 0.02, sphere: 0.005 };
const places = [{ x: 1.3, near: 1 }, { x: 0.3, near: 0 }];
for (const surf of surfs) {
  for (const pl of places) {
    const tag = `${surf}, parked at ${pl.x}`;
    await open();   // (a page of its own: a camera still easing out of the last scenario's zoom is not this one's picture)
    await ctl({ go: 0, now: true });
    await ctl({ surf });
    await settle(600);
    await ctl({ park: pl.x });
    await settle(900);
    const s0 = await S();
    ok(`${tag}: the view is parked between two planes`, !s0.__exc && !s0.anim && !s0.play && Math.abs(s0.x - pl.x) < 1e-6, { x: s0.x, anim: s0.anim, play: s0.play, surf: s0.surf });
    const b = await plot(), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const g0 = await grab(); ok(`${tag}: the picture's canvas can be read`, Array.isArray(g0), g0);
    const c0 = await calm();
    info[`${tag} still`] = c0.seq;
    ok(`${tag}: the parked picture holds still between two grabs`, c0.d && c0.d.frac < 0.002, c0);
    // a pan
    await drag(cx, cy, cx - 140, cy + 80, 14, 20);
    await settle(900);
    await grab();
    const pan = await diff();
    info[`${tag} pan`] = pan;
    ok(`${tag}: a pan changes the picture, not only the axes`, pan && pan.frac > least[surf], pan);
    const s1 = await S();
    ok(`${tag}: … and the view stays parked`, !s1.__exc && Math.abs(s1.x - pl.x) < 1e-6, { x: s1.x });
    // a zoom (from a picture at rest again, so that a pan still settling is not taken for the zoom's change)
    const c1 = await calm(surf === 'sphere' ? 32 : 12);
    ok(`${tag}: the picture is at rest again after the pan`, c1.d && c1.d.frac < 0.002, c1);
    await wheel(cx, cy, -400);
    await settle(900);
    await grab();
    const zoom = await diff();
    info[`${tag} zoom`] = zoom;
    ok(`${tag}: a zoom changes the picture, not only the axes`, zoom && zoom.frac > least[surf], zoom);
    const s2 = await S();
    ok(`${tag}: … and the view stays parked after the zoom`, !s2.__exc && Math.abs(s2.x - pl.x) < 1e-6, { x: s2.x });
  }
}
return { pass: fails.length === 0, fails, info };
