// A pane head's open pop-up follows its button when the head lays its row out again: the pop-up hangs under the head with its
// right edge on the head's (the Regions button's, or ⋯'s, when that lies further right), as the opening rule places it, and does not
// reach the Inspector's column. Classic X → Y, the Regions pop-up open at 1440 × 900, the window then narrowed to 1425 and 1380 and widened
// again; and the steps view's ⋯ pop-up over the same change.
// The window is resized as a window is (no emulation reset), so the head's row may not change at all.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ST = { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'phase' } };
const TOL = 1.5;   // px
// the window's own resize (Playwright's setViewportSize): the page's size alone, with no media or touch emulation set again, which would lay the head out again by itself
const resize = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
const frames = (n) => ev(`new Promise((r) => { let k = ${n}; const t = () => (--k > 0 ? requestAnimationFrame(t) : r(1)); requestAnimationFrame(t); })`);
// the open pop-up's place against its button, the head and the Inspector
const BOXES = (btnSel, popSel) => `(() => {
  const R = (e) => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const btn = document.querySelector(${JSON.stringify(btnSel)}), pop = document.querySelector(${JSON.stringify(popSel)}), head = btn && btn.closest('.pane-head');
  return { btn: R(btn), pop: R(pop), head: R(head), insp: R(document.getElementById('propsPanel')), pressed: !!btn && btn.getAttribute('aria-expanded') === 'true' };
})()`;
// the opening rule: the pop-up's right edge on the head's less 6 px, or on the button's right edge when that lies further right
const stands = (tag, b) => {
  ok(`${tag}: the pop-up is open under the head's button`, !!b.pop && !!b.btn, b);
  if (!b.pop || !b.btn || !b.head) return;
  const want = Math.max(b.btn.r, b.head.r - 6);
  ok(`${tag}: its right edge is where the opening rule puts it (${Math.round(want)})`, Math.abs(b.pop.r - want) <= TOL, { want, got: b.pop.r, b });
  if (b.insp && b.insp.l > b.pop.l) ok(`${tag}: it does not reach the Inspector's column`, b.pop.r <= b.insp.l + TOL, b);
};
const BTN = '#paneL .pane-head .pat-btn';
await view(1440, 900, false, false);
await load('headpopplace' + Date.now(), ST, '', 'classic');
await ev(`__cmwSetMain('xy'), 1`);
await settled({ max: 15000, until: `!!document.querySelector('${BTN}')` });
await settled({ max: 30000, until: `document.getAnimations().length === 0` });
await ev(`document.querySelector('${BTN}').click(), 1`);
await settled({ max: 8000, until: `!!document.querySelector('.pat-pop')`, only: true });
await frames(10);
stands('classic X → Y, 1440', await ev(BOXES(BTN, '.pat-pop')));
const HEADW = `document.querySelector('#paneL .pane-head').getBoundingClientRect().width`;
// (a series of narrowings and the way back: the head lays its row out again at some of these widths and keeps it at others, by what it counts)
for (const w of [1425, 1380, 1440]) {
  const w0 = await ev(HEADW);
  await resize(w, 900);
  const g = await settled({ max: 8000, until: `Math.abs(${HEADW} - ${w0}) > 1`, only: true });
  ok(`the head's width changed for ${w}`, g.ok, g);
  await frames(20);
  stands(`classic X → Y, ${w}`, await ev(BOXES(BTN, '.pat-pop')));
}
// narrowed in small steps (4 px at a time, from 1436 to 1360): the head keeps the same controls through most of them, and the pop-up
// follows it all the same
await resize(1440, 900);
await settled({ max: 8000, until: `${HEADW} > 850`, only: true });
for (let w = 1436; w >= 1360; w -= 4) {
  const w0 = await ev(HEADW);
  await resize(w, 900);
  const g = await settled({ max: 8000, until: `Math.abs(${HEADW} - ${w0}) > 1`, only: true });
  ok(`the head's width changed for ${w}`, g.ok, g);
  await frames(4);
  if (w % 24 === 0 || w === 1360) stands(`classic X → Y, in small steps, ${w}`, await ev(BOXES(BTN, '.pat-pop')));
}
// the steps view's ⋯ pop-up
const OPT = '.pane-head .opts-btn:not(.pat-btn)';
await view(1440, 900, false, false);
await loadView('steps', 'headpopplaces' + Date.now(), Object.assign({ v3: true, v4: true, v5: true }, ST));
await settled({ max: 30000, until: 'window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving' });
await settled({ max: 15000, until: `!!document.querySelector('${OPT}')` });
await ev(`document.querySelector('${OPT}').click(), 1`);
await settled({ max: 8000, until: `!!document.querySelector('.disp-pop')`, only: true });
await frames(10);
stands('steps view ⋯, 1440', await ev(BOXES(OPT, '.disp-pop')));
{
  const w0 = await ev(`document.querySelector('${OPT}').closest('.pane-head').getBoundingClientRect().width`);
  await resize(1425, 900);
  const g = await settled({ max: 8000, until: `Math.abs(document.querySelector('${OPT}').closest('.pane-head').getBoundingClientRect().width - ${w0}) > 1`, only: true });
  ok('the steps view head\'s width changed for 1425', g.ok, g);
  await frames(20);
  stands('steps view ⋯, 1425', await ev(BOXES(OPT, '.disp-pop')));
}
return { pass: fails.length === 0, fails, info };
