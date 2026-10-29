// The start-up bar (issue #245): a thin bar at the top while the programs of the first frames and of the background
// warm-up link, counted from the GPU layer's own lists (GLR.warmStatus), never from timers. On a cold start of the
// default page it shows (the work outlasts 300 ms), its fill and the count only grow, the warm-up pauses while the
// pointer moves, it reaches 100 % and is gone; it takes no input and moves nothing; at phone widths it spans the page;
// its name and value are in the page's language; reduced motion stops its sweep.
// Software GL has no KHR_parallel_shader_compile (SwiftShader and lavapipe do not offer it), and without it the app
// links every program at once and has nothing to show. A shim stands in for the extension: a program's link is
// reported complete a fixed time after the one before it (one compile thread), so the app runs its real background
// states; counts, not times, are what the checks read. A command file for the CDP daemon (test/cdp_kit README).
// Prints {pass, fails, info}.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const errs = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
// KHR_parallel_shader_compile, simulated: getExtension gives it, and a program's COMPLETION_STATUS_KHR turns true
// window.__pcDelay ms after the previous program's (the first, after its link call)
const SHIM = `(() => {
  const C = 0x91B1;
  // (a section may ask for input from the first moment: a pointer move on the window every 50 ms for window.name's "in<ms>")
  const im = /in(\\d+)/.exec(window.name);
  if (im) { const until = performance.now() + +im[1]; const id = setInterval(() => { window.dispatchEvent(new Event('pointermove')); if (performance.now() > until) clearInterval(id); }, 50); }
  window.__pcDelay = +(/pc(\d+)/.exec(window.name) || [0, 120])[1];   // (a section sets it through window.name, which a navigation keeps)
  let last = 0;
  for (const G of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!G) continue;
    const gx = G.prototype.getExtension, gs = G.prototype.getSupportedExtensions, gp = G.prototype.getProgramParameter, lp = G.prototype.linkProgram;
    G.prototype.getExtension = function (n) { return n === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR: C } : gx.call(this, n); };
    G.prototype.getSupportedExtensions = function () { const l = gs.call(this) || []; return l.includes('KHR_parallel_shader_compile') ? l : l.concat('KHR_parallel_shader_compile'); };
    G.prototype.linkProgram = function (p) { lp.call(this, p); last = Math.max(last, performance.now()) + window.__pcDelay; p.__due = last; };
    G.prototype.getProgramParameter = function (p, n) { return n === C ? performance.now() >= (p.__due || 0) : gp.call(this, p, n); };
  }
})();`;
// a sampler that runs from the first moment of the page: every 40 ms the counts, the bar's state and its box
const SAMPLER = `(() => {
  window.__ws = [];
  const t0 = performance.now();
  setInterval(() => {
    const el = document.getElementById('warmBar');
    let w = null;
    try { w = window.__cmwWarm ? window.__cmwWarm() : null; } catch (e) { /* not yet */ }
    const cs = el ? getComputedStyle(el) : null, ics = el ? getComputedStyle(el.firstElementChild) : null;
    window.__ws.push({ t: Math.round(performance.now() - t0), w, vis: !!el && !el.hidden && cs.display !== 'none', now: el ? el.getAttribute('aria-valuenow') : null,
      indet: !!el && el.classList.contains('indet'), anim: ics ? ics.animationName : '', tr: ics ? ics.transitionDuration : '',
      label: el ? el.getAttribute('aria-label') : '', text: el ? el.getAttribute('aria-valuetext') : '' });
    if (window.__ws.length > 20000) window.__ws.shift();
  }, 40);
})();`;
const finished = () => ev(`(() => { const w = window.__cmwWarm && __cmwWarm(); const b = document.getElementById('warmBar'); return !!w && w.total > 0 && w.done >= w.total && !!b && b.hidden; })()`);
const waitFinished = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await finished()) return true; await sleep(500); } return false; };
await send('Page.addScriptToEvaluateOnNewDocument', { source: SHIM });
await send('Page.addScriptToEvaluateOnNewDocument', { source: SAMPLER });
const cold = async (w, h, phone, lang, reduced, delay, input) => {
  await view(w, h, false, phone);
  if (reduced) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.navigate', { url: `${U}/gl-helpers.html` }); await sleep(350);
  await ev(`localStorage.clear(); window.name = 'pc${delay || 120}${input ? ' in' + input : ''}'; 1`);
  await logs();
  await nav(`${U}/test.html?ns=warm-${w}-${lang}-${Date.now()}&lang=${lang}`);
};
const boxes = () => ev(`(() => { const b = document.getElementById('warmBar'), r = b.getBoundingClientRect(), cs = getComputedStyle(b);
  return { top: r.top, h: r.height, w: r.width, iw: innerWidth, pos: cs.position, pe: cs.pointerEvents, role: b.getAttribute('role'), min: b.getAttribute('aria-valuemin'), max: b.getAttribute('aria-valuemax'),
    hit: document.elementFromPoint(Math.round(innerWidth / 2), 1) === b || document.elementFromPoint(Math.round(innerWidth / 2), 1) === b.firstElementChild,
    top1: [...document.querySelectorAll('.top button')].slice(0, 12).map((x) => { const q = x.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)]; }) }; })()`);

// ---- A: the cold start of the default page, desktop ----
// (input for the first 20 s, a fast compile: the programs of the first frames land, and the groups wait for the quiet; the page is slow to start in software, so the window is long)
await cold(1440, 900, false, 'en', false, 30, 20000);
const tA = Date.now();
let vis = null;
for (let i = 0; i < 60 && !vis; i++) { const w = await ev('(window.__cmwWarm && __cmwWarm()) || null'); if (w && w.visible) vis = await boxes(); else await sleep(100); }
ok('A the bar shows on a cold start', !!vis, null);
const during = vis;
while ((await ev('window.__ws.length ? window.__ws[window.__ws.length - 1].t : 0')) < 21000) await sleep(500);
const SI = (await ev('window.__ws')).filter((x) => x.w && x.w.phase !== 'first' && x.w.phase !== 'none' && x.t < 19500);
const inputPh = SI.map((x) => x.w.phase), inputGlobe = SI.map((x) => ((x.w.groups || {}).globe || { done: 0 }).done);
info.A_input = { n: SI.length, phases: [...new Set(inputPh)], globeDone: Math.max(0, ...inputGlobe) };
ok('A the warm-up waits while the pointer moves: no globe or Landscape group starts', SI.length > 5 && !inputPh.some((p) => p === 'globe' || p === 'land') && Math.max(...inputGlobe) === 0, info.A_input);
const doneA = await waitFinished(280000);
const secs = Math.round((Date.now() - tA) / 100) / 10;
const SA = await ev('window.__ws');
const wsw = SA.filter((x) => x.w);
// (within a round: from the bar showing to its hiding; a later piece of work starts a new one)
const rounds = []; let cur = null;
for (const x of SA) { if (x.vis && x.w) { if (!cur) rounds.push(cur = []); cur.push(x); } else cur = null; }
const fr = [].concat(...rounds.map((r) => r.map((x) => x.w.frac)));
const mono = (a) => a.every((v, i) => !i || v >= a[i - 1] - 1e-9);
const nowv = [].concat(...rounds.map((r) => r.map((x) => +x.now)));
const totals = wsw.map((x) => x.w.total), maxTotal = Math.max(...totals);
const lastS = wsw[wsw.length - 1].w;
info.A = { secs, samples: SA.length, firstVisible: (SA.find((x) => x.vis) || {}).t, maxTotal, last: lastS, bar: during };
ok('A the warm-up finishes: every counted program is linked and the bar is gone', doneA, info.A);
ok('A the fill never goes back (the count may grow, the bar holds)', rounds.every((r) => mono(r.map((x) => x.w.frac)) && mono(r.map((x) => +x.now))), { rounds: rounds.length, lens: rounds.map((r) => r.length) });
ok('A done never exceeds total, the fill never exceeds 100', wsw.every((x) => x.w.done <= x.w.total) && fr.every((v) => v >= 0 && v <= 1) && nowv.every((v) => v >= 0 && v <= 100), null);
ok('A the count ends full: the groups add up to the total and every one is linked', lastS.done === lastS.total && lastS.pending === 0 && Object.values(lastS.groups).every((g) => g.done === g.total) && Object.values(lastS.groups).reduce((a, g) => a + g.total, 0) === lastS.total, lastS);
ok('A the groups: the 2D list is 6, the globes 4 more (mark is shared), the Landscape its static one and two chain programs', lastS.groups['2d'].total === 6 && lastS.groups.globe.total === 4 && lastS.groups.land.total === 3, lastS.groups);
// the bar's box: 3 px across the top, fixed, no input, the first row of the top bar where it is without it
ok('A the bar is 3 px, fixed at the top, as wide as the window, takes no input', !!during && during.top === 0 && during.h === 3 && during.w === during.iw && during.pos === 'fixed' && during.pe === 'none' && !during.hit, during);
ok('A it is a progressbar with a range', !!during && during.role === 'progressbar' && during.min === '0' && during.max === '100', during);
const after = await boxes();
ok('A the top bar does not move while the bar shows', JSON.stringify(during.top1) === JSON.stringify(after.top1), { during: during.top1, after: after.top1 });
// the bar went within a second of the last program landing
let tFull = null, tGone = null;
for (const x of SA) { if (!x.w) continue; if (tFull == null && x.w.total > 0 && x.w.done >= x.w.total && x.w.pending === 0 && x.vis) tFull = x.t; if (tFull != null && tGone == null && !x.vis) tGone = x.t; }
info.A_hide = { tFull, tGone };
ok('A the bar is gone 400 ms after the work is done (within a second)', tFull != null && tGone != null && tGone - tFull < 1400, info.A_hide);
ok('A its label and value are words, in English', SA.some((x) => x.vis && x.label === 'Preparing the page' && /^Preparing \d+ of \d+ shaders, first time only$/.test(x.text || '')), SA.find((x) => x.vis));
ok('A its sweep (unknown total) is shown only while the chain is not yet listed', SA.filter((x) => x.vis && x.indet).every((x) => x.w && x.w.phase === 'first'), null);
let ea = errs(await logs());
ok('A no page errors', !ea.length, ea.slice(0, 5));

// ---- B: phones ----
for (const [w, h] of [[360, 740], [390, 844], [412, 915]]) {
  await cold(w, h, true, 'en');
  let b = null;
  for (let i = 0; i < 100 && !b; i++) { const q = await ev('(window.__cmwWarm && __cmwWarm()) || null'); if (q && q.visible) b = await boxes(); else await sleep(150); }
  ok(`B ${w} px: the bar shows on a cold start`, !!b, null);
  ok(`B ${w} px: 3 px across the whole window, fixed, takes no input`, !!b && b.top === 0 && b.h === 3 && b.w === b.iw && b.iw === w && b.pos === 'fixed' && b.pe === 'none' && !b.hit, b);
  const e = errs(await logs());
  ok(`B ${w} px: no page errors`, !e.length, e.slice(0, 5));
}

// ---- C: the interface languages ----
for (const [lang, label, word] of [['ru', 'Подготовка страницы', /^Подготовлено шейдеров: \d+ из \d+ \(только в первый раз\)$/], ['it', 'Preparazione della pagina', /^Shader preparati: \d+ di \d+ \(solo la prima volta\)$/]]) {
  await cold(1440, 900, false, lang);
  let got = null;
  for (let i = 0; i < 120 && !got; i++) {
    const s = await ev(`(() => { const b = document.getElementById('warmBar'); return { vis: !b.hidden, label: b.getAttribute('aria-label'), text: b.getAttribute('aria-valuetext'), indet: b.classList.contains('indet') }; })()`);
    if (s.vis && !s.indet && s.text) got = s; else await sleep(150);
  }
  ok(`C ${lang}: the bar's name and value are in the language`, !!got && got.label === label && word.test(got.text || ''), got);
}

// ---- D: reduced motion: no transition, no sweep ----
await cold(1440, 900, false, 'en', true);
await sleep(4000);
const SD = await ev('window.__ws');
const vD = SD.filter((x) => x.vis);
ok('D reduced motion: the bar shows with no transition and no sweep', vD.length > 0 && vD.every((x) => /^0s(, 0s)*$/.test(x.tr) && (!x.indet || x.anim === 'none')), vD.slice(0, 2));
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });

return { pass: !fails.length, fails, info };
