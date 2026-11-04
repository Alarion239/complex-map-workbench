// The steps view's rail fits its thread by ux's rule: when the thread with the chips' names fits, every step takes the same
// width; when it fits only with the letters (fₖ) every chip drops its name together, the name staying in the chip's aria-label,
// and every plane's node lies whole inside the rail; when even the letters do not fit the rail scrolls.
// The default chain at 1440 and 1280 px in en, ru and it, and a six-step chain at 1280.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// a wait on the page's own state; a timeout is a failed check by the caller reading its result
const ready = async (expr, max = 20000) => (await settled({ until: expr, max, only: true })).ok;
const SIX = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's1', kind: 'disc', c: [0.3, 0], r: 0.6, ci: 0, visible: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 },
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'sin', params: {}, on: true },
    { type: 'pown', params: { n: 3 }, on: true }, { type: 'exp', params: {}, on: true }, { type: 'sin', params: {}, on: true }] };
const open = async (w, lang, state) => {
  const ns = 'railfit' + Date.now();
  await view(w, 900, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` });
  await ready('document.readyState === "complete"');
  if (state) await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps` });
  return ready('!!window.__cmwSteps && __cmwSteps().on && document.querySelectorAll("#svStrip .sv-step").length > 1 && !document.querySelector("#svStrip.sv-measure")');
};
const probe = `(() => {
  const strip = document.getElementById('svStrip'), rail = strip.querySelector('.sv-rail'), rr = rail.getBoundingClientRect();
  const steps = [...rail.querySelectorAll('.sv-step')].map((s) => Math.round(s.getBoundingClientRect().width * 10) / 10);
  const chips = [...rail.querySelectorAll('.sv-step .sv-fchip')];
  const nodes = [...rail.querySelectorAll('.sv-plane .sv-node')].map((n) => n.getBoundingClientRect());
  return { letters: strip.classList.contains('sv-letters'), steps, spread: Math.max(...steps) - Math.min(...steps),
    namesShown: chips.map((c) => c.querySelector('.sv-fn').offsetWidth > 0), named: chips.map((c) => /f\\S*\\s+\\S+/.test(c.getAttribute('aria-label') || '')),
    nodesIn: nodes.every((b) => b.left >= rr.left - 0.5 && b.right <= rr.right + 0.5), scrolls: rail.scrollWidth > rail.clientWidth + 1, railW: rail.clientWidth, scrollW: rail.scrollWidth };
})()`;
// (letters: true or false is the mode the rule gives; null is either, as long as what the mode promises holds)
for (const [w, lang, letters] of [[1440, 'en', false], [1440, 'it', null], [1440, 'ru', true], [1280, 'en', true], [1280, 'ru', true], [1280, 'it', true]]) {
  const tag = `${lang} ${w}`;
  ok(`${tag}: the steps view is up`, await open(w, lang), null);
  const p = await ev(probe);
  info[tag] = { letters: p.letters, railW: p.railW, scrollW: p.scrollW };
  if (letters === false || (letters === null && !p.letters)) {
    ok(`${tag}: the chain fits with names, and every step takes the same width`, !p.letters && p.namesShown.every(Boolean) && p.spread <= 1, p);
  } else {
    ok(`${tag}: the chain shows the letters of every chip, together, and no name`, p.letters && p.namesShown.every((v) => !v), p);
    ok(`${tag}: every chip's aria-label keeps its name`, p.named.every(Boolean), p);
    ok(`${tag}: every plane's node lies whole inside the rail, and the rail does not scroll`, p.nodesIn && !p.scrolls, p);
  }
}
ok('six steps at 1280: the steps view is up', await open(1280, 'en', SIX), null);
const six = await ev(probe);
ok('six steps at 1280: the rail scrolls', six.scrolls, six);
return { pass: fails.length === 0, fails, info };
