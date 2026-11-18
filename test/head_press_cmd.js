// The pane head's triggers show their pressed (open) state clearly (#1914): the Display options ⋯, the pattern button and the
// colour key chip, each with its pop-up open, differ from the unpressed look by a mark that stands at least 3:1 against the
// head (WCAG 1.4.11: the fill alone, --well on the head, is about 1.06:1). The mark is the strongest of the trigger's border
// colour, its inset ring and its fill, against the head's own background. A laptop, light and dark, in the steps view (the
// Landscape's head: ⋯ and the key) and in the classic X → Y view (both heads: ⋯, the pattern button and the key).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const MIN_CONTRAST = 3;   // non-text contrast of a state's mark against what it stands on (WCAG 1.4.11)
const WAIT_MS = 400, UI_WAIT = 8000;
const ST = { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'phase' } };
// the triggers of the pane heads: how each opens, and how it closes
const TRIGGERS = [
  { name: 'Display options ⋯', sel: '.pane-head .opts-btn:not(.pat-btn)', open: (s) => `document.querySelector(${JSON.stringify(s)}).click()`, isOpen: (s) => `document.querySelector(${JSON.stringify(s)}).getAttribute('aria-expanded') === 'true'` },
  { name: 'pattern button', sel: '.pane-head .pat-btn', open: (s) => `document.querySelector(${JSON.stringify(s)}).click()`, isOpen: (s) => `document.querySelector(${JSON.stringify(s)}).getAttribute('aria-expanded') === 'true'` },
  { name: 'colour key', sel: '.pane-head > .legend-chip', open: (s) => `document.querySelector(${JSON.stringify(s)}).click()`, isOpen: (s) => `document.querySelector(${JSON.stringify(s)}).classList.contains('open')` },
];
// the look of a trigger: the contrast of its fill, its border and its inset ring against the head's own background (the nearest
// opaque one up the tree), as WCAG's relative luminance reads the colours the canvas resolves
const look = (sel) => ev(`(() => {
  const e = document.querySelector(${JSON.stringify(sel)});
  if (!e || !e.getClientRects().length) return null;
  const cx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  let h = e.closest('.pane-head'), bg = null;
  for (let n = h; n && !bg; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] === 1) bg = c; }
  const cs = getComputedStyle(e), fill = rgba(cs.backgroundColor), bw = parseFloat(cs.borderTopWidth) || 0, border = rgba(cs.borderTopColor);
  // (an inset ring: "rgb(...) 0px 0px 0px 1px inset", the colour first or last)
  const ring = (cs.boxShadow || '').split(/,(?![^(]*\\))/).map((s) => s.trim()).filter((s) => /inset/.test(s) && !/^none/.test(s)).map((s) => { const m = /(rgba?\\([^)]*\\))/.exec(s); const px = (/\\)\\s+(-?[\\d.]+)px\\s+(-?[\\d.]+)px\\s+(-?[\\d.]+)px\\s+(-?[\\d.]+)px/.exec(s) || [0, 0, 0, 0, 0]); return m && +px[4] >= 1 ? rgba(m[1]) : null; }).filter(Boolean);
  const marks = [['fill', fill[3] === 1 ? ratio(fill, bg) : 1], ['border', bw > 0 && border[3] > 0 ? ratio(border, bg) : 1], ...ring.map((r) => ['ring', ratio(r, bg)])];
  const best = marks.reduce((m, x) => (x[1] > m[1] ? x : m), ['none', 1]);
  return { fill: cs.backgroundColor, border: bw > 0 ? cs.borderTopColor : null, ring: cs.boxShadow, headBg: 'rgb(' + bg.slice(0, 3).join(',') + ')', best: best[0], contrast: +best[1].toFixed(2), marks: marks.map((x) => x[0] + ' ' + x[1].toFixed(2)) };
})()`);
const scene = async (label, steps) => {
  for (const theme of ['light', 'dark']) {
    await ev(`document.documentElement.setAttribute('data-theme', '${theme}'), 1`);
    await sleep(WAIT_MS);
    for (const t of TRIGGERS) {
      const tag = `${label} ${theme}: ${t.name}`;
      const before = await look(t.sel);
      if (!before) { info[tag] = 'absent'; continue; }
      await ev(`${t.open(t.sel)}, 1`);
      const w = await settled({ until: t.isOpen(t.sel), max: UI_WAIT, only: true });
      ok(`${tag}: opens`, w.ok, w);
      // (the pointer is off it: the hover look is not the pressed one)
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
      await sleep(WAIT_MS);
      const after = await look(t.sel);
      info[tag] = { before, after };
      ok(`${tag}: its pressed look differs from the unpressed one`, !!after && JSON.stringify([before.fill, before.border, before.ring]) !== JSON.stringify([after.fill, after.border, after.ring]), { before, after });
      ok(`${tag}: its pressed mark stands at least ${MIN_CONTRAST}:1 against the head`, !!after && after.contrast >= MIN_CONTRAST, after);
      if (steps) await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 1`);
      if (await ev(t.isOpen(t.sel))) await ev(`${t.open(t.sel)}, 1`);
      await settled({ until: `!(${t.isOpen(t.sel)})`, max: UI_WAIT, only: true });
    }
  }
};
// the steps view's Landscape head
await view(1440, 900, false, false);
await loadView('steps', 'headpress' + Date.now(), Object.assign({ v3: true, v4: true, v5: true }, ST));
await settled({ max: 30000, until: 'window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving' });
await ev(`(__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }), 1)`);
await settled({ max: 30000, until: 'window.__cmwSteps && !__cmwSteps().moving' });
ok('the page shows the steps view', await isSteps(), null);
await scene('steps view', true);
// the classic X → Y view: both pane heads
await load('headpressxy' + Date.now(), ST, '', 'classic');
ok('the page shows the classic view', !(await isSteps()), null);
await ev(`__cmwSetMain('xy'), 1`);
await settled({ max: 15000, until: `!!document.querySelector('#paneR .pane-head .pat-btn')` });
await scene('classic X → Y', false);
await ev(`document.documentElement.removeAttribute('data-theme'), 1`);
return { pass: fails.length === 0, fails, info };
