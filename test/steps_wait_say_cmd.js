// The Play gate's ring for a screen reader (#2337): while a play waits, ▶ (named Cancel) is described "Preparing the
// glide… 40 %", the ring's fill (--wait) in whole tens, so the wait's progress is read when the control has the focus.
// The live region says "Preparing the glide…" once. In en, ru and it, the page of each opened in its language:
// z^-2 with a disc about 0, Everywhere, on the plane, at the fast speed, its frames drawn ahead (ahead: { ms: 0 }, the
// chain's first glide measuring their cost), the CPU slowed THROTTLE times so that the wait shows its ring; a Play
// 0 -> 1 with the idle jobs held until the ring shows, then let go, so the ring moves through the preparation and the
// frames (the wait on ▶). Every time ▶'s --wait is set, the page records it with ▶'s description and name
// then:
// - says: each time, the description is the language's "Preparing the glide… {p} %", p the fill in whole tens (floor);
// - follows: it takes at least MIN_SAYS values during the wait (it changes with the ring);
// - once: the live region says the language's "Preparing the glide…" exactly once while the play waits;
// - after: once the play starts, ▶ is described and named as it is when it plays (no share, not Cancel), and not busy;
// - unknown: a gauge with no total yet (null) leaves the ring at the unknown fill (0.25) and the description at the
//   language's "Preparing the glide…" alone, no share that was not measured; control: a gauge of 0.47 says 40 %
//   (__cmwWaitSay: the wait's look on a button apart from the page).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); return !!cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const WAIT_MS = 120000, THROTTLE = 40, MIN_SAYS = 3;
// each language's words: the live region's, and the description's with {p} for the share
const WORDS = {
  en: { live: 'Preparing the glide…', say: 'Preparing the glide… {p} %' },
  ru: { live: 'Готовим переход…', say: 'Готовим переход… {p} %' },
  it: { live: 'Preparazione del passaggio…', say: 'Preparazione del passaggio… {p} %' },
};
const STATE = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 }, sv: { speed: 'fast' },
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }], steps: [{ type: 'pown', params: { n: -2 }, on: true }] };
// every value ▶'s --wait is set to, with ▶'s description then, in window.__ring: [{ w, d }]; every text the steps view's
// live region says, in window.__live
const WATCH = `(() => {
  window.__ring = []; window.__live = [];
  const play = document.querySelector(".sv-play"), live = document.querySelector('#stage > .sr-only[aria-live]');
  new MutationObserver(() => {
    const w = play.style.getPropertyValue('--wait');
    if (w) __ring.push({ w: +w, d: play.getAttribute('aria-description'), l: play.getAttribute('aria-label') });
  }).observe(play, { attributes: true, attributeFilter: ['style', 'aria-description'] });
  new MutationObserver(() => __live.push(live.textContent)).observe(live, { childList: true, characterData: true, subtree: true });
  return 1;
})()`;
const BTN = '(() => { const b = document.querySelector(".sv-play"); return { label: b.getAttribute("aria-label"), desc: b.getAttribute("aria-description"), busy: b.hasAttribute("aria-busy") }; })()';
const rest = async (i) => {
  await ev(`__cmwSteps({ go: ${i}, now: true }), 1`);
  await settled({ only: true, max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === ${i} && __cmwSteps().ready.ready` });
};

await view(900, 600, false, false);
for (const lang of Object.keys(WORDS)) {
  const W = WORDS[lang], ns = `waitsay${lang}${Date.now()}`;
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(STATE))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps&lang=${lang}`);
  const up = await settled({ only: true, max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  if (!up.ok) throw new Error(`${lang}: the page hooks are not up: ` + JSON.stringify(up));
  const unk = await ev('__cmwWaitSay(null)'), known = await ev('__cmwWaitSay(0.47)');
  info[`${lang} unknown`] = { unk, known };
  ok(`${lang} unknown: with no total yet the ring stands at 0.25 and the description is "${W.live}" alone`, !!unk && unk.desc === W.live && unk.fill === 0.25, unk);
  ok(`${lang} unknown control: a gauge of 0.47 is described with 40 %`, !!known && known.desc === W.say.replace('{p}', '40'), known);
  await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: 'plane', ahead: { ms: 0, waitMs: ${WAIT_MS} } }), 1`);
  await rest(0);
  // (the chain's first glide plays live; its frame cost is measured after it ends)
  await ev('__cmwSteps({ clock: 1000 / 60, go: 1 }), 1');
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
  const m = await settled({ only: true, max: WAIT_MS, until: '(() => { const p = __cmwSteps().aheadProbe; return !!p && p.state !== "waiting" && p.state !== "drawing"; })()' });
  if (!m.ok) throw new Error(`${lang}: the frames' probe did not end`);
  await rest(0);
  const before = await ev(BTN);
  await ev(WATCH);
  await send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  let g = null;
  try {
    await ev('__cmwSteps({ holdJobs: true, clock: 1e-6 }), __cmwSteps({ play: true }), 1');
    await settled({ only: true, max: WAIT_MS, until: '__ring.length > 0' });
    await ev('__cmwSteps({ holdJobs: false }), 1');
    g = await settled({ only: true, max: WAIT_MS, until: '!!__cmwSteps().play' });
  } finally {
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await ev('__cmwSteps({ holdJobs: false }), 1');
  }
  const ring = await ev('__ring'), live = await ev('__live'), after = await ev(BTN);
  const want = (w) => W.say.replace('{p}', String(10 * Math.floor(10 * w + 1e-9)));
  const off = ring.filter((r) => r.d !== want(r.w));
  const says = [...new Set(ring.map((r) => r.d))];
  info[lang] = { says, live, before, after, sets: ring.length, g: g && g.ok };
  ok(`${lang} says: each time, ▶'s description is "${W.say}" with the ring's fill in whole tens`, ring.length > 0 && off.length === 0, off.slice(0, 6).map((r) => `${r.w.toFixed(3)}: ${r.d}`));
  ok(`${lang} follows: the description takes at least ${MIN_SAYS} values during the wait`, says.length >= MIN_SAYS, says);
  ok(`${lang} once: the live region says "${W.live}" exactly once while the play waits`, live.filter((t) => t === W.live).length === 1, live);
  const waitLabel = ring.length ? ring[ring.length - 1].l : null;
  ok(`${lang} after: once the play starts, ▶ has no share in its description, is not named as the wait is, and is not busy`, !!g && g.ok && !String(after.desc).includes('%') && after.label !== waitLabel && !after.busy, { before, after, waitLabel });
  await ev('__cmwSteps({ play: false, clock: 1000 / 60 }), 1');
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
}

return { pass: fails.length === 0, passed: pass, fails, info };
