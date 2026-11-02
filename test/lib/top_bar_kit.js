// What the two top-bar suites share: opening the app at a width and language, walking Tab from the top of the page to Help,
// and measuring every visible segmented control. An expression for eval in a suite:
// `const { open, tabs, scan, settle } = eval(fs.readFileSync(...))({ ev, send, view, key, sleep, DIR })`.
({ ev, send, view, key, sleep, DIR }) => {
  const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
  const settle = async (ms = 600) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
  const open = async (w, h, lang) => {
    await view(w, h, false, false);
    await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=tbf${w}${lang}${Date.now()}&lang=${lang}` });
    await sleep(2600); await settle();
  };
  // (a fresh page: no history, so Undo and Redo are not stops; the order is the bar's source order)
  const tabs = async () => {
    await ev('document.activeElement && document.activeElement.blur(); 1');
    const seq = [];
    // (up to Help; a Tab or two from the page itself can land on the body before the bar's first stop on a slow runner: those
    // leave the sequence, which starts at the first stop of the bar)
    for (let i = 0; i < 24 && seq[seq.length - 1] !== 'helpBtn'; i++) {
      await key('Tab'); await sleep(40);
      seq.push(await ev(`(() => { const a = document.activeElement; return a ? (a.closest('#viewSwitch') ? 'viewSwitch' : a.id || a.tagName) : ''; })()`));
    }
    while (seq.length && (seq[0] === 'BODY' || !seq[0])) seq.shift();
    return seq;
  };
  const scan = () => ev(`(() => [...document.querySelectorAll('.seg')].filter((s) => s.getClientRects().length).map((s) => {
    const bs = [...s.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect());
    return { id: s.id || s.className, n: bs.length, minH: Math.min(...bs.map((r) => r.height)), minW: Math.min(...bs.map((r) => r.width)), over: s.scrollWidth > s.clientWidth + 1 };
  }))()`);
  return { open, tabs, scan, settle };
}
