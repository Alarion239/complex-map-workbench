// v16.5 wave 1, the "plane" piece: before/after screenshots of every visible fix (notes/ux-build/w1-plane-AS-BUILT.md).
// Before = dist/base-test.html (a build of work/xv164-merged-snap), after = dist/test.html; light and dark; Russian last.
// Saved as <cdp folder>/shots/w1p/<finding>-<before|after>-<light|dark>.png (copy to notes/ux-build/shots/w1-plane/).
// A command file for a CDP daemon (test/cdp_kit README). (__ONLY = ['ux48', ...]; __PAGES = ['test.html'].)
const ONLY = typeof __ONLY !== 'undefined' ? __ONLY : null;
const PAGES = typeof __PAGES !== 'undefined' ? __PAGES : ['base-test.html', 'test.html'];
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const W = (re, im, side = 'L') => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const out = [], errs = [];
const NS = 'w1ps' + (Date.now() % 100000);
let n = 0;
const loadAt = async (page, st, extra, q = '') => {
  const ns = NS + (n++);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); ${extra || ''}; 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/${page}?ns=${ns}${q}` }); await sleep(2000); await settle(300);
};
const rect = (css, pad = 6) => ev(`(() => { const e = document.querySelector(${JSON.stringify(css)}); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { x: Math.max(0, r.left - ${pad}), y: Math.max(0, r.top - ${pad}), width: r.width + 2 * ${pad}, height: r.height + 2 * ${pad} }; })()`);
const clickSelX = async (css) => { const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(css)}); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`); if (r && !r.__exc) { await click(r[0], r[1]); await settle(150); } return r; };
const tool = (id) => clickSelX(`#tools .tool[data-tool="${id}"], #constructTools .tool[data-tool="${id}"]`);
const clickR = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
};
const tStart = (x, y) => send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
const tMove = (x, y) => send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
const tEnd = () => send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const tap = async (x, y) => { await tStart(x, y); await sleep(50); await tEnd(); await settle(150); };
const tapSel = async (css) => { const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(css)}); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`); if (r && !r.__exc) await tap(r[0], r[1]); return r; };
const laptop = (dark) => view(1366, 768, dark, false);
const phone = (dark) => view(412, 860, dark, true);
const SD = {
  shapes: [
    { id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true },
    { id: 'l1', kind: 'line', a: [-2, 1.5], b: [2, 1.5], ci: 1, visible: true },
    { id: 'p1', kind: 'point', p: [1.5, -1], ci: 2, visible: true },
  ],
  steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, snap: false, nextId: 60,
};
const SC = { shapes: [{ id: 'c1', kind: 'circle', c: [0, 0], r: 1.5, ci: 0, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 90 }, snap: false, nextId: 60 };
const SCENES = {
  // UX48, UX51, UX55, UX100: the Orthogonal chip after a circle (what to pick, the kept curve, ?, Whole | Inside | Outside)
  async ux48(page, tag, dark) {
    await laptop(dark); await loadAt(page, SC);
    await tool('perp');
    const c = await W(1.5, 0); await click(c[0], c[1]); await settle(100);
    const a = await W(-0.5, 0.3), b = await W(0.6, 0.5);
    await click(a[0], a[1]); await settle(100); await click(b[0], b[1]); await settle(300);
    await clickSelX('#draftChipL .cm-q');
    await shot(`w1p/ux48-chip-${tag}`, await ev(`(() => { const r = document.getElementById('plotL').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: 220 }; })()`));
  },
  // UX55: the Construct tiles (Hyperbolic line) and its result's row
  async ux55(page, tag, dark) {
    await laptop(dark); await loadAt(page, SC);
    if (page === 'test.html') { await tool('hyper'); } else { await tool('perp'); await clickSelX('#draftChipL .cm-sb[aria-label="Inside"]'); }
    const c = await W(1.5, 0); await click(c[0], c[1]); await settle(100);
    const a = await W(-0.5, 0.3), b = await W(0.6, 0.5);
    await click(a[0], a[1]); await settle(100); await click(b[0], b[1]); await settle(300);
    await key('Escape'); await key('Escape'); await settle(100);
    await shot(`w1p/ux55-tiles-${tag}`, await rect('#secDraw', 4));
    await ev(`(() => { const r = [...document.querySelectorAll('#shapeList .shape')].pop(); if (r) r.scrollIntoView({ block: 'end' }); return 1; })()`); await settle(150);
    await shot(`w1p/ux55-row-${tag}`, await rect('#secShapes', 4));
  },
  // UX52 + UX101: a refused pick (two parallel lines) in the chip, not a toast at the bottom
  async ux101(page, tag, dark) {
    await laptop(dark); await loadAt(page, { shapes: [{ id: 'la', kind: 'line', a: [-2, 0.5], b: [2, 0.5], ci: 0, visible: true }, { id: 'lb', kind: 'line', a: [-2, -0.5], b: [2, -0.5], ci: 1, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 90 }, snap: false, nextId: 60 });
    await tool('meet');
    const a = await W(-1, 0.5), b = await W(1, -0.5);
    await click(a[0], a[1]); await settle(100); await click(b[0], b[1]); await settle(250);
    await shot(`w1p/ux101-parallel-${tag}`);
  },
  // UX101: a crossing gone to ∞ keeps a hollow marker at the plane's edge
  async ux101inf(page, tag, dark) {
    await laptop(dark); await loadAt(page, { shapes: [{ id: 'la', kind: 'line', a: [-2, 0.5], b: [2, 0.5], ci: 0, visible: true }, { id: 'lb', kind: 'line', a: [-2, -0.5], b: [2, -0.5], ci: 1, visible: true }, { id: 'm', kind: 'point', p: [1, 0.5], ci: 2, visible: true, def: { op: 'meet', args: [{ s: 'la', part: 0 }, { s: 'lb', part: 0 }], index: 0 } }], steps: [], srcView: { cx: 0, cy: 0, s: 90 }, snap: false, nextId: 60 });
    await shot(`w1p/ux101-inf-${tag}`, await ev(`(() => { const r = document.getElementById('plotL').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`));
  },
  // UX56: right-click a point on a circle
  async ux56(page, tag, dark) {
    await laptop(dark); await loadAt(page, { shapes: [{ id: 'c1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 'pt', kind: 'point', p: [1, 0], ci: 1, visible: true, def: { op: 'glider', args: [{ s: 'c1', part: 0 }] }, t: 0 }], steps: [], srcView: { cx: 0, cy: 0, s: 90 }, snap: false, nextId: 60 });
    const p = await W(1, 0); await clickR(p[0], p[1]); await settle(300);
    const m = await ev(`(() => { const e = [...document.querySelectorAll('.ctx-menu, .menu')].find((x) => x.getClientRects().length); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.max(0, r.left - 140), y: Math.max(0, r.top - 30), width: r.width + 160, height: r.height + 40 }; })()`);
    await shot(`w1p/ux56-menu-${tag}`, m || undefined);
    await key('Escape');
  },
  // UX10, UX27, UX37, UX94, UX105: the laptop at rest with a probe: titles, Plane | Sphere, Snap, one readout, the rulers
  async ux10(page, tag, dark) {
    await laptop(dark); await loadAt(page, { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 } });
    const p = await W(0.5, -0.8); await move(p[0], p[1]); await settle(250);
    await shot(`w1p/ux10-laptop-${tag}`);
    // (close-ups: X's head with its title and Plane | Sphere [UX27, UX37]; the Snap button [UX94]; X's rulers [UX105])
    const pl = await ev(`(() => { const r = document.getElementById('plotL').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
    await shot(`w1p/ux27-37-head-${tag}`, { x: Math.max(0, pl[0] - 4), y: Math.max(0, pl[1] - 44), width: pl[2] + 8, height: 120 });
    const sb = await rect('#snapBtn', 40); if (sb) await shot(`w1p/ux94-snap-${tag}`, sb);
    await shot(`w1p/ux105-ruler-${tag}`, { x: Math.max(0, pl[0] - 24), y: pl[1] + pl[3] - 150, width: 280, height: 176, scale: 2 }); // (the rulers and their labels sit outside #plotL)
  },
  // UX10, UX27 on the phone: the X tag and the teaching chip at rest; then the hold-and-slide readout
  async ux10ph(page, tag, dark) {
    await phone(dark); await loadAt(page, { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 } }, `localStorage.removeItem('cmw-probe-learned')`);
    await settle(500);
    await shot(`w1p/ux10-phone-idle-${tag}`, { x: 0, y: 0, width: 412, height: 300 });
    const p = await W(0.5, -0.8);
    await tStart(p[0], p[1]); await sleep(800); await tMove(p[0] + 14, p[1] + 4); await sleep(80); await tMove(p[0] + 24, p[1] + 8); await sleep(250);
    await shot(`w1p/ux10-phone-probe-${tag}`, { x: 0, y: 0, width: 412, height: 300 });
    await tEnd(); await settle(200);
  },
  // UX14, UX95: the polygon's chip on the phone (no Enter)
  async ux14(page, tag, dark) {
    await phone(dark); await loadAt(page, { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 60 }, snap: false });
    await tapSel('.ph-tools .tool[data-tool="polygon"], #tools .tool[data-tool="polygon"]'); await settle(150);
    for (const [a, b] of [[-1, -1], [1, -1], [1.2, 1], [-0.5, 1.4]]) { const s = await W(a, b); await tap(s[0], s[1]); }
    await shot(`w1p/ux14-phone-poly-${tag}`);
  },
  // UX09: handles on the phone
  async ux09(page, tag, dark) {
    await phone(dark); await loadAt(page, { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 60 }, snap: false });
    const c = await W(0, 0); await tap(c[0], c[1]); await settle(200);
    const r = await W(1, 0);
    await shot(`w1p/ux09-phone-handles-${tag}`, { x: c[0] - 90, y: c[1] - 80, width: 180, height: 160, scale: 2 });
    void r;
  },
  // UX44, UX105: the disc's Inspector fields
  async ux44(page, tag, dark) {
    await laptop(dark); await loadAt(page, { shapes: [{ id: 'd1', kind: 'disc', c: [0.2166667, -1.3846154], r: 1.5833333, ci: 0, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 60 } });
    await clickSelX('.shape[data-id="d1"] .shape-name'); await settle(300);
    await ev(`(() => { const r = document.querySelector('.shape-edit'); if (r) r.scrollIntoView({ block: 'end' }); return 1; })()`); await settle(150);
    await shot(`w1p/ux44-fields-${tag}`, await rect('.shape-edit', 6));
  },
  // UX92, UX95: a bounded formula region (no "Unbounded" note)
  async ux92(page, tag, dark) {
    await laptop(dark); await loadAt(page, { shapes: [{ id: 'f1', kind: 'formula', expr: '|z+1| < 1', ci: 0, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 60 } });
    await clickSelX('.shape[data-id="f1"] .shape-name'); await settle(300);
    await ev(`document.getElementById('secShapes').scrollIntoView({ block: 'start' }); 1`); await settle(150);
    await shot(`w1p/ux92-note-${tag}`, await rect('#secShapes', 4));
  },
  // UX95: colour names; no Clear shapes in one shape's ⋯
  async ux95(page, tag, dark) {
    await laptop(dark); await loadAt(page, { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 60 } });
    await clickSelX('.shape[data-id="d1"] .icon-btn.more'); await settle(250);
    await ev(`(() => { const b = [...document.querySelectorAll('.menu .mi')].find((x) => x.textContent.trim().startsWith('Color')); if (b) b.click(); return !!b; })()`); await settle(250);
    const m = await ev(`(() => { const es = [...document.querySelectorAll('.menu')].filter((x) => x.getClientRects().length); if (!es.length) return null; let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0; for (const e of es) { const r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); } return { x: Math.max(0, x0 - 8), y: Math.max(0, y0 - 8), width: x1 - x0 + 16, height: y1 - y0 + 16 }; })()`);
    await shot(`w1p/ux95-menu-${tag}`, m || undefined);
    await key('Escape'); await key('Escape');
  },
  // UX91: the first shape refits the cell, and says so
  async ux91(page, tag, dark) {
    await laptop(dark); await loadAt(page, { shapes: [], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 }, snap: true, pattern: 'checker' });
    await tool('disc');
    const a = await W(0.3, 0.2); await drag(a[0], a[1], a[0] + 24, a[1], 8, 16); await settle(500);
    await shot(`w1p/ux91-refit-${tag}`);
  },
  // UX67: the root step's sheet in its editor
  async ux67(page, tag, dark) {
    await laptop(dark); await loadAt(page, { shapes: [], steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } });
    await clickSelX('#pipeline .card[data-k="1"]'); await settle(400);
    await shot(`w1p/ux67-sheets-${tag}`, await rect('#propsPanel', 2));
  },
  // UX86, UX95: the pattern names (Square grid; names wrap) and the Line grid tool
  async ux86(page, tag, dark) {
    await laptop(dark); await loadAt(page, { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 60 } });
    await ev(`document.getElementById('patternSeg').scrollIntoView({ block: 'center' }); 1`); await settle(200);
    await shot(`w1p/ux86-patterns-${tag}`, await rect('#patternSeg', 6));
    await ev(`document.getElementById('secDraw').scrollIntoView({ block: 'start' }); 1`); await settle(100);
    await key('2'); await settle(900);
    // (the Phase style chooser, where "Grid" is now "Pulled-back grid")
    const dc = await rect('#dcSeg', 8);
    await shot(`w1p/ux86-phase-${tag}`, dc || await ev(`(() => { const r = document.getElementById('plotL').getBoundingClientRect(); return { x: r.left, y: r.top - 40, width: r.width, height: 120 }; })()`));
  },
  // UX15: Undo in the middle of an Orthogonal circle: the pick goes, the disc stays, a toast says so
  async ux15(page, tag, dark) {
    await laptop(dark); await loadAt(page, SD);
    await tool('perp');
    const u = await W(0, 1.5); await click(u[0] + 40, u[1]); await settle(100);
    const p = await W(-1, -1.5); await click(p[0], p[1]); await settle(100);
    await key('z', 4); await settle(250);
    await shot(`w1p/ux15-undo-${tag}`);
  },
  // UX94, UX51 on the phone: the Snap switch in More tools; the Orthogonal chip in words
  async ux94ph(page, tag, dark) {
    await phone(dark); await loadAt(page, SD);
    await tapSel('#toolMore'); await settle(400);
    await shot(`w1p/ux94-phone-more-${tag}`);
    await key('Escape'); await settle(200);
    await ev(`document.querySelector('#constructTools .tool[data-tool="perp"]').click(); 1`); await settle(200);
    const u = await W(0, 1.5); await tap(u[0] + 30, u[1]);
    await shot(`w1p/ux51-phone-chip-${tag}`, { x: 0, y: 0, width: 412, height: 300 });
  },
  // UX95: the phone's Display sheet title
  async ux95ph(page, tag, dark) {
    await phone(dark); await loadAt(page, SD);
    await tapSel('.ph-dsp'); await settle(500);
    await shot(`w1p/ux95-phone-display-${tag}`);
  },
};
for (const [id, f] of Object.entries(SCENES)) {
  if (ONLY && !ONLY.includes(id)) continue;
  for (const page of PAGES) for (const dark of [false, true]) {
    const tag = `${page === 'test.html' ? 'after' : 'before'}-${dark ? 'dark' : 'light'}`;
    try { await f(page, tag, dark); out.push(`${id} ${tag}`); } catch (e) { errs.push({ id, tag, e: String(e && e.stack || e).slice(0, 400) }); }
  }
}
// Russian (after only): the Hyperbolic line chip and the laptop at rest
if (!ONLY || ONLY.includes('ru')) {
  try {
    await laptop(false); await loadAt('test.html', SC, '', '&lang=ru');
    await tool('hyper'); const c = await W(1.5, 0); await click(c[0], c[1]); await settle(200);
    await clickSelX('#draftChipL .cm-q');
    await shot('w1p/ru-hyper-chip-after-light');
    await key('Escape'); await key('Escape');
    await ev(`localStorage.setItem('cmw-lang', 'en'); 1`);
    out.push('ru');
  } catch (e) { errs.push({ id: 'ru', e: String(e).slice(0, 300) }); }
}
await laptop(false);
return { out, errs, logs: (await logs()).filter((x) => x.t === 'EXC').slice(0, 8) };
