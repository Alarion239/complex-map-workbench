const BASE = 'http://localhost:9709/';
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const out = {}; const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
const RECT = [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }];
const RT = (n, cut = 180) => ({ type: 'root', params: { n, cut }, on: true }), SN = { type: 'sin', params: {}, on: true }, LG = { type: 'log', params: { cut: 180, k: 0 }, on: true };
const PW = (a) => ({ type: 'powa', params: { alpha: String(a), cut: 180, k: 0 }, on: true });
const st = (steps, extra) => Object.assign({ shapes: RECT, steps, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' }, extra || {});
const open = async (ns, s, lang) => { await load(ns, s); if (lang) await nav(`${BASE}test.html?ns=${ns}&lang=${lang}`); await settle(1500); await ev('__cmwSetMain("land")'); await settle(800); };
const probe = () => ev(`(() => { const L = __cmwLandSheets(); return { K: L.drawn && L.drawn.K, hom: L.drawn && L.drawn.hom, shownK: L.shown && L.shown.K, D: L.shown && L.shown.D, title: L.title.replace(/<[^>]+>/g, ''), cap: __cmwCapText(['L']) }; })()`);
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const setView = async (w, h, dark, phone) => { await view(w, h, dark, phone); await send('Emulation.setUserAgentOverride', phone ? { userAgent: ANDROID, platform: 'Android' } : { userAgent: '' }); };
const NS = 'vw' + Date.now();
await setView(1440, 900, false, false);
// math-6
out.m6 = {};
for (const [nm, steps] of [['sqrt_sq', [RT(2), PW(2)]], ['sqrt_4', [RT(2), PW(4)]], ['cbrt_cube', [RT(3), PW(3)]]]) {
  await open(`${NS}m6${nm}`, st(steps));
  const s0 = await probe();
  await ev('__cmwMorph({ open: true, playing: false, T: 0.5 })'); await settle(900);
  const s1 = await probe();
  out.m6[nm] = { steps: (await ev('__cmwP().steps')).map((x) => x.type + JSON.stringify(x.params)), static: { K: s0.K, D: s0.D, title: s0.title, cap: s0.cap.slice(0, 400) }, def: { K: s1.K, D: s1.D, title: s1.title, cap: s1.cap.slice(0, 500) } };
  await grab();
}
// screenshots: user's case 1440 light
await open(`${NS}u`, st([RT(2), SN]));
await shot('vv-user-static');
await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(800);
for (const T of [0, 0.15, 0.5, 1]) { await ev(`__cmwMorph({ T: ${T} })`); await settle(1200); await shot('vv-user-T' + T); }
await ev('__cmwMorph({ open: false })'); await settle(1000); await shot('vv-user-closed');
await grab();
// log then sin, log bracketed: end frame vs static
await open(`${NS}l`, st([LG, SN]));
await shot('vv-log-static');
await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(800);
for (const T of [0, 0.5, 1]) { await ev(`__cmwMorph({ T: ${T} })`); await settle(1200); await shot('vv-log-T' + T); }
await grab();
// log alone (helicoid) end vs static
await open(`${NS}l2`, st([LG]));
await shot('vv-logonly-static');
await ev('__cmwMorph({ open: true, playing: false, T: 1 })'); await settle(1200); await shot('vv-logonly-T1');
await ev('__cmwMorph({ T: 0.5 })'); await settle(1200); await shot('vv-logonly-T0.5');
await grab();
// phone 390 RU dark: user case and capped chain chip
out.phone = {};
await setView(390, 844, true, true);
for (const [nm, steps, range] of [['user', [RT(2), SN], { a: 1, b: 1 }], ['capped', [RT(5), RT(6)], null], ['m5', [RT(4), LG, SN, RT(3)], { a: 1, b: 2 }]]) {
  for (const lang of ['ru', '']) {
    await open(`${NS}p${nm}${lang}`, st(steps), lang);
    const chip0 = await ev(`(() => { const e = document.querySelector('#leftReadout .rhint'); if (!e) return null; const b = e.getBoundingClientRect(); return { t: e.textContent, w: b.width, h: b.height, l: b.left, r: b.right, top: b.top, sw: e.scrollWidth, cw: e.clientWidth, vw: innerWidth }; })()`);
    await ev(`__cmwMorph(Object.assign({ open: true, playing: false }, ${JSON.stringify(range ? { range } : {})}))`); await settle(800);
    await ev('__cmwMorph({ T: 0.5 })'); await settle(1200);
    const chip = await ev(`(() => { const e = document.querySelector('#leftReadout .rhint'); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { t: e.textContent, w: b.width, h: b.height, l: b.left, r: b.right, top: b.top, sw: e.scrollWidth, cw: e.clientWidth, vw: innerWidth, ws: cs.whiteSpace, ov: cs.overflow, to: cs.textOverflow }; })()`);
    out.phone[nm + (lang || 'en')] = { chip0, chip, overflow: await ev('document.documentElement.scrollWidth > innerWidth') };
    await shot(`vv-phone-${nm}-${lang || 'en'}`);
    await grab();
  }
}
await setView(1440, 900, false, false);
out.errs = errs;
return out;
