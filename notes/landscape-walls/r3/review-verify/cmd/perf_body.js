// frame times, the user's case (sqrt, sin; Im): orbit by a real pointer drag, orbit by the camera hook (rest frames,
// as review-speed), play, after stop; pages alternating
const VIEWS = globalThis.__pv || [[1440, 900, false]];
const MESH = globalThis.__pm || [1920];
const SH = globalThis.__ps || [true, false];
const ORDER = globalThis.__po || ['base.html', 'test.html', 'test.html', 'base.html'];
const NAME = (p) => (p.startsWith('base') ? 'base' : p.startsWith('r2') ? 'r2' : 'new');
const out = [];
for (const [vw, vh, mob] of VIEWS) for (const meshN of MESH) for (const sh of SH) for (const page of ORDER) {
  await view(vw, vh, false, mob);
  await ld(page, 'pf' + Date.now(), { meshN, shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: sh, height: 'im' });
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(3000);
  const pr = await ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, b.width]; })()`);
  await ev('window.__fr = __qa.frames(2500); 1');
  const x0 = pr[0] - pr[2] * 0.15;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: pr[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: pr[1], button: 'left', clickCount: 1 });
  const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < 2400) { i++; await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (i % 120 < 60 ? i % 60 : 60 - (i % 60)) * 3, y: pr[1] + 10 * Math.sin(i / 9), button: 'left', buttons: 1 }); await sleep(12); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0, y: pr[1], button: 'left', clickCount: 1 });
  const drag = await ev('await window.__fr', 30000);
  await settle(2000);
  const orbit = await ev(`await (async () => { const c0 = __cmwCam('L'); let k = 0, run = true; const spin = () => { if (!run) return; __cmwCam('L', { yaw: c0.yaw + 0.01 * (++k) }); requestAnimationFrame(spin); }; requestAnimationFrame(spin); const r = await __qa.frames(2500); run = false; return r; })()`, 30000);
  await settle(1500);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(1500);
  await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(900);
  const play = await ev('await (async () => await __qa.frames(3000))()', 30000);
  await ev('__cmwMorph({ playing: false })');
  const after = await ev('await (async () => await __qa.frames(1500))()', 30000);
  const tag = `${vw}${mob ? 'ph' : ''} m${meshN} ${sh ? 'ALL ' : 'prin'}`;
  for (const [what, r] of [['drag', drag], ['hookorb', orbit], ['play', play], ['stop', after]]) out.push({ page: NAME(page), tag, what, ...r });
}
await view(1440, 900, false, false);
const lines = out.map((r) => `${r.page.padEnd(5)} ${r.tag.padEnd(20)} ${r.what.padEnd(8)} fps ${r.fps} p50 ${r.p50} p95 ${r.p95} max ${r.max}${r.what !== 'stop' && !(r.fps >= 55 && r.p95 <= 20) ? '  BUDGET60 FAIL' : ''}`);
return { lines, logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6) };
