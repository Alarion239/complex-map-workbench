// [#465] No raw TeX on the screen: a formula's source (\text{кривая, 5 точек}, \frac{1}{z}, z^{2}, u_k) never shows as
// text, before MathJax has loaded (or where it cannot: a blocked CDN) nor after. Scanned: the visible text, the
// accessible names and tooltips (aria-label, title, data-tip, alt) and the text drawn on canvases (fillText,
// strokeText, recorded from the page's first script). Where: drawn shapes (a curve, a polygon, a disc, a point) in
// the steps view, on the plane z, on the plane w₁, on the sphere and on the landscape, each selected in turn, then every example of the gallery, on the page without MathJax
// (test-nomj.html: what the page shows until MathJax arrives) and with it (test-mj.html: MathJax 4 and its STIX2 font
// from vendor/, no CDN), and the shapes at a phone's width. One language per run (LANG, ci/browser_suites.js); the page
// with MathJax only where MJ is set (en and ru: Alexander's report was Russian with MathJax, a Cyrillic \text MathJax
// did not set; it is not set for it, whose tooltips, names and canvas text read the same with MathJax or without and are
// read on the page without it). It runs in the steps view (ci/suite_views.js: steps({ pin: true })). A command file for a CDP daemon.
const fails = [], info = { scanned: 0 };
const LANG = globalThis.LANG || 'ru';
const MJ = globalThis.MJ !== false;
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
// the raw-TeX scan (test/lib/raw_tex_scan.js): the canvas text is recorded before the page's own scripts run
const RT = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'raw_tex_scan.js'), 'utf8'));
await send('Page.addScriptToEvaluateOnNewDocument', { source: RT.RECORDER });
const scan = RT.scanner({ ev, LANG, fails, info });
// (no wait for the exact images: they put no formula on screen, only ruler ticks and the panes' status, and the canvas
// text is recorded for the page's whole life, so a later scan reads what a late frame drew)
// (the page is quiet, MathJax is there where it is wanted, then a window for it to typeset: MathJax has no event for the
// end of its work, so that window is measured time)
const settle = async (mj) => {
  const t0 = Date.now();
  await settled();
  if (mj) await settled({ until: `!!(window.MathJax && MathJax.tex2svg)`, max: 10000 });
  await settled({ floor: mj ? 1200 : 400 });
  info.settleMs = (info.settleMs || 0) + Date.now() - t0;
};
const SHAPES = [
  { id: 's1', kind: 'curve', pts: [[-1, 0], [-0.5, 0.6], [0, 0.2], [0.5, 0.8], [1, 0.1]], ci: 0, visible: true },
  { id: 's2', kind: 'polygon', pts: [[-1.5, -1], [-0.5, -1.2], [-0.8, -0.3]], ci: 1, visible: true },
  { id: 's3', kind: 'disc', c: [0.8, -0.8], r: 0.4, ci: 2, visible: true },
  { id: 's4', kind: 'point', p: [0.3, 0.4], ci: 3, visible: true },
];
async function openShapes(page) {
  const ns = 'rawtex' + LANG + Date.now();
  await go(`${BASE}/gl-helpers.html`);
  const o = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', lang: LANG, shapes: SHAPES, steps: [{ type: 'pown', params: { n: 2 }, on: true }] };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await go(`${BASE}/${page}?ns=${ns}&lang=${LANG}`);
  await settled({ until: `typeof __cmwSteps === 'function' && typeof __cmwSelect === 'function'` });
}
// the steps view's pictures: the plane z, the plane w₁, the sphere and the landscape of the shown plane
const PICTURES = [['plane z', { go: 0, now: true, surf: 'plane' }], ['plane w1', { go: 1, now: true, surf: 'plane' }], ['sphere', { surf: 'sphere' }], ['landscape', { surf: 'land' }]];
for (const page of MJ ? ['test-nomj.html', 'test-mj.html'] : ['test-nomj.html']) {
  const mj = page === 'test-mj.html';
  await view(1440, 900, false, false);
  await openShapes(page); await settle(mj);
  if (!(await ev(`!!(window.__cmwSteps && __cmwSteps().on)`))) return { pass: false, fails: ['the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)'] };
  for (const [name, o] of PICTURES) {
    await ev(`__cmwSteps(${JSON.stringify(o)}), 1`); await settle(mj);
    await scan(page, `shapes, ${name}`);
    for (const s of SHAPES) { await ev(`__cmwSelect('${s.id}'), 1`); await settled({ floor: mj ? 900 : 400 }); await scan(page, `shapes, ${name}, ${s.kind} selected`); }
    await ev(`__cmwSelect(null), 1`);
  }
  // the gallery: every example
  await go(`${BASE}/${page}?ns=rawtexg${LANG}${Date.now()}&lang=${LANG}`);
  await settled({ until: `typeof __cmwExample === 'function'` });
  for (let i = 0; i < 80; i++) {
    const ok = await ev(`(() => { try { __cmwExample(${i}); return true; } catch (e) { return false; } })()`);
    if (!ok) break;
    await settle(mj);
    await scan(page, `example ${i} (${await ev(`document.querySelector('#examplesBtn .exlabel')?.textContent || ''`)})`);
  }
}
// a phone: the shapes, before MathJax
await view(390, 844, false, true);
await openShapes('test-nomj.html'); await settle(false);
await scan('test-nomj.html', 'phone, shapes');
await view(1440, 900, false, false);
info.fails = fails.length;
return { pass: fails.length === 0, fails: fails.slice(0, 60), info };
