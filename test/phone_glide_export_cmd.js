// An export on a phone saves the plane the steps view shows (issues #383, #633): after › › glide to the plane w₂ of a
// three-step chain, the figure's picture is that plane's, not z's, and its caption names that plane's map, f₃(w₂); ‹ ‹
// back to z, the figure is the first one again. 390 x 844 with touch. A command file for a CDP daemon (test/cdp_kit
// README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'pge' + Date.now();
await view(390, 844, false, true);
await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'k1', kind: 'disc', c: [0.3, 0], r: 0.6, ci: 0, visible: true }],
  steps: [{ type: 'affine', params: { a: '1', b: '0.5' }, on: true }, { type: 'sin', params: {}, on: true }, { type: 'exp', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en`);
await settled({ until: '!!window.__cmwSteps && __cmwSteps().planes.length === 4', max: 20000 });
// (the figure needs MathJax: where the page can't load it, only the plane and its names are checked)
const noMJ = !(await settled({ until: '!!window.MathJax && typeof MathJax.tex2svg === "function"', max: 30000, panes: false })).ok;
if (noMJ) info.figure = 'MathJax did not load here: the figure is not built';
// the figure's pictures are the data: images embedded in the svg, hashed in the page (the svg's own ids differ from
// build to build); built in the page and kept on window, since a figure can take longer than one evaluation's timeout
const fig = async () => {
  await ev(`window.__pge = null; __cmwFig.build({ for: 'article', cols: 1 }).then((f) => {
    if (!f) { window.__pge = { none: 1 }; return; }
    const hs = (t) => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(16); };
    const imgs = [...f.svg.matchAll(/xlink:href="(data:[^"]*)"/g)].map((m) => m[1].length + ':' + hs(m[1]));
    window.__pge = { len: f.svg.length, imgs: imgs.join(','), n: imgs.length, cap: String(f.captionTex || ''), title: String(f.slideTitle || '') };
  }, (e) => { window.__pge = { err: String(e && e.stack || e).slice(0, 400) }; }); 1`);
  await settled({ until: 'window.__pge != null', max: 120000, panes: false });
  return ev('window.__pge');
};
// the plane on screen: the thread's place, and the names the head and the strip give it
const plane = async () => ev(`(() => { const s = __cmwSteps(); return { i: s.i, x: s.x, moving: s.moving, head: (document.getElementById('svHead') || {}).textContent || '', label: s.label, title: s.names.title }; })()`);
// a tap on the strip's ‹ or ›, then the glide to the next plane runs to its end
const tap = async (sel) => { await clickSel(`#svStrip ${sel}`); await settled({ until: '!__cmwSteps().moving', max: 15000, floor: 400 }); };
const P0 = await plane();
ok('at rest the plane is z, coloured by F', P0.i === 0 && /^z\s*·\s*phase of F/.test(P0.head), P0);
const F1 = noMJ ? null : await fig();
if (F1) ok('the figure at z builds, with its pictures, and names F', !F1.err && !F1.none && F1.len > 1000 && F1.n > 0 && /F\(z\)=e\^\{\\sin/.test(F1.cap), F1.err || F1.none || F1);
await tap('.sv-next'); await tap('.sv-next');
const P2 = await plane();
ok('› › glide to the plane w₂, at rest there', P2.i === 2 && Math.abs(P2.x - 2) < 1e-6 && !P2.moving, P2);
ok('the head names w₂ and its map f₃', /^w2\s*·\s*phase of f₃/.test(P2.head) && /^Plane w₂/.test(P2.label), { head: P2.head, label: P2.label });
if (F1) {
  const F2 = await fig();
  ok('the figure at w₂ builds', !F2.err && !F2.none && F2.len > 1000 && F2.n > 0, F2.err || F2.none || F2.len);
  ok('its caption names w₂\'s map: f₃(w₂) = e^{w₂}, not F', /f_\{3\}\(w_\{2\}\)=e\^\{w_\{2\}\}/.test(F2.cap) && !/F\(z\)/.test(F2.cap) && /f_\{3\}/.test(F2.title), { cap: (F2.cap || '').slice(0, 200), title: F2.title });
  info.imgs = { z: F1.imgs, w2: F2.imgs };
  ok('its pictures are not z\'s', F2.imgs !== F1.imgs, info.imgs);
}
// ‹ ‹ : back to z, and the figure is the first one again
await tap('.sv-prev'); await tap('.sv-prev');
const P3 = await plane();
ok('‹ ‹ glide back to z', P3.i === 0 && Math.abs(P3.x) < 1e-6 && /^z\s*·\s*phase of F/.test(P3.head), P3);
if (F1) {
  const F3 = await fig();
  ok('at z again the figure\'s pictures and caption are the first\'s', !F3.err && F3.imgs === F1.imgs && F3.cap === F1.cap, { a: F3.imgs, b: F1.imgs });
}
return { pass: fails.length === 0, fails, info };
