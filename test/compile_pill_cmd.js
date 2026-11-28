// The "Compiling…" pill reads on any backdrop (#1622), behind ?view=steps with the chain's link held (?glhold): while a colour
// plot's program links, the left pane's lower left corner says "Compiling…" in a small pill. Under Inside regions that corner is
// paper (the plane outside the regions), where a pill filled with the surface colour is the paper's own colour in the light theme
// and close to it in the dark one, so the text floats on the plot. The pill reads when its edge or its fill differs from what is
// around it by 1.5 : 1 (contrast ratio of the colours on the page, measured on a screenshot): in the light and dark themes, Inside
// regions (paper) and Everywhere (the colour plot's stand-in). The note is also said to a screen reader: the LED's label and the polite
// region carry its words, in each language.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const MIN_RATIO = 1.5;
const { ratio } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'contrast.js'), 'utf8'))();
await view(1440, 900, false);
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const base = `http://localhost:${PORT}`;
const ns = 'cpl' + Date.now();
const loaded = "typeof __cmwSteps === 'function' && !!window.GLR && typeof __cmwCompileBox === 'function'";
const rectOf = () => ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
// (a disc on z: Inside regions colours only it, the pane's lower left corner is paper)
await seed(ns, { steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }], shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1' }], sv: { at: 0, T: 1, scope: 'in', surf: 'plane' } });
await go(`${base}/test.html?ns=${ns}&glhold`);
await settled({ max: 30000, panes: false, until: loaded });
// the pill's pixels: at its left edge and at its top edge, from outside to inside: [outside, on the edge, inside]
const read = async () => {
  const box = await ev('__cmwCompileBox()');
  if (!box) return null;
  const r = await rectOf(), p = await img(r);
  const cy = box.y + box.h / 2, cx = box.x + box.w / 2;
  // (the pixel that holds a point of the pane: the box's edges lie in the middle of a pixel row and column)
  const at = (x, y) => p.at(Math.floor(x), Math.floor(y));
  const left = [at(box.x - 3, cy), at(box.x, cy), at(box.x + 4, cy)], top = [at(cx, box.y - 3), at(cx, box.y), at(cx, box.y + 3)];
  const reads = ([out, edge, inn]) => Math.max(ratio(edge, out), ratio(inn, out));
  return { box, left, top, ratio: Math.min(reads(left), reads(top)) };
};
// (the state read once the frame is the same twice in a row: the theme and scope changes redraw the pane)
const stable = async () => {
  let prev = null, cur = null;
  const w = await settled({ only: true, max: 20000, panes: false, until: `(() => { const s = __cmwPaneStatus('L'); return !!s && !!s.compiling && !!__cmwCompileBox(); })()` });
  if (!w.ok) return null;
  for (let i = 0; i < 40; i++) {
    cur = await read();
    if (cur && prev && JSON.stringify(cur.left) === JSON.stringify(prev.left) && JSON.stringify(cur.top) === JSON.stringify(prev.top)) return cur;
    prev = cur;
    await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  }
  return cur;
};
const setTheme = (t) => ev(`(() => { document.documentElement.setAttribute('data-theme', '${t}'); return 1; })()`);
for (const scope of ['in', 'all']) {
  await ev(`__cmwSteps({ go: 0, now: true, scope: '${scope}' }), 1`);
  for (const theme of ['light', 'dark']) {
    await setTheme(theme);
    const m = await stable();
    const name = `${theme}, ${scope === 'in' ? 'Inside regions' : 'Everywhere'}`;
    info[name] = m && { ratio: +m.ratio.toFixed(2), left: m.left, top: m.top };
    ok(`${name}: the pill is there`, !!m, m);
    ok(`${name}: the pill reads against what is around it (at least ${MIN_RATIO} : 1)`, !!m && m.ratio >= MIN_RATIO, m && { ratio: +m.ratio.toFixed(2), left: m.left, top: m.top });
  }
}
// A screen reader hears the note (#2031): the note is canvas text, so the pane's LED says it, and the polite region #ledLive
// after it. On a later plane of the chain (the left plane is drawn from the chain's own program, not the colour plot's stand-in) the
// note is drawn while the LED said "Up to date". The LED's label is the note's words, busy, and #ledLive says them, in each language.
const SAY_MS = 4000;
const FIRST_MS = 250, SILENT_MS = 350;
const SAMPLER = `(() => { const log = window.__ledLog = []; let t0 = 0, p0 = 0; const tick = () => {
  const l = document.getElementById('leftLed'), s = typeof __cmwPaneStatus === 'function' ? __cmwPaneStatus('L') : null, z = document.getElementById('ledLive');
  const c = !!(s && s.compiling), now = performance.now();
  if (l && !p0) p0 = now;
  if (l && c && !t0) t0 = now;
  if (l) log.push({ t: t0 ? now - t0 : 0, p: now - p0, c, app: typeof __cmwPaneStatus === 'function', led: l.className, label: l.getAttribute('aria-label') || l.getAttribute('title') || l.getAttribute('data-tip'), live: z ? z.textContent : '' });
  if (log.length < 4000) requestAnimationFrame(tick);
}; requestAnimationFrame(tick); })()`;
const LANGS = { en: 'Compiling…', ru: 'Компиляция…', it: 'Compilazione…' };
// (the LED's words while no frame has run, in each language: the markup has none, so the page never shows them in English first)
const STARTING = { en: 'Starting…', ru: 'Запуск…', it: 'Avvio…' };
for (const [lang, words] of Object.entries(LANGS)) {
  const ns2 = 'cplled' + lang + Date.now();
  await seed(ns2, { steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }, { type: 'mobius', params: { a: '1', b: '1', c: '0', d: '1' }, on: true }], shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1' }], sv: { at: 2, T: 1, scope: 'in', surf: 'plane' } });
  // (a page script samples the LED at every frame from the page's start: while the pane's frames stand in for a compiling program,
  // the LED is busy from the first of them, and the polite region says it only once the state has held)
  const rec = await send('Page.addScriptToEvaluateOnNewDocument', { source: SAMPLER });
  await go(`${base}/test.html?ns=${ns2}&glhold&view=steps&lang=${lang}`);
  await settled({ max: 30000, panes: false, until: loaded });
  const w = await settled({ only: true, max: 20000, panes: false, until: `(() => { const s = __cmwPaneStatus('L'); return !!s && !!s.compiling && !!__cmwCompileBox(); })()` });
  const heard = () => ev(`(() => { const l = document.getElementById('leftLed'); return { led: l.className, label: l.getAttribute('aria-label'), live: document.getElementById('ledLive').textContent }; })()`);
  await settled({ max: SAY_MS, panes: false, until: `document.getElementById('ledLive').textContent.indexOf(${JSON.stringify(words)}) >= 0` });
  const got = await heard();
  info['heard ' + lang] = got;
  ok(`${lang}: the note is drawn on the later plane`, w.ok, w);
  ok(`${lang}: the left LED is busy and its label says "${words}"`, got.led === 'led busy' && got.label === words, got);
  ok(`${lang}: the polite region says "${words}"`, got.live.indexOf(words) >= 0, got);
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: rec.identifier });
  const all = await ev('window.__ledLog || []');
  // (the LED's states from its first paint: while the links are pending, none of them is "Up to date")
  const lead = all.filter((x) => !all.some((y) => y.c && y.p <= x.p));
  const log = all.filter((x) => x.c), first = log.length ? log[0].t : 0, early = log.filter((x) => x.t - first < FIRST_MS);
  info['before the first compiling frame ' + lang] = { n: lead.length, led: lead.map((x) => x.led).filter((v, i, a) => a.indexOf(v) === i), label: lead.length ? lead[0].label : null };
  ok(`${lang}: the LED is never "Up to date" from its first paint to the first compiling frame, with links pending`, lead.length > 0 && lead.every((x) => x.led === 'led busy'), lead.slice(0, 3));
  // (from the first frame after the app's script has run, which names the LEDs in the step that applies the translations; the frames
  // before it are the bare markup, which has no words)
  const named = lead.filter((x) => x.app);
  ok(`${lang}: from the app's first frame to the first compiling frame the LED is named "${STARTING[lang]}", never empty and never the English words in another language`, named.length > 0 && named.every((x) => x.label === STARTING[lang]), named.filter((x) => x.label !== STARTING[lang]).slice(0, 3));
  ok(`${lang}: the LED says "${STARTING[lang]}" before the first compiling frame`, lead.some((x) => x.label === STARTING[lang]), lead.slice(0, 3));
  info['first frames ' + lang] = { n: log.length, early: early.length, led: early.map((x) => x.led).filter((v, i, a) => a.indexOf(v) === i), label: early.length ? early[0].label : null };
  ok(`${lang}: frames that stand in for a compiling program were sampled within ${FIRST_MS} ms of the first`, early.length >= 1, info['first frames ' + lang]);
  ok(`${lang}: the LED is busy from the first such frame, with "${words}" as its label`, early.length > 0 && early.every((x) => x.led === 'led busy' && x.label === words), early.slice(0, 3));
  ok(`${lang}: the polite region is still silent within ${SILENT_MS} ms of the first`, log.filter((x) => x.t - first < SILENT_MS).every((x) => x.live.indexOf(words) < 0), log.filter((x) => x.t - first < SILENT_MS && x.live).slice(0, 2));
}
// A page whose programs link at once starts "Up to date" and says nothing: the starting state is gone with the first frame, well
// inside the polite region's wait.
{
  const ns3 = 'cplclean' + Date.now();
  const rec = await send('Page.addScriptToEvaluateOnNewDocument', { source: SAMPLER });
  await seed(ns3, { steps: [{ type: 'pown', params: { n: 2 }, on: true }], shapes: [], sv: { at: 0, T: 1, scope: 'in', surf: 'plane' } });
  await go(`${base}/test.html?ns=${ns3}&view=steps&lang=en`);
  await settled({ max: 30000, panes: false, until: loaded });
  const w = await settled({ max: 8000, only: true, panes: false, until: "document.getElementById('leftLed').className === 'led ok'" });
  await sleep(900);   // (a control: the polite region's wait is 500 ms, and a state said late would show here)
  const fin = await ev(`({ led: document.getElementById('leftLed').className, label: document.getElementById('leftLed').getAttribute('aria-label'), live: document.getElementById('ledLive').textContent })`);
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: rec.identifier });
  info['clean load'] = fin;
  ok('a page that links at once: its LED settles to "Up to date"', w.ok && fin.led === 'led ok' && fin.label === 'Up to date', fin);
  ok('a page that links at once: the polite region says nothing', fin.live === '', fin);
}
// A start that lasts past the polite region's wait says nothing: the LED shows and labels its starting state, and the region is for
// changes after the page is up. The page's frames are held on a flag (the page's first frame is what ends the starting state) until
// the LED has had its label for longer than the region's wait (LED_SAY_MS 500 ms, read in the page's own time, not a time from the
// injection): a LED that said its starting state would have said it by then, so the region is read at that moment, and again
// once the frames are released and the page is up.
{
  const ns4 = 'cplslow' + Date.now();
  // (SAY_WAIT_MS is LED_SAY_MS of src/app/05-panes-rulers.js, the polite region's wait; no hook exposes it, so the two are kept equal by hand)
  const SAY_WAIT_MS = 500, MARGIN_MS = 250;
  const HOLD = `(() => { let hold = true, id = 0; const pend = [], raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { if (!hold) return raf(cb); pend.push(cb); return --id; };
    window.__releaseFrames = () => { hold = false; for (const cb of pend.splice(0)) raf(cb); };
    window.__labelAt = 0;
    const poll = setInterval(() => { const l = document.getElementById('leftLed'); if (l && l.getAttribute('aria-label')) { window.__labelAt = performance.now(); clearInterval(poll); } }, 2); })()`;
  const rec = await send('Page.addScriptToEvaluateOnNewDocument', { source: HOLD });
  await seed(ns4, { steps: [{ type: 'pown', params: { n: 2 }, on: true }], shapes: [], sv: { at: 0, T: 1, scope: 'in', surf: 'plane' } });
  await go(`${base}/test.html?ns=${ns4}&view=steps&lang=en`);
  const mid = await settled({ max: 30000, only: true, panes: false, until: `window.__labelAt > 0 && performance.now() - window.__labelAt > ${SAY_WAIT_MS + MARGIN_MS}` });
  const held = await ev(`({ held: !!window.__releaseFrames, led: document.getElementById('leftLed').className, label: document.getElementById('leftLed').getAttribute('aria-label'), live: document.getElementById('ledLive').textContent, sinceLabel: Math.round(performance.now() - window.__labelAt) })`);
  await ev('window.__releaseFrames(); 1');
  await settled({ max: 30000, only: true, panes: false, until: "document.getElementById('leftLed').className === 'led ok'" });
  await sleep(SAY_WAIT_MS + MARGIN_MS);   // (a control: a state said late is said after the region's wait, so the read waits as long)
  const done = await ev(`({ led: document.getElementById('leftLed').className, live: document.getElementById('ledLive').textContent })`);
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: rec.identifier });
  info['slow start'] = { held, done };
  ok('a slow start: the LED is still starting after the region\'s wait (the control: the first frame is held)', mid.ok && held.led === 'led busy' && held.label === 'Starting…' && held.sinceLabel > SAY_WAIT_MS, held);
  ok('a slow start: the polite region says nothing while it lasts', held.live === '', held);
  ok('a slow start: the page comes up "Up to date" and the polite region still says nothing', done.led === 'led ok' && done.live === '', done);
}
return { pass: fails.length === 0, fails, info };
