// An infinite sum that does not converge within its terms leaves part of the plane blank, and the pane says so. The GPU sums an
// infinite Σ term by term up to SER_GPU_LOOP = 512 terms and a pixel that has neither converged nor a tail to add by then is
// blank; whether that happens depends on z, so the page evaluates the steps the colour plot applies at points of the window on
// the CPU, with the same stop rule (Expr's SER_CAP), and says so when some did not converge: in the note over the plane, the left
// LED (an error, its tooltip the note) and the plane's description. In the steps view's Everywhere plane, one step:
// - the geometric sum of ((z² + 1) / 3)^n, which converges where |z² + 1| < 3 and does not outside, in English, Russian and
//   Italian: the plane is partly coloured (the disc) and partly blank, and the note names the 512 terms;
// - the sum of e^{i n z}, which converges above the real axis and not below it, so the points at the window's top converge:
//   the sample is taken in an order whose every prefix spans the window and is cut by the terms it evaluates, so a sample
//   cut short (the work a test sets) still reaches the bottom and says so, the same counts on every load, and one cut
//   to a single point's work is a sample of the window and not of its top rows.
// Controls: the same sum with ratio ((z² + 1) / 1000), which converges across the window, and a chain with no sum (z²) say
// nothing, the first with points tried and none out.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const base = `http://localhost:${PORT}`;
const CAP = 512, HUE_MIN = 60, WAIT_MS = 60000;
await view(1280, 800, false);
// the left pane's status once its program has linked and a frame has drawn with it, and its sample of the sums has been taken
const sampled = `(() => { if (typeof __cmwPaneStatus !== 'function' || typeof __cmwSumRun !== 'function') return false; const s = __cmwPaneStatus('L'), r = __cmwSumRun('L'); return !!s && !s.pending && !s.compiling && !!r && r.taken; })()`;
const state = () => ev(`(() => { const s = __cmwPaneStatus('L'), r = __cmwSumRun('L'), e = document.getElementById('leftLed'), cv = document.getElementById('overlayL');
  const said = (cv.getAttribute('aria-describedby') || '').split(' ').map((id) => document.getElementById(id)).filter(Boolean).map((d) => d.textContent).join(' ');
  return { note: s.note || '', error: s.error || '', run: r, led: e ? { cls: e.className, tip: e.getAttribute('data-tip') } : null, said }; })()`);
// the share of 15 × 10 points of the left canvas that are coloured (their channels spread by HUE_MIN or more)
const coloured = async () => {
  const r = await ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
  const p = await img(r);
  let n = 0;
  for (let i = 0; i < 15; i++) for (let j = 0; j < 10; j++) { const c = p.at(Math.floor((i + 0.5) * r.width / 15), Math.floor((j + 0.5) * r.height / 10)); if (Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) >= HUE_MIN) n++; }
  return n / 150;
};
const open = async (expr, lang) => {
  const ns = 'sro' + Date.now();
  await seed(ns, { steps: [{ type: 'custom', params: { expr, cut: 180 } }], sv: { at: 0, T: 1, scope: 'all', surf: 'plane' } });
  await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  const w = await settled({ max: WAIT_MS, until: sampled });
  // (a note drawn after the sample: the frame that follows it)
  const n = await settled({ max: WAIT_MS, until: `(() => { const s = __cmwPaneStatus('L'), r = __cmwSumRun('L'); return !!s && (!r.hit || !!s.note); })()` });
  return { wait: w, noteWait: n, ...(await state()), coloured: await coloured() };
};
const RUNS = '\\sum_{n=0}^{\\infty} \\left(\\frac{z^2+1}{3}\\right)^n';
const english = {};
for (const lang of ['en', 'ru', 'it']) {
  const m = await open(RUNS, lang), name = `${lang}, a geometric sum that converges in a disc only`;
  info[name] = m;
  const r = m.run || { hit: 0, tried: 0 };
  ok(`${name}: some sample points did not converge within the terms and some converged`, m.wait.ok && r.tried > 0 && r.hit > 0 && r.hit < r.tried, m);
  ok(`${name}: the note names the ${CAP} terms`, !!m.note && m.note.includes(String(CAP)), { note: m.note, run: r });
  ok(`${name}: the plane is partly coloured, partly blank`, m.coloured > 0.02 && m.coloured < 0.9, { coloured: m.coloured });
  ok(`${name}: the left LED is an error whose tooltip is the note`, !!m.led && /\berr\b/.test(m.led.cls) && !!m.note && m.led.tip === m.note, m.led);
  ok(`${name}: the plane's description says the note`, !!m.note && m.said.includes(m.note), { said: m.said, note: m.note });
  if (lang === 'en') english.note = m.note;
  else ok(`${name}: the note is translated`, !!m.note && m.note !== english.note && (lang !== 'ru' || /[а-яё]/i.test(m.note)), { note: m.note, en: english.note });
}
// (a sum that converges at the window's top and not at its bottom: a sample cut short must still say so)
{
  const UP = '\\sum_{n=0}^{\\infty} e^{i n z}', TINY_WORK = 2000;
  const a = await open(UP, 'en'), b = await open(UP, 'en');
  info['en, e^{inz}, full sample, twice'] = [a, b];
  ok('en, e^{inz}: some sample points do not converge and some do, and the note is shown', a.wait.ok && !!a.run && a.run.hit > 0 && a.run.hit < a.run.tried && !!a.note, a);
  ok('en, e^{inz}: the same view on a second load gives the same counts', !!b.run && b.run.hit === a.run.hit && b.run.tried === a.run.tried, { first: a.run, second: b.run });
  await ev(`__cmwSumRun('L', ${TINY_WORK}), 1`);
  const t = await settled({ max: WAIT_MS, until: `(() => { const s = __cmwPaneStatus('L'), r = __cmwSumRun('L'); return !!s && !!r && r.taken && !!s.note; })()` });
  const m = { wait: t, ...(await state()) };
  info['en, e^{inz}, a sample cut to ' + TINY_WORK + ' terms'] = m;
  ok(`en, e^{inz}: a sample cut to ${TINY_WORK} terms is a smaller one, and it still reaches the bottom of the window (the note is shown)`, t.ok && !!m.run && m.run.tried > 0 && m.run.tried < a.run.tried && m.run.hit > 0 && !!m.note, { cut: m.run, full: a.run });
  await ev(`__cmwSumRun('L', ${TINY_WORK}), 1`);
  const t2 = await settled({ max: WAIT_MS, until: `(() => { const r = __cmwSumRun('L'); return !!r && r.taken; })()` });
  const m2 = await state();
  ok('en, e^{inz}: the same cut gives the same counts again', t2.ok && !!m2.run && m2.run.hit === m.run.hit && m2.run.tried === m.run.tried, { first: m.run, second: m2.run });
}
// (controls: a sum that converges across the window, and no sum at all)
{
  const m = await open('\\sum_{n=0}^{\\infty} \\left(\\frac{z^2+1}{1000}\\right)^n', 'en');
  info['en, the same sum converging across the window'] = m;
  ok('en, a sum that converges across the window (control): sample points were tried and none ran out', m.wait.ok && !!m.run && m.run.tried > 0 && m.run.hit === 0, m.run);
  ok('en, a sum that converges across the window (control): the plane is coloured, no note, the LED is not an error', m.coloured > 0.5 && !m.note && !!m.led && !/\berr\b/.test(m.led.cls), m);
  const z = await open('z^2', 'en');
  info['en, no sum'] = z;
  ok('en, a chain with no sum (control): no sample point is tried, no note', z.wait.ok && !!z.run && z.run.tried === 0 && !z.note, z);
}
return { pass: fails.length === 0, fails, info };
