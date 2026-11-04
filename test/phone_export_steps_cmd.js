// An export while the shown plane is a step's plane saves that plane (issue #383): the steps view's figure is the shown
// plane, and it names that plane's own map and variable (f_{3} on w_{2}), not F's. 390 x 844 with touch, the steps view,
// a three-step chain: the figure at z (F's plane, as the first), parked on the plane after step 2 (it differs, the pane
// title says w₂, the caption names f_{3}), and at z again once the steps view is back there (as the first). A command
// file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'pse' + Date.now();
await view(390, 844, false, true);
await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'k1', kind: 'disc', c: [0.3, 0], r: 0.6, ci: 0, visible: true }],
  steps: [{ type: 'affine', params: { a: '1', b: '0.5' }, on: true }, { type: 'sin', params: {}, on: true }, { type: 'exp', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
await settled({ until: '!!window.__cmwSteps && !!window.__cmwFig && __cmwSteps().on', max: 30000 });
const until = async (expr, max = 10000) => { const r = await settled({ until: expr, max }); if (!r.ok) fails.push({ name: 'wait timed out', got: expr }); return r; };
const park = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true })`); await until(`__cmwSteps().i === ${i} && !__cmwSteps().moving`); };
// (the figure's pictures are the data: images embedded in the svg, hashed in the page; the svg's own ids differ from build to build)
const fig = async () => ev(`await (async () => { try {
  const f = await __cmwFig.build({ for: 'article', cols: 1 }); if (!f) return { none: 1 };
  const hs = (t) => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(16); };
  const imgs = [...f.svg.matchAll(/xlink:href="(data:[^"]*)"/g)].map((m) => m[1].length + ':' + hs(m[1]));
  return { svg: f.svg.replace(/xlink:href="data:[^"]*"/g, ''), imgs: imgs.join(','), n: imgs.length, cap: f.captionTex || '' };
} catch (e) { return { err: String(e && e.stack || e).slice(0, 400) }; } })()`, 180000);
const shown = () => ev(`(() => { const s = __cmwSteps();
  return { i: s.i, x: s.x, stage: s.stage, moving: s.moving, name: s.names.title.name, role: s.names.title.role,
    title: document.getElementById('leftTitle').textContent }; })()`);
await park(0);
const S0 = await shown();
ok('at rest the shown plane is z: stage 0, the variable z', S0.i === 0 && S0.stage === 0 && S0.name === '<i>z</i>', S0);
const F1 = await fig();
// (the figure needs MathJax: where the page can't load it, only the state is checked)
const noMJ = !!(F1.err && /MathJax/.test(F1.err));
if (noMJ) info.figure = 'MathJax did not load here: the figure is not built';
else {
  ok('the figure at z builds, with its pictures', !F1.err && !F1.none && F1.svg && F1.svg.length > 1000 && F1.n > 0, F1.err || F1.none || F1.n);
  ok('the caption at z names F', /\$F\$/.test(F1.cap), F1.cap.slice(0, 160));
}
await park(2);
const g = await shown();
ok('the shown plane is the one after step 2', g.i === 2 && Math.abs(g.x - 2) < 1e-6 && !g.moving, g);
ok('its stage and variable are that plane\'s: stage 2, w with the subscript 2', g.stage === 2 && g.name === '<i>w</i><sub>2</sub>', g);
ok('the pane\'s title names the plane: w2, the phase of f₃', /^w2/.test(g.title) && /f₃/.test(g.title), g.title);
const P = await fig();
if (!noMJ) {
  ok('the parked figure builds', !P.err && !P.none && P.svg && P.svg.length > 1000, P.err || P.none);
  ok('the caption names f_{3}, the step that colours w_{2}, not F\'s composite', /f_\{3\}/.test(P.cap) && !/\\sin/.test(P.cap), P.cap.slice(0, 200));
  info.imgs = { z: F1.imgs, parked: P.imgs };
  ok('the parked figure\'s pictures are not the first\'s', P.n > 0 && P.imgs !== F1.imgs, info.imgs);
}
// back at z: the figure is the first again
await park(0);
const S1 = await shown();
ok('at z again: the shown plane, its name and title are z\'s', S1.i === 0 && S1.stage === 0 && S1.name === '<i>z</i>' && /^z/.test(S1.title), S1);
if (!noMJ) {
  const F2 = await fig();
  ok('at z again the figure\'s pictures are the first\'s', !F2.err && F2.imgs === F1.imgs, { a: F2.imgs, b: F1.imgs });
  ok('at z again the caption names F', /\$F\$/.test(F2.cap), F2.cap.slice(0, 160));
}
return { pass: fails.length === 0, fails, info };
