// Chain cards during a window resize (#530, ux's pick B): while a card's picture is still the old size's, it keeps its own
// aspect (never stretched into the new box), centred, on the card's own well colour; once redrawn, it matches its box.
// Every painted frame is sampled (after the frame, so the page's observers have run): no visible picture is shown at an aspect
// that differs from its backing store's by more than 2 %. Cases: a drag-resize 1024 -> 1440 at CPU x1 and x6, and a tablet
// rotation 768 x 1024 -> 1024 x 768 on a touch screen (a phone's layout has no card pictures). A command file for a CDP
// daemon:  <runner> test/card_resize_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await load('cr' + Date.now(), {});
const base = await ev('location.origin');
// one row per card canvas per painted frame: [ms, index, backing w, h, box w, h, object-fit, stale flag, drawn flag, background]
const SAMPLER = `(() => { window.__cr = { t0: performance.now(), s: [] };
  const probe = document.createElement('i'); probe.style.background = 'var(--well)'; probe.style.display = 'none'; document.body.append(probe);
  window.__cr.well = getComputedStyle(probe).backgroundColor;
  const sample = () => { const cs = typeof __cmwCards === 'function' ? __cmwCards().cards : [];
    [...document.querySelectorAll('#pipeline .card canvas')].forEach((e, i) => { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return; const st = getComputedStyle(e);
      window.__cr.s.push([Math.round(performance.now() - window.__cr.t0), i, e.width, e.height, +r.width.toFixed(2), +r.height.toFixed(2), st.objectFit, e.classList.contains('rz') ? 1 : 0, cs[i] && cs[i].sig ? 1 : 0, st.backgroundColor]); }); };
  const tick = () => requestAnimationFrame(() => setTimeout(() => { sample(); tick(); }, 0));
  tick(); })()`;
const analyse = (rows, well) => {
  // a stretched picture counts when the same card shows it in two consecutive samples: one sample is taken after each painted
  // frame, so a state that lasts to the next sample was painted; one that the next frame's observers fix (a redraw that cleared
  // the mark in the task between two frames, just before the next resize step changed the box) was never on screen
  let worst = 0, stale = 0, wrongBars = 0, n = 0;
  const prev = {};
  for (const [, i, bw, bh, rw, rh, fit, rz, drawn, bg] of rows) {
    if (!drawn || !bh) { prev[i] = 0; continue; }
    n++;
    const mis = Math.abs((bw / bh) / (rw / rh) - 1);
    const shown = fit === 'contain' ? 0 : mis;            // object-fit: contain shows the picture at its own aspect
    worst = Math.max(worst, Math.min(prev[i] || 0, shown));
    prev[i] = shown;
    if (rz && mis > 0.02) { stale++; if (fit !== 'contain' || bg !== well) wrongBars++; }
  }
  return { frames: n, worstShownDistortionPct: +(worst * 100).toFixed(2), staleFrames: stale, wrongBars };
};
const cardsSettled = async () => { for (let i = 0; i < 100; i++) { const s = await ev(`(() => { const c = __cmwCards().cards; const d = Math.min(window.devicePixelRatio || 1, 2);
  return { drawn: c.length > 0 && c.every((x) => x.sig), ok: [...document.querySelectorAll('#pipeline .card canvas')].every((e) => { const r = e.getBoundingClientRect(); return !(r.width > 0) || (e.width === Math.round(r.width * d) && e.height === Math.round(r.height * d)); }), n: c.length }; })()`); if (s && s.drawn && s.ok) return s; await sleep(250); } return await ev(`__cmwCards().cards.length`); };
const run = async (name, setup, step, thr) => {
  await send('Emulation.setCPUThrottlingRate', { rate: thr });
  await setup();
  await nav(`${base}/test.html?ns=cr${name}${thr}${Date.now() % 1000000}`);
  const before = await cardsSettled();
  const vis = await ev(`[...document.querySelectorAll('#pipeline .card canvas')].filter((e) => e.getBoundingClientRect().width > 0).length`);
  ok(`${name} (cpu x${thr}): the cards are shown and drawn before the resize`, vis >= 2 && before && before.drawn, { vis, before });
  await ev(SAMPLER);
  await step();
  await sleep(thr > 1 ? 7000 : 2500);
  const r = await ev('({ s: window.__cr.s, well: window.__cr.well })');
  const a = analyse(r.s, r.well);
  info[`${name} x${thr}`] = a;
  ok(`${name} (cpu x${thr}): no card shows a stretched picture (distortion at most 2 %)`, a.frames > 0 && a.worstShownDistortionPct <= 2, a);
  ok(`${name} (cpu x${thr}): a stale picture keeps its own aspect on the card's well colour`, a.wrongBars === 0, a);
  const end = await cardsSettled();
  ok(`${name} (cpu x${thr}): after the redraw every canvas matches its box`, end && end.drawn && end.ok, end);
  return a;
};
const dragResize = async () => { for (let w = 1024; w <= 1440; w += 32) { await view(w, 700, false, false); await sleep(80); } };
await run('drag', () => view(1024, 700, false, false), dragResize, 1);
const slow = await run('drag', () => view(1024, 700, false, false), dragResize, 6);
ok('drag (cpu x6): the stale window was seen (a stale picture was painted)', slow.staleFrames > 0, slow);
const tab = await run('tablet', () => view(768, 1024, false, true), () => view(1024, 768, false, true), 4);
await send('Emulation.setCPUThrottlingRate', { rate: 1 });
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 20), info };
