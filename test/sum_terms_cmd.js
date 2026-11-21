// The GPU takes at most 2048 terms of a pixel in all, across the sums of a step (src/glsl.js, SER_GPU_TERMS), so a pixel whose
// sums need more is blank: with the sums nested the time per pixel is bounded, and the pane says why. In the steps view's
// Everywhere plane, one step: an infinite sum over m around a finite one of 100 terms,
// the sum of (z²/4)^m / (n + z) over n = 1..100: at z = 0.3 it converges in 8 outer terms (800 in all) and is coloured; at
// z = 1.7 it converges only after about 50 outer terms (5,000 in all, past the budget): blank, with the budget's note; at z = 2.6 it
// diverges: blank. The note names the GPU's 2048 terms, in English, Russian and Italian, the LED is
// an error with the note as its tooltip, and the plane's description says it. Control: the same sum with ((z²/1000)^m) over
// n = 1..4 converges in a few terms everywhere (about 60 in all): coloured at all three points, no note.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const base = `http://localhost:${PORT}`;
const BUDGET = 2048, HUE_MIN = 8, WAIT_MS = 60000;   // (a value of large modulus is a pale colour, its channels 14 apart; the hatch's are within 3)
const POINTS = { converging: [0.3, 0], 'past the budget': [1.7, 0], diverging: [2.6, 0] };
await view(1280, 800, false);
const sampled = `(() => { if (typeof __cmwPaneStatus !== 'function' || typeof __cmwSumRun !== 'function') return false; const s = __cmwPaneStatus('L'), r = __cmwSumRun('L'); return !!s && !s.pending && !s.compiling && !!r && r.taken; })()`;
const state = () => ev(`(() => { const s = __cmwPaneStatus('L'), r = __cmwSumRun('L'), e = document.getElementById('leftLed'), cv = document.getElementById('overlayL');
  const said = (cv.getAttribute('aria-describedby') || '').split(' ').map((id) => document.getElementById(id)).filter(Boolean).map((d) => d.textContent).join(' ');
  return { note: s.note || '', run: r, led: e ? { cls: e.className, tip: e.getAttribute('data-tip') } : null, said }; })()`);
// the colour of the left plane at each of POINTS (a pixel's channels spread by HUE_MIN or more: coloured; the hatch is grey)
const colours = async () => {
  const r = await ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
  const p = await img(r), out = {};
  for (const [tag, [re, im]] of Object.entries(POINTS)) {
    const [px, py] = await ev(`__cmwW2S('L', ${re}, ${im})`);
    const c = p.at(Math.round(px - r.x), Math.round(py - r.y));
    out[tag] = { rgb: [c[0], c[1], c[2]], coloured: Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) >= HUE_MIN };
  }
  return out;
};
const open = async (expr, lang) => {
  const ns = 'stm' + Date.now();
  await seed(ns, { steps: [{ type: 'custom', params: { expr, cut: 180 } }], sv: { at: 0, T: 1, scope: 'all', surf: 'plane' } });
  await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  const w = await settled({ max: WAIT_MS, until: sampled });
  const n = await settled({ max: WAIT_MS, until: `(() => { const s = __cmwPaneStatus('L'), r = __cmwSumRun('L'); return !!s && (!(r.hit || r.spent) || !!s.note); })()` });
  return { wait: w, noteWait: n, ...(await state()), colours: await colours() };
};
const OVER = '\\sum_{m=0}^{\\infty} \\sum_{n=1}^{100} \\frac{(z^2/4)^m}{n+z}';
const FAST = '\\sum_{m=0}^{\\infty} \\sum_{n=1}^{4} \\frac{(z^2/1000)^m}{n+z}';
const english = {};
for (const lang of ['en', 'ru', 'it']) {
  const m = await open(OVER, lang), name = `${lang}, an infinite sum around a finite one of 100 terms`;
  info[name] = m;
  const r = m.run || { spent: 0, tried: 0 };
  ok(`${name}: z = 0.3, 800 terms in all, is coloured`, m.colours.converging.coloured, m.colours);
  ok(`${name}: z = 1.7, about 5,000 terms in all, is blank`, !m.colours['past the budget'].coloured, m.colours);
  ok(`${name}: z = 2.6, divergent, is blank`, !m.colours.diverging.coloured, m.colours);
  ok(`${name}: some sample points took more than the budget, none ran out of the 512 terms`, m.wait.ok && r.tried > 0 && r.spent > 0 && r.hit === 0, m.run);
  ok(`${name}: the note names the GPU's ${BUDGET} terms`, !!m.note && m.note.includes(String(BUDGET)), { note: m.note, run: r });
  ok(`${name}: the left LED is an error whose tooltip is the note, and the description says it`, !!m.led && /\berr\b/.test(m.led.cls) && m.led.tip === m.note && m.said.includes(m.note), { led: m.led, said: m.said });
  if (lang === 'en') english.note = m.note;
  else ok(`${name}: the note is translated`, !!m.note && m.note !== english.note && (lang !== 'ru' || /[а-яё]/i.test(m.note)), { note: m.note, en: english.note });
}
{
  const m = await open(FAST, 'en');
  info['en, the same sum with a fast ratio'] = m;
  ok('en, the sum that converges in a few terms everywhere (control): coloured at all three points', Object.values(m.colours).every((c) => c.coloured), m.colours);
  ok('en, the sum that converges in a few terms everywhere (control): sample points tried, none over the budget or out of terms, no note', m.wait.ok && !!m.run && m.run.tried > 0 && m.run.spent === 0 && m.run.hit === 0 && !m.note, { run: m.run, note: m.note });
}
// The three notes (the 512-term one, the budget one, both) at 320 px, the narrowest phone, in each language: each fits NOTE_LINES
// lines, and the two that name the budget say what to do (they name the sums' upper limits). __cmwPaneNote draws a note on the
// left plane and returns its box (18 px a line, 14 of padding)
const NOTE_LINES = 7;
const NOTES = [
  ['the 512 terms', 'Part of this plane is blank: an infinite sum does not converge there within {terms} terms.'],
  ['the budget', 'Part of this plane is blank: the sums there need more than the {budget} terms the GPU adds at a point. Try a lower upper limit on a finite sum.'],
  ['both', 'Part of this plane is blank. An infinite sum does not converge there within {terms} terms, and other sums need more than the {budget} terms the GPU adds at a point. Try a lower upper limit on a finite sum.'],
];
await view(320, 640, false, true);
for (const lang of ['en', 'ru', 'it']) {
  const ns = 'stn' + Date.now();
  await seed(ns, { steps: [{ type: 'custom', params: { expr: FAST, cut: 180 } }], sv: { at: 0, T: 1, scope: 'all', surf: 'plane' } });
  await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await settled({ max: WAIT_MS, until: sampled });
  for (const [tag, key] of NOTES) {
    const b = await ev(`(() => { const b = __cmwPaneNote(${JSON.stringify(key)}, { terms: 512, budget: ${BUDGET} }); return b && { h: b.h, w: b.w }; })()`);
    const lines = b ? Math.round((b.h - 14) / 18) : null;
    info[`note ${lang} ${tag}`] = { box: b, lines };
    ok(`${lang} at 320 px, the note for ${tag} has at most ${NOTE_LINES} lines`, lines !== null && lines <= NOTE_LINES, { box: b, lines });
  }
}
return { pass: fails.length === 0, fails, info };
