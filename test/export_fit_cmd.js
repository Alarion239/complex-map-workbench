// The export dialog fits its box at 1024 px in English, Russian and Italian (#487): every control and every piece of its
// text, in the controls column and the footer, lies inside the dialog's rectangle, and nothing is scrolled sideways.
// A command file for a CDP daemon:  <runner> test/export_fit_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1024, 768, false);
await load('xfit' + Date.now(), {});
const base = await ev('location.origin');
// (the controls are built with the dialog; the preview behind them may still be typesetting)
const ready = async () => { for (let i = 0; i < 80; i++) { await sleep(150); if (await ev(`!!document.querySelector('.modal.xf .xf-fmtrow')`) === true) { await sleep(600); return true; } } return false; };
for (const lang of ['en', 'ru', 'it']) {
  await nav(`${base}/test.html?ns=xfit${lang}${Date.now() % 1000000}&lang=${lang}`);
  await sleep(2400);
  await ev('(__cmwExample(1), 1)'); await sleep(1800);
  await key('e', 4);   // Meta+E (the page also takes Ctrl+E)
  const up = await ready();
  ok(`${lang}: the dialog opens`, up, null);
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
    return { box: [Math.round(box.left), Math.round(box.right)], n: m.querySelectorAll('.xf-ctl *').length, out: out.slice(0, 12), nOut: out.length, scrollX: m.scrollWidth - m.clientWidth, bodyX: (m.querySelector('.xf-body') || {}).scrollWidth - (m.querySelector('.xf-body') || {}).clientWidth };
  })()`);
  info[lang] = r;
  ok(`${lang}: the dialog is there to measure`, r && r.n > 10, r);
  ok(`${lang}: every control and its text lies inside the dialog at 1024`, r && r.nOut === 0, r && r.out);
  ok(`${lang}: no sideways scroll in the dialog or its body`, r && r.scrollX <= 0 && r.bodyX <= 0, r && { scrollX: r.scrollX, bodyX: r.bodyX });
  await key('Escape');
}
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
