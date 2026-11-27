// The export dialog's page label (the one it opens with: "amsart, 10 pt text · Fit column", «amsart, testo a 10 pt · Adatta alla colonna";
// the longest: «Margini di 1 pollice · Letter, testo a 10 pt · Adatta alla colonna», «REVTeX во всю ширину, …») has room of
// its own over the preview, at phone, tablet and desk widths, in English, Russian and Italian. Opened from the steps view (Ctrl+E),
// each leg shows the label the dialog opens with (Article, amsart) and the longest label of each language (Homework's default,
// REVTeX full width, an Overleaf article size), reads the label's box (.xf-hint), the grey and lens buttons' boxes
// (.xf-bar .xf-ico) and the page's (.xf-paper), and checks:
// - the label is shown, in every language (it carries the class and «по ширине колонки», which the facts line under the page does not);
// - the label's box meets neither button's box;
// - the label's box ends above the page (so its last line never lands on the page's placeholder lines);
// - the label is shown whole: its text is not cut by an ellipsis or a clamp (scrollWidth and scrollHeight within its box);
// - in a preview 560 px wide or wider, where the bar lies over its top padding: the label takes at most two lines, the bar ends inside that
//   padding (a label that wraps uses the room above the page, it does not push the page down), and the label ends 8 px above the page at least.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// the legs: the window (CSS px) and whether it is a touch phone
const LEGS = [[390, 844, true], [360, 780, true], [430, 932, true], [561, 900, false], [600, 900, false], [640, 900, false], [700, 900, false], [767, 900, false], [768, 1024, true], [901, 900, false], [960, 900, false], [1024, 768, false], [1440, 900, false]];
const LANGS = ['en', 'ru', 'it'];
const GAP = 0.5;   // px: two boxes meet when they overlap by more than this
const BESIDE_MIN_STAGE = 560;   // px: in a preview this wide or wider the label sits beside the buttons, over the page's top margin
const MAX_LINES_BESIDE = 2;
const ROOM_ABOVE_PAGE = 8;   // px: beside the buttons, the label ends at least this far above the page
// the labels each leg shows, [preset, columns (Article only), the size's place in the Size menu (0: the default)]: the first one
// opened, then the longest of each language (Homework's default in it, REVTeX full width in ru, an Overleaf article size in en)
const LABELS = [['article', '1', 0], ['homework', null, 0], ['article', '2', 2], ['homework', null, 2]];
const MENU_UP = `document.querySelectorAll('.pop.menu .mi').length > 0`;
const hintText = () => ev(`document.querySelector('.modal.xf .xf-hint').textContent`);
// (a press that changes the label: wait for its text to change; a choice already made is not pressed again)
const pick = async (sel) => {
  if (await ev(`document.querySelector(${JSON.stringify(sel)}).getAttribute('aria-checked') === 'true' || /^✓/.test(document.querySelector(${JSON.stringify(sel)}).textContent)`)) return;
  const t0 = await hintText();
  await ev(`(document.querySelector(${JSON.stringify(sel)}).click(), 1)`);
  await settled({ max: 4000, until: `document.querySelector('.modal.xf .xf-hint').textContent !== ${JSON.stringify(t0)}` });
};
const show = async ([forV, cols, size]) => {
  await pick(`#xfFor > button[data-v="${forV}"]`);
  if (cols) await pick(`#xfCols > button[data-v="${cols}"]`);
  await ev(`(document.getElementById('xfSize').click(), 1)`);
  if (!(await settled({ max: 4000, until: MENU_UP })).ok) return false;
  await pick(`.pop.menu .mi:nth-of-type(${size + 1})`);
  if (await ev(`document.querySelectorAll('.pop.menu .mi').length > 0`)) await key('Escape');
  await settled({ max: 4000, until: `!document.querySelector('.pop.menu')` });
  return true;
};
const HINT_UP = `!!document.querySelector('.modal.xf .xf-hint') && !!document.querySelector('.modal.xf .xf-hint').textContent`;
const meet = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > GAP && Math.min(a.b, b.b) - Math.max(a.t, b.t) > GAP;
for (const [W, H, touch] of LEGS) for (const lang of LANGS) {
  const tag = `${lang} ${W}×${H}`;
  await view(W, H, false, touch);
  await go(`http://localhost:${PORT}/test.html?ns=xfhint${lang}${W}${Date.now() % 1000000}&lang=${lang}`);
  await settled({ max: 30000, until: '!!window.__cmwExample && !!window.__cmwSteps' });
  await ev('(__cmwExample(1), 1)');
  await settled({ max: 30000 });
  await key('e', 2);   // Ctrl+E
  const up = (await settled({ max: 12000, until: HINT_UP })).ok;
  ok(`${tag}: the export dialog opens with its page label`, up, null);
  if (!up) continue;
  for (const lab of LABELS) {
    const ltag = `${tag} ${lab[0]}${lab[1] ? ' ' + lab[1] + ' col' : ''} size ${lab[2]}`;
    ok(`${ltag}: the label's size can be chosen`, await show(lab), null);
    const r = await ev(`(() => {
      const box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      const m = document.querySelector('.modal.xf'), hint = m.querySelector('.xf-hint'), paper = m.querySelector('.xf-paper');
      const shown = getComputedStyle(hint).display !== 'none' && hint.getBoundingClientRect().width > 0;
      const lh = parseFloat(getComputedStyle(hint).lineHeight);
      return { shown, text: hint.textContent, hint: box(hint), btns: [...m.querySelectorAll('.xf-bar .xf-ico')].map(box), paper: box(paper),
        cut: hint.scrollWidth > hint.clientWidth + 1 || hint.scrollHeight > hint.clientHeight + 1, sw: hint.scrollWidth, cw: hint.clientWidth,
        lines: Math.round(hint.getBoundingClientRect().height / lh), stage: m.querySelector('.xf-stage').clientWidth,
        barB: m.querySelector('.xf-bar').getBoundingClientRect().bottom, padB: (() => { const sc = m.querySelector('.xf-scroll'); return sc.getBoundingClientRect().top + parseFloat(getComputedStyle(sc).paddingTop); })() };
    })()`);
    info[ltag] = r;
    ok(`${ltag}: the page label is shown`, r.shown, r);
    if (!r.shown) continue;
    ok(`${ltag}: the page label meets neither the grey nor the lens button`, r.btns.length === 2 && r.btns.every((b) => !meet(r.hint, b)), r);
    ok(`${ltag}: the page label ends above the page`, r.hint.b <= r.paper.t + GAP, r);
    ok(`${ltag}: the page label is shown whole (no ellipsis, no clamp)`, !r.cut, r);
    if (r.stage >= BESIDE_MIN_STAGE) {
      ok(`${ltag}: beside the buttons the label takes at most ${MAX_LINES_BESIDE} lines`, r.lines <= MAX_LINES_BESIDE, r.lines);
      ok(`${ltag}: the bar ends inside the preview's top padding (the page is not pushed down)`, r.barB <= r.padB + GAP, { barB: r.barB, padB: r.padB });
      ok(`${ltag}: the label ends at least ${ROOM_ABOVE_PAGE} px above the page`, r.padB - r.hint.b >= ROOM_ABOVE_PAGE - GAP, { hintB: r.hint.b, padB: r.padB });
    }
  }
  await key('Escape');
}
return { pass: fails.length === 0, fails, info };
