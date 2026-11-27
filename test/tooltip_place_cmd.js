// A tip is drawn beside the element it belongs to, or not at all: never at the page's top-left, where its style puts it until
// it is placed. The tip of an LED changes under the pointer whenever the LED's state does (the LED's data-tip is its words),
// and an open tip follows its element's words; an element that has no box at that moment (its pane head hides it, display none)
// has no place to put a tip beside.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
await view(1200, 800, false);
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const base = `http://localhost:${PORT}`;
const loaded = "typeof __cmwSteps === 'function' && typeof __cmwBusy === 'function' && !!document.getElementById('leftLed')";
const LANGS = { en: 'Up to date', ru: 'Актуально', it: 'Aggiornato' };
// (the LED's centre, the pointer put on it, and the tip's wait: 450 ms)
const hover = async () => {
  const c = await ev(`(() => { const r = document.getElementById('leftLed').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0] - 20, y: c[1] });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0], y: c[1] });
  return settled({ max: 4000, only: true, panes: false, until: `!document.getElementById('tip').hidden` });
};
// (a rAF log of the tip against the LED, run in the page, while `act` runs there: every frame in which the tip is shown away from the LED)
const LOG = (act, frames = 24, grace = 0) => `new Promise((resolve) => {
  const tip = document.getElementById('tip'), led = document.getElementById('leftLed'), away = [], seen = { shown: 0, frames: 0 };
  const look = (when) => {
    seen.frames++;
    if (tip.hidden || seen.frames <= ${grace}) return;
    seen.shown++;
    const t = tip.getBoundingClientRect(), l = led.getBoundingClientRect();
    if (Math.abs((t.left + t.width / 2) - (l.left + l.width / 2)) > t.width / 2 + 40 || Math.min(Math.abs(t.bottom - l.top), Math.abs(t.top - l.bottom)) > 40) away.push({ when, tip: [t.left, t.top, t.width, t.height], led: [l.left, l.top, l.width, l.height], text: tip.textContent });
  };
  let n = 0;
  // (each frame is read after it has been painted: from a task queued in its animation frame callback, when the frame's rendering update is done)
  const loop = () => requestAnimationFrame(() => setTimeout(() => { look('frame'); if (++n < ${frames}) loop(); else resolve({ away, seen }); }, 0));
  ${act}
  loop();
})`;
for (const [lang, words] of Object.entries(LANGS)) {
  const ns = 'tipp' + lang + Date.now();
  await seed(ns, { steps: [{ type: 'pown', params: { n: 2 }, on: true }], shapes: [], sv: { at: 0, T: 1, scope: 'in', surf: 'plane' } });
  await go(`${base}/test.html?ns=${ns}&view=steps&lang=${lang}`);
  await settled({ max: 30000, panes: false, until: loaded });
  await settled({ max: 8000, only: true, panes: false, until: "document.getElementById('leftLed').className === 'led ok'" });
  const w = await hover();
  ok(`${lang}: the hovered LED shows its tip`, w.ok, w);
  // (a) the LED's words change under the pointer: the tip follows, beside the LED
  const a = await ev(LOG(`window.__cmwBusy(true);`));
  info['change ' + lang] = a.seen;
  ok(`${lang}: the LED's state changes under the pointer: the tip stays beside the LED`, a.away.length === 0 && a.seen.shown > 0, a.away.slice(0, 2));
  // (b) the LED has no box when its words change (its pane head hides it): no tip at the page's top-left
  const b = await ev(LOG(`const head = led.closest('.pane-head'); head.classList.add('noled'); window.__cmwBusy(false); setTimeout(() => head.classList.remove('noled'), 0);`));
  info['hidden ' + lang] = b.seen;
  ok(`${lang}: the LED has no box when its words change: no tip is drawn away from it`, b.away.length === 0, b.away.slice(0, 2));
}
// (d) the LED moves under an open tip, its words unchanged (a pane head laid out again around it): the tip goes with it, within a few
// frames, or is gone; it does not stay where the LED was
for (const [lang, words] of Object.entries(LANGS)) {
  const ns = 'tipm' + lang + Date.now();
  await seed(ns, { steps: [{ type: 'pown', params: { n: 2 }, on: true }], shapes: [], sv: { at: 0, T: 1, scope: 'in', surf: 'plane' } });
  await go(`${base}/test.html?ns=${ns}&view=steps&lang=${lang}`);
  await settled({ max: 30000, panes: false, until: loaded });
  await settled({ max: 8000, only: true, panes: false, until: "document.getElementById('leftLed').className === 'led ok'" });
  const w = await hover();
  ok(`${lang}: moved LED: the hovered LED shows its tip`, w.ok, w);
  // (the LED's words change while a layout puts it elsewhere for a moment, as the pane head laid out again around it does: the
  // observer that re-shows the open tip reads the LED where it is then, and the LED is back where it was, under the pointer, before
  // the next frame. No pointer event follows, so nothing but the tip itself can put it right)
  // (the pane head's size changes, and its observer, which runs in the frame's rendering update after the animation frame callbacks and
  // before the paint, does what a pane head's layout pass does: the LED's words change while it is elsewhere)
  const m = await ev(LOG(`const head = led.closest('.pane-head'); const ro = new ResizeObserver(() => { ro.disconnect(); led.style.marginRight = '260px'; led.setAttribute('data-tip', led.getAttribute('data-tip') + ' '); queueMicrotask(() => { led.style.marginRight = ''; }); }); ro.observe(head); head.style.paddingLeft = '7px';`, 30));
  info['moved ' + lang] = m.seen;
  ok(`${lang}: the open tip is re-shown while the LED is elsewhere for a moment: in every painted frame the tip is beside the LED, or gone`, m.away.length === 0, m.away.slice(0, 2));
}
// (c) the real trigger: the Cauchy style picked while the LED is hovered, links landing late (test/lib/late_links.js). The pane head
// lays out again around the LED as the style changes, and the LED's words change with it: the tip stays beside the LED in every
// frame, not only in the first
const LATE_MS = 2500;
const lateLinks = fs.readFileSync(path.join(DIR, '..', 'lib', 'late_links.js'), 'utf8');
const CIRCLE = { id: 's1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true };
const step = (expr) => ({ type: 'custom', params: { expr, cut: 180 }, on: true });
for (const lang of Object.keys(LANGS)) {
  const ns = 'tippc' + lang + Date.now();
  await seed(ns, { shapes: [CIRCLE], srcView: { cx: 0, cy: 0, s: 110 }, nextId: 50, pattern: 'checker', dc: 'phase', alpha: 1, steps: [step('z'), step('z+\\frac{1}{z}')] });
  const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lateLinkMs = ${LATE_MS};\n` + lateLinks });
  await go(`${base}/test.html?ns=${ns}&view=steps&lang=${lang}`);
  await settled({ max: 30000, panes: false, until: loaded });
  await settled({ max: 20000, only: true, panes: false, until: "document.getElementById('leftLed').className === 'led ok' && !GLR.pendingLinks" });
  await ev(`__cmwSelect('s1'); 1`);
  await settled({ max: 20000, only: true, panes: false, until: "!__cmwSteps().moving && !GLR.pendingLinks" });
  const w = await hover();
  ok(`${lang}: the Cauchy switch: the hovered LED shows its tip`, w.ok, w);
  const c = await ev(LOG(`(() => { let b = document.querySelector('[id="dcSeg"] [data-v="cauchy"]'); if (!b || !b.getClientRects().length) { document.querySelector('#leftFoot .opts-btn').click(); b = document.querySelector('.opts-pop [data-v="cauchy"]'); } b.click(); })();`, 120));
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
  info['cauchy switch ' + lang] = { seen: c.seen, away: c.away.length };
  ok(`${lang}: the Cauchy style picked under the pointer on the LED: the tip is never drawn away from the LED`, c.away.length === 0, c.away.slice(0, 3));
}
return { pass: fails.length === 0, fails, info };
