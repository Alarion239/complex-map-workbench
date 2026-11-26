// The Regions pop-up of a classic pane head (X → Y) stays open, and its button stays pressed, when the head lays its row out again
// while the pop-up is open (#2432): right after the switch to X → Y, while the page settles, and when the head's width changes.
// The button the pop-up hangs from is the one the head keeps: a press on it closes the pop-up (the anchor's re-click) and Escape
// gives the focus back to it. The relayouts are forced by a width change, so each row fails the same way every run.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ST = { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'phase' } };
const BTN = `document.querySelector('#paneL .pane-head .pat-btn')`;
// the pop-up and its button's state: the pop-up is there, and the button the head shows is pressed
const STATE = `(() => { const b = ${BTN}; return { pop: !!document.querySelector('.pat-pop'), pressed: !!b && b.getAttribute('aria-expanded') === 'true', shown: !!b && b.isConnected }; })()`;
// n animation frames of the page
const frames = (n) => ev(`new Promise((r) => { let k = ${n}; const t = () => (--k > 0 ? requestAnimationFrame(t) : r(1)); requestAnimationFrame(t); })`);
const stands = async (tag) => {
  const s = await ev(STATE);
  ok(`${tag}: the pop-up is open and the head's button is pressed`, s.pop && s.pressed && s.shown, s);
};
await view(1440, 900, false, false);
// pressed at once after the switch, with the page still settling
await load('headpoprelayout' + Date.now(), ST, '', 'classic');
await ev(`__cmwSetMain('xy'), 1`);
await settled({ max: 15000, until: `!!${BTN}` });
await ev(`${BTN}.click(), 1`);
const w = await settled({ max: 8000, until: `${STATE}.pop`, only: true });
ok('pressed right after the switch: it opens', w.ok, w);
// (the head laid out again by a width change while the pop-up is open, right after the switch: forced, not left to the page's own settling)
const HEADW = `document.querySelector('#paneL .pane-head').getBoundingClientRect().width`;
const wSw = await ev(HEADW);
await view(1400, 900, false, false);
const nSw = await settled({ max: 8000, until: `${HEADW} < ${wSw} - 1`, only: true });
ok('right after the switch: the head narrowed', nSw.ok, { wSw, nSw });
await frames(20);
await stands('right after the switch, the head laid out again');
// Escape (here, after that relayout) closes it and gives the focus back to the head's button, the one the head shows
await ev(`document.querySelector('.pat-pop').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 1`);
const esc = await settled({ max: 8000, until: `!document.querySelector('.pat-pop') && document.activeElement === ${BTN}`, only: true });
ok('Escape closes it and the focus is on the head\'s button', esc.ok, esc);
await ev(`${BTN}.click(), 1`);
await settled({ max: 8000, until: `${STATE}.pop`, only: true });
// at rest, the head's width changes: its row is laid out again with the pop-up open
await stands('at rest');
const w0 = await ev(HEADW);
await view(1380, 900, false, false);
const nw = await settled({ max: 8000, until: `${HEADW} < ${w0} - 1`, only: true });
ok('the head narrowed', nw.ok, { w0, nw });
await frames(20);
await stands('after the head narrowed');
// a press on the head's button then closes the pop-up (it opens at the first press, closes at the second)
await ev(`${BTN}.click(), 1`);
const g = await settled({ max: 8000, until: `!document.querySelector('.pat-pop') && ${BTN}.getAttribute('aria-expanded') === 'false'`, only: true });
ok('a second press closes it and the button reads unpressed', g.ok, g);
return { pass: fails.length === 0, fails, info };
