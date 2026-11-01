// The phone's tour strip in a long language (#553): Italian at 360 × 780, with reduced motion, every step of every chapter:
// nothing in the strip is cut (its line, its count, its text block: no scroll height past the box), and the strip is as tall as
// the lines its chapter needs (68 px, 76 for three lines, 93 for four). Basics step 4 ("Tieni premuto dentro il disco…") needs
// four lines at this width, and the strip had three. Also Russian at 360 and Italian at 390. A command file for a CDP daemon
// (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
  for (let i = 0; i < 40; i++) { if (await ev(`!Tour.isActive() || (!document.querySelector('.tour-strip[aria-busy]') && !!Tour.lit() && !Tour.lit().moving)`)) break; await sleep(100); } };
const PROBE = `(() => {
  const s = document.querySelector('.tour-strip');
  if (!s || !Tour.isActive()) return null;
  const b = s.getBoundingClientRect(), c = Tour.current();
  const cut = [];
  for (const e of s.querySelectorAll('#tourLead, .ts-count, .ts-title, .ts-text, .ts-l2, .ts-row')) {
    if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') continue;
    if (e.scrollHeight > e.clientHeight + 1 && e.clientHeight > 0) cut.push([e.className || e.id, e.scrollHeight, e.clientHeight]);
  }
  const txt = s.querySelector('.ts-text'), l2 = s.querySelector('.ts-l2'), tb = txt.getBoundingClientRect(), lb = l2.getBoundingClientRect();
  return { id: c.chapter + '/' + c.id, mode: s.dataset.mode, lines: Tour.lit() ? Tour.lit().lines : null, need: Tour._t.needLines(), h: Math.round(b.height), cut,
    inBox: lb.bottom <= tb.bottom + 1 && lb.top >= tb.top - 1 };
})()`;
const rowH = (mode, lines) => (mode === 'port' ? (lines >= 4 ? 93 : lines === 3 ? 76 : 68) : (lines >= 4 ? 72 : lines === 3 ? 56 : 48));
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
for (const [w, h, lang] of [[360, 780, 'it'], [360, 780, 'ru'], [390, 844, 'it']]) {
  const tag = `${w}x${h}-${lang}`;
  await view(w, h, false, true);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=it360-${w}${lang}&lang=${lang}` }); await sleep(2500);
  await ev('Tour.dismissSuggestion()'); await ev('Tour.auto(false)');
  await ev(`Tour.start({ chapter: 'basics' })`); await settle(1500);
  let n = 0, longest = 0;
  for (let k = 0; k < 70 && (await ev('Tour.isActive()')); k++) {
    const g = await ev(PROBE);
    if (!g) break;
    n++; longest = Math.max(longest, g.need);
    ok(`${tag} ${g.id}: no text cut in the strip`, !g.cut.length && g.inBox, g);
    ok(`${tag} ${g.id}: the strip's lines (${g.lines}) cover what its chapter needs (${g.need})`, g.need <= g.lines, g);
    if (g.mode === 'port') ok(`${tag} ${g.id}: the strip is ${rowH('port', g.lines)} px tall`, g.h === rowH('port', g.lines), g);
    const before = JSON.stringify(await ev('Tour.current()'));
    await ev('Tour.next()'); await settle(900);
    if ((await ev('Tour.isActive()')) && JSON.stringify(await ev('Tour.current()')) === before) { ok(`${tag}: Next moves on`, false, g.id); break; }
  }
  ok(`${tag}: the walk saw the steps (at least 40)`, n >= 40, n);
  info[tag] = { steps: n, longest };
  await ev('Tour.stop()'); await settle(300);
}
return { pass: fails.length === 0, fails, info };
