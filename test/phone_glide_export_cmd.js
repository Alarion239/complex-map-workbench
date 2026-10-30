// An export while ‹ › have Y on a step's plane saves that plane (issue #383): the figure's Y plane is the one on screen,
// not F's, and it names its variable for it (w_{2}). 390 x 844 with touch, a three-step chain: the figure at F, with Y
// parked on the plane after step 2 (it differs, and says w_{2}), and at F again once the glide is over (as the first). A
// command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
const ns = 'pge' + Date.now();
await view(390, 844, false, true);
await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'k1', kind: 'disc', c: [0.3, 0], r: 0.6, ci: 0, visible: true }],
  steps: [{ type: 'affine', params: { a: '1', b: '0.5' }, on: true }, { type: 'sin', params: {}, on: true }, { type: 'exp', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en` }); await sleep(3000); await settle(500);
const rest = async () => { for (let i = 0; i < 60; i++) { if (!(await ev('__cmwGlide().moving'))) return; await sleep(100); } };
const fig = async () => ev(`await (async () => { try {
  const f = await __cmwFig.build({ for: 'article', cols: 1 }); if (!f) return { none: 1 };
  return { svg: f.svg.replace(/xlink:href="data:[^"]*"/g, ''), tex: __cmwFig.latex(f), cap: f.captionTex || '' };
} catch (e) { return { err: String(e && e.stack || e).slice(0, 400) }; } })()`, 180000);
// (the state every reader of Y's stage follows: its stage and its variable's name)
const S0 = await ev('__cmwGlide()');
ok('at rest Y is F: the last stage, the variable w', S0.stage === 3 && S0.yHtml === '<i>w</i>', S0);
const F1 = await fig();
// (the figure needs MathJax: where the page can't load it, only the state is checked)
const noMJ = !!(F1.err && /MathJax/.test(F1.err));
if (noMJ) info.figure = 'MathJax did not load here: the figure is not built';
else ok('the figure at F builds', !F1.err && !F1.none && F1.svg && F1.svg.length > 1000, F1.err || F1.none);
await ev('__cmwGlide(-1)'); await rest(); await settle(500);
const g = await ev('__cmwGlide()');
ok('Y is parked on the plane after step 2', g.peek === true && Math.abs(g.x - 2) < 1e-6 && g.at >= 0, g);
ok('Y\'s stage and variable are that plane\'s: stage 2, w with the subscript 2', g.stage === 2 && g.yHtml !== '<i>w</i>' && /w/.test(g.yHtml), g);
const P = await fig();
if (!noMJ) {
  ok('the parked figure builds', !P.err && !P.none && P.svg && P.svg.length > 1000, P.err || P.none);
  info.len = { F: F1.svg && F1.svg.length, parked: P.svg && P.svg.length };
  ok('the parked figure is not F\'s', fnv(P.svg || '') !== fnv(F1.svg || ''), info.len);
  info.texParked = (P.tex || '').slice(0, 300); info.texF = (F1.tex || '').slice(0, 300);
}
// › › : back to F, the glide over, and the figure is F's again
await ev('__cmwGlide(1)'); await ev('__cmwGlide(1)'); await rest(); await settle(600);
const S1 = await ev('__cmwGlide()');
ok('› › ends the glide: Y is F again', S1.peek === false && S1.stage === 3 && S1.yHtml === '<i>w</i>', S1);
if (!noMJ) {
  const F2 = await fig();
  ok('at F again the figure is the first', !F2.err && fnv(F2.svg || '') === fnv(F1.svg || ''), { a: F2.svg && F2.svg.length, b: F1.svg && F1.svg.length });
}
return { pass: fails.length === 0, fails, info };
