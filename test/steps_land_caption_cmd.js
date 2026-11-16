// The Landscape's caption about the target preimages (#1702), behind ?view=steps: the relief has no place for them, and the
// caption at the foot of the pane says where they do show, in the steps view's words (the surfaces Plane and Sphere), with no
// classic view name (X → Y, Phase) and no view key (1, 2). The caption is canvas text: the suite records what the pane's
// context draws. English, Russian and Italian.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const WANT = { en: 'Target preimages show on the Plane and the Sphere', ru: 'Прообразы целей видны на «Плоскости» и на «Сфере»', it: 'Le controimmagini dei bersagli si vedono sul Piano e sulla Sfera' };
const CLASSIC = /X\s*→\s*Y|Phase|Fase|Фаза|\(1, 2\)/;
const st = { v3: true, v4: true, v5: true, v6: true,
  shapes: [], targets: [{ id: 't1', kind: 'point', p: [1, 0.5], ci: 2, visible: true }],
  steps: [{ type: 'zeta', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
for (const lang of ['en', 'ru', 'it']) {
  const ns = 'svlc' + lang + Date.now();
  await view(1280, 800, false, false);
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function'` });
  // (every text a 2D context draws from now on, with the font it uses: the caption is 12px text at the pane's foot)
  await ev(`(() => { window.__drawn = []; const f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { window.__drawn.push(String(t)); return f.call(this, t, ...r); }; return 1; })()`);
  await ev(`__cmwSteps({ surf: 'land' }); 1`);
  const w = await settled({ max: 20000, only: true, until: `__cmwSteps().surf === 'land' && window.__drawn.some((t) => /${lang === 'en' ? 'Target preimages' : lang === 'ru' ? 'Прообразы целей' : 'controimmagini dei bersagli'}/.test(t))` });
  ok(`${lang}: the Landscape draws a caption about the target preimages`, w.ok, w);
  const caps = await ev(`[...new Set(window.__drawn.filter((t) => /${lang === 'en' ? 'Target preimages' : lang === 'ru' ? 'Прообразы целей' : 'controimmagini dei bersagli'}/.test(t)))]`);
  info[lang] = caps;
  ok(`${lang}: the caption is "${WANT[lang]}"`, caps.length === 1 && caps[0] === WANT[lang], caps);
  ok(`${lang}: it names no classic view and no view key`, caps.every((t) => !CLASSIC.test(t)), caps);
}
return { pass: fails.length === 0, fails, info };
