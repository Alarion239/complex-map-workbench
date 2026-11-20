// A phone's message in the steps view lies above the context bar's row, not over it: with the bar open for a selected shape (its Edit
// row) or for the orthogonal circle (the tall bar: ⌫ and × over Whole | Inside | Outside | Between), a message that shows covers no control of
// the bar, and the plane's keys and the folded colour key stand clear of the bar and the message. At 360 × 640, 740 × 360, 667 × 375 and 844 × 390, in English and Russian. Control: with no bar
// open the message is 8 px above the thread's strip as before. The plane's keys stay inside the plane and can be pressed with the message up, and on a landscape phone
// (740 × 360, 667 × 375, 844 × 390), where the plane is too short to lift them above it, the message does not move them: it ends 8 px left of any control of the plane its box would reach (the keys' column, the folded colour key), and the message is placed again when a key unfolds or its rows change width. On the tall bar the construction chip steps aside while the message shows, and a short message takes one row. In the steps view (ci/suite_views.js).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }, { id: 's2', kind: 'rect', a: [-2, -1], b: [1, 0.5] }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const SHORT = { en: 'Added f₃', ru: 'Шаг f₃ добавлен' };   // (a message that fits one row)
const ONE_ROW_MAX = 60;   // a one-row message is 56 px tall (its padding and a 44 px button), px
const SHOW = { en: 'Show alone', ru: 'Показать отдельно' };   // (the second action of a message that adds a step)
const MSG = { en: ['Added f₃: Exponential, and a longer second part', 'Undo'], ru: ['Добавлен шаг f₃ (Экспонента) и продолжение сообщения', 'Отменить'] };
const VIEWPORTS = [[360, 640], [740, 360], [667, 375], [844, 390]], GAP = 8, STILL_MS = 150, SETTLE_MAX = 5000, MSG_MS = 60000, OVERLAP_PX = 1;
// the toast, the bar, the strip, the plot and the plane's keys, in viewport px, and what the page finds at each button's centre
const measure = () => ev(`(() => {
  const rect = (e) => { if (!e || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const t = document.querySelector('#toastHost .toast'), bar = document.querySelector('.ph-ctx');
  // (the folded colour key: its box, and whether the page finds it at its centre; the message's words: their width, and whether the two-line clamp cut them)
  const legendHit = () => { const e = document.getElementById('leftLegend'), r = rect(e); if (!r) return null; const at = document.elementFromPoint((r.l + r.r) / 2, (r.t + r.b) / 2); return Object.assign(r, { hit: !!at && e.contains(at) }); };
  const wordsOf = (toast) => { const w = toast && toast.querySelector(':scope > span'); return w ? { w: w.getBoundingClientRect().width, cut: w.scrollHeight > w.clientHeight + 1 } : null; };
  const hits = (root) => root ? [...root.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => { const r = b.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { t: b.textContent.trim() || b.getAttribute('aria-label') || b.className, hit: !!at && (at === b || b.contains(at)) }; }) : [];
  return { toast: rect(t), bar: bar && !bar.hidden && bar.classList.contains('in') ? rect(bar) : null, tall: !!bar && bar.classList.contains('tall'), strip: rect(document.getElementById('svStrip')), plot: rect(document.getElementById('plotL')),
    placed: document.getElementById('toastHost').dataset.placed || null, barHits: hits(bar), toastHits: hits(t),
    keys: [...document.querySelectorAll('.viewstack, .ph-col')].filter((e) => e.getClientRects().length).map(rect),
    keyBtns: [...document.querySelectorAll('.viewstack button, .ph-col button')].filter((b) => b.getClientRects().length).map((b) => { const r = b.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { name: b.getAttribute('aria-label') || b.className.split(' ')[0], l: r.left, t: r.top, r: r.right, b: r.bottom, hit: !!at && (at === b || b.contains(at)) }; }),
    chip: rect(document.querySelector('#plotL > .draft-chip.cm-on')), q: rect(document.querySelector('#plotL .cm-q')),
    legend: legendHit(), words: wordsOf(t), rows: t && t.dataset.rows || null,
    // (the chip's prompt and its ×, whether the page finds it; the bar's title; every button of the message inside its box and the screen)
    chipText: (document.querySelector('#plotL > .draft-chip.cm-on .cm-t') || {}).textContent || null,
    chipX: (() => { const x = document.querySelector('#plotL > .draft-chip.cm-on .cm-x'), r = rect(x); if (!r) return null; const at = document.elementFromPoint((r.l + r.r) / 2, (r.t + r.b) / 2); return !!at && x.contains(at); })(),
    barTitle: (document.querySelector('.ph-ctx .ph-ctn') || {}).textContent || null,
    btnsIn: t ? [...t.querySelectorAll('button')].every((b) => { const r = b.getBoundingClientRect(), q = t.getBoundingClientRect(); return r.left >= q.left - 0.5 && r.right <= q.right + 0.5 && r.top >= q.top - 0.5 && r.bottom <= q.bottom + 0.5 && r.left >= 0 && r.right <= innerWidth; }) : null };
})()`);
// (the message and the bar at rest: the same boxes twice, STILL_MS apart)
const still = async () => { let a = JSON.stringify(await measure()); for (let i = 0; i < SETTLE_MAX / STILL_MS; i++) { await sleep(STILL_MS); const b = JSON.stringify(await measure()); if (a === b) return JSON.parse(b); a = b; } return JSON.parse(a); };
const inter = (a, b) => !!a && !!b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > OVERLAP_PX && Math.min(a.b, b.b) - Math.max(a.t, b.t) > OVERLAP_PX;
for (const lang of ['en', 'ru']) for (const [w, h] of VIEWPORTS) for (const mode of ['edit', 'tall', 'none']) for (const variant of w > h && mode === 'tall' ? ['long', 'two', 'short'] : ['long']) {
  const acts = variant === 'two' ? 2 : 1;
  const tag = `${lang} ${w}×${h} ${mode === 'edit' ? 'Edit row' : mode === 'tall' ? 'tall bar' : 'no bar (control)'}${variant === 'two' ? ' with two actions' : variant === 'short' ? ' with a short message' : ''}`;
  await view(w, h, false, true);
  const ns = 'stc' + w + lang + mode + (Date.now() % 1000000);
  await load(ns, ST);
  await go(`${U}?ns=${ns}&lang=${lang}&view=steps`);
  await settled({ max: 30000, until: `typeof __cmwToast === 'function' && !!window.Phone && Phone.isOn() && document.getElementById('svStrip').getBoundingClientRect().height > 0 && !!document.querySelector('#shapeList .shape[data-id="s1"]')` });
  if (mode === 'edit') await ev(`__cmwSelect('s1'), 1`); else if (mode === 'tall') await ev(`document.querySelector('[data-tool="perp"]').click(), 1`);
  if (mode !== 'none') await settled({ max: 5000, panes: false, until: `!!document.querySelector('.ph-ctx.in')` });
  const base = await still();   // (the bar open and no message yet: where the plane's keys stand)
  // (a message that adds a step offers Show alone as well as Undo: its second action is added before the message picks its rows, as the page does)
  await ev(`(__cmwToast(${JSON.stringify(variant === 'short' ? SHORT[lang] : MSG[lang][0])}, ${JSON.stringify(MSG[lang][1])}, { ms: ${MSG_MS} }), ${acts === 2 ? `(() => { const t = document.querySelector('#toastHost .toast'), b = document.createElement('button'); b.className = 'toast-act'; b.textContent = ${JSON.stringify(SHOW[lang])}; t.querySelector('.toast-act').before(b); })(), ` : ''}1)`);
  await settled({ max: 5000, panes: false, until: `document.getElementById('toastHost').dataset.placed === 'phone-plot'` });
  const m = await still();
  info[tag] = m;
  ok(`${tag}: the message lies over the plot`, m.placed === 'phone-plot' && !!m.toast, m.placed);
  if (!m.toast) continue;
  ok(`${tag}: the bar is ${mode === 'none' ? 'closed' : 'open' + (mode === 'tall' ? ' and tall' : '')}`, mode === 'none' ? !m.bar : !!m.bar && m.tall === (mode === 'tall'), { bar: m.bar, tall: m.tall });
  ok(`${tag}: the message is inside the plot, under the header`, !!m.plot && m.toast.t >= m.plot.t - 0.5, { toast: m.toast, plot: m.plot });
  if (m.bar) {
    ok(`${tag}: the message ends above the bar's row`, m.toast.b <= m.bar.t - GAP + 0.5, { toast: m.toast, bar: m.bar });
    ok(`${tag}: every control of the bar can be pressed (nothing lies over it)`, m.barHits.length >= 2 && m.barHits.every((x) => x.hit), m.barHits);
  } else ok(`${tag}: the message stands ${GAP} px above the strip`, Math.abs(m.strip.t - GAP - m.toast.b) <= 1, { toast: m.toast, strip: m.strip });
  ok(`${tag}: the message's own buttons can be pressed`, m.toastHits.length >= 2 && m.toastHits.every((x) => x.hit), m.toastHits);
  ok(`${tag}: the plane's keys stand clear of the message and the bar`, m.keys.every((k) => !inter(k, m.toast) && !inter(k, m.bar)), { keys: m.keys, toast: m.toast, bar: m.bar });
  // (a landscape phone's plane is 236 to 266 px tall, so keys lifted by the bar and the message would leave the plot at its top)
  const inPlot = (k) => !!m.plot && k.t >= m.plot.t - 0.5 && k.b <= m.plot.b + 0.5 && k.l >= m.plot.l - 0.5 && k.r <= m.plot.r + 0.5;
  const fitted = base.keyBtns.filter((k) => !!base.plot && k.t >= base.plot.t - 0.5);   // (the keys the plane holds without the message)
  ok(`${tag}: the keys that stood inside the plane without the message still do, and can be pressed`, fitted.length >= 2 && fitted.every((k) => { const n = m.keyBtns.find((x) => x.name === k.name); return !!n && inPlot(n) && n.hit; }), { fitted, now: m.keyBtns, plot: m.plot });
  if (w > h) ok(`${tag}: a message does not move the keys of a landscape plane (the bar's lift only)`, m.keyBtns.length === base.keyBtns.length && m.keyBtns.every((k, i) => Math.abs(k.t - base.keyBtns[i].t) <= 1 && Math.abs(k.l - base.keyBtns[i].l) <= 1), { base: base.keyBtns, now: m.keyBtns });
  if (w > h && m.chip) ok(`${tag}: the message covers neither the construction chip nor its ?`, !inter(m.toast, m.chip) && !inter(m.toast, m.q), { toast: m.toast, chip: m.chip, q: m.q });
  // (the folded colour key is a control: with the message up it can be pressed, and the message is not over it)
  if (base.legend && base.legend.hit) ok(`${tag}: the folded colour key can still be pressed with the message up, and the message does not lie over it`, !!m.legend && m.legend.hit && !inter(m.toast, m.legend), { base: base.legend, now: m.legend, toast: m.toast });
  ok(`${tag}: the message's words are whole (the two-line clamp cuts nothing)`, !!m.words && !m.words.cut, m.words);
  // (the message picks its rows at the width it stands at: a short one takes one row where the placement gives it room, not two with the second empty)
  if (variant === 'short') ok(`${tag}: a short message takes one row`, m.rows === 'one' && m.toast.b - m.toast.t <= ONE_ROW_MAX, { rows: m.rows, toast: m.toast });
  ok(`${tag}: every button of the message lies inside its box and the screen`, m.btnsIn === true, { toast: m.toast, btnsIn: m.btnsIn });
  // (a landscape phone's tall bar leaves a message little room beside the construction chip: the chip steps aside, and the bar's title says its prompt; elsewhere the chip's ×
  // can be pressed with the message up)
  const norm = (x) => (x || '').replace(/\s+/g, ' ').trim();
  if (w > h && mode === 'tall') ok(`${tag}: the construction chip steps aside, and the bar's title says its prompt`, !m.chip && !!norm(base.chipText) && norm(m.barTitle) === norm(base.chipText), { chip: m.chip, chipText: base.chipText, barTitle: m.barTitle });
  else if (base.chipX !== null && base.chipX !== undefined) ok(`${tag}: the construction chip's × can be pressed with the message up`, m.chipX === true, { base: base.chipX, now: m.chipX });
  // (the key unfolding while the message is up: the message moves off it, and the key can still be pressed)
  if (variant === 'long' && w > h && mode === 'tall') {
    await ev(`document.getElementById('leftLegend').click(), 1`);
    await settled({ max: 5000, panes: false, until: `!document.getElementById('leftLegend').classList.contains('collapsed')` });
    const u = await still();
    ok(`${tag}: with the key unfolded under it, the message is not over the key and the key can be pressed`, !!u.toast && !!u.legend && u.legend.hit && !inter(u.toast, u.legend), { toast: u.toast, legend: u.legend });
  }
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
ok('no errors', !errs.length, errs);
return { pass: fails.length === 0, fails, info };
