// The pane head's triggers show their pressed (open) state clearly (#1914): the Display options ⋯, the pattern (Regions) button, the
// colour key chip and the steps view's two menu buttons (Where colour shows, Surface), each with its pop-up open, differ from the
// unpressed look by a mark that stands at least 3:1 against the head (WCAG 1.4.11: the fill alone, --well on the head, is about
// 1.06:1). The mark is the strongest of the trigger's border colour, its inset ring and its fill, against the head's own background.
// A laptop, light and dark. Each scene lists the triggers that must be there (a missing one fails, and every one of them is
// checked, in every head that shows it): the steps view's Landscape has the ⋯, the key and the two menu buttons; the classic X → Y
// view, which draws X alone, has the Regions button in X's head.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { CONTRAST_JS } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'contrast.js'), 'utf8'))();
const MIN_CONTRAST = 3;   // non-text contrast of a state's mark against what it stands on (WCAG 1.4.11)
const UI_WAIT = 8000;
const ST = { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'phase' } };
// the triggers of the pane heads, each by the selector of the elements that show (a hidden one is not counted); the pressed state
// is aria-expanded, and the key chip's is its class
const TRIGGERS = [
  { name: 'Display options ⋯', sel: '.pane-head .opts-btn:not(.pat-btn)' },
  { name: 'Regions button', sel: '.pane-head .pat-btn' },
  { name: 'colour key', sel: '.pane-head > .legend-chip' },
  { name: 'Where colour shows', sel: '.pane-head .sv-scope-menu' },
  { name: 'Surface', sel: '.pane-head .sv-surf1' },
];
// page side: the shown elements of a selector, and whether one is pressed
const SHOWN = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.getClientRects().length)`;
const PRESSED = `(e) => e.getAttribute('aria-expanded') === 'true' || e.classList.contains('open')`;
// the look of the i-th shown trigger of sel: the contrast of its fill, its border and its inset ring against the head's own
// background (the nearest opaque one up the tree), as WCAG's relative luminance reads the colours the canvas resolves
const look = (sel, i) => ev(`(() => {
  ${CONTRAST_JS}
  const e = ${SHOWN(sel)}[${i}], bg = e && backdrop(e.closest('.pane-head'));
  if (!e || !bg) return null;
  const cs = getComputedStyle(e), fill = rgba(cs.backgroundColor), bw = parseFloat(cs.borderTopWidth) || 0, border = rgba(cs.borderTopColor);
  // (an inset ring: "rgb(...) 0px 0px 0px 1px inset", the colour first or last)
  const ring = (cs.boxShadow || '').split(/,(?![^(]*\\))/).map((s) => s.trim()).filter((s) => /inset/.test(s) && !/^none/.test(s)).map((s) => { const m = /(rgba?\\([^)]*\\))/.exec(s); const px = (/\\)\\s+(-?[\\d.]+)px\\s+(-?[\\d.]+)px\\s+(-?[\\d.]+)px\\s+(-?[\\d.]+)px/.exec(s) || [0, 0, 0, 0, 0]); return m && +px[4] > 0 ? rgba(m[1]) : null; }).filter(Boolean);
  const marks = [['fill', fill[3] === 1 ? ratio(fill, bg) : 1], ['border', bw > 0 && border[3] > 0 ? ratio(border, bg) : 1], ...ring.map((r) => ['ring', ratio(r, bg)])];
  const best = marks.reduce((m, x) => (x[1] > m[1] ? x : m), ['none', 1]);
  return { fill: cs.backgroundColor, border: bw > 0 ? cs.borderTopColor : null, ring: cs.boxShadow, headBg: 'rgb(' + bg.slice(0, 3).join(',') + ')', best: best[0], contrast: +best[1].toFixed(2), marks: marks.map((x) => x[0] + ' ' + x[1].toFixed(2)) };
})()`);
// a scene: in light and dark, each trigger of `expect` ({ name: how many are shown }) is shown that many times, and each of them
// shows its pressed look
const scene = async (label, steps, expect) => {
  for (const theme of ['light', 'dark']) {
    await ev(`document.documentElement.setAttribute('data-theme', '${theme}'), 1`);
    await settled({ until: `document.documentElement.getAttribute('data-theme') === '${theme}' && document.getAnimations().length === 0`, max: UI_WAIT, only: true });
    for (const t of TRIGGERS) {
      const shown = await ev(`${SHOWN(t.sel)}.length`);
      ok(`${label} ${theme}: ${t.name}: ${expect[t.name] || 0} shown`, shown === (expect[t.name] || 0), shown);
      for (let i = 0; i < shown; i++) {
        const tag = `${label} ${theme}: ${t.name} ${i + 1}`, el = `${SHOWN(t.sel)}[${i}]`;
        const before = await look(t.sel, i);
        await ev(`${el}.click(), 1`);
        const w = await settled({ until: `(${PRESSED})(${el})`, max: UI_WAIT, only: true });
        ok(`${tag}: opens`, w.ok, w);
        // (the pointer is off it: the hover look is not the pressed one)
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
        await settled({ until: `!${el}.matches(':hover') && document.getAnimations().length === 0`, max: UI_WAIT, only: true });
        const after = await look(t.sel, i);
        info[tag] = { before, after };
        ok(`${tag}: its pressed look differs from the unpressed one`, !!before && !!after && JSON.stringify([before.fill, before.border, before.ring]) !== JSON.stringify([after.fill, after.border, after.ring]), { before, after });
        ok(`${tag}: its pressed mark stands at least ${MIN_CONTRAST}:1 against the head`, !!after && after.contrast >= MIN_CONTRAST, after);
        if (steps) await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 1`);
        if (await ev(`(${PRESSED})(${el})`)) await ev(`${el}.click(), 1`);
        await settled({ until: `!(${PRESSED})(${el})`, max: UI_WAIT, only: true });
      }
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
await scene('steps view', true, { 'Display options ⋯': 1, 'colour key': 1, 'Where colour shows': 1, Surface: 1 });
// the classic X → Y view: X's head, the one the view draws, with the Regions button
// (standards-ok: Y's head and its ⋯, colour key and Regions button go with Y's pane, which the classic view does not draw, #994;
// X's Regions button is read here, and the ⋯ and the key in the steps view's scene above)
await load('headpressxy' + Date.now(), ST, '', 'classic');
ok('the page shows the classic view', !(await isSteps()), null);
await ev(`__cmwSetMain('xy'), 1`);
await settled({ max: 15000, until: `!!document.querySelector('#paneL .pane-head .pat-btn')` });
await scene('classic X → Y', false, { 'Regions button': 1 });
await ev(`document.documentElement.removeAttribute('data-theme'), 1`);
return { pass: fails.length === 0, fails, info };
