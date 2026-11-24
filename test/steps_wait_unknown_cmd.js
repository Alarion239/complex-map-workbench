// The Play gate while it waits only for parts with nothing counted inside them (#2372): Integer power z³ repeated 20
// times on a disc across the unit circle (a REPT chain, exact images), the page at 1440 x 900, ▶ pressed as soon as the
// page is at rest, before what a glide needs is ready. The carried colour's warm draw (svReady's warm part: one unit,
// nothing counted inside it) is the last part done: its machine code takes long to make on a REPT chain (about 2 s on
// lavapipe). Every time ▶'s ring is set, the page records it with ▶'s description, data-wait, the animations on its
// ring's ::before, and svReady's parts then. In two passes, each on a fresh page: with motion, and with
// prefers-reduced-motion: reduce. In each:
// - seen: the ring is set while every counted part (the programs, the jobs) is done and the warm draw is not (the
//   scene reaches the state; a control);
// - says: then ▶ is described "Preparing the glide…" alone: no share (the ring at 17/18 was said as "90 %");
// - unknown: then the ring's state is unknown (data-wait "unknown"), not busy with a share it does not measure;
// - kept: the ring never goes back, and while unknown it keeps the arc it had measured (--wait at least the last busy one);
// - sweep: with motion, a segment sweeps round the rest of the ring (an animation runs on its ::before); with reduced
//   motion, none runs;
// - after: the wait ends: ▶ is not busy and has no share in its description.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); return !!cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const WAIT_MS = 120000, SAY = 'Preparing the glide…';
const STATE = { v3: true, v4: true, v5: true, v6: true, exactImages: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 140 }, sv: { speed: 'fast' },
  shapes: [{ id: 'd1', kind: 'disc', c: [1, 0], r: 0.12, ci: 0, visible: true }], steps: [{ type: 'pown', params: { n: 3 }, on: true, repeat: { n: 20, len: 1 } }] };
// every value ▶'s ring is set to, with ▶'s description, data-wait, the animations on its ring's ::before and svReady's
// parts then, in window.__ring
const WATCH = `(() => {
  window.__ring = [];
  const play = document.querySelector('.sv-play');
  new MutationObserver(() => {
    const w = play.style.getPropertyValue('--wait');
    if (!w) return;
    const anim = document.getAnimations().filter((a) => a.effect && a.effect.target === play && a.effect.pseudoElement === '::before').length;
    __ring.push({ w: +w, d: play.getAttribute('aria-description'), s: play.dataset.wait || null, anim, parts: __cmwSteps().ready.parts });
  }).observe(play, { attributes: true, attributeFilter: ['style', 'aria-description', 'data-wait'] });
  return 1;
})()`;
const counted = (p) => p.programs && p.programs.done === p.programs.total && p.jobs && p.jobs.done === p.jobs.total;

await view(1440, 900, false, false);
for (const reduced of [false, true]) {
  const tag = reduced ? 'reduced motion' : 'motion';
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
  const ns = `waitunknown${reduced ? 'r' : 'm'}${Date.now()}`;
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(STATE))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const up = await settled({ only: true, max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  if (!up.ok) throw new Error(`${tag}: the page hooks are not up: ` + JSON.stringify(up));
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane' }), __cmwSteps({ go: 0, now: true }), 1`);
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
  await ev(WATCH);
  await ev('__cmwSteps({ play: true }), 1');
  // (the wait ends: ▶ is no longer busy, after its ring was set at least once)
  const end = await settled({ only: true, max: WAIT_MS, until: '__ring.length > 0 && !document.querySelector(".sv-play[aria-busy]")' });
  const ring = await ev('__ring'), after = await ev('(() => { const b = document.querySelector(".sv-play"); return { busy: b.hasAttribute("aria-busy"), desc: b.getAttribute("aria-description") }; })()');
  const warmOnly = ring.filter((r) => counted(r.parts) && r.parts.warm && r.parts.warm.done < r.parts.warm.total && !r.parts.ahead);
  const firstU = ring.findIndex((r) => warmOnly.includes(r)), lastBusy = ring.slice(0, Math.max(0, firstU)).filter((r) => r.s === 'busy').pop();
  info[tag] = { ring: ring.map((r) => `${r.w.toFixed(3)} ${r.s} anim=${r.anim} ${r.d} ${JSON.stringify(r.parts)}`), lastBusy: lastBusy && lastBusy.w };
  ok(`${tag} seen: the ring is set while every counted part is done and the warm draw is not`, warmOnly.length > 0, info[tag]);
  ok(`${tag} says: then ▶ is described "${SAY}" alone, with no share`, warmOnly.length > 0 && warmOnly.every((r) => r.d === SAY), warmOnly.map((r) => r.d));
  ok(`${tag} unknown: then the ring's state is unknown (data-wait "unknown")`, warmOnly.length > 0 && warmOnly.every((r) => r.s === 'unknown'), warmOnly.map((r) => r.s));
  ok(`${tag} kept: the ring never goes back, and while unknown keeps the arc last measured`, ring.every((r, i) => i === 0 || r.w >= ring[i - 1].w) && warmOnly.every((r) => !lastBusy || r.w >= lastBusy.w), info[tag]);
  if (reduced) ok(`${tag} sweep: no animation runs on the ring while unknown`, warmOnly.length > 0 && warmOnly.every((r) => r.anim === 0), warmOnly.map((r) => r.anim));
  else ok(`${tag} sweep: a segment sweeps round the rest of the ring while unknown (an animation on its ::before)`, warmOnly.length > 0 && warmOnly.every((r) => r.anim > 0), warmOnly.map((r) => r.anim));
  ok(`${tag} after: the wait ends and ▶ is not busy, with no share in its description`, end.ok && !after.busy && !String(after.desc).includes('%'), { end, after });
  await ev('__cmwSteps({ play: false }), 1');
}
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

return { pass: fails.length === 0, passed: pass, fails, info };
