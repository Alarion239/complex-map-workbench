// A finite sum with more terms than the GPU draws says so (#1806): the GPU takes at most 2048 terms of a finite sum per
// pixel, and nested finite sums share that budget by the product of their terms (#1868), so past it the colour plot has
// no value. The pane then says why, in the note over the plane, and its status light (the left LED) turns to an error
// whose tooltip is the same note, naming the sum's terms and the budget. In the steps view's Everywhere plane, one step:
// a single sum of 2100 terms and a nested one of 33 × 64 = 2112, in English, Russian and Italian, where the plane has no
// colours; at 2048 and at 32 × 64 the plane is coloured and nothing is said (control). And the colour carried through
// such a sum (the chain 0.25z + 1.5, then the 33 × 64 sum, a disc |z| < 3: eyes' case on #1868): plane w₂, which the sum
// maps to, is white and says why; plane w₁, which it does not, says nothing.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const base = `http://localhost:${PORT}`;
const CAP = 2048, HUE_MIN = 60;
await view(1280, 800, false);
// the left pane's status and LED once its program has linked and a frame has drawn with it
const linked = `(() => { if (typeof __cmwPaneStatus !== 'function') return false; const s = __cmwPaneStatus('L'); return !!s && !s.pending && !s.compiling; })()`;
const state = () => ev(`(() => { const s = __cmwPaneStatus('L'), e = document.getElementById('leftLed');
  return { note: s.note || '', error: s.error || '', led: e ? { cls: e.className, tip: e.getAttribute('data-tip') } : null }; })()`);
// the share of 15 × 10 points of the left canvas that are coloured: their channels spread by HUE_MIN or more (the
// colour plot's hues; the undefined hatch and the paper are grey)
const coloured = async () => {
  const r = await ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
  const p = await img(r);
  let n = 0;
  for (let i = 0; i < 15; i++) for (let j = 0; j < 10; j++) { const c = p.at(Math.floor((i + 0.5) * r.width / 15), Math.floor((j + 0.5) * r.height / 10)); if (Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) >= HUE_MIN) n++; }
  return n / 150;
};
const open = async (expr, lang, more = null) => {
  const ns = 'sbn' + Date.now();
  await seed(ns, more ? more(expr) : { steps: [{ type: 'custom', params: { expr, cut: 180 } }], sv: { at: 0, T: 1, scope: 'all', surf: 'plane' } });
  await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  const w = await settled({ max: 60000, until: linked });
  return { wait: w, ...(await state()), coloured: await coloured() };
};
const CASES = [
  { tag: 'a single sum of 2100 terms', expr: '\\sum_{n=1}^{2100} n^{-z}', terms: 2100 },
  { tag: 'a nested sum of 33 × 64 terms', expr: '\\sum_{m=1}^{33}\\sum_{n=1}^{64} (m+n)^{-z}', terms: 33 * 64 },
];
const english = {};
for (const lang of ['en', 'ru', 'it']) {
  for (const c of CASES) {
    const m = await open(c.expr, lang), name = `${lang}, ${c.tag}`;
    info[name] = m;
    const says = (t) => typeof t === 'string' && t.includes(String(c.terms)) && t.includes(String(CAP));
    ok(`${name}: the pane's note names its ${c.terms} terms and the GPU's ${CAP}`, m.wait.ok && says(m.note), m);
    ok(`${name}: the plane has no colours (control)`, m.coloured < 0.05, { coloured: m.coloured });
    ok(`${name}: the left LED is an error whose tooltip is the note`, !!m.led && /\berr\b/.test(m.led.cls) && !!m.note && m.led.tip === m.note, m.led);
    if (lang === 'en') english[c.tag] = m.note;
    else ok(`${name}: the note is translated`, !!m.note && m.note !== english[c.tag] && (lang !== 'ru' || /[а-яё]/i.test(m.note)), { note: m.note, en: english[c.tag] });
  }
}
// (control: within the budget the plane is drawn and the pane says nothing)
for (const [tag, expr] of [['2048 terms', '\\sum_{n=1}^{2048} n^{-z}'], ['32 × 64 terms', '\\sum_{m=1}^{32}\\sum_{n=1}^{64} (m+n)^{-z}']]) {
  const m = await open(expr, 'en');
  info[`en, ${tag}`] = m;
  ok(`en, ${tag} (control): the plane is coloured`, m.wait.ok && m.coloured > 0.5, { coloured: m.coloured });
  ok(`en, ${tag} (control): no note, and the LED is not an error`, m.wait.ok && !m.note && !!m.led && !/\berr\b/.test(m.led.cls), m);
}
// (the colour carried from w₁ through the sum: plane w₂, at 2, and plane w₁, at 1)
const carried = (at) => (expr) => ({ steps: [{ type: 'custom', params: { expr: '0.25z+1.5', cut: 180 } }, { type: 'custom', params: { expr, cut: 180 } }],
  shapes: [{ kind: 'disc', c: [0, 0], r: 3, id: 's1' }], sv: { at, T: 1, scope: 'all', surf: 'plane' } });
{
  const m = await open(CASES[1].expr, 'en', carried(2));
  info['en, carried to w₂'] = m;
  ok(`en, the colour carried through the 33 × 64 sum to plane w₂: the note names its ${CASES[1].terms} terms and the GPU's ${CAP}`, m.wait.ok && m.note.includes(String(CASES[1].terms)) && m.note.includes(String(CAP)), m);
  ok('en, the colour carried to plane w₂: the left LED is an error whose tooltip is the note', !!m.led && /\berr\b/.test(m.led.cls) && !!m.note && m.led.tip === m.note, m.led);
  const m1 = await open(CASES[1].expr, 'en', carried(1));
  info['en, carried, plane w₁'] = m1;
  ok('en, plane w₁, before the sum (control): no note, and the LED is not an error', m1.wait.ok && !m1.note && !!m1.led && !/\berr\b/.test(m1.led.cls), m1);
}
return { pass: fails.length === 0, fails, info };
