// The Landscape's caption about the target preimages (#1702), behind ?view=steps: the relief has no place for them, and the
// caption at the foot of the pane says where they do show, in the steps view's words (the surfaces Plane and Sphere), with no
// classic view name (X → Y, Phase) and no view key (1, 2). The caption is canvas text: the suite records what the pane's
// context draws. English, Russian and Italian.
// #1767: a screen reader hears it too, as the plane's description (the canvas's aria-describedby names a hidden span that says
// it), only while it shows; and on phones (320 and 360 px wide, and 740 × 360) it sits clear of the view buttons (zoom, Fit,
// …) and inside the pane, in light and dark: each line the context draws is measured against the buttons' boxes.
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
  // (#1767) the plane's description says it while it shows, and stops when the surface is the Plane again
  const said = () => ev(`(() => { const c = document.getElementById('overlayL'), id = c && c.getAttribute('aria-describedby'), e = id && document.getElementById(id); return e ? e.textContent : null; })()`);
  const d = await settled({ max: 5000, until: `(() => { const c = document.getElementById('overlayL'), id = c && c.getAttribute('aria-describedby'); return !!id && !!document.getElementById(id); })()` });
  const sd = await said();
  info[lang + ' said'] = { d, sd };
  ok(`${lang}: the plane's description says the caption`, typeof sd === 'string' && sd.includes(WANT[lang]), sd);
  await ev(`__cmwSteps({ surf: 'plane' }); 1`);
  await settled({ max: 20000, until: `__cmwSteps().surf === 'plane'` });
  const sp = await said();
  ok(`${lang}: on the Plane the description no longer says it`, !sp || !sp.includes(WANT[lang]), sp);
}
// ---- (#1767) on phones the caption sits clear of the view buttons, inside the pane ----
const CLEAR_PX = 2;   // the least gap between a line's ink box and a button's box
const WORDS = (t) => t.split(/\s+/).filter(Boolean);
for (const [W, H] of [[320, 640], [360, 640], [740, 360]]) for (const dark of [false, true]) for (const lang of ['en', 'ru', 'it']) {
  const tag = `${W}×${H} ${dark ? 'dark' : 'light'} ${lang}`;
  const ns = 'svlcp' + lang + W + Date.now();
  await view(W, H, dark, true);
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function'` });
  // (each line of 12px text the left plane's canvas draws, as a box in page px: its ink, from measureText at the context's transform)
  await ev(`(() => { window.__lines = []; const f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, x, y, ...r) {
    if (this.canvas && this.canvas.id === 'canvasL' && /^12px/.test(this.font)) { const m = this.measureText(t), T = this.getTransform(), cr = this.canvas.getBoundingClientRect(), k = cr.width / this.canvas.width;
      const x0 = this.textAlign === 'center' ? x - m.width / 2 : this.textAlign === 'right' || this.textAlign === 'end' ? x - m.width : x;
      const px = (u, v) => [cr.left + (T.a * u + T.c * v + T.e) * k, cr.top + (T.b * u + T.d * v + T.f) * k];
      const [l, tp] = px(x0, y - m.actualBoundingBoxAscent), [rr, b] = px(x0 + m.width, y + m.actualBoundingBoxDescent);
      window.__lines.push({ t: String(t), l, t0: tp, r: rr, b, pane: { l: cr.left, r: cr.right, t: cr.top, b: cr.bottom } }); }
    return f.call(this, t, x, y, ...r); }; return 1; })()`);
  await ev(`__cmwSteps({ surf: 'land' }); 1`);
  const w = await settled({ max: 20000, only: true, until: `__cmwSteps().surf === 'land' && window.__lines.length > 0` });
  ok(`${tag}: the Landscape draws the caption`, w.ok, w);
  // (the lines of one frame drawn afresh: the caption is the run of lines, drawn one after another, that says WANT)
  await ev(`window.__lines = []; __cmwHideStrokes(false); 1`);
  await settled({ max: 10000, until: `window.__lines.length > 0` });
  const got = await ev(`(() => { const L = window.__lines, want = ${JSON.stringify(WORDS(WANT[lang]).join(' '))}, words = (t) => t.split(/\\s+/).filter(Boolean).join(' ');
    let lines = null;
    for (let i = 0; i < L.length && !lines; i++) for (let j = i; j < L.length; j++) { const t = words(L.slice(i, j + 1).map((q) => q.t).join(' ')); if (t === want) { lines = L.slice(i, j + 1); break; } if (!want.startsWith(t)) break; }
    const btns = [...document.querySelectorAll('#paneL .vbtn')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => { const b = e.getBoundingClientRect(); return { id: e.id, l: b.left, r: b.right, t: b.top, b: b.bottom }; });
    return lines && { lines, btns }; })()`);
  info[tag] = got;
  if (!got) { ok(`${tag}: the caption's lines are found`, false, null); continue; }
  const text = got.lines.map((q) => q.t).join(' ');
  ok(`${tag}: its lines say the caption, word for word`, WORDS(text).join(' ') === WORDS(WANT[lang]).join(' '), text);
  for (const q of got.lines) {
    ok(`${tag}: "${q.t}" is inside the pane`, q.l >= q.pane.l - 0.5 && q.r <= q.pane.r + 0.5, q);
    const hit = got.btns.filter((b) => q.l < b.r + CLEAR_PX && q.r > b.l - CLEAR_PX && q.t0 < b.b + CLEAR_PX && q.b > b.t - CLEAR_PX);
    ok(`${tag}: "${q.t}" is clear of the view buttons by ${CLEAR_PX} px`, !hit.length, { q, hit });
  }
}
return { pass: fails.length === 0, fails, info };
