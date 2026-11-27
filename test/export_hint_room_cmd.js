// The export dialog's page label (#2539: "amsart, 10 pt text · Fit column", «amsart, testo a 10 pt · Adatta alla colonna»)
// has room of its own over the preview, at phone and desk widths, in English, Russian and Italian: opened from the steps
// view (Ctrl+E), each leg reads the label's box (.xf-hint), the grey and lens buttons' boxes (.xf-bar .xf-ico) and the
// page's (.xf-paper), and checks, where the label is shown (on a phone in Russian it is not: the facts line under the
// paper says the same):
// - the label's box meets neither button's box;
// - the label's box ends above the page (so its last line never lands on the page's placeholder lines);
// - the label is shown whole: its text is not cut by an ellipsis (scrollWidth within its box).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// the legs: the window (CSS px) and whether it is a touch phone
const LEGS = [[390, 844, true], [360, 780, true], [430, 932, true], [768, 1024, true], [1024, 768, false], [1440, 900, false]];
const LANGS = ['en', 'ru', 'it'];
const GAP = 0.5;   // px: two boxes meet when they overlap by more than this
const ready = async () => { for (let i = 0; i < 80; i++) { await sleep(150); if (await ev(`!!document.querySelector('.modal.xf .xf-hint') && !!document.querySelector('.modal.xf .xf-hint').textContent`) === true) { await sleep(600); return true; } } return false; };
const meet = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > GAP && Math.min(a.b, b.b) - Math.max(a.t, b.t) > GAP;
for (const [W, H, touch] of LEGS) for (const lang of LANGS) {
  const tag = `${lang} ${W}×${H}`;
  await view(W, H, false, touch);
  await go(`http://localhost:${PORT}/test.html?ns=xfhint${lang}${W}${Date.now() % 1000000}&lang=${lang}`);
  await settled({ max: 30000, until: '!!window.__cmwExample && !!window.__cmwSteps' });
  await ev('(__cmwExample(1), 1)'); await sleep(1800);
  await key('e', 2);   // Ctrl+E
  const up = await ready();
  ok(`${tag}: the export dialog opens with its page label`, up, null);
  if (!up) continue;
  const r = await ev(`(() => {
    const box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    const m = document.querySelector('.modal.xf'), hint = m.querySelector('.xf-hint'), paper = m.querySelector('.xf-paper');
    const shown = getComputedStyle(hint).display !== 'none' && hint.getBoundingClientRect().width > 0;
    return { shown, text: hint.textContent, hint: box(hint), btns: [...m.querySelectorAll('.xf-bar .xf-ico')].map(box), paper: box(paper),
      cut: hint.scrollWidth > hint.clientWidth + 1, sw: hint.scrollWidth, cw: hint.clientWidth };
  })()`);
  info[tag] = r;
  if (!r.shown) { ok(`${tag}: the label is hidden only on a Russian phone`, lang === 'ru' && W <= 560, r); continue; }
  ok(`${tag}: the page label meets neither the grey nor the lens button`, r.btns.length === 2 && r.btns.every((b) => !meet(r.hint, b)), r);
  ok(`${tag}: the page label ends above the page`, r.hint.b <= r.paper.t + GAP, r);
  ok(`${tag}: the page label is shown whole (no ellipsis)`, !r.cut, r);
}
return { pass: fails.length === 0, fails, info };
