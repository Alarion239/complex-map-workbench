// v16.5 wave 1 fix round (notes/ux-build/w1-fix-AS-BUILT.md): the browser look of the review fixes, laptop 1366 × 768
// and phone 412 × 860 (Android emulation, real touch events). A cdp_kit command file (test/cdp_kit/README.md): copy the
// kit, serve dist/ and run: q.sh test/ux165_fix_cmd.js. BASE is the server: the port the kit's load() uses, read from
// the daemon copy's cdpd.js as the other suites do (ci/browser.js rewrites it to its own server; a fixed port reached
// no server there, so rail-9's page had no __cmwW2S and a click went out with no x)
const BASE = `http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}`;
let checks = 0; const fails = [];
const ok = (name, cond, got) => { checks++; if (!cond) fails.push({ name, got }); };
const settle = async (ms = 250) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const W = (re, im, side = 'L') => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const A = (deg, r = 1, c = [0, 0], side='L') => W(c[0] + r * Math.cos(deg * Math.PI / 180), c[1] + r * Math.sin(deg * Math.PI / 180), side);
const CI = (o) => ev(`__cmwCI(${JSON.stringify(o || null)})`);
const ST = () => CI({ shapes: true });
const DBG = () => CI();
const last = (st) => st.list[st.list.length - 1];
const scale = async (side='L') => { const a = await W(0, 0, side), b = await W(1, 0, side); return b[0] - a[0]; };
const tool = async (id) => { const r = await ev(`(() => { const b = [...document.querySelectorAll('[data-tool="${id}"]')].find((e) => e.offsetParent) || document.querySelector('[data-tool="${id}"]'); if(!b) return 0; b.click(); return 1; })()`); await settle(120); return r; };
const chipOf = async () => { const d = await DBG(); return d.ring ? d.ring.chip : null; };
const undo = async () => { await ev(`document.getElementById('undoBtn').click(), 1`); await settle(200); };
const redo = async () => { await ev(`(document.getElementById('redoBtn')||{click(){}}).click(), 1`); await settle(200); };
const abs = (p) => Math.hypot(p[0], p[1]);
async function mdrag(path, o = {}) {
  const m = o.mods || 0;
  const [x0, y0] = path[0];
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0, modifiers: m });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1, modifiers: m });
  const samples = [];
  for (let i = 1; i < path.length; i++) {
    const [x, y] = path[i];
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1, modifiers: o.altFrom != null && i >= o.altFrom ? 1 : m });
    await sleep(o.dt || 18);
    if (o.sample) { await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); samples.push(await o.sample(i)); }
  }
  if (o.hold) await sleep(o.hold);
  if (o.beforeUp) await o.beforeUp();
  const [x1, y1] = path[path.length - 1];
  if (o.noUp) return samples;
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1, modifiers: o.upMods != null ? o.upMods : m });
  return samples;
}
async function tdrag(path, o = {}) {
  const [x0, y0] = path[0];
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
  await sleep(30);
  const samples = [];
  for (let i = 1; i < path.length; i++) {
    const [x, y] = path[i];
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    await sleep(o.dt || 18);
    if (o.sample) { await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); samples.push(await o.sample(i)); }
  }
  if (o.hold) await sleep(o.hold);
  if (o.noUp) return samples;
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return samples;
}
const tap = async (x, y, ms = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const arc = async (a0, a1, step, r = 1, c = [0, 0]) => { const out = []; const n = Math.round(Math.abs(a1 - a0) / step); for (let i = 0; i <= n; i++) out.push(await A(a0 + (a1 - a0) * i / n, r, c)); return out; };
const line = (p, q, n) => Array.from({ length: n + 1 }, (_, i) => [p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n]);
const SHOT = (n) => shot('rv/' + n);
const U0 = (extra) => Object.assign({ unit: true, snap: true, shapes: [], nextId: 10 }, extra || {});
const sum = (st) => st.list.map((x) => ({ id: x.id, k: x.kind, op: x.def && x.def.op, a: x.def && x.def.args, fx: x.fixed, p: x.p, t: x.t, c: x.c, r: x.r, A: x.A, a2: x.a, b: x.b, name: x.name }));
const toasts = () => ev(`(window.__qa && __qa.toasts) ? __qa.toasts() : null`);
const NS = 'rv' + (Date.now() % 100000);
const mchip = async () => ev(`(()=>{const e=[...document.querySelectorAll('.cm-chip')].find(e=>e.offsetParent); return e? e.textContent.trim() : null})()`);
const rect = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); })()`);
const tstxt = () => ev(`[...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent.trim()).join(' | ')`);
const deg = (p) => +(Math.atan2(p[1], p[0]) * 180 / Math.PI).toFixed(2);
const openEx = async (i) => { await ev(`document.getElementById('examplesBtn').click(), 1`); await settle(500); await ev(`[...document.querySelectorAll('#popHost .examples .ex-item')][${i}].click(), 1`); await settle(2500); };
const pick = async (d) => { const p = await A(d); await move(p[0], p[1]); await settle(60); await click(p[0], p[1]); await settle(180); };

// rail-1, rail-2 (placing), rail-4: Point tool on the unit circle, laptop and phone
for (const dev of ['phone', 'laptop']) for (const d of [90, 0, 37, 80]) {
  if (dev === 'phone') await view(412, 860, false, true); else await view(1366, 768, false, false);
  await load(NS + 'p' + dev + d, U0()); await settle(600);
  await tool('point');
  const p = await A(d);
  if (dev === 'phone') await tap(p[0], p[1]); else await click(p[0], p[1]);
  await settle(250);
  const st = await ST(), g = last(st), c = st.list.find((x) => x.fixed);
  ok(`rail-1/2 ${dev} ${d}°: a glider on the unit circle at ${d}°`, c && c.fixed === 'unit' && g.def && g.def.op === 'glider' && Math.abs(deg(g.p) - d) < 0.01, sum(st));
  if (d === 37) { const nm = (await CI({ names: true })).map((x) => x.name + ' / ' + x.def).join(' | '); ok(`rail-4 ${dev}: "the unit circle", "on the unit circle"`, /^the unit circle \/ null \| z₀ \/ on the unit circle$/.test(nm), nm); }
}
// rail-2 (sliding) and rail-6: a finger slides from 37° to 200° with the Point tool; no toast at the drag
await view(412, 860, false, true);
await load(NS + 'slide', U0()); await settle(800); await tool('point');
{ let p = await A(37); await tap(p[0], p[1]); await settle(300);
  const g = last(await ST()), P0 = await W(g.p[0], g.p[1]);
  const smp = await tdrag([P0].concat(await arc(37, 200, 2)), { dt: 20, sample: async () => { const q = (await ST()).list.find((x) => x.id === g.id); return deg(q.p); } });
  await settle(300);
  const free = smp.filter((a) => Math.abs(a - Math.round(a / 90) * 90) > 0.01).length;
  ok('rail-2 phone: a finger slide rests between the detents most of the way', free / smp.length > 0.6, smp.join(' '));
  ok('rail-6: no "turn Snap off" toast after dragging the point just placed', !/Snap off/.test(await tstxt()), await tstxt()); }
// user-2: 6 px outside the circle at 30° is on the circle
await view(1366, 768, false, false);
await load(NS + 'u2', U0()); await settle(600); await tool('point');
{ const s = await scale(), p = await A(30, 1 + 6 / s); await move(p[0], p[1]); await settle(150);
  ok('user-2: the chip says the circle, not a grid point', /unit circle/.test(await chipOf()), await chipOf()); }
// rail-3: P slides across Q (on a detent) and the circle through them never goes undefined
await load(NS + 'k', U0()); await settle(900);
await tool('perp'); await pick(200); await pick(100); await pick(150);
{ const st = await ST(), K = st.list.find((x) => x.def && x.def.op === 'perp'), P = st.list.find((x) => x.id === K.def.args[1].s);
  await key('Escape'); await settle(100); await key('Escape'); await settle(100); await tool('select');
  const smp = await mdrag([await W(P.p[0], P.p[1])].concat(await arc(100, 250, 3)), { dt: 20, sample: async () => { const s2 = await ST(); const k = s2.list.find((x) => x.id === K.id), p = s2.list.find((x) => x.id === P.id); return [deg(p.p), !!k.cundef]; } });
  await settle(200);
  ok('rail-3: P never rests on Q (150°) and K stays defined', !smp.some((x) => x[1]) && !smp.some((x) => Math.abs(x[0] - 150) < 0.01), smp.map((x) => x.join(':')).join(' ')); }
// rail-7, rail-8, user-6: the refusal in the chip (the tool's full name), cleared by the next pick and by Esc
await load(NS + 'k7', U0()); await settle(900);
await tool('perp'); await pick(200);
ok('user-6: the chip says a point on the curve will do', /Pick a point \(on the unit circle or anywhere\)/.test(await mchip()), await mchip());
await pick(300);
{ const p = await A(302); await move(p[0], p[1]); await settle(100); await click(p[0], p[1]); await settle(150);
  const r = (await DBG()).ring, c = await mchip();
  ok('rail-8: the refusal names the tool in full', /Perpendicular circle needs distinct points/.test(c) && !/Orthogonal needs distinct points/.test(c), c);
  ok('rail-7: after the press the ring only warns (no second label)', r && r.warn && r.chip === '', r);
  await pick(60);
  ok('rail-7: an accepted pick clears the refusal', !/needs distinct points/.test(await mchip()), await mchip()); }
// rail-9: the chip leaves the picks' band (RU, dark)
await view(1366, 768, true, false);
await load(NS + 'r9', U0({ shapes: [{ id: 'C', kind: 'circle', c: [0.5, 0.3], r: 1.3, ci: 0, visible: true }], nextId: 40 }));
await nav(`${BASE}/test.html?ns=${NS}r9&lang=ru`); await settle(1500);
await tool('perp');
{ const at = async (d) => A(d, 1.3, [0.5, 0.3]); let q = await at(200); await move(q[0], q[1]); await settle(100); await click(q[0], q[1]); await settle(200);
  q = await at(100); await move(q[0], q[1]); await settle(150);
  const el = await ev(`(() => { const e = document.elementFromPoint(${q[0]}, ${q[1]}); return e ? e.id : null; })()`);
  await click(q[0], q[1]); await settle(200);
  ok('rail-9: a press on the circle under the chip\'s old place is a pick', el === 'overlayL' && /2 из 2/.test(await mchip()), [el, await mchip()]); }
// rail-5: 3 points on a drawn circle on the sphere are gliders; Orthogonal there says where its curve is picked
await view(1366, 768, false, false);
await load(NS + 'sp', U0({ unit: false, shapes: [{ id: 'C', kind: 'circle', c: [0, 0], r: 0.8, ci: 0, visible: true }], nextId: 30 })); await settle(900);
await ev(`__cmwSetView('L', 'sphere'), 1`); await settle(1200);
{ const GS = (re, im) => ev(`(() => { const P = Region.Globe.lift(${re}, ${im}); return __cmwCI({ gs: ['L', P] }); })()`);
  const pt = (d) => GS(0.8 * Math.cos(d * Math.PI / 180), 0.8 * Math.sin(d * Math.PI / 180));
  await tool('circle3');
  for (const d of [20, 60, 100]) { const q = await pt(d); await click(q[0] + 2, q[1]); await settle(200); }
  const st = await ST(), K = st.list.find((x) => x.def && x.def.op === 'circle3');
  ok('rail-5: three globe picks on C are gliders and the circle is C', K && Math.abs(K.r - 0.8) < 1e-12 && st.list.filter((x) => x.def && x.def.op === 'glider').length === 3, sum(st));
  await key('Escape'); await tool('perp'); const q = await pt(60); await click(q[0], q[1]); await settle(200);
  ok('rail-5: Orthogonal on the globe says to switch to the plane', /Switch to the plane to pick the curve/.test(await mchip()), await mchip()); }
// user-1, user-5, regress-3: z^2 + a from the palette
await view(1366, 768, false, false);
await nav(`${BASE}/test.html?ns=${NS}pal`); await settle(1500);
await key('k', 4); await settle(300); await type('z^2 + a'); await settle(400); await key('Enter'); await settle(800);
{ const t = await ev(`(() => { const e = [...document.querySelectorAll('.prm')].find((x) => x.offsetParent); return e ? e.textContent : ''; })()`);
  ok('user-1: the number just added with its step is not "Not used yet"', !/Not used yet/.test(t), t);
  const add = await rect('.prm-add'), row = await ev(`(() => { const r = [...document.querySelectorAll('.prm-row')].filter((x) => x.offsetParent).pop(); return r ? Math.round(r.getBoundingClientRect().bottom) : null; })()`);
  ok('user-5: + Number sits right under the last number', add && row != null && add[1] - row <= 8, [add, row]);
  const tr = await ev(`(() => { const t = document.querySelector('#toastHost .toast'); if (!t) return null; const r = t.getBoundingClientRect(), h = document.querySelector('.pipe-head').getBoundingClientRect(); return [r.top >= h.top - 1 && r.bottom <= h.bottom + 1, document.getElementById('toastHost').getAttribute('data-placed')]; })()`);
  ok('regress-3: the "Added" message sits in the chain head, over no plane', tr && tr[0] && tr[1] === 'head', tr); }
// regress-1, regress-2: example 8 with the deformation; example 10's "Opened" toast and M
await openEx(8); await key('m'); await settle(1200);
{ const d = await rect('.tdock:not([hidden])'); ok('regress-1: the deformation bar is one row at 1366 × 768', d && d[3] - d[1] <= 44, d); }
await key('m'); await settle(500);
await openEx(10); await key('m'); await settle(1200);
{ const t = await ev(`(() => { const t = document.querySelector('#toastHost .toast'), d = document.querySelector('.tdock:not([hidden])'); if (!t || !d) return null; const a = t.getBoundingClientRect(), b = d.getBoundingClientRect(); return a.bottom <= b.top || a.top >= b.bottom; })()`);
  ok('regress-2: the toast is not over the deformation bar', t !== false, t); }
await key('m'); await settle(500);
// regress-5: Listen keeps the planes where they are
await nav(`${BASE}/test.html?ns=${NS}snd`); await settle(1500);
await ev(`document.querySelector('#examplesBtn').click()`); await settle(600);
await ev(`document.querySelector('#popHost .examples .ex-snd').closest('.ex-item').click()`); await settle(2500);
{ const p0 = await rect('#plotL'); const lb = await ev(`(() => { const b = document.querySelector('.tour-lane .btn.primary'); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await click(lb[0], lb[1]); await settle(1200);
  ok('regress-5: the planes do not move when Listen starts the melody', JSON.stringify(await rect('#plotL')) === JSON.stringify(p0), [p0, await rect('#plotL')]); }
// regress-9: a Tab focus shows the tip; a focus the app moves does not
await ev(`document.getElementById('undoBtn').focus(), 1`); await settle(400);
ok('regress-9: no tip for a focus the app moves', await ev(`document.getElementById('tip').hidden`));
await key('Tab'); await settle(600);
ok('regress-9: a Tab to an icon shows its tip', await ev(`!document.getElementById('tip').hidden`));
// regress-10: undoing a Midpoint names the point
await load(NS + 'u10', U0({ shapes: [{ id: 'a', kind: 'point', p: [0.5, 0.5], ci: 0 }, { id: 'b', kind: 'point', p: [1.5, -0.5], ci: 1 }], nextId: 20 })); await settle(900);
await tool('midpoint');
{ const pa = await W(0.5, 0.5), pb = await W(1.5, -0.5); await click(pa[0], pa[1]); await settle(150); await click(pb[0], pb[1]); await settle(300);
  await key('Escape'); await settle(100); await ev(`document.getElementById('undoBtn').click(), 1`); await settle(300);
  ok('regress-10: "Undid: add z₂."', /Undid: add z₂\./.test(await tstxt()), await tstxt()); }
// regress-4, user-4: the phone's hold-and-slide line once a session, whole, in Russian
await view(412, 860, true, true);
// (a phone that has not probed yet: the Point taps above, on a phone, count as a finger on the plane, cmw-probe-learned,
// which ends the teaching for good; ux165_plane_cmd.js clears it the same way)
await ev(`sessionStorage.clear(), localStorage.removeItem('cmw-probe-learned'), 1`);
await nav(`${BASE}/test.html?ns=${NS}ph&lang=ru`); await settle(1500);
{ const c = await ev(`(() => { const e = document.getElementById('leftReadout'); return [e.textContent, e.scrollWidth <= e.clientWidth + 1]; })()`);
  ok('user-4: the Russian line is whole', /Удерживайте палец\s— F\(z\)/.test(c[0]) && c[1], c);
  await sleep(8500);
  ok('regress-4: the line is gone after 8 s', !/Удерживайте/.test(await ev(`document.getElementById('leftReadout').textContent`)));
  await nav(`${BASE}/test.html?ns=${NS}ph&lang=ru`); await settle(1500);
  ok('regress-4: not again in the same session', !/Удерживайте/.test(await ev(`document.getElementById('leftReadout').textContent`))); }
// user-3: Orthogonal on the phone: Y's view stays
await view(412, 860, false, true);
await nav(`${BASE}/test.html?ns=${NS}u3`); await settle(1500);
{ const yv = () => ev(`(() => { const a = __cmwW2S('R', 0, 0), b = __cmwW2S('R', 1, 0); return Math.round((b[0] - a[0]) * 100) / 100; })()`);
  const y0 = await yv(); await tool('perp');
  for (const d of [200, 250, 300]) { const p = await A(d); await tap(p[0], p[1]); await settle(300); }
  await settle(600);
  ok('user-3: Y keeps its view after an orthogonal circle', Math.abs((await yv()) - y0) < 0.5, [y0, await yv()]); }
const lg = (await logs()).filter((x) => /EXC|error/.test(x.t) && !/Failed to load/.test(x.m));
ok('no exception or console error', !lg.length, lg.slice(0, 5));
return { checks, failed: fails.length, fails };
