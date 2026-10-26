const BASE = 'http://localhost:9709/';
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const out = {}; const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
const RECT = [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }];
const RT = (n, cut = 180) => ({ type: 'root', params: { n, cut }, on: true }), SN = { type: 'sin', params: {}, on: true }, LG = { type: 'log', params: { cut: 180, k: 0 }, on: true };
const st = (steps, extra) => Object.assign({ shapes: RECT, steps, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' }, extra || {});
const open = async (ns, s, lang) => { await load(ns, s); if (lang) await nav(`${BASE}test.html?ns=${ns}&lang=${lang}`); await settle(1500); await ev('__cmwSetMain("land")'); await settle(800); };
const probe = () => ev(`(() => { const L = __cmwLandSheets(); const c = document.getElementById('sheetsChk'); const l = c && c.closest('label'); return { K: L.drawn && L.drawn.K, hom: L.drawn && L.drawn.hom, shownK: L.shown && L.shown.K, total: L.shown && L.shown.total, title: L.title, label: l ? l.textContent.trim() : null, tip: l ? (l.dataset.tip || l.title || '') : null, chk: c ? c.checked : null, cap: __cmwCapText(['L']) }; })()`);
const fig = async (o) => ev(`await (async () => { try { const f = await __cmwFig.build(${JSON.stringify(o)}); return f ? { view: f.view, cap: f.captionTex } : null; } catch (e) { return { err: String(e).slice(0, 300) }; } })()`, 180000);
await view(1440, 900, false, false);
const NS = 'vv' + Date.now();
// A. the user's case, √ bracketed, EN and RU
for (const lang of ['', 'ru']) {
  await open(`${NS}a${lang}`, st([RT(2), SN]), lang);
  const r = { static: await probe() };
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(800);
  for (const T of [0, 0.5, 1]) { await ev(`__cmwMorph({ T: ${T} })`); await settle(900); r['T' + T] = await probe(); }
  r.film = await fig(Object.assign({ for: 'article' }, lang ? { lang } : {}));
  r.frame = await fig(Object.assign({ for: 'article', deform: 'frame' }, lang ? { lang } : {}));
  out['user' + (lang || 'en')] = r; await grab();
}
// B. same with All sheets off (principal branch should stay)
await open(`${NS}b`, st([RT(2), SN], { sheets: false }));
await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 }, T: 0.5 })'); await settle(900);
out.nosheets = { p: await probe(), film: await fig({ for: 'article' }) }; await grab();
// C. sheets on but view Phase (xy) not Landscape: the homotopy should not claim sheets
await open(`${NS}c`, st([RT(2), SN]));
await ev('__cmwSetMain("xy")'); await settle(600);
await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 }, T: 0.5 })'); await settle(900);
out.sheetsNotLand = { p: await probe(), view: await ev('__cmwView()'), film: await fig({ for: 'article' }) }; await grab();
// D. whole chain sin √z
await open(`${NS}d`, st([RT(2), SN]));
await ev('__cmwMorph({ open: true, playing: false })'); await settle(800);
out.whole = {}; for (const T of [0.5, 1.5]) { await ev(`__cmwMorph({ T: ${T} })`); await settle(900); out.whole['T' + T] = await probe(); }
out.whole.film = await fig({ for: 'article' }); await grab();
// E. capped 5th then 6th root, whole
await open(`${NS}e`, st([RT(5), RT(6)]));
out.capped = { static: await probe() };
await ev('__cmwMorph({ open: true, playing: false })'); await settle(800);
for (const T of [0, 0.5, 1.5]) { await ev(`__cmwMorph({ T: ${T} })`); await settle(900); out.capped['T' + T] = await probe(); }
out.capped.film = await fig({ for: 'article' }); await grab();
// F. √ then log whole
await open(`${NS}f`, st([RT(2), LG]));
await ev('__cmwMorph({ open: true, playing: false })'); await settle(800);
out.sqrtlog = {}; for (const T of [0.5, 1.5]) { await ev(`__cmwMorph({ T: ${T} })`); await settle(900); out.sqrtlog['T' + T] = await probe(); }
await grab();
// G. √ then z² (single valued)
await open(`${NS}g`, st([RT(2), { type: 'pow', params: { n: 2 }, on: true }]));
out.sqrtsq = { static: await probe(), steps: await ev('__cmwP().steps') };
await ev('__cmwMorph({ open: true, playing: false, T: 0.5 })'); await settle(900);
out.sqrtsq.T05 = await probe(); await grab();
// H. sin then cbrt, √ then √ (math-1 b) at T 0.5
await open(`${NS}h`, st([SN, RT(3)]));
await ev('__cmwMorph({ open: true, playing: false, T: 0.5 })'); await settle(900);
out.sincbrt = await probe();
await ev('__cmwMorph({ T: 1.5 })'); await settle(900); out.sincbrt15 = await probe(); await grab();
await open(`${NS}i`, st([RT(2), RT(2)]));
await ev('__cmwMorph({ open: true, playing: false, T: 0.5 })'); await settle(900);
out.sqrtsqrt = await probe(); await grab();
// I. math-5 chain: 4th root, log, sin, cbrt, bracket 1-2
await open(`${NS}j`, st([RT(4), LG, SN, RT(3)]));
await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 2 } })'); await settle(800);
out.m5 = {}; for (const T of [0, 0.999, 1, 1.5, 2]) { await ev(`__cmwMorph({ T: ${T} })`); await settle(900); const p = await probe(); delete p.cap; out.m5['T' + T] = p; }
await grab();
// J. near third
await open(`${NS}k`, st([{ type: 'powa', params: { alpha: '0.333333333', cut: 180, k: 0 }, on: true }]));
out.near = await probe(); await grab();
out.errs = errs;
return out;
