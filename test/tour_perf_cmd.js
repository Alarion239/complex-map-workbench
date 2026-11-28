// Frames with the tour running, at 1440 (mouse) and 390 (touch): a countdown filling Next while the pointer hovers X,
// and the tour moving on to the next step when it ends; the Grieg piece playing with its captions; and how often the
// panes change size through a chapter. Each frame window has a control that its activity runs in it, so a window can't
// measure an idle page:
// - the countdown: Next fills (its class counting, its --tour-cd set) on the plane step as the window starts, and the
//   countdown has moved the tour on to the next step by its end (the countdown is shorter than the window);
// - the piece: the Listen button says «Stop listening» as the window starts and as it ends.
// It runs in the steps view (ci/suite_views.js: steps({ pin: true })).
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const R = {}, C = [];
const check = (n, p, d) => C.push([n, !!p, d]);
const TOUR = `typeof Tour === 'object' && typeof __qa === 'object'`;
const running = `Tour.isActive()`;
// (the page's own frames, not a clock: __qa.frames' window is the measurement itself, a control that must last as long as it says)
const frames = (ms) => ev(`await __qa.frames(${ms})`);
const FILL_MS = 5000;
const nextFrame = () => ev('new Promise((r) => requestAnimationFrame(() => r(1)))');
// (the countdown as Next shows it, and the step the tour is on; the Listen button's name, which is
// «Stop listening» while the piece plays)
const COUNTDOWN = `(() => { const n = document.querySelector('.ts-next'), c = Tour.current();
  return { counting: !!n && n.classList.contains('counting'), cd: n ? n.style.getPropertyValue('--tour-cd') : '', step: c ? c.chapter + ':' + c.id : null }; })()`;
const LISTEN = `(() => { const a = document.querySelector('.ts-act'); return a && !a.hidden ? a.getAttribute('aria-label') : null; })()`;
for (const [w, h, mob] of [[1440, 900, false], [390, 844, true]]) {
  await view(w, h, false, mob);
  await go(U + `?ns=pf${w}`); await settled({ until: TOUR });
  if (!(await isSteps())) return { pass: 0, of: 1, fails: [['the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)', false, null]] };
  await ev('Tour.dismissSuggestion()');
  // the panes' size changes through Playing the chain (one chapter): a ResizeObserver on #panes
  // (each change logged with the step's title, the height and the web fonts' state: what a failure needs to be read)
  await ev(`window.__rs = 0; window.__rsLog = []; new ResizeObserver((es) => { window.__rs++; const t = document.querySelector('.tour-strip #tourTitle'); window.__rsLog.push({ h: Math.round(es[0].contentRect.height), step: t ? t.textContent.slice(0, 40) : null, sheet: !!document.querySelector('.ph-sheet:not([hidden])'), fonts: document.fonts.status, ms: Math.round(performance.now()) }); }).observe(document.querySelector('#panes')); 1`);
  await ev(`Tour.start({ chapter: 'playing', step: 1 })`); await settled({ until: running });
  const r0 = await ev('window.__rs');
  // (through the chapter's own steps only: it ends on its range step)
  for (let i = 0; i < 4; i++) { const c = await ev('Tour.current()'); if (!c || c.chapter !== 'playing' || c.id === 'range') break; await ev('Tour.next()'); await settled(); }
  const r1 = await ev('window.__rs');
  R['resizes_' + w] = { start: r0, inChapter: r1 - r0, log: await ev('window.__rsLog') };
  // (a step that opens a phone's sheet gives the planes the room above it, once; every other change is a fault)
  const rl = R['resizes_' + w].log.slice(r0), bySheet = {};
  for (const x of rl) if (x.sheet) bySheet[x.step] = (bySheet[x.step] || 0) + 1;
  check(`${w}: the panes keep their size through the steps of a chapter, but for the one resize a step's sheet makes`, rl.every((x) => x.sheet) && Object.values(bySheet).every((n) => n <= 1) && (w === 1440 ? r1 - r0 === 0 : true), R['resizes_' + w]);
  // a countdown running: the plane step, a drag, then frames while Next fills
  await ev(`Tour.start({ chapter: 'planes', step: 0 })`); await settled({ until: running });
  const a = await ev(`(() => { const b = document.querySelector('#panes').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a[0], y: a[1], button: 'left', clickCount: 1 });
  for (let i = 1; i <= 10; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a[0] + 6 * i, y: a[1], button: 'left', buttons: 1 }); await nextFrame(); }   // (one move per drawn frame)
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: a[0] + 60, y: a[1], button: 'left', clickCount: 1 });
  // (the fill starts once the drag's step is done, which can be a frame after the release)
  const filling = await settled({ only: true, max: FILL_MS, until: `!!document.querySelector('.ts-next.counting')` });
  const cd0 = await ev(COUNTDOWN);
  R['countdown_' + w] = await frames(2500);
  const cd1 = await ev(COUNTDOWN);
  R['countdownRun_' + w] = { filling, start: cd0, end: cd1 };
  check(`${w}: control: the countdown fills Next on the plane step as the frame window starts`, filling.ok && cd0.counting && parseFloat(cd0.cd) > 0 && cd0.step === 'planes:plane', R['countdownRun_' + w]);
  check(`${w}: control: the countdown has moved the tour on to the next step by the window's end`, !!cd0.step && !!cd1.step && cd1.step !== cd0.step, R['countdownRun_' + w]);
  check(`${w}: 60 fps while the countdown fills Next and the tour moves on to the next step (p95 under 20 ms)`, R['countdown_' + w].p95 < 20, R['countdown_' + w]);
  // the Grieg piece with captions
  await ev(`Sound.set({ on: true, events: true }, { quiet: true }); 1`);
  await ev(`Tour.start({ chapter: 'sound', step: 0 })`); await settled({ until: `${running} && !!document.querySelector('.ts-act')` });
  const b = await ev(`(() => { const r = document.querySelector('.ts-act').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await click(b[0], b[1]); await settled();
  const pc0 = await ev(LISTEN);
  R['song_' + w] = await frames(3000);
  const pc1 = await ev(LISTEN);
  R['songRun_' + w] = { start: pc0, end: pc1 };
  check(`${w}: control: the piece plays through the frame window (the Listen button says «Stop listening» at its start and end)`, pc0 === 'Stop listening' && pc1 === 'Stop listening', R['songRun_' + w]);
  check(`${w}: 60 fps while the piece plays (p95 under 20 ms)`, R['song_' + w].p95 < 20, R['song_' + w]);
  await ev('Tour.stop()'); await settled({ until: `!${running}` });
}
await view(1440, 900, false, false);
return { pass: C.filter((c) => c[1]).length, of: C.length, fails: C.filter((c) => !c[1]), R };
