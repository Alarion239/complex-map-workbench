// v16.4 (SPEC 7.7): frames with the tour running, at 1440 (mouse) and 390 (touch): a countdown filling Next while the
// pointer hovers X; the Grieg piece playing with its captions; and how often the panes change size through a chapter
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const R = {}, C = [];
const check = (n, p, d) => C.push([n, !!p, d]);
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const frames = (ms) => ev(`await __qa.frames(${ms})`);
for (const [w, h, mob] of [[1440, 900, false], [390, 844, true]]) {
  await view(w, h, false, mob);
  await nav(U + `?ns=pf${w}`); await settle(1800);
  await ev('Tour.dismissSuggestion()');
  // the panes' size changes through Views (one chapter): a ResizeObserver on #panes
  await ev(`window.__rs = 0; new ResizeObserver(() => window.__rs++).observe(document.querySelector('#panes')); 1`);
  await ev(`Tour.start({ chapter: 'views', step: 1 })`); await settle(1800);
  const r0 = await ev('window.__rs');
  for (let i = 0; i < 4; i++) { await ev('Tour.next()'); await settle(1400); }
  const r1 = await ev('window.__rs');
  R['resizes_' + w] = { start: r0, inChapter: r1 - r0 };
  check(`${w}: the panes keep their size through the steps of a chapter`, r1 - r0 === 0, R['resizes_' + w]);
  // a countdown running: the land step, an orbit, then frames while Next fills
  await ev(`Tour.start({ chapter: 'views', step: 2 })`); await settle(1800);
  const a = await ev(`(() => { const b = document.querySelector('#panes').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a[0], y: a[1], button: 'left', clickCount: 1 });
  for (let i = 1; i <= 10; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a[0] + 6 * i, y: a[1], button: 'left', buttons: 1 }); await sleep(16); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: a[0] + 60, y: a[1], button: 'left', clickCount: 1 });
  R['countdown_' + w] = await frames(2500);
  check(`${w}: 60 fps while the countdown fills Next (p95 under 20 ms)`, R['countdown_' + w].p95 < 20, R['countdown_' + w]);
  // the Grieg piece with captions
  await ev(`Sound.set({ on: true, events: true }, { quiet: true }); 1`);
  await ev(`Tour.start({ chapter: 'sound', step: 0 })`); await settle(1800);
  const b = await ev(`(() => { const r = document.querySelector('.ts-act').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await click(b[0], b[1]); await sleep(400);
  R['song_' + w] = await frames(3000);
  check(`${w}: 60 fps while the piece plays (p95 under 20 ms)`, R['song_' + w].p95 < 20, R['song_' + w]);
  await ev('Tour.stop()'); await settle(500);
}
await view(1440, 900, false, false);
return { pass: C.filter((c) => c[1]).length, of: C.length, fails: C.filter((c) => !c[1]), R };
