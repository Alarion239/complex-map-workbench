// No example's Try line is cut in the phone's lane (#586): ?view=steps, a phone (360 × 780 and 390 × 844, touch), in en, ru and
// it, every example that has a lane. The lane under the plane shows the example's name and its Try line; the line took two
// lines at most and the third was cut (19 of 30 examples in Italian at 360). Now the lane takes the lines the text needs: the
// text box holds all its text (no scroll height or width past its box), the lane is as tall as the layout gave it
// (--ph-tour), and at least 25 examples had a lane (the count itself is the check that the walk read them). A command file
// for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PROBE = `(() => {
  const l = document.querySelector('.tour-lane[data-lane="example"]');
  if (!l) return null;
  const tx = l.querySelector('.tl-text'), lb = l.getBoundingClientRect(), tb = tx.getBoundingClientRect();
  const slot = document.getElementById('tourSlot'), sb = slot ? slot.getBoundingClientRect() : null;
  return { name: (document.querySelector('#examplesBtn .exlabel') || {}).textContent, mode: l.dataset.mode, grow: l.classList.contains('grow'),
    cutH: tx.scrollHeight - tx.clientHeight, cutW: tx.scrollWidth - tx.clientWidth, lane: Math.round(lb.height), slot: sb ? Math.round(sb.height) : null,
    ph: getComputedStyle(document.documentElement).getPropertyValue('--ph-tour'), inLane: tb.top >= lb.top - 1 && tb.bottom <= lb.bottom + 1,
    title: !!(l.querySelector('.tl-title') && !l.querySelector('.tl-title').hidden), text: tx.textContent.slice(0, 60) };
})()`;
for (const lang of ['en', 'ru', 'it']) for (const [w, h] of [[360, 780], [390, 844]]) {
  const tag = `${lang} ${w}`;
  await view(w, h, false, true);
  await nav(`http://localhost:${PORT}/test.html?ns=exlane-${lang}-${w}-${Date.now() % 1000000}&view=steps${lang === 'en' ? '' : '&lang=' + lang}`); await settle(2500);
  await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); return 1; })()`);
  let n = 0, grown = 0;
  for (let i = 0; i < 60; i++) {
    const thrown = await ev(`(() => { try { __cmwExample(${i}); return false; } catch (e) { return true; } })()`);
    if (thrown) break;
    await settle(900);
    const p = await ev(PROBE);
    if (!p) continue;
    n++; if (p.grow) grown++;
    ok(`${tag}: "${p.name}": the Try line is not cut`, p.cutH <= 1 && p.cutW <= 1 && p.inLane, p);
    ok(`${tag}: "${p.name}": the lane is as tall as the layout gave it`, p.slot == null || Math.abs(p.lane - p.slot) <= 1, p);
  }
  ok(`${tag}: the walk found the examples' lanes (at least 25)`, n >= 25, n);
  info[tag] = { lanes: n, grown };
  await ev('Tour.dismissSuggestion && Tour.dismissSuggestion(); 1');
}
return { pass: fails.length === 0, fails, info };
