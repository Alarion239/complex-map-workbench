// The export dialog fits its box at 1024, 1280 and 1440 px in English, Russian and Italian (#487): every control and every piece of its
// text, in the controls column and the footer, lies inside the dialog's rectangle, every segmented button's text lies inside
// its own pill, and nothing is scrolled sideways.
// A command file for a CDP daemon:  <runner> test/export_fit_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await load('xfit' + Date.now(), {});
const base = await ev('location.origin');
// (the controls are built with the dialog; the preview behind them may still be typesetting)
const ready = async () => { for (let i = 0; i < 80; i++) { await sleep(150); if (await ev(`!!document.querySelector('.modal.xf .xf-fmtrow')`) === true) { await sleep(600); return true; } } return false; };
for (const [W, H] of [[1024, 768], [1280, 800], [1440, 900]]) for (const lang of ['en', 'ru', 'it']) {
  await view(W, H, false);
  const tag = `${lang} ${W}`;
  await nav(`${base}/test.html?ns=xfit${lang}${W}${Date.now() % 1000000}&lang=${lang}`);
  await sleep(2400);
  await ev('(__cmwExample(1), 1)'); await sleep(1800);
  await key('e', 4);   // Meta+E (the page also takes Ctrl+E)
  const up = await ready();
  ok(`${tag}: the dialog opens`, up, null);
  const r = await ev(`(() => {
    const m = document.querySelector('.modal.xf'); if (!m) return null;
    const box = m.getBoundingClientRect(), out = [];
    for (const e of m.querySelectorAll('.xf-ctl, .xf-ctl *, .xf-foot, .xf-foot *')) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || e.closest('[hidden]')) continue;
      const b = e.getBoundingClientRect();
      if (!(b.width > 0 && b.height > 0)) continue;
      // (an element that scrolls on purpose, like the LaTeX box, is measured by its own rectangle too)
      const over = Math.max(box.left - b.left, b.right - box.right, box.top - b.top);
      if (over > 0.5) out.push({ el: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''), over: +over.toFixed(1), text: (e.textContent || '').trim().slice(0, 24) });
    }
    // each segmented button's text lies inside its own pill (the pills' text is nowrap and visible, so a pill narrower than
    // its text spills into its neighbours while still inside the dialog: eyes, Italian "Lingua dell'interfaccia")
    const pills = [];
    for (const b of m.querySelectorAll('.xf-seg > button')) {
      if (!(b.offsetWidth > 0)) continue;
      if (b.scrollWidth > b.clientWidth + 1) pills.push({ pill: (b.textContent || '').trim().slice(0, 30), text: b.scrollWidth, box: b.clientWidth });
    }
    return { pills, nPills: m.querySelectorAll('.xf-seg > button').length, box: [Math.round(box.left), Math.round(box.right)], n: m.querySelectorAll('.xf-ctl *').length, out: out.slice(0, 12), nOut: out.length, scrollX: m.scrollWidth - m.clientWidth, bodyX: (m.querySelector('.xf-body') || {}).scrollWidth - (m.querySelector('.xf-body') || {}).clientWidth };
  })()`);
  info[tag] = r;
  ok(`${tag}: the dialog is there to measure`, r && r.n > 10, r);
  ok(`${tag}: every control and its text lies inside the dialog`, r && r.nOut === 0, r && r.out);
  ok(`${tag}: the segmented buttons are there to measure`, r && r.nPills >= 8, r && r.nPills);
  ok(`${tag}: every segmented button's text fits inside its own pill`, r && r.pills.length === 0, r && r.pills);
  ok(`${tag}: no sideways scroll in the dialog or its body`, r && r.scrollX <= 0 && r.bodyX <= 0, r && { scrollX: r.scrollX, bodyX: r.bodyX });
  await key('Escape');
}
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
