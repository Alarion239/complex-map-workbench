// The Play gate while it waits only for parts with nothing counted inside them (#2372): Integer power z³ repeated 20
// times on a disc across the unit circle (a REPT chain, exact images), the page at 1440 x 900, ▶ pressed as soon as the
// page is at rest, before what a glide needs is ready, with the carried colour's warm draw held not done (holdWarm:
// svReady's warm part, one unit with nothing counted inside it, the last part on a REPT chain, whose machine code takes
// seconds) until the ring has been set UNKNOWN_SETS times in that state, then let go: so the state is reached on any
// renderer. Every time ▶'s ring is set, the page records it with ▶'s description, data-wait, the animations on its ring's
// ::before, the angle its glint starts at, and svReady's parts then. In three passes, each on a fresh page: with motion,
// with prefers-reduced-motion: reduce, and with motion where the warm draw is held past the message the wait shows after
// SV_GATE_HANG_MS (10 s), whose Retry is pressed (the warm draw held UNKNOWN_SETS sets more). In each:
// - seen: the ring is set while every counted part (the programs, the pole tracks, the ring, the meshes) is done and the warm draw is not (the
//   scene reaches the state; a control);
// - says: then ▶ is described "Preparing the glide…" alone: no share (17/18 said as a share would be "90 %");
// - unknown: then the ring's state is unknown (data-wait "unknown"), not busy with a share it does not measure;
// - kept: the ring never goes back, and while unknown it keeps the arc it had measured (--wait at least the last busy one);
// - sweep: with motion, a glint sweeps round the whole ring whatever arc is kept (an animation runs on its ::before, and
//   the angles its glint starts at, over the records, cover at least SWEEP_MIN_DEG of the ring); with reduced motion,
//   none runs;
// - after: the wait ends: ▶ is not busy and has no share in its description;
// - retry (its pass): after Retry the ring keeps the arc it had and stays unknown, described "Preparing the glide…"
//   (the wait Retry starts again carries what the ring showed: svGateRetry).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); return !!cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const WAIT_MS = 120000, SAY = 'Preparing the glide…', UNKNOWN_SETS = 15, SWEEP_MIN_DEG = 180, HANG_WAIT_MS = 20000;
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
    const from = /from ([0-9.-]+)deg/.exec(getComputedStyle(play, '::before').backgroundImage);
    __ring.push({ w: +w, d: play.getAttribute('aria-description'), s: play.dataset.wait || null, anim, at: from ? +from[1] : null, parts: __cmwSteps().ready.parts });
  }).observe(play, { attributes: true, attributeFilter: ['style', 'aria-description', 'data-wait'] });
  return 1;
})()`;
// (every counted part done: the parts with something counted inside them, not marked whole, as svGateFill reads them; the
// parts that start only once all else is ready, the inverse programs and the frames ahead, aside)
const counted = (p) => !!p.programs && Object.entries(p).every(([k, v]) => v.whole || k === 'ahead' || k === 'inverse' || v.done === v.total);

await view(1440, 900, false, false);
for (const tag of ['motion', 'reduced motion', 'retry']) {
  const reduced = tag === 'reduced motion', retry = tag === 'retry';
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
  const ns = `waitunknown${tag[0]}${Date.now()}`;
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(STATE))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const up = await settled({ only: true, max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  if (!up.ok) throw new Error(`${tag}: the page hooks are not up: ` + JSON.stringify(up));
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane' }), __cmwSteps({ go: 0, now: true }), 1`);
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
  await ev(WATCH);
  await ev('__cmwSteps({ holdWarm: true }), __cmwSteps({ play: true }), 1');
  let end = null, at = -1;
  try {
    const held = await settled({ only: true, max: WAIT_MS, until: `__ring.filter((r) => r.s === 'unknown').length >= ${UNKNOWN_SETS}` });
    info[`${tag} held`] = held.ok;
    if (retry) {
      // (the message SV_GATE_HANG_MS into the wait, still unknown: its Retry pressed, and the ring set UNKNOWN_SETS times more)
      const msg = await settled({ only: true, max: HANG_WAIT_MS, until: '!!document.querySelector("#toastHost .toast:not(.toast-out) .toast-act")' });
      at = await ev('(() => { const b = Array.from(document.querySelectorAll("#toastHost .toast:not(.toast-out) button")).find((x) => x.textContent === "Retry"); if (!b) return -1; const n = __ring.length; b.click(); return n; })()');
      info.retry = { msg: msg.ok, at };
      if (at >= 0) await settled({ only: true, max: WAIT_MS, until: `__ring.length >= ${at} + ${UNKNOWN_SETS}` });
    }
  } finally { await ev('__cmwSteps({ holdWarm: false }), 1'); }
  // (the wait ends: ▶ is no longer busy, after its ring was set at least once)
  end = await settled({ only: true, max: WAIT_MS, until: '__ring.length > 0 && !document.querySelector(".sv-play[aria-busy]")' });
  const ring = await ev('__ring'), after = await ev('(() => { const b = document.querySelector(".sv-play"); return { busy: b.hasAttribute("aria-busy"), desc: b.getAttribute("aria-description") }; })()');
  const warmOnly = ring.filter((r) => counted(r.parts) && r.parts.warm && r.parts.warm.done < r.parts.warm.total && !r.parts.ahead);
  const firstU = ring.findIndex((r) => warmOnly.includes(r)), lastBusy = ring.slice(0, Math.max(0, firstU)).filter((r) => r.s === 'busy').pop();
  info[tag] = { ring: ring.map((r) => `${r.w.toFixed(3)} ${r.s} anim=${r.anim} at=${r.at} ${r.d} ${JSON.stringify(r.parts)}`), lastBusy: lastBusy && lastBusy.w };
  // (the arc of the ring the glint's start was seen on: 360° less the widest gap between the angles recorded, round the
  // circle; a glint confined to a small rest covers no more than that rest)
  // (past SV_GATE_HANG_MS the wait is hung, data-wait "hung", in the retry pass until Retry: the unknown look is read before)
  const unk = warmOnly.filter((r) => r.s !== 'hung');
  const ats = unk.map((r) => r.at).filter((a) => a != null).map((a) => ((a % 360) + 360) % 360).sort((a, b) => a - b);
  const gaps = ats.map((a, i) => (i + 1 < ats.length ? ats[i + 1] - a : ats[0] + 360 - a));
  const travel = ats.length > 1 ? 360 - Math.max(...gaps) : 0;
  info[tag].travel = travel;
  ok(`${tag} seen: the ring is set while every counted part is done and the warm draw is not`, warmOnly.length > 0, info[tag]);
  ok(`${tag} says: then ▶ is described "${SAY}" alone, with no share`, warmOnly.length > 0 && warmOnly.every((r) => r.d === SAY), warmOnly.map((r) => r.d));
  ok(`${tag} unknown: then the ring's state is unknown (data-wait "unknown")`, unk.length > 0 && unk.every((r) => r.s === 'unknown'), warmOnly.map((r) => r.s));
  ok(`${tag} kept: the ring never goes back, and while unknown keeps the arc last measured`, ring.every((r, i) => i === 0 || r.w >= ring[i - 1].w) && warmOnly.every((r) => !lastBusy || r.w >= lastBusy.w), info[tag]);
  if (reduced) ok(`${tag} sweep: no animation runs on the ring while unknown`, unk.length > 0 && unk.every((r) => r.anim === 0), unk.map((r) => r.anim));
  else ok(`${tag} sweep: a glint sweeps round the whole ring while unknown, its start seen over at least ${SWEEP_MIN_DEG}° of the ring`, unk.length > 0 && unk.every((r) => r.anim > 0) && travel >= SWEEP_MIN_DEG, { anim: unk.map((r) => r.anim), ats, travel, kept: unk.length && unk[0].w });
  ok(`${tag} after: the wait ends and ▶ is not busy, with no share in its description`, end.ok && !after.busy && !String(after.desc).includes('%'), { end, after });
  if (retry) {
    const before = ring[at - 1], next = ring.slice(at, at + UNKNOWN_SETS);
    ok('retry: Retry in the message during an unknown wait keeps the ring\'s arc and its unknown state', at > 0 && next.length > 0 && next.every((r) => r.w >= before.w && r.s === 'unknown' && r.d === SAY), { at, before: before && `${before.w} ${before.s}`, next: next.map((r) => `${r.w.toFixed(3)} ${r.s} ${r.d}`) });
  }
  await ev('__cmwSteps({ play: false }), 1');
}
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

return { pass: fails.length === 0, passed: pass, fails, info };
