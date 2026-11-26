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
const LOG = (act) => `new Promise((resolve) => {
  const tip = document.getElementById('tip'), led = document.getElementById('leftLed'), away = [], seen = { shown: 0, frames: 0 };
  const look = (when) => {
    seen.frames++;
    if (tip.hidden) return;
    seen.shown++;
    const t = tip.getBoundingClientRect(), l = led.getBoundingClientRect();
    if (Math.abs((t.left + t.width / 2) - (l.left + l.width / 2)) > t.width / 2 + 40 || Math.min(Math.abs(t.bottom - l.top), Math.abs(t.top - l.bottom)) > 40) away.push({ when, tip: [t.left, t.top, t.width, t.height], led: [l.left, l.top, l.width, l.height], text: tip.textContent });
  };
  let n = 0;
  const loop = () => { look('frame'); if (++n < 24) requestAnimationFrame(loop); else resolve({ away, seen }); };
  ${act}
  requestAnimationFrame(loop);
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
return { pass: fails.length === 0, fails, info };
