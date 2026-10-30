// An export while ‹ › have Y on a step's plane saves that plane (issue #383): the figure's Y plane is the one on screen,
// not F's, and it names its variable for it (w_{2}). 390 x 844 with touch, a three-step chain: the figure at F, with Y
// parked on the plane after step 2 (it differs, and says w_{2}), and at F again once the glide is over (as the first). A
// command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ns = 'pge' + Date.now();
await view(390, 844, false, true);
await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'k1', kind: 'disc', c: [0.3, 0], r: 0.6, ci: 0, visible: true }],
  steps: [{ type: 'affine', params: { a: '1', b: '0.5' }, on: true }, { type: 'sin', params: {}, on: true }, { type: 'exp', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en` }); await sleep(3000); await settle(500);
const rest = async () => { for (let i = 0; i < 60; i++) { if (!(await ev('__cmwGlide().moving'))) return; await sleep(100); } };
// (the figure's pictures are the data: images embedded in the svg, hashed in the page; the svg's own ids differ from build to build)
const fig = async () => ev(`await (async () => { try {
  const f = await __cmwFig.build({ for: 'article', cols: 1 }); if (!f) return { none: 1 };
  const hs = (t) => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(16); };
  const imgs = [...f.svg.matchAll(/xlink:href="(data:[^"]*)"/g)].map((m) => m[1].length + ':' + hs(m[1]));
  return { svg: f.svg.replace(/xlink:href="data:[^"]*"/g, ''), imgs: imgs.join(','), n: imgs.length, tex: __cmwFig.latex(f), cap: f.captionTex || '' };
} catch (e) { return { err: String(e && e.stack || e).slice(0, 400) }; } })()`, 180000);
// (the state every reader of Y's stage follows: its stage and its variable's name)
const S0 = await ev('__cmwGlide()');
ok('at rest Y is F: the last stage, the variable w', S0.stage === 3 && S0.yHtml === '<i>w</i>', S0);
const F1 = await fig();
// (the figure needs MathJax: where the page can't load it, only the state is checked)
const noMJ = !!(F1.err && /MathJax/.test(F1.err));
if (noMJ) info.figure = 'MathJax did not load here: the figure is not built';
else ok('the figure at F builds, with its pictures', !F1.err && !F1.none && F1.svg && F1.svg.length > 1000 && F1.n > 0, F1.err || F1.none || F1.n);
await ev('__cmwGlide(-1)'); await rest(); await settle(500);
const g = await ev('__cmwGlide()');
ok('Y is parked on the plane after step 2', g.peek === true && Math.abs(g.x - 2) < 1e-6 && g.at >= 0, g);
ok('Y\'s stage and variable are that plane\'s: stage 2, w with the subscript 2', g.stage === 2 && g.yHtml !== '<i>w</i>' && /w/.test(g.yHtml), g);
// (the names that go with it: Y's title, the phone's chip, a readout over Y, and the caption's map F_2 over the first 2 steps)
const nm = await ev(`({ title: document.getElementById('rightTitle').textContent, mtitle: document.documentElement.dataset.mtitle, cap: __cmwCapParts() })`);
ok('Y\'s title names the plane: w₂ = f₂(f₁(z)), after 2 steps', /w2\s*=\s*f2\(\u2026f1\(z\)\)/.test(nm.title.replace(/[\u2082]/g, '2').replace(/\u2081/g, '1')) || /w.?2.*after 2 steps/.test(nm.title), nm.title);
ok('the chip reads z → w₂', nm.mtitle === 'z \u2192 w\u2082', nm.mtitle);
ok('the caption\'s map is F_{2}, the first two steps\' composite, not F', nm.cap.Fname === 'F_{2}' && nm.cap.raw && !/\\exp/.test(nm.cap.raw), nm.cap);
const P = await fig();
if (!noMJ) {
  ok('the parked figure builds', !P.err && !P.none && P.svg && P.svg.length > 1000, P.err || P.none);
  info.imgs = { F: F1.imgs, parked: P.imgs };
  ok('the parked figure\'s pictures are not F\'s', P.n > 0 && P.imgs !== F1.imgs, info.imgs);
  info.texParked = (P.tex || '').slice(0, 300); info.texF = (F1.tex || '').slice(0, 300);
}
// › › : back to F, the glide over, and the figure is F's again
await ev('__cmwGlide(1)'); await ev('__cmwGlide(1)'); await rest(); await settle(600);
const S1 = await ev('__cmwGlide()');
const nm1 = await ev(`({ title: document.getElementById('rightTitle').textContent, mtitle: document.documentElement.dataset.mtitle, cap: __cmwCapParts() })`);
ok('at F again: the title, chip and caption are F\'s', /w\s*=\s*F\(z\)/.test(nm1.title) && nm1.mtitle === 'z \u2192 w' && nm1.cap.Fname === 'F', nm1);
ok('› › ends the glide: Y is F again', S1.peek === false && S1.stage === 3 && S1.yHtml === '<i>w</i>', S1);
if (!noMJ) {
  const F2 = await fig();
  ok('at F again the figure\'s pictures are the first\'s', !F2.err && F2.imgs === F1.imgs, { a: F2.imgs, b: F1.imgs });
}
return { pass: fails.length === 0, fails, info };
