// No example's Try line is cut in the phone's lane: ?view=steps, a phone (360 × 780 and 390 × 844, touch), in en, ru and it,
// every example that has a lane. The lane under the plane shows the example's name and its Try line and takes the lines the
// text needs, up to four: the text box holds all its text (no scroll height or width past its box), the lane is as tall as
// the layout gave it (--ph-tour) and at most 82 px, and at least 25 examples had a lane (the count is the check that the
// walk read them). A line that needs a fifth is cut, so it fails, except the known Italian one below. A command file for a
// CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
// (Italian wording that is Pietro's, five lines at 360 (issue #576); any other line over four fails)
const KNOWN_FIFTH = new Set(['it La mappa di Douady–Hubbard']);
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const PROBE = `(() => {
  const l = document.querySelector('.tour-lane[data-lane="example"]');
  if (!l) return null;
  const tx = l.querySelector('.tl-text'), lb = l.getBoundingClientRect(), tb = tx.getBoundingClientRect();
  const slot = document.getElementById('tourSlot'), sb = slot ? slot.getBoundingClientRect() : null;
  return { name: (document.querySelector('#examplesBtn .exlabel') || {}).textContent, mode: l.dataset.mode, grow: l.classList.contains('grow'),
    cutH: tx.scrollHeight - tx.clientHeight, cutW: tx.scrollWidth - tx.clientWidth, lane: Math.round(lb.height), slot: sb ? Math.round(sb.height) : null,
    ph: getComputedStyle(document.documentElement).getPropertyValue('--ph-tour'), inLane: tb.top >= lb.top - 1 && tb.bottom <= lb.bottom + 1,
    lines: +(tx.dataset.lines || 0), title: !!(l.querySelector('.tl-title') && !l.querySelector('.tl-title').hidden), text: tx.textContent.slice(0, 60) };
})()`;
for (const lang of ['en', 'ru', 'it']) for (const [w, h] of [[360, 780], [390, 844]]) {
  const tag = `${lang} ${w}`;
  await view(w, h, false, true);
  await go(`http://localhost:${PORT}/test.html?ns=exlane-${lang}-${w}-${Date.now() % 1000000}&view=steps${lang === 'en' ? '' : '&lang=' + lang}`); await settled({ until: `typeof Tour !== 'undefined' && typeof __cmwExample === 'function' && document.readyState === 'complete'` });
  // (the page opens examples once it is up: a first open that does not take is tried again, then the walk starts)
  for (let k = 0; k < 40 && !(await ev(`(() => { try { return __cmwExample(0); } catch (e) { return false; } })()`)); k++) await settled({ floor: 100 });
  await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); return 1; })()`);
  let n = 0, grown = 0, maxLines = 2, lastName = null; const tooLong = [];
  for (let i = 0; i < 60; i++) {
    const thrown = await ev(`(() => { try { __cmwExample(${i}); return false; } catch (e) { return true; } })()`);
    if (thrown) break;
    // (the lane has laid out when the page is quiet and the lane shows this example's name)
    await settled({ until: `(() => { const l = document.querySelector('.tour-lane[data-lane="example"]'); return !l || (document.querySelector('#examplesBtn .exlabel') || {}).textContent !== ${JSON.stringify(lastName)}; })()`, max: 4000 });
    const p = await ev(PROBE);
    if (!p) continue;
    lastName = p.name;
    n++; if (p.grow) grown++;
    maxLines = Math.max(maxLines, p.lines || 2);
    if (p.lines > 4) { tooLong.push(`${p.name} (${p.lines} lines)`); ok(`${tag}: "${p.name}": needs at most four lines`, KNOWN_FIFTH.has(`${lang} ${p.name}`), p.lines); }
    else ok(`${tag}: "${p.name}": the Try line is not cut`, p.cutH <= 1 && p.cutW <= 1 && p.inLane, p);
    ok(`${tag}: "${p.name}": the lane is at most 82 px`, p.lane <= 82 || p.mode === 'head', p);
    ok(`${tag}: "${p.name}": the lane is as tall as the layout gave it`, p.slot == null || Math.abs(p.lane - p.slot) <= 1, p);
  }
  ok(`${tag}: the walk found the examples' lanes (at least 25)`, n >= 25, n);
  info[tag] = { lanes: n, grown, maxLines, needAFifthLine: tooLong };
  await ev('Tour.dismissSuggestion && Tour.dismissSuggestion(); 1');
}
return { pass: fails.length === 0, fails, info };
