// v16 release smoke on the PUBLISHED page (dist/complex-map-workbench.html wrapped in a UTF-8 doctype with a viewport
// meta: smk_pub.html). CFG = { lang, w, dark } is prepended. No test hooks: DOM, input events, the saved state in
// localStorage and the page's own globals (Sound) only.
const BASEU = 'http://localhost:9509/';
const phone = CFG.w < 600;
const tag = `${CFG.lang}_${CFG.w}_${CFG.dark ? 'dark' : 'light'}`;
const R = { tag, checks: {}, info: {} };
const ok = (k, v, got) => { R.checks[k] = !!v; if (got !== undefined) R.info[k] = got; };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const T = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p[0], y: p[1], id: 1, radiusX: 4, radiusY: 4, force: 1 })) });
const touch = async (x, y, ms = 60) => { await T('touchStart', [[x, y]]); await sleep(ms); await T('touchEnd', []); };
const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); if (b.width < 1 || b.height < 1) return null; return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
const press = async (sel) => { const c = await center(sel); if (!c) return false; if (phone) await touch(c[0], c[1]); else await click(c[0], c[1]); return true; };
const tap = async (x, y) => { if (phone) await touch(x, y); else await click(x, y); };
const rect = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
const errs = (l) => l.filter((x) => /EXC|error|warn/i.test(x.t) && !/favicon|Failed to load resource: the server responded with a status of 404/i.test(x.m));
const stepCards = () => ev(`[...document.querySelectorAll('#pipeline .card[data-k]:not(.region-card)')].map((c) => c.getAttribute('aria-label'))`);
const LANGQ = CFG.lang === 'ru' ? '&lang=ru' : '';
let NS = '';
const openNs = async (ns, st) => {
  NS = ns;
  await send('Page.navigate', { url: BASEU + 'blank.html' }); await sleep(300);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: BASEU + 'smk_pub.html?ns=' + ns + LANGQ }); await sleep(3000); await settle(600);
};
const saved = () => ev(`JSON.parse(localStorage.getItem('complex-map-workbench-v1:${NS}') || 'null')`);
// world -> screen on X's plane for srcView {cx, cy, s}: the plot canvas's centre, s px per unit
const W = async (re, im, sv) => { const c = await rect('#canvasL'); return [c.x + c.width / 2 + (re - sv.cx) * sv.s, c.y + c.height / 2 - (im - sv.cy) * sv.s]; };
const dist = (p, c) => Math.hypot(p[0] - c[0], p[1] - c[1]);
const parseZ = (t) => { const v = String(t).replace(/\s/g, '').replace(/−/g, '-'); const m = /^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)?(?:([-+])(\d*\.?\d*)i)?$/.exec(v); if (!m) return null; return [m[1] ? +m[1] : 0, m[2] ? (m[2] === '-' ? -1 : 1) * (m[3] === '' ? 1 : +m[3]) : 0]; };

if (phone) {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2.625, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36', platform: 'Linux armv8l', userAgentMetadata: { brands: [{ brand: 'Google Chrome', version: '141' }, { brand: 'Chromium', version: '141' }], fullVersion: '141.0.0.0', platform: 'Android', platformVersion: '14', architecture: '', model: 'Pixel 7', mobile: true } });
} else {
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 });
  await send('Emulation.setUserAgentOverride', { userAgent: '' });
}
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: CFG.dark ? 'dark' : 'light' }] });
await send('Page.navigate', { url: BASEU + 'blank.html' }); await sleep(400);
await ev('localStorage.clear(); sessionStorage.clear(); 1');
logs();
await send('Page.navigate', { url: BASEU + 'smk_pub.html' + (CFG.lang === 'ru' ? '?lang=ru' : '') }); await sleep(3500); await settle(600);
const env = await ev(`({ doctype: document.doctype && document.doctype.name, charset: document.characterSet, lang: document.documentElement.lang, ph: document.documentElement.classList.contains('ph'),
  vp: !!document.querySelector('meta[name=viewport]'), bg: getComputedStyle(document.body).backgroundColor, mobile: navigator.userAgentData && navigator.userAgentData.mobile, w: innerWidth, dpr: devicePixelRatio,
  hooks: Object.keys(window).filter((k) => /^__cmw/.test(k)).length, sw: document.documentElement.scrollWidth })`);
R.env = env;
ok('page: UTF-8 doctype, viewport meta, language, layout, no hooks, no sideways scroll', env.doctype === 'html' && env.charset === 'UTF-8' && env.vp && (env.lang || 'en') === CFG.lang && env.ph === phone && env.hooks === 0 && env.w === CFG.w && env.sw <= CFG.w, env);
await shot(`${tag}_1_start`);
const l0 = errs(logs());
ok('load: no console errors or warnings', l0.length === 0, l0.slice(0, 6));
await key('Escape'); await settle(300);

// 1. constructions: a circle through z0, z1 and the zero ζ1 of f1; dragging ζ1 moves the circle, which still passes
// through all three (read from the saved state)
{
  const sv = { cx: 0, cy: 0, s: phone ? 60 : 80 };
  await openNs('smkc' + tag + Date.now(), { shapes: [{ id: 's1', kind: 'point', p: [-1.5, 0], ci: 0, visible: true }, { id: 's2', kind: 'point', p: [0.5, -1], ci: 1, visible: true }],
    steps: [{ type: 'zp', params: { a: '1', zeros: '1+0.5i', poles: '' }, on: true }], srcView: sv, pattern: 'checker' });
  let armed = false;
  if (phone) {
    if (await press('#toolMore > summary')) { await settle(500); armed = await press('.ph-tiles .ph-tile[data-tool="circle3"]'); await settle(600); }
  } else armed = await press('#constructTools .tool[data-tool="circle3"]');
  await settle(200);
  const a = await W(-1.5, 0, sv), b = await W(0.5, -1, sv), z = await W(1, 0.5, sv);
  if (!phone) { await move(a[0], a[1]); await settle(80); }
  await tap(a[0] + 2, a[1] - 1); await settle(200);
  await tap(b[0], b[1] + 2); await settle(200);
  if (!phone) { await move(z[0] + 1, z[1]); await settle(80); }
  await tap(z[0] + 1, z[1]); await settle(700);
  await shot(`${tag}_2_circle3`);
  let st = await saved();
  const c3 = st && st.shapes.find((s) => s.def && s.def.op === 'circle3');
  const through = (c, pts) => c && pts.every((p) => Math.abs(dist(p, c.c) - c.r) <= 1e-9 * Math.max(1, c.r));
  ok('construction: Circle through 3 points makes one disc through z0, z1 and the zero ζ1', armed && !!c3 && c3.def.args[0].s === 's1' && c3.def.args[1].s === 's2' && typeof c3.def.args[2].zp === 'string' && through(c3, [[-1.5, 0], [0.5, -1], [1, 0.5]]), { armed, c3 });
  // Select, then drag ζ1
  if (phone) { if (!(await press('#tools .tool[data-tool="select"]'))) { await press('#toolMore > summary'); await settle(500); await press('.ph-tiles .ph-tile[data-tool="select"]'); } }
  else await press('#tools .tool[data-tool="select"]');
  await settle(300);
  const dx = 48, dy = -32;
  if (phone) { await T('touchStart', [z]); await sleep(120); for (let i = 1; i <= 12; i++) { await T('touchMove', [[z[0] + dx * i / 12, z[1] + dy * i / 12]]); await sleep(16); } await T('touchEnd', []); }
  else await drag(z[0], z[1], z[0] + dx, z[1] + dy, 12, 16);
  await settle(900);
  st = await saved();
  const zeta = st && parseZ(st.steps[0].params.zeros);
  const c3b = st && c3 && st.shapes.find((s) => s.id === c3.id);
  await shot(`${tag}_3_circle3_zero_dragged`);
  ok('construction: dragging the zero moves it, and the circle still passes through ζ1, z0 and z1', !!zeta && dist(zeta, [1, 0.5]) > 0.2 && !!c3b && through(c3b, [zeta, [-1.5, 0], [0.5, -1]]) && (c3b.c[0] !== c3.c[0] || c3b.c[1] !== c3.c[1]),
    { zeros: st && st.steps[0].params.zeros, c: c3b && c3b.c, r: c3b && c3b.r });
}
const lA = errs(logs());
ok('section 1: no console errors or warnings', lA.length === 0, lA.slice(0, 6));

// 2. the deformation range: [√z, f] with f1 alone deforms from f(z) to f(√z) (H_t = f2 ∘ G_t); then f2 alone, a
// push-forward of f1's image (H_t = G_t ∘ f1). Desktop: the bracket from the saved state; phone: the Display sheet's
// Deformed steps selects, whose 'from …' line must follow (review v16 verify-1)
{
  const steps = [{ type: 'custom', params: { expr: '\\sqrt{z}', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'z^2+z', cut: 180 }, on: true }];
  const shapes = [{ id: 's1', kind: 'rect', a: [-1.5, -1.2], b: [1.5, 1.2] }];
  const dock = () => ev(`(() => { const d = document.querySelector('.tdock:not([hidden])'); const q = (s) => [...document.querySelectorAll(s)].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()); return { title: (document.getElementById('rightTitle') || {}).textContent, pre: d ? q('.tdock:not([hidden]) .tpre') : [], post: d ? q('.tdock:not([hidden]) .tpost') : [], from: q('.trange .tr-from'), sels: [...document.querySelectorAll('.trange select')].map((s) => s.value), max: +(document.getElementById('morphRange') || { max: -1 }).max, range: (JSON.parse(localStorage.getItem('complex-map-workbench-v1:${NS}') || 'null') || {}).homRange || null }; })()`);
  const setSel = async (i, v) => ev(`(() => { const s = [...document.querySelectorAll('.trange select')][${i}]; if (!s) return false; s.value = '${v}'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await openNs('smkr' + tag + Date.now(), { shapes, steps, srcView: { cx: 0, cy: 0, s: phone ? 60 : 80 }, pattern: 'checker', homRange: phone ? undefined : { a: 1, b: 1 } });
  await press('#morphBtn'); await sleep(1500); await settle(300);
  let pull = null, push = null, every = null;
  if (phone) {
    const s1 = await setSel(1, '1'); await settle(600);   // f1 alone: from f2(z)
    pull = Object.assign(await dock(), { s1 });
  } else pull = await dock();
  await ev(`(() => { const r = document.getElementById('morphRange'); r.value = 0.5; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  await sleep(1500); await settle(300);
  await shot(`${tag}_4_range_pullback`);
  if (phone) {
    ok('range (phone): f1 alone deforms from f2(z) = f(z) to f(√z): the title and the row say so', /f₂|f2/.test(pull.title || '') && pull.from.length >= 1 && pull.from.every((t) => /f₂\s*\(\s*z\s*\)|f2\(z\)/.test(t)) && pull.sels.join() === '1,1', pull);
  } else {
    ok('range: f1 alone deforms from f2(z) = f(z) to f(√z) (→ f2 after the scrubber, the title names the start)', pull && pull.post.length === 1 && /f₂|f2/.test(pull.post[0]) && pull.pre.length === 0 && /f₂|f2/.test(pull.title || '') && pull.max === 1, pull);
  }
  // push-forward: f2 alone
  if (phone) {
    await setSel(1, '2'); await settle(400); every = await dock();
    await setSel(0, '2'); await settle(700); push = await dock();
    ok('range (phone, verify-1): the row\'s "from …" follows the selects (every step: from z; f2 alone: from w1)', every.from.every((t) => /\bz\b/.test(t) && !/f₂|w/.test(t)) && push.from.length >= 1 && push.from.every((t) => /w₁|w1/.test(t)) && push.sels.join() === '2,2', { every, push });
  } else {
    await openNs('smkr2' + tag + Date.now(), { shapes, steps, srcView: { cx: 0, cy: 0, s: 80 }, pattern: 'checker', homRange: { a: 2, b: 2 } });
    await press('#morphBtn'); await sleep(1500); await settle(300);
    push = await dock();
  }
  await ev(`(() => { const r = document.getElementById('morphRange'); r.value = 0.5; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  await sleep(1500); await settle(300);
  await shot(`${tag}_5_range_pushforward`);
  if (!phone) ok('range: f2 alone, a push-forward of f1\'s image (f1 → before the scrubber, the title starts at w1)', push.pre.length === 1 && /f₁|f1/.test(push.pre[0]) && push.post.length === 0 && /w₁|w1/.test(push.title || ''), push);
  await key('Escape'); await settle(300);
}
const lB = errs(logs());
ok('section 2: no console errors or warnings', lB.length === 0, lB.slice(0, 6));

// 3. the Mountain King example: opened from the gallery, its hint sits in X's note chip (not a toast over the plane,
// review v16 verify-7) with Listen; Listen plays the piece along the spiral (its harp counts the notes)
{
  await openNs('smkm' + tag + Date.now(), { shapes: [], steps: [] });
  if (!phone) { await click(700, 12); } else { await touch(200, 12); }
  await settle(300);
  const NAME = { en: 'In the Hall of the Mountain King', ru: 'В пещере горного короля' }[CFG.lang];
  let opened = false;
  // (a phone's More sheet row runs the same button: examplesBtn.click())
  if (phone ? await ev(`(() => { const b = document.getElementById('examplesBtn'); if (!b) return false; b.click(); return true; })()`) : await press('#examplesBtn')) {
    await settle(700);
    const it = await ev(`(() => { const its = [...document.querySelectorAll('.examples .ex-item, .ex-item')]; const i = its.findIndex((b) => (b.querySelector('.ex-name') || b).textContent.includes(${JSON.stringify(NAME)})); if (i < 0) return null; its[i].scrollIntoView({ block: 'nearest' }); const q = its[i].getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
    if (it) { await tap(it[0], it[1]); opened = true; }
  }
  await sleep(2500); await settle(400);
  const hint = await ev(`(() => { const hd = document.getElementById('paneHintL'), c = document.getElementById('sphereChipL'); const el = hd && !hd.hidden ? hd : c && !c.hidden ? c : null; const b = el && el.querySelector('.toast-act'); const r = el ? el.getBoundingClientRect() : null; const pr = document.getElementById('canvasL').getBoundingClientRect(); return { where: el === hd && el ? 'title row' : el ? 'note chip' : null, text: el ? el.textContent.trim() : null, btn: !!(b && b.getBoundingClientRect().width), r: r && [r.left, r.top, r.right, r.bottom].map(Math.round), plane: [pr.left, pr.top, pr.right, pr.bottom].map(Math.round), overPlane: !!(r && r.bottom > pr.top && r.top < pr.bottom && r.right > pr.left && r.left < pr.right), toast: [...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent.trim()) }; })()`);
  await shot(`${tag}_6_mountain_king_open`);
  ok('Mountain King: opens; its hint (with Listen) is in X\'s title row on desktop, over no plane; no toast', opened && !!hint.text && hint.btn && hint.toast.length === 0 && (phone || (hint.where === 'title row' && !hint.overPlane)), { opened, hint });
  await ev(`(() => { const o = Sound.harpAlong; window.__smkHA = null; Sound.harpAlong = function (...a) { const r = o.apply(this, a); window.__smkHA = r; return r; }; return 1; })()`);
  const bc = (await center('#paneHintL .toast-act')) || (await center('#sphereChipL .chip-act'));
  if (bc) await tap(bc[0], bc[1]);
  const tPlay = (await settled({ until: '!!window.__smkHA', max: 6000, only: true })).at;
  await sleep(1500);
  const ha = await ev(`({ h: window.__smkHA && { up: __smkHA.up, down: __smkHA.down, notes: __smkHA.notes }, snd: { on: Sound.state().on, audio: Sound.state().audio, events: Sound.state().events }, chip: (document.getElementById('sphereChipL') || {}).textContent, hidden: (document.getElementById('sphereChipL') || {}).hidden })`);
  await shot(`${tag}_7_mountain_king_listen`);
  ok('Mountain King: Listen plays the piece along the spiral (its harp counts the notes; the chip says Listening along)', tPlay >= 0 && ha.h && ha.h.notes >= 20 && ha.snd.on && ha.snd.audio === 'running' && /Listening along|Слушаем|Прослуш|вдоль/i.test(ha.chip || ''), ha);
  await key('Escape'); await settle(500);
}
const lC = errs(logs());
ok('section 3: no console errors or warnings', lC.length === 0, lC.slice(0, 6));

// 4. the harp on a loop: F = z, the probe twice round the zero at X's centre (60 px); its low Ds count the turns
{
  await openNs('smkh' + tag + Date.now(), { steps: [{ type: 'custom', params: { expr: 'z', cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 120 } });
  if (!phone) { await click(5, 300); await settle(200); } else { await touch(5, 120); await settle(200); }
  await ev(`Sound.set({ on: true, vol: 0.7, ui: true, events: true, sonify: true }, { quiet: true }); await new Promise((r) => setTimeout(r, 600)); 1`);
  const cl = await rect('#canvasL');
  const C0 = [cl.x + cl.width / 2, cl.y + cl.height / 2];
  const P = (r, a) => [C0[0] + r * Math.cos(a), C0[1] - r * Math.sin(a)];
  const a0 = 0.45, rr = 60, laps = 2, N = 64;
  await ev('Sound.harpCount(); 1');
  if (phone) {
    await T('touchStart', [P(rr, a0)]); await sleep(650);
    for (let i = 1; i <= N * laps; i++) { await T('touchMove', [P(rr, a0 + 2 * Math.PI * i / N)]); await sleep(16); }
    for (let i = 1; i <= 8; i++) { await T('touchMove', [P(rr, a0 + 2 * Math.PI * laps + i * 0.04)]); await sleep(16); }
    await settle(250); R.harp = await ev('Sound.harpCount()'); await T('touchEnd', []); await settle(300);
  } else {
    await move(...P(rr, a0)); await settle(250); await ev('Sound.harpCount(); 1');
    for (let i = 1; i <= N * laps; i++) { await move(...P(rr, a0 + 2 * Math.PI * i / N)); await sleep(16); }
    for (let i = 1; i <= 8; i++) { await move(...P(rr, a0 + 2 * Math.PI * laps + i * 0.04)); await sleep(16); }
    await settle(250); R.harp = await ev('Sound.harpCount()');
  }
  ok('harp: two laps round the zero of F = z give 2 low Ds up, 0 down, with the scale', R.harp && R.harp.up === 2 && R.harp.down === 0 && R.harp.notes >= 9, R.harp);
}
const lD = errs(logs());
ok('section 4: no console errors or warnings', lD.length === 0, lD.slice(0, 6));

// 5. the search: sin z adds the Sine step; \sin(z^2+1) splits into its 3 steps, and Undo brings the one step back
{
  const shapes = [{ id: 's1', kind: 'rect', a: [-1.5, -1.2], b: [1.5, 1.2] }];
  await openNs('smks' + tag + Date.now(), { shapes, steps: [], srcView: { cx: 0, cy: 0, s: phone ? 60 : 80 } });
  const openSearch = async () => { const okp = await press('#addStepBtn'); await settle(500); return okp && await ev(`!!document.getElementById('palInput')`); };
  const s1 = await openSearch();
  await ev(`document.getElementById('palInput').focus(); 1`);
  await type('sin z'); await settle(500);
  await key('Enter'); await settle(800);
  const cSin = await stepCards();
  ok('search: sin z + Enter adds the Sine step (not a formula)', s1 && cSin.length === 1 && /Sine|Синус/.test(cSin[0]) && !/formula|формул/i.test(cSin[0]), cSin);
  await key('z', 2); await settle(600);
  const s2 = await openSearch();
  await ev(`document.getElementById('palInput').focus(); 1`);
  await type('\\sin(z^2+1)'); await settle(900);
  await shot(`${tag}_8_search_sin_z2`);
  await key('Enter'); await settle(1000);
  const cF = await stepCards();
  const soAt = () => ev(`(() => { const b = [...document.querySelectorAll('.split-offer .so-btn')].find((e) => e.getBoundingClientRect().width > 0); if (!b) return null; b.scrollIntoView({ block: 'center' }); return 1; })()`).then(async (f) => { if (!f) return null; await settle(500); return ev(`(() => { const b = [...document.querySelectorAll('.split-offer .so-btn')].find((e) => e.getBoundingClientRect().width > 0); const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y); return e === b || b.contains(e) ? [x, y] : null; })()`); });
  let so = await soAt();
  if (!so && phone) { await press('#pipeline .card[data-k="1"]'); await settle(800); so = await soAt(); }
  if (so) await tap(so[0], so[1]);
  await settle(1200);
  const cS = await stepCards();
  await shot(`${tag}_9_split_done`);
  await key('Escape'); await settle(200);
  await ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(); 1`);
  await key('z', 2); await settle(900);
  const cB = await stepCards();
  ok('split: \\sin(z^2+1) splits into its 3 steps, and Undo brings the one step back', s2 && cF.length === 1 && !!so && cS.length === 3 && cB.length === 1, { cF, cS, cB });
  await shot(`${tag}_10_split_undone`);
}
const l1 = errs(logs());
ok('section 5: no console errors or warnings', l1.length === 0, l1.slice(0, 8));
R.pass = Object.values(R.checks).every(Boolean);
R.fails = Object.keys(R.checks).filter((k) => !R.checks[k]);
return R;
