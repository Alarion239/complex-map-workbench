// v16.3 release smoke (v16.2's rel162_smoke_cmd.js, sections 1 to 9, plus the v16.3 constructions: 10 a hyperbolic line
// in the unit disk and its drag, 11 a touching circle and the tangent from an outside point) on the PUBLISHED page (dist/complex-map-workbench.html wrapped in a UTF-8 doctype with a viewport
// meta: smk_pub.html). CFG = { lang, w, dark } is prepended. No test hooks: DOM, input events, the saved state in
// localStorage and the page's own globals (Sound) only.
const BASEU = 'http://localhost:9828/';
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
const cssAt = await ev(`(() => { let n = 0, has = []; const walk = (rs) => { for (const r of rs) { if (r.selectorText) { n++; if (r.selectorText.includes(':has(') && r.selectorText.includes('[style')) has.push(r.selectorText); } if (r.cssRules) walk(r.cssRules); } }; for (const s of document.styleSheets) { try { walk(s.cssRules); } catch (e) {} } return { n, has }; })()`);
ok('fix deform_range_fps: no :has() rule on a style attribute (--at) in the page\'s CSS', cssAt.n > 100 && cssAt.has.length === 0, cssAt);
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

// 2b. (fix deform_range_fps) the transport while the deformation plays: the readout's Text node changes, never the
// node itself; paused, the scrubber shows t exactly; style recalc time over 2 s of play is reported
{
  await openNs('smkt' + tag + Date.now(), { steps: [{ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 120 }, loop: true });
  // (DOM clicks here: this section checks the transport's updates, sections 1 to 5 check the touch input)
  await ev(`document.getElementById('morphBtn').click(); 1`); await sleep(1200); await settle(300);
  await ev(`(() => { const l = document.getElementById('morphLabel'); window.__smkMO = { cl: 0, cd: 0, n0: l && l.firstChild }; if (!l) return 0; new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'childList') __smkMO.cl++; else if (m.type === 'characterData') __smkMO.cd++; } }).observe(l, { childList: true, characterData: true, subtree: true }); return 1; })()`);
  const lab = () => ev(`(document.getElementById('morphLabel') || {}).textContent || ''`);
  const moving = async () => { const a = await lab(); await sleep(350); return a !== (await lab()); };
  const playBtn = async () => ev(`(() => { const b = document.getElementById('morphPlay'); if (!b) return false; b.click(); return true; })()`);
  // playing or not: the button's label (Pause / Пауза), not the readout (it rests on t = 1 for a moment each loop)
  const playing = () => ev(`/^(Pause|Пауза)$/.test((document.getElementById('morphPlay') || { getAttribute: () => '' }).getAttribute('aria-label') || '')`);
  await sleep(2500);
  const pl0 = await playing();
  if (!pl0) { await playBtn(); await sleep(300); }
  const pl = await playing();
  R.info.transportPlay = { pl0, pl };
  await ev(`__smkMO.cl = 0; __smkMO.cd = 0; __smkMO.n0 = document.getElementById('morphLabel').firstChild; 1`);
  await sleep(200);
  await send('Performance.enable', { timeDomain: 'threadTicks' });
  const m0 = Object.fromEntries((await send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await sleep(2000);
  const m1 = Object.fromEntries((await send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await send('Performance.disable', {});
  const mo = await ev(`({ cl: __smkMO.cl, cd: __smkMO.cd, same: !!__smkMO.n0 && document.getElementById('morphLabel').firstChild === __smkMO.n0 })`);
  await playBtn(); await sleep(400); await settle(300);
  const pa = !(await playing()) && !(await moving());
  const tr = await ev(`(() => { const l = document.getElementById('morphLabel'), r = document.getElementById('morphRange'); return { label: l && l.textContent, value: r && +r.value, max: r && +r.max }; })()`);
  const tl = tr.label && /t\s*=\s*([\d.,]+)/.exec(tr.label);
  const tLab = tl ? +tl[1].replace(',', '.') : NaN;
  R.info.transportStyle = { recalcMs: +((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000).toFixed(1), recalcN: m1.RecalcStyleCount - m0.RecalcStyleCount, layoutMs: +((m1.LayoutDuration - m0.LayoutDuration) * 1000).toFixed(1), taskMs: +((m1.TaskDuration - m0.TaskDuration) * 1000).toFixed(1) };
  await shot(`${tag}_5b_transport_paused`);
  ok('fix deform_range_fps: playing, the readout changes its Text node only; paused, the scrubber shows t exactly', pl && pa && mo.cd >= 5 && mo.cl === 0 && mo.same && Number.isFinite(tLab) && Math.abs(tr.value - tLab) <= 0.0051 && tr.value > 0, { mo, tr, tLab });
  await key('Escape'); await settle(300);
}
const lB2 = errs(logs());
ok('section 2b: no console errors or warnings', lB2.length === 0, lB2.slice(0, 6));

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
  const hint = await ev(`(() => { const hd = document.getElementById('paneHintL'), c = document.getElementById('sphereChipL'); const ht = hd && !hd.hidden && hd.querySelector('.pane-hint-t'); const head = hd && (hd.closest('.pane-head') || hd.parentElement); const sq = head && !hd.hidden ? [...head.querySelectorAll('*')].filter((e) => e !== hd && !hd.contains(e) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map((e) => String(e.className || e.tagName) + ':' + e.scrollWidth + '>' + e.clientWidth) : []; const cut = ht ? { t: ht.textContent, sw: ht.scrollWidth, cw: ht.clientWidth, cut: ht.scrollWidth > ht.clientWidth + 1, squeezed: sq } : null; const el = hd && !hd.hidden ? hd : c && !c.hidden ? c : null; const b = el && el.querySelector('.toast-act'); const r = el ? el.getBoundingClientRect() : null; const pr = document.getElementById('canvasL').getBoundingClientRect(); return { where: el === hd && el ? 'title row' : el ? 'note chip' : null, text: el ? el.textContent.trim() : null, btn: !!(b && b.getBoundingClientRect().width), r: r && [r.left, r.top, r.right, r.bottom].map(Math.round), plane: [pr.left, pr.top, pr.right, pr.bottom].map(Math.round), overPlane: !!(r && r.bottom > pr.top && r.top < pr.bottom && r.right > pr.left && r.left < pr.right), toast: [...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent.trim()), cut }; })()`);
  await shot(`${tag}_6_mountain_king_open`);
  ok('Mountain King: opens; its hint (with Listen) is in X\'s title row on desktop, over no plane; no toast', opened && !!hint.text && hint.btn && hint.toast.length === 0 && (phone || (hint.where === 'title row' && !hint.overPlane)), { opened, hint });
  if (!phone) ok('fix smoke-ru-hint: the title-row hint is not cut and squeezes nothing' + (CFG.lang === 'ru' ? ' (the new, shorter Russian string)' : ''), !!hint.cut && !hint.cut.cut && hint.cut.squeezed.length === 0 && (CFG.lang !== 'ru' || hint.cut.t === 'Правой кнопкой по спирали: «Слушать вдоль кривой».'), hint.cut);
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

// 6. (user's points) the tour's Draw step lights the Disc tool alone: of the visible tool buttons, only Disc sits in a
// lit area; then 7. the cards step shows the pictures when the chain shows Names, and ending the tour puts Names back
{
  await openNs('smkt6' + tag + Date.now(), { shapes: [], steps: [] });
  await ev('Tour.dismissSuggestion && Tour.dismissSuggestion(); 1');
  await ev(`await Tour.start({ chapter: 'basics', step: 4 })`); await sleep(1600); await settle(400);
  const lit = await ev(`(() => { const c = Tour.current(), L = Tour.lit(); if (!L) return { c }; const hs = L.holes; const inH = (x, y) => hs.some((h) => x >= h.l && x <= h.r && y >= h.t && y <= h.b);
    const tools = [...document.querySelectorAll('.tool[data-tool], .ph-tile[data-tool]')].filter((e) => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const x = r.left + r.width / 2, y = r.top + r.height / 2; const t = document.elementFromPoint(x, y); return x > 0 && y > 0 && x < innerWidth && y < innerHeight; });
    const litTools = tools.filter((e) => { const r = e.getBoundingClientRect(); return inH(r.left + r.width / 2, r.top + r.height / 2); }).map((e) => e.dataset.tool);
    return { c, holes: hs.length, tools: tools.map((e) => e.dataset.tool), litTools, mark: (document.querySelector('.tour-mark') || { getAttribute: () => '' }).getAttribute('d') ? true : false }; })()`);
  await shot(`${tag}_11_tour_draw`);
  ok('tour: the Draw step lights the Disc tool alone', lit.c && lit.c.id === 'draw' && lit.litTools && lit.litTools.length >= 1 && lit.litTools.every((t) => t === 'disc') && lit.tools.length > lit.litTools.length, lit);
  await ev('Tour.isActive() && Tour.stop()'); await sleep(500); await settle(300);
  // the cards step (chapter Editing the chain, its first step)
  const chain = () => ev(`(() => { const p = document.querySelector('#pipeline'); const cs = [...document.querySelectorAll('#pipeline .card[data-k]:not(.region-card)')]; const pics = cs.filter((c) => [...c.querySelectorAll('canvas, img')].some((x) => { const r = x.getBoundingClientRect(); return r.width >= 40 && r.height >= 30; })).length;
    return { compact: !!(p && p.classList.contains('compact')), h: document.documentElement.style.getPropertyValue('--chain-h'), hpx: p ? Math.round(p.getBoundingClientRect().height) : 0, cards: cs.length, pics }; })()`);
  await openNs('smkt7' + tag + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [-1.5, -1.2], b: [1.5, 1.2] }], steps: [{ type: 'custom', params: { expr: 'z^2', cut: 180 }, on: true }] });
  await ev('Tour.dismissSuggestion && Tour.dismissSuggestion(); 1');
  if (!phone) { await press('#chainMode [data-mode="compact"]'); await settle(500); }
  const before = await chain();
  await ev(`await Tour.start({ chapter: 'edit', step: 0 })`); await sleep(2200); await settle(400);
  const cur = await ev('Tour.current()');
  const during = await chain();
  await shot(`${tag}_12_tour_cards`);
  await ev('Tour.isActive() && Tour.stop()'); await sleep(800); await settle(300);
  const after = await chain();
  if (!phone) ok('tour: from Names, the cards step shows the pictures, and ending the tour puts Names back', before.compact && cur && cur.id === 'cards' && !during.compact && during.pics >= 1 && after.compact === before.compact && after.h === before.h, { before, cur, during, after });
  else ok('tour (phone): the cards step shows the chain bar\'s pictures; the chain is as before afterwards', cur && cur.id === 'cards' && during.pics >= 1 && JSON.stringify(after) === JSON.stringify(before), { before, cur, during, after });
  if (!phone) await press('#chainMode [data-mode="cards"]');
}
const lE = errs(logs());
ok('section 6-7: no console errors or warnings', lE.length === 0, lE.slice(0, 6));

// 8. (user's points) sin √z with √ bracketed, Landscape, All sheets, height Im: the title names F's sheets while
// deforming; at t = 0 H_0 = sin z (the two sheets coincide: one surface), at t = 1 sin √z on both sheets (two); the
// counts are checked with hooks in sheets_smoke_cmd.js, this section shows the published page
{
  const steps = [{ type: 'root', params: { n: 2, cut: 180 }, on: true }, { type: 'sin', params: {}, on: true }];
  await openNs('smks8' + tag + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im', homRange: { a: 1, b: 1 } });
  await press('#viewSwitch [data-mode="land"]'); await sleep(1500); await settle(300);
  await press('#morphBtn'); await sleep(1500); await settle(300);
  const setT = async (v) => { await ev(`(() => { const r = document.getElementById('morphRange'); r.value = ${v}; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`); await sleep(1500); await settle(400); };
  const title = () => ev(`(() => { const re = ${CFG.lang === 'ru' ? '/на обоих листах/' : '/on both sheets of/'}; const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }; const hits = [...document.querySelectorAll('body *')].filter((e) => re.test(e.textContent) && vis(e)).sort((a, b) => a.textContent.length - b.textContent.length); const e = hits[0] || null; const c = document.querySelector('#leftReadout .rhint'); const pl = document.getElementById('morphPlay'); return { title: e ? e.textContent : null, where: e ? (e.id || String(e.className)) : null, main: (document.querySelector('#viewSwitch [aria-checked="true"]') || {}).dataset ? document.querySelector('#viewSwitch [aria-checked="true"]').dataset.mode : null, chip: c ? c.textContent : null, range: (document.getElementById('morphRange') || {}).value, playing: pl && /^(Pause|Пауза)$/.test(pl.getAttribute('aria-label') || '') }; })()`);
  const pl = await title();
  if (pl.playing) { await ev(`document.getElementById('morphPlay').click(); 1`); await sleep(400); }
  await setT(0); const t0 = await title(); await shot(`${tag}_13_sinsqrt_sheets_t0`);
  await setT(1); const t1 = await title(); await shot(`${tag}_14_sinsqrt_sheets_t1`);
  const re = CFG.lang === 'ru' ? /на обоих листах F/ : /on both sheets of F/;
  const has = (o) => re.test(o.title || '') || re.test(o.chip || '');
  ok('sheets: sin √z, √ bracketed, Landscape, All sheets: the title (phone: the chip) names F\'s sheets at t = 0 and t = 1', has(t0) && has(t1), { t0, t1 });
  await key('Escape'); await settle(300);
}
const lF = errs(logs());
ok('section 8: no console errors or warnings', lF.length === 0, lF.slice(0, 6));

// 9. (user's points) More formats opens over the Export figure dialog: on top (elementFromPoint at its centre and
// corner is in it), inside the viewport, the focus in it; Esc closes the menu and leaves the dialog
{
  await openNs('smkx9' + tag + Date.now(), { shapes: [{ id: 's1', kind: 'disc', c: [0.3, 0.2], r: 1, ci: 0, visible: true }], steps: [{ type: 'custom', params: { expr: 'z^2', cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: phone ? 60 : 80 } });
  await key('e', 2);
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) { await sleep(150); ready = await ev(`(() => { const m = document.querySelector('.modal.xf'), b = document.getElementById('xfMore'); return !!(m && b && !b.disabled && b.getBoundingClientRect().width > 0); })()`); }
  const MP = `(() => { const p = document.querySelector('#popHost .pop.menu'), m = document.querySelector('.modal.xf'); if (!p) return { open: false, dialog: !!m };
    const r = p.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), e2 = document.elementFromPoint(r.left + 8, r.top + 8);
    return { open: true, dialog: !!m, rect: [r.left, r.top, r.width, r.height].map(Math.round), z: +getComputedStyle(p).zIndex, zm: +getComputedStyle(document.querySelector('.modal-bg')).zIndex,
      onTop: !!(e && p.contains(e)) && !!(e2 && p.contains(e2)), inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, focus: p.contains(document.activeElement) ? document.activeElement.textContent.trim() : null, items: [...p.querySelectorAll('[role=menuitem], button')].map((b) => b.textContent.trim()).slice(0, 6) }; })()`;
  let a = { open: false };
  const c = await ev(`(() => { const e = document.getElementById('xfMore'); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  if (ready && c) { await tap(c[0], c[1]); await sleep(450); a = await ev(MP); }
  await shot(`${tag}_15_export_more_formats`);
  await key('Escape'); await sleep(300);
  const x = await ev(`({ menu: !!document.querySelector('#popHost .pop.menu'), dialog: !!document.querySelector('.modal.xf') })`);
  ok('export: More formats opens over the dialog, inside the viewport, with the focus in it; Esc closes only the menu', ready && a.open && a.dialog && a.z > a.zm && a.onTop && a.inView && !!a.focus && !x.menu && x.dialog, { ready, a, x });
  await key('Escape'); await settle(300);
}
const lG = errs(logs());
ok('section 9: no console errors or warnings', lG.length === 0, lG.slice(0, 6));
// 10. a hyperbolic line in the unit disk: Perpendicular circle on the shown unit circle through two points inside;
// then P dragged: K still passes through P and Q and crosses the unit circle at right angles (read from the saved state)
const armTool = async (id) => {
  // (phone: the More sheet scrolls; in Russian the sixth Construct tile is below the sheet's fold until scrolled to.
  // The tile must then be on top at its centre: reachable, not covered)
  if (phone) {
    if (!(await press('#toolMore > summary'))) return false;
    await settle(500);
    const vis = await ev(`(() => { const t = document.querySelector('.ph-tiles .ph-tile[data-tool="${id}"]'); if (!t) return null; t.scrollIntoView({ block: 'nearest' }); const r = t.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y); return { inView: r.top >= 0 && r.bottom <= innerHeight, onTop: !!e && (e === t || t.contains(e)) }; })()`);
    await settle(300);
    R.info['tile ' + id] = vis;
    const a = !!vis && vis.inView && vis.onTop && await press(`.ph-tiles .ph-tile[data-tool="${id}"]`); await settle(600); return a;
  }
  const a = await press(`#constructTools .tool[data-tool="${id}"]`); await settle(200); return a;
};
const selectTool = async () => {
  if (phone) { if (!(await press('#tools .tool[data-tool="select"]'))) { await press('#toolMore > summary'); await settle(500); await press('.ph-tiles .ph-tile[data-tool="select"]'); } }
  else await press('#tools .tool[data-tool="select"]');
  await settle(300);
};
const pdrag = async (p, dx, dy) => {
  if (phone) { await T('touchStart', [p]); await sleep(120); for (let i = 1; i <= 12; i++) { await T('touchMove', [[p[0] + dx * i / 12, p[1] + dy * i / 12]]); await sleep(16); } await T('touchEnd', []); }
  else await drag(p[0], p[1], p[0] + dx, p[1] + dy, 12, 16);
};
const through = (c, pts, tol = 1e-12) => c && isFinite(c.r) && pts.every((p) => Math.abs(dist(p, c.c) - c.r) <= tol * Math.max(1, c.r));
const lineDist = (L, p) => { const d = [L.b[0] - L.a[0], L.b[1] - L.a[1]], n = Math.hypot(d[0], d[1]); return Math.abs(d[0] * (p[1] - L.a[1]) - d[1] * (p[0] - L.a[0])) / n; };
{
  const sv = { cx: 0, cy: 0, s: phone ? 120 : 150 };
  await openNs('smkh10' + tag + Date.now(), { shapes: [], steps: [{ type: 'recip', params: {}, on: true }], srcView: sv, unit: true, snap: true, pattern: 'checker' });
  const armed = await armTool('perp');
  const u = await W(Math.cos(0.9), Math.sin(0.9), sv);
  if (!phone) { await move(u[0] + 2, u[1] - 1); await settle(100); }
  await tap(u[0] + 2, u[1] - 1); await settle(250);
  const a = await W(0.3, 0.2, sv), b = await W(-0.6, 0.5, sv);
  if (!phone) { await move(a[0], a[1]); await settle(80); }
  await tap(a[0], a[1]); await settle(250);
  if (!phone) { await move(b[0], b[1]); await settle(150); }
  await tap(b[0], b[1]); await settle(700);
  await shot(`${tag}_16_hyperbolic_line`);
  let st = await saved();
  const K = st && st.shapes.find((s) => s.def && s.def.op === 'perp');
  const Cid = K && K.def.args[0].s, Pid = K && K.def.args[1].s, Qid = K && K.def.args[2].s;
  const C = st && st.shapes.find((s) => s.id === Cid), P = st && st.shapes.find((s) => s.id === Pid), Q = st && st.shapes.find((s) => s.id === Qid);
  const orth = (k) => k && Math.abs(k.c[0] * k.c[0] + k.c[1] * k.c[1] - k.r * k.r - 1) <= 1e-12 * Math.max(1, k.r * k.r);
  ok('hyperbolic line: Perpendicular circle on the unit circle through two points inside: a circle through both, at right angles to the unit circle',
    armed && !!K && K.kind === 'circle' && C && C.kind === 'circle' && C.r === 1 && C.c[0] === 0 && C.c[1] === 0 && P && Q && Math.hypot(...P.p) < 1 && Math.hypot(...Q.p) < 1 && through(K, [P.p, Q.p]) && orth(K),
    { armed, K: K && { kind: K.kind, c: K.c, r: K.r, def: K.def }, C: C && { c: C.c, r: C.r }, P: P && P.p, Q: Q && Q.p });
  await selectTool();
  const pz = P ? await W(P.p[0], P.p[1], sv) : a;
  await pdrag(pz, phone ? 30 : 40, phone ? 24 : 30);
  await settle(900);
  st = await saved();
  const K2 = K && st.shapes.find((s) => s.id === K.id), P2 = P && st.shapes.find((s) => s.id === P.id), Q2 = Q && st.shapes.find((s) => s.id === Q.id);
  await shot(`${tag}_17_hyperbolic_line_dragged`);
  ok('hyperbolic line: P dragged inside the disk: K follows, through the new P and Q, still at right angles to the unit circle',
    !!K2 && !!P2 && dist(P2.p, P.p) > 0.1 && Math.hypot(...P2.p) < 1 && through(K2, [P2.p, Q2.p]) && orth(K2) && (K2.c[0] !== K.c[0] || K2.c[1] !== K.c[1]),
    { P: P2 && P2.p, K: K2 && { kind: K2.kind, c: K2.c, r: K2.r } });
  await key('Escape'); await settle(300);
}
const lH = errs(logs());
ok('section 10: no console errors or warnings', lH.length === 0, lH.slice(0, 6));

// 11. Touching circle on a circle C: T on C's stroke at 1, P = 2 + i: K touches C at T and passes through P;
// then (C stays picked) P' = -1.5 + 1.5i outside C and a tap on the upper ring: the tangent from P' and its touching point
{
  const sv = phone ? { cx: 0.25, cy: 0.25, s: 80 } : { cx: 0.25, cy: 0.25, s: 100 };
  await openNs('smkt11' + tag + Date.now(), { shapes: [{ id: 'c1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [{ type: 'recip', params: {}, on: true }], srcView: sv, unit: false, snap: true, pattern: 'checker' });
  const armed = await armTool('touch');
  const u = await W(Math.cos(2.2), Math.sin(2.2), sv);
  if (!phone) { await move(u[0] + 2, u[1] - 2); await settle(100); }
  await tap(u[0] + 2, u[1] - 2); await settle(250);
  const t0 = await W(1, 0, sv);
  if (!phone) { await move(t0[0] + 3, t0[1]); await settle(100); }
  await tap(t0[0] + 3, t0[1]); await settle(250);
  const p0 = await W(2, 1, sv);
  if (!phone) { await move(p0[0], p0[1]); await settle(150); }
  await tap(p0[0], p0[1]); await settle(700);
  await shot(`${tag}_18_touching_circle`);
  let st = await saved();
  const K = st && st.shapes.find((s) => s.def && s.def.op === 'touch');
  const Tp = K && st.shapes.find((s) => s.id === K.def.args[1].s), Pp = K && st.shapes.find((s) => s.id === K.def.args[2].s);
  const C = st && st.shapes.find((s) => s.id === 'c1');
  const tangentAt = (k, c, t) => k && Math.abs(Math.abs(dist(k.c, c.c) - k.r) - c.r) <= 1e-12 * Math.max(1, k.r) || k && Math.abs(dist(k.c, c.c) - (k.r + c.r)) <= 1e-12 * Math.max(1, k.r);
  ok('touching circle: T on C at 1 (a glider), P = 2 + i: K passes through T and P and touches C at T',
    armed && !!K && K.kind === 'circle' && K.def.args[0].s === 'c1' && Tp && Tp.def && Tp.def.op === 'glider' && Tp.p[0] === 1 && Tp.p[1] === 0 && Pp && Pp.p[0] === 2 && Pp.p[1] === 1 && through(K, [Tp.p, Pp.p]) && tangentAt(K, C, Tp.p),
    { armed, K: K && { kind: K.kind, c: K.c, r: K.r, def: K.def }, T: Tp && { p: Tp.p, def: Tp.def }, P: Pp && Pp.p });
  // the tangent from an outside point: C is still picked; P' then the upper ring
  const q = await W(-1.5, 1.5, sv);
  if (!phone) { await move(q[0], q[1]); await settle(100); }
  await tap(q[0], q[1]); await settle(400);
  await shot(`${tag}_19_tangent_rings`);
  const d = [-1.5, 1.5], dd = 4.5, h = Math.sqrt(dd - 1) / dd;
  const rings = [[d[0] / dd - h * d[1], d[1] / dd + h * d[0]], [d[0] / dd + h * d[1], d[1] / dd - h * d[0]]];
  const up = rings[0][1] > rings[1][1] ? rings[0] : rings[1];
  const uz = await W(up[0], up[1], sv);
  if (!phone) { await move(uz[0] + 4, uz[1] - 3); await settle(120); }
  await tap(uz[0] + 4, uz[1] - 3); await settle(700);
  await shot(`${tag}_20_tangent_made`);
  st = await saved();
  const L = st && st.shapes.find((s) => s.def && s.def.op === 'tangent');
  const M = L && st.shapes.find((s) => s.def && s.def.op === 'meet' && s.def.args.some((a) => a.s === L.id));
  const P2 = L && st.shapes.find((s) => s.id === L.def.args[1].s);
  ok('tangent from an outside point: the ring gives a tangent line through P\' at distance r from C\'s centre, and its touching point on C',
    !!L && L.kind === 'line' && L.def.args[0].s === 'c1' && P2 && P2.p[0] === -1.5 && P2.p[1] === 1.5 && lineDist(L, P2.p) <= 1e-12 && Math.abs(lineDist(L, [0, 0]) - 1) <= 1e-12 && !!M && Math.abs(Math.hypot(...M.p) - 1) <= 1e-12 && lineDist(L, M.p) <= 1e-12 && dist(M.p, up) <= 1e-9,
    { L: L && { kind: L.kind, a: L.a, b: L.b, def: L.def }, M: M && { p: M.p, def: M.def }, P: P2 && P2.p, up });
  await key('Escape'); await settle(300);
}
const lI = errs(logs());
ok('section 11: no console errors or warnings', lI.length === 0, lI.slice(0, 6));
R.pass = Object.values(R.checks).every(Boolean);
R.fails = Object.keys(R.checks).filter((k) => !R.checks[k]);
return R;
