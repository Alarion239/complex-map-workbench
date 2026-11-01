// Chain card thumbnails (#511): once the cards are drawn, every card's canvas has the backing size of its box (times the
// device pixel ratio, at most 2), never the browser's default 300 x 150 -- after a load, after a chain edit (an example
// opened) and after a window resize. The page is slowed (CPU x4 or x6) as the loaded cloud sandbox is, where the first
// pass over the cards comes late; a size that is only wrong while the cards are still waiting for their first draw is not
// a failure, one that outlasts the draw is. A command file for a CDP daemon:  <runner> test/card_canvas_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await load('cc' + Date.now(), {});
const base = await ev('location.origin');
const STATE = `(() => { if (typeof __cmwCards !== 'function') return null; const c = __cmwCards(), d = Math.min(window.devicePixelRatio || 1, 2);
  const rows = [...document.querySelectorAll('#pipeline .card canvas')].map((e) => { const r = e.getBoundingClientRect(); return { vis: r.width > 0 && r.height > 0, have: e.width + 'x' + e.height, want: Math.round(r.width * d) + 'x' + Math.round(r.height * d) }; });
  return { n: c.cards.length, drawn: c.cards.length > 0 && c.cards.every((x) => x.sig), rows }; })()`;
const wrong = (s) => (s ? s.rows.filter((x) => x.vis && x.have !== x.want) : [{ have: 'no state' }]);
// the cards drawn and their canvases right, or the time is up (then the state it ended in)
const cardSettled = async (max = 30000) => { const t0 = Date.now(); let s = null; while (Date.now() - t0 < max) { s = await ev(STATE); if (s && s.n && s.drawn && !wrong(s).length) return s; await sleep(250); } return s; };
const CASES = [[1024, 700, 4], [1100, 700, 6], [1152, 720, 4], [1280, 800, 6], [1440, 900, 4]];
for (const [w, h, thr] of CASES) {
  const tag = `${w} (cpu x${thr})`;
  await send('Emulation.setCPUThrottlingRate', { rate: thr });
  await view(w, h, false, false);
  await nav(`${base}/test.html?ns=cc${w}${Date.now() % 1000000}`);
  let s = await cardSettled();
  info[tag] = s && s.rows;
  ok(`${tag}: after a load, every card's canvas matches its box`, s && s.n >= 2 && s.drawn && !wrong(s).length, s);
  // a chain edit: another example's chain rebuilds the cards
  await ev('(__cmwExample(3), 1)');
  await sleep(300);
  s = await cardSettled();
  ok(`${tag}: after a chain edit, every card's canvas matches its box`, s && s.n >= 2 && s.drawn && !wrong(s).length, s);
  // a resize of the window: the boxes change, the canvases follow
  await view(w + 140, h, false, false);
  await sleep(500);
  s = await cardSettled();
  ok(`${tag}: after the window is resized, every card's canvas matches its box`, s && s.n >= 2 && s.drawn && !wrong(s).length, s);
}
await send('Emulation.setCPUThrottlingRate', { rate: 1 });
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 20), info };
