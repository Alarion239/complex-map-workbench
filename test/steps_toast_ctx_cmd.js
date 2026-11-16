// A phone's message in the steps view lies above the context bar's row, not over it (#1523): with the bar open for a selected shape (its Edit
// row) or for the orthogonal circle (the tall bar: ⌫ and × over Whole | Inside | Outside | Between), a message that shows covers no control of
// the bar, and the plane's keys stand clear of the bar and the message. At 360 × 640 and 740 × 360, in English and Russian. Control: with no bar
// open the message is 8 px above the thread's strip as before. In the steps view (ci/suite_views.js).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }, { id: 's2', kind: 'rect', a: [-2, -1], b: [1, 0.5] }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const MSG = { en: ['Added f₃: Exponential, and a longer second part', 'Undo'], ru: ['Добавлен шаг f₃ (Экспонента) и продолжение сообщения', 'Отменить'] };
const VIEWPORTS = [[360, 640], [740, 360]], GAP = 8, STILL_MS = 150, SETTLE_MAX = 5000, MSG_MS = 60000, OVERLAP_PX = 1;
// the toast, the bar, the strip, the plot and the plane's keys, in viewport px, and what the page finds at each button's centre
const measure = () => ev(`(() => {
  const rect = (e) => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const t = document.querySelector('#toastHost .toast'), bar = document.querySelector('.ph-ctx');
  const hits = (root) => root ? [...root.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => { const r = b.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { t: b.textContent.trim() || b.getAttribute('aria-label') || b.className, hit: !!at && (at === b || b.contains(at)) }; }) : [];
  return { toast: rect(t), bar: bar && !bar.hidden && bar.classList.contains('in') ? rect(bar) : null, tall: !!bar && bar.classList.contains('tall'), strip: rect(document.getElementById('svStrip')), plot: rect(document.getElementById('plotL')),
    placed: document.getElementById('toastHost').dataset.placed || null, barHits: hits(bar), toastHits: hits(t),
    keys: [...document.querySelectorAll('.viewstack, .ph-col')].filter((e) => e.getClientRects().length).map(rect) };
})()`);
// (the message and the bar at rest: the same boxes twice, STILL_MS apart)
const still = async () => { let a = JSON.stringify(await measure()); for (let i = 0; i < SETTLE_MAX / STILL_MS; i++) { await sleep(STILL_MS); const b = JSON.stringify(await measure()); if (a === b) return JSON.parse(b); a = b; } return JSON.parse(a); };
const inter = (a, b) => !!a && !!b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > OVERLAP_PX && Math.min(a.b, b.b) - Math.max(a.t, b.t) > OVERLAP_PX;
for (const lang of ['en', 'ru']) for (const [w, h] of VIEWPORTS) for (const mode of ['edit', 'tall', 'none']) {
  const tag = `${lang} ${w}×${h} ${mode === 'edit' ? 'Edit row' : mode === 'tall' ? 'tall bar' : 'no bar (control)'}`;
  await view(w, h, false, true);
  const ns = 'stc' + w + lang + mode + (Date.now() % 1000000);
  await load(ns, ST);
  await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwToast === 'function' && !!window.Phone && Phone.isOn() && document.getElementById('svStrip').getBoundingClientRect().height > 0 && !!document.querySelector('#shapeList .shape[data-id="s1"]')` });
  if (mode === 'edit') await ev(`__cmwSelect('s1'), 1`); else if (mode === 'tall') await ev(`document.querySelector('[data-tool="perp"]').click(), 1`);
  if (mode !== 'none') await settled({ max: 5000, panes: false, until: `!!document.querySelector('.ph-ctx.in')` });
  await ev(`(__cmwToast(${JSON.stringify(MSG[lang][0])}, ${JSON.stringify(MSG[lang][1])}, { ms: ${MSG_MS} }), 1)`);
  await settled({ max: 5000, panes: false, until: `document.getElementById('toastHost').dataset.placed === 'phone-plot'` });
  const m = await still();
  info[tag] = m;
  ok(`${tag}: the message lies over the plot`, m.placed === 'phone-plot' && !!m.toast, m.placed);
  if (!m.toast) continue;
  ok(`${tag}: the bar is ${mode === 'none' ? 'closed' : 'open' + (mode === 'tall' ? ' and tall' : '')}`, mode === 'none' ? !m.bar : !!m.bar && m.tall === (mode === 'tall'), { bar: m.bar, tall: m.tall });
  ok(`${tag}: the message is inside the plot`, !!m.plot && m.toast.t >= m.plot.t - 0.5, { toast: m.toast, plot: m.plot });
  if (m.bar) {
    ok(`${tag}: the message ends above the bar's row`, m.toast.b <= m.bar.t - GAP + 0.5, { toast: m.toast, bar: m.bar });
    ok(`${tag}: every control of the bar can be pressed (nothing lies over it)`, m.barHits.length >= 2 && m.barHits.every((x) => x.hit), m.barHits);
  } else ok(`${tag}: the message stands ${GAP} px above the strip`, Math.abs(m.strip.t - GAP - m.toast.b) <= 1, { toast: m.toast, strip: m.strip });
  ok(`${tag}: the message's own buttons can be pressed`, m.toastHits.length >= 2 && m.toastHits.every((x) => x.hit), m.toastHits);
  ok(`${tag}: the plane's keys stand clear of the message and the bar`, m.keys.every((k) => !inter(k, m.toast) && !inter(k, m.bar)), { keys: m.keys, toast: m.toast, bar: m.bar });
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
ok('no errors', !errs.length, errs);
return { pass: fails.length === 0, fails, info };
