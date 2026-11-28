// A target (a point of the w-plane, the row "Point p") is nudged by the arrow keys the way a shape is (#1907): one press is one step of the
// grid of the plane shown, ten with Shift, and the toast the run ends with names it as its row does and gives its place as one complex number
// ("Moved Point p to 0.500 + 0.000i."; in Russian «Объект «Точка p» перемещён в 0,500 + 0,000i.», in Italian «Oggetto «Punto p» spostato in …»: the decimal comma,
// never two numbers apart), not another shape's name ("Moved z₀."). The selected row says "Arrow keys move it; Shift for ten steps" where a keyboard is
// the input (a laptop), and says nothing of it on a touch phone, which has no arrow keys. In the steps view the plane on screen is the one camera every plane shares
// (S.srcView); the classic view shows X alone, whose view a target is nudged in. The step is read as what the plane's own scale says
// (the page's Constr.gridStep of the pixels a unit takes there), so it holds wherever the view is set.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const WARM_MS = 120000, SAID_MS = 8000;
const HINT = 'Arrow keys move it; Shift for ten steps';
// the place as the page writes it: one complex number, three decimals, the decimal comma and the minus sign of the language
const cx = (p, lang) => { const f = (v) => { const t = Math.abs(v).toFixed(3); return lang === 'en' ? t : t.replace('.', ','); }; return `${p[0] < 0 ? '−' : ''}${f(p[0])} ${p[1] < 0 ? '−' : '+'} ${f(p[1])}i`; };
// (ru and it: the name in «» after «Объект» and «Oggetto», with a participle that agrees with that noun, whatever the shape is: a target,
// a point, a circle or a segment)
const MOVED = { en: (n, z) => `Moved ${n} to ${z}.`, ru: (n, z) => `Объект «${n}» перемещён в ${z}.`, it: (n, z) => `Oggetto «${n}» spostato in ${z}.` };
const ROW = `document.querySelector('#shapeList .shape[data-id="t1"] .shape-name')`;
const STATE = { v3: true, v4: true, v5: true, v6: true, alpha: 1, shapes: [], targets: [{ id: 't1', kind: 'point', p: [0, 0], ci: 2, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 40 } };
const target = () => ev(`(() => { const t = __cmwShapes().targets.find((x) => x.id === 't1'); return t ? t.p : null; })()`);
// the grid step of the plane the target is on: the pixels a unit takes there (the plane menu's w2s on the side) through the page's own gridStep
const stepOf = (side) => ev(`(() => { const m = __cmwPlaneMenu(), a = m.w2s('${side}', 0, 0), b = m.w2s('${side}', 1, 0); return Constr.gridStep(Math.hypot(b[0] - a[0], b[1] - a[1])); })()`);
const said = (want) => ev(`new Promise((res) => { const t0 = performance.now(); let last = null; const f = () => { for (const x of document.querySelectorAll('#toastHost .toast')) { const t = x.textContent; last = t; if (t.indexOf(${JSON.stringify(want)}) >= 0) return res(t); } if (performance.now() - t0 > ${SAID_MS}) res(last); else setTimeout(f, 50); }; f(); })`);
const leg = async (view, lang = 'en') => {
  const tag = lang === 'en' ? view : `${view} ${lang}`;
  await seed(`ntg${view}${lang}`, STATE);
  await nav(`http://localhost:${PORT}/test.html?ns=ntg${view}${lang}&view=${view}&lang=${lang}`);
  await settled({ max: WARM_MS, only: true, until: `typeof __cmwShapes === 'function' && __cmwShapes().targets.length === 1` });
  if (view === 'steps') { await ev(`(__cmwSteps({ go: 1, now: true }), 1)`); await settled({ max: WARM_MS, until: '__cmwSteps().i === 1 && !__cmwSteps().moving' }); }
  await settled({ only: true, floor: 300, max: WARM_MS });
  const step = await stepOf('L'), name = await ev(`(() => { const r = ${ROW}, k = r && r.querySelector('.k'); return k ? k.textContent.trim() : null; })()`);
  info[tag] = { step, name };
  if (lang === 'en') ok(`${view}: the target's row is "Point p"`, name === 'Point p', name);
  const p0 = await target();
  await ev(`${ROW}.focus(); 1`);
  await key('Enter'); await settled({ only: true, max: WARM_MS, until: `${ROW}.getAttribute('aria-pressed') === 'true'` });
  const hint = await ev(`${ROW}.getAttribute('aria-description')`);
  if (lang === 'en') ok(`${view}: the selected row says the arrow keys move it (a laptop)`, hint === HINT, hint);
  await key('ArrowRight');
  const p1 = await target();
  info[tag].moved = [p0, p1];
  ok(`${view}: one → moves the target by the grid step of its plane (${step})`, !!p1 && Math.abs(p1[0] - p0[0] - step) < 1e-9 && Math.abs(p1[1] - p0[1]) < 1e-9, { p0, p1, step });
  await key('ArrowUp', 8);
  const p2 = await target();
  ok(`${view}: Shift ↑ moves it ten steps`, !!p2 && Math.abs(p2[1] - p1[1] - 10 * step) < 1e-9, { p1, p2, step });
  // (the toast of the run's end: its place is the target's now; a toast an earlier press made says another place)
  const want = MOVED[lang](name, cx(p2, lang));
  const w = await said(want);
  info[tag].said = w;
  ok(`${tag}: the toast names the target as its row does and gives its place as one complex number`, w === want, { w, want, p2 });
};
await view(1280, 800, false, false);
await leg('steps');
await leg('classic');
await leg('steps', 'ru');
await leg('steps', 'it');
// a touch phone: the selected row says nothing of arrow keys
await view(360, 640, false, true);
await seed('ntgphone', STATE);
await nav(`http://localhost:${PORT}/test.html?ns=ntgphone&view=steps`);
await settled({ max: WARM_MS, only: true, until: `typeof __cmwShapes === 'function' && __cmwShapes().targets.length === 1 && !!${ROW}` });
await ev(`__cmwSelect('t1'); 1`);
await settled({ only: true, max: WARM_MS, until: `${ROW}.getAttribute('aria-pressed') === 'true'` });
const phoneHint = await ev(`${ROW}.getAttribute('aria-description')`);
ok('phone: a touch phone has no arrow keys, and the selected row does not say they move it', phoneHint === null, phoneHint);
return { pass: fails.length === 0, fails, info };
