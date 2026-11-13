// The steps view's rail fits its thread by what gives way first: "+ Add function" folds to its round +, then the steps stop
// sharing one width (each takes what its chip needs, the names whole), then every chip drops its name together for its letters
// (fₖ, the name staying in the chip's aria-label), and only then does the rail scroll. While the names fit with every step as
// wide as the widest chip, the steps are all that width; every plane's node lies whole inside the rail unless it scrolls.
// The default chain at 1440 and 1280 px in en, ru and it, and a six-step chain at 1280. The rail is read once its layout is final:
// the faces loaded and the widths the fit sets unchanged for longer than the app waits after a face load, since a fit made
// before the faces settle is made again after them. A width whose page does not come up is a failed check and is not probed.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// a wait on the page's own state; a timeout is a failed check by the caller reading its result
const ready = async (expr, max = 20000) => (await settled({ until: expr, max, only: true })).ok;
const SIX = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's1', kind: 'disc', c: [0.3, 0], r: 0.6, ci: 0, visible: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 },
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'sin', params: {}, on: true },
    { type: 'pown', params: { n: 3 }, on: true }, { type: 'exp', params: {}, on: true }, { type: 'sin', params: {}, on: true }] };
// the rail's widths and the fit's choices, as one string
const RAIL_SIG = `(() => {
  const strip = document.getElementById('svStrip'), rail = strip.querySelector('.sv-rail');
  return [rail.clientWidth, rail.scrollWidth, rail.style.marginLeft, rail.style.marginRight, strip.className, getComputedStyle(strip.querySelector('.sv-add-t')).display,
    [...rail.querySelectorAll('.sv-step')].map((s) => s.getBoundingClientRect().width).join(',')].join('|');
})()`;
// the faces are loaded and the rail's signature has not changed for 150 ms (the app re-fits 60 ms after a face load)
const RAIL_SETTLED = `(() => {
  const st = window.__railSettle || (window.__railSettle = { sig: null, t: 0 }), now = performance.now(), sig = ${RAIL_SIG};
  if (sig !== st.sig || !document.fonts || document.fonts.status !== 'loaded') { st.sig = sig; st.t = now; return false; }
  return now - st.t >= 150;
})()`;
// whether the page came up with the rail's layout final
const open = async (w, lang, state) => {
  const ns = 'railfit' + Date.now();
  await view(w, 900, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` });
  if (!await ready('document.readyState === "complete"')) return false;
  if (state) await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps` });
  return await ready('!!window.__cmwSteps && __cmwSteps().on && document.querySelectorAll("#svStrip .sv-step").length > 1 && !document.querySelector("#svStrip.sv-measure")')
    && await ready(RAIL_SETTLED);
};
const probe = `(() => {
  const strip = document.getElementById('svStrip'), rail = strip.querySelector('.sv-rail'), rr = rail.getBoundingClientRect();
  const steps = [...rail.querySelectorAll('.sv-step')].map((s) => Math.round(s.getBoundingClientRect().width * 10) / 10);
  const chips = [...rail.querySelectorAll('.sv-step .sv-fchip')];
  const nodes = [...rail.querySelectorAll('.sv-plane .sv-node')].map((n) => n.getBoundingClientRect());
  return { letters: strip.classList.contains('sv-letters'), steps, spread: Math.max(...steps) - Math.min(...steps),
    namesShown: chips.map((c) => c.querySelector('.sv-fn').offsetWidth > 0), chipsW: chips.map((c) => Math.round(c.getBoundingClientRect().width * 10) / 10), named: chips.map((c) => /f\\S*\\s+\\S+/.test(c.getAttribute('aria-label') || '')),
    addFolded: getComputedStyle(strip.querySelector('.sv-add-t')).display === 'none', nodesIn: nodes.every((b) => b.left >= rr.left - 0.5 && b.right <= rr.right + 0.5), scrolls: rail.scrollWidth > rail.clientWidth + 1, railW: rail.clientWidth, scrollW: rail.scrollWidth };
})()`;
// (the tier each width gives: equal widths with names, the names at their own widths, or the letters)
for (const [w, lang, tier] of [[1440, 'en', 'equal'], [1440, 'it', 'names'], [1440, 'ru', 'letters'], [1280, 'en', 'letters'], [1280, 'ru', 'letters'], [1280, 'it', 'letters']]) {
  const tag = `${lang} ${w}`;
  const up = await open(w, lang);
  ok(`${tag}: the steps view is up with its rail laid out`, up, null);
  if (!up) continue;
  const p = await ev(probe);
  info[tag] = { letters: p.letters, railW: p.railW, scrollW: p.scrollW };
  ok(`${tag}: + Add function is the round +`, p.addFolded, p);
  if (tier !== 'letters') {
    ok(`${tag}: the chain shows every chip's name whole and does not scroll`, !p.letters && p.namesShown.every(Boolean) && !p.scrolls && p.nodesIn, p);
    if (tier === 'equal') ok(`${tag}: every step takes the same width`, p.spread <= 1, p);
  } else {
    ok(`${tag}: the chain shows the letters of every chip, together, and no name`, p.letters && p.namesShown.every((v) => !v), p);
    ok(`${tag}: every chip's aria-label keeps its name`, p.named.every(Boolean), p);
    ok(`${tag}: every letters chip is a target of at least 24 px beside its ⋯`, p.chipsW.every((cw) => cw >= 24), p);
    ok(`${tag}: every plane's node lies whole inside the rail, and the rail does not scroll`, p.nodesIn && !p.scrolls, p);
  }
}
const sixUp = await open(1280, 'en', SIX);
ok('six steps at 1280: the steps view is up with its rail laid out', sixUp, null);
if (sixUp) { const six = await ev(probe); ok('six steps at 1280: the rail scrolls', six.scrolls, six); }
return { pass: fails.length === 0, fails, info };
