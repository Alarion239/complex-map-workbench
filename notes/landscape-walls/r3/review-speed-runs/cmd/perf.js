// frame times: the user's case (sqrt, sin; Im), orbit (camera hook, every frame) then play, base and r3 alternating
const B = 'base/test.html', T = 'test.html';
const VIEWS = globalThis.__pv || [[1440, 900, false], [390, 844, true]];
const MESH = globalThis.__pm || [1920];
const SH = globalThis.__ps || [true, false];
const ORDER = globalThis.__po || [B, T, T, B];
const out = [];
for (const [vw, vh, mob] of VIEWS) for (const meshN of MESH) for (const sh of SH) for (const page of ORDER) {
  await view(vw, vh, false, mob);
  await ld(page, 'rvp' + Date.now(), { meshN, shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: sh, height: 'im' });
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(2500);
  const orbit = await ev(`await (async () => { const c0 = __cmwCam('L'); let k = 0, run = true; const spin = () => { if (!run) return; __cmwCam('L', { yaw: c0.yaw + 0.01 * (++k) }); requestAnimationFrame(spin); }; requestAnimationFrame(spin); const r = await __qa.frames(2500); run = false; return r; })()`, 30000);
  await settle(1500);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(1200);
  await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(900);
  const play = await ev('await (async () => await __qa.frames(3000))()', 30000);
  await ev('__cmwMorph({ playing: false })');
  // the first frames after play stops (the rest refinement comes back): longest frame in 1.5 s
  const after = await ev('await (async () => await __qa.frames(1500))()', 30000);
  const tag = `${vw}${mob ? 'ph' : ''} m${meshN} ${sh ? 'ALL ' : 'prin'}`;
  for (const [what, r] of [['orbit', orbit], ['play', play], ['stop', after]]) out.push({ page: page === B ? 'base' : 'r3', tag, what, ...r });
}
await view(1440, 900, false, false);
const lines = out.map((r) => `${r.page.padEnd(5)} ${r.tag.padEnd(20)} ${r.what.padEnd(6)} fps ${r.fps} p50 ${r.p50} p95 ${r.p95} max ${r.max}${r.what !== 'stop' && !(r.fps >= 55 && r.p95 <= 20) ? '  BUDGET60 FAIL' : ''}`);
return { lines, logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6) };
