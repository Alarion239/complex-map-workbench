// A page whose font sheet arrives after first paint fits its layout on the loaded faces (src/page.html loads the sheet
// without blocking the parser; onFontsSettled in src/app/01-core.js re-fits when the faces land): the header, the
// steps view's strip and head and the pane heads end up folded exactly as in an undelayed load, at 1280 and at 360.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const NAV_SETTLE_MS = 300;      // pause after a navigation before the page is used
const HOLD_LATE_MS = 5000;      // how long the late load's sheet request is held
const HOLD_CHECK_MS = 2500;     // when the held load is inspected (before the hold ends)
const POLL_MS = 200, POLL_MAX = 300; // poll for the app up, the sheet applied and the faces loaded
const FIT_SETTLE_MS = 1200;     // after the faces load, time for the debounced re-fit and any redraw
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const sheetState = () => ev(`(() => { const l = document.querySelector('link[rel=stylesheet][href*="fonts.googleapis"]'); return { media: l && l.media, fonts: document.fonts && document.fonts.status, hooks: typeof window.__cmwSteps }; })()`);
// how the fit functions left the page: the class lists they set, whether the strip or a head overflows, which of the
// header's controls show
const fit = () => ev(`(() => {
  const q = (s) => document.querySelector(s), c = (s) => { const e = q(s); return e ? e.className : null; };
  const o = (s) => { const e = q(s); return e ? e.scrollWidth > e.clientWidth + 1 : null; };
  const vis = (s) => { const e = q(s); return !!e && e.getClientRects().length > 0; };
  return { html: document.documentElement.className, svHead: c('#svHead'), svHeadOver: o('#svHead'), strip: c('#svStrip'), paneHeadL: c('#paneL .pane-head'), paneHeadLOver: o('#paneL .pane-head'),
    top: c('.top'), topOver: o('.top'), more: vis('#hdrMoreBtn'), examples: vis('#examplesBtn') };
})()`);
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0 };
// opens the steps view at w x h with the sheet held for hold ms; returns the fit once the faces have loaded
const open = async (w, h, mobile, hold) => {
  await holdSheet(0);
  await view(w, h, false, mobile);
  const ns = 'fl' + w + hold + (Date.now() % 1000000);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(NAV_SETTLE_MS);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await holdSheet(hold);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  let pre = null;
  if (hold) { await sleep(HOLD_CHECK_MS); pre = await sheetState(); }
  let s = null;
  for (let i = 0; i < POLL_MAX; i++) { await sleep(POLL_MS); s = await sheetState().catch(() => null); if (s && s.hooks === 'function' && s.media === 'all' && s.fonts === 'loaded') break; }
  await sleep(FIT_SETTLE_MS);
  await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  await holdSheet(0);
  return { pre, post: s, fit: await fit() };
};
for (const [w, h, mobile] of [[1280, 800, false], [360, 740, true]]) {
  const base = await open(w, h, mobile, 0);
  const late = await open(w, h, mobile, HOLD_LATE_MS);
  ok(`${w}: the held load starts before its sheet applies (the app is up, the sheet is still print media)`, late.pre && late.pre.hooks === 'function' && late.pre.media === 'print', late.pre);
  ok(`${w}: both loads end on loaded faces`, base.post && base.post.fonts === 'loaded' && late.post && late.post.fonts === 'loaded', { base: base.post, late: late.post });
  ok(`${w}: the late sheet's fit matches the undelayed load's`, JSON.stringify(late.fit) === JSON.stringify(base.fit), { base: base.fit, late: late.fit });
  info[w] = { base: base.fit, late: late.fit };
}
return { pass: fails.length === 0, fails, info };
