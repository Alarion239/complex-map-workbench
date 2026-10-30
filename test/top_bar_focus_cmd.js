// The top bar's keyboard order and the small controls' target size (issues #359, #360). Tab from the top of the page goes
// Examples (leftmost on screen), the view switch, Deformation, then the menu's buttons (search … Help), in the order of the screen; and every
// segment of a segmented control in the bar, the plane heads and the chain head is at least 24 x 24 px (WCAG 2.5.8; the
// segments touch, so the spacing exception does not apply) without the control overflowing: the view switch, the plane
// head's style row, Landscape's height and paint rows, the chain's Pictures | Names. 1440 px in English, 1024 px in
// Russian and Italian. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 600) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const open = async (w, h, lang) => {
  await view(w, h, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=tbf${w}${lang}${Date.now()}&lang=${lang}` });
  await sleep(2600); await settle();
};
for (const [w, h, lang] of [[1440, 900, 'en'], [1024, 768, 'ru'], [1024, 768, 'it']]) {
  const at = `${w} ${lang}`;
  await open(w, h, lang);
  // (a fresh page: no history, so Undo and Redo are not stops; the order is the bar's source order)
  await ev('document.activeElement && document.activeElement.blur(); 1');
  const seq = [];
  // (up to Help; a Tab or two from the page itself can land on the body before the bar's first stop on a slow runner: those
  // leave the sequence, which starts at the first stop of the bar)
  for (let i = 0; i < 24 && seq[seq.length - 1] !== 'helpBtn'; i++) {
    await key('Tab'); await sleep(40);
    seq.push(await ev(`(() => { const a = document.activeElement; return a ? (a.closest('#viewSwitch') ? 'viewSwitch' : a.id || a.tagName) : ''; })()`));
  }
  while (seq.length && (seq[0] === 'BODY' || !seq[0])) seq.shift();
  info[at + ' tab'] = seq.join(' ');
  const at_ = (id) => seq.indexOf(id);
  // (Examples is leftmost on screen and the first stop; then the views, then the menu's buttons as laid out)
  ok(`${at}: Examples is the first Tab stop`, seq[0] === 'examplesBtn', seq);
  ok(`${at}: the view switch follows it, and Deformation the view switch`, at_('viewSwitch') === 1 && at_('morphBtn') === 2, seq);
  ok(`${at}: then the menu's buttons in their order, search … Help`, ['cmdBtn', 'exportBtn', 'settingsBtn', 'helpBtn'].every((id, i, a) => at_(id) >= 3 && (i === 0 || at_(a[i - 1]) < at_(id))), seq);
  ok(`${at}: no view switch or Deformation stop after Help`, !seq.slice(at_('helpBtn') + 1).some((s) => s === 'viewSwitch' || s === 'morphBtn' || s === 'examplesBtn'), seq);

  // the segments, in each view's heads
  const scan = () => ev(`(() => [...document.querySelectorAll('.seg')].filter((s) => s.getClientRects().length).map((s) => {
    const bs = [...s.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect());
    return { id: s.id || s.className, n: bs.length, minH: Math.min(...bs.map((r) => r.height)), minW: Math.min(...bs.map((r) => r.width)), over: s.scrollWidth > s.clientWidth + 1 };
  }))()`);
  const seen = new Set();
  for (const mode of ['xy', 'phase', 'land']) {
    await ev(`document.querySelector('#viewSwitch [data-mode="${mode}"]').click(); 1`); await settle(900);
    for (const s of await scan()) {
      seen.add(s.id);
      ok(`${at} ${mode}: ${s.id}: every segment is at least 24 px tall and wide`, s.minH >= 23.5 && s.minW >= 23.5, s);
      ok(`${at} ${mode}: ${s.id} does not overflow`, !s.over, s);
    }
    ok(`${at} ${mode}: the bar does not overflow`, await ev(`(() => { const t = document.querySelector('.top'); return t.scrollWidth <= t.clientWidth + 1; })()`), null);
  }
  for (const id of ['viewSwitch', 'dcSeg', 'heightSeg', 'landPaint', 'chainMode']) ok(`${at}: ${id} was measured`, seen.has(id), [...seen]);
}
return { pass: fails.length === 0, fails, info };
