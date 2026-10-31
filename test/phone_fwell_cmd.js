// F's well on the phone's edit sheet (issue #455): the Inspector is built while the sheet is closed, so the well has no
// width when fitPick first runs; it used to keep the full (expanded) form there, wider than the sheet. Now nothing is
// decided without a width, and the choice is made again when the well gets one (the sheet opens) or changes it (the
// phone turns). Two steps (a Möbius square and a long formula with a display form), F selected, the Edit sheet opened:
// the well is whole (not wider than its box, at 70 % or more), the short form F(z) = w₂ = …, as on the desk; closed and
// opened again in landscape, still whole. 390 × 844 and 360 × 740 in en, ru and it; then 1440 × 900 (the desk) as a
// control. Needs MathJax (CI). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 600) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const LONGF = 'exp(' + Array.from({ length: 30 }, (_, j) => `0.1*log(z-(0.5+0.${String(j).padStart(2, '0')}i))`).join('+') + ')';
const SHOW = 'c\\,z^{s}\\prod_{j=1}^{30}\\left(\\frac{z-p_j}{z}\\right)^{1/10}';
const fnv = (s) => { s = String(s).trim(); let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 0x01000193) >>> 0; return x.toString(16).padStart(8, '0'); };
const STEPS = [{ type: 'custom', params: { expr: '((z-0.1)/(1-0.1*z))^2', cut: 180 }, on: true }, { type: 'custom', params: { expr: LONGF, cut: 180, show: SHOW, showOf: fnv(LONGF) }, on: true }];
const well = () => ev(`(() => { const p = document.getElementById('propsPanel'); const t = p && (p.querySelector('.iform .ftex:not(.long)') || p.querySelector('.iform .ftex')); if (!t) return null; const f = t.closest('.iform'); const cs = getComputedStyle(f); const avail = f.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); return { tex: (t.dataset.tex || '').slice(0, 40), use: t.dataset.use, fs: t.style.fontSize, sw: t.scrollWidth, avail: Math.round(avail), svg: t.querySelectorAll('svg').length }; })()`);
const open = async (w, h, lang, mobile, ns) => {
  await view(w, h, false, mobile);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}-pre` }); await sleep(2500);
  const o = { v3: true, v4: true, shapes: [{ id: 's1', kind: 'circle', c: [0, 0], r: 1 }], steps: STEPS, nextId: 50, focus: 0, rightMode: 'image' };
  await ev(`localStorage.clear(); localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}` });
  for (let i = 0; i < 40 && !(await ev(`typeof MathJax !== 'undefined' && !!MathJax.tex2svg`)); i++) await sleep(500);
  await settle(1500);
};
const whole = (name, g) => {
  ok(`${name}: the well is there and typeset`, g && g.svg > 0, g);
  ok(`${name}: whole in its box`, g && g.sw <= g.avail + 1, g);
  ok(`${name}: at 70 % or more`, g && (!g.fs || parseFloat(g.fs) >= 70), g);
};
for (const [w, h, lang] of [[390, 844, 'en'], [360, 740, 'ru'], [360, 740, 'it']]) {
  const at = `${w} ${lang}`;
  await open(w, h, lang, true, `fw${w}${lang}${Date.now()}`);
  ok(`${at}: MathJax loaded`, await ev(`typeof MathJax !== 'undefined' && !!MathJax.tex2svg`), null);
  await ev(`document.querySelector('#pipeline .ftile').click(); 1`); await settle(1200);
  await ev(`Phone.open('edit'); 1`); await settle(2500);
  const g = await well(); info[at] = g;
  whole(at, g);
  ok(`${at}: the short form, as on the desk`, g && g.use === '1' && /w_\{2\}/.test(g.tex), g);
  // the phone turns: the sheet closed, the view landscape, the sheet opened again
  await ev(`Phone.close(true); 1`); await settle(500);
  await view(h, w, false, true); await settle(1500);
  await ev(`document.querySelector('#pipeline .ftile') && document.querySelector('#pipeline .ftile').click(); Phone.open('edit'); 1`); await settle(2500);
  whole(`${at} landscape`, await well());
}
await open(1440, 900, 'en', false, `fwd${Date.now()}`);
await ev(`document.querySelector('#pipeline .ftile').click(); 1`); await settle(1500);
const d = await well(); info.desk = d;
whole('1440 desk', d);
ok('1440 desk: the short form', d && d.use === '1', d);
return { pass: fails.length === 0, fails, info };
