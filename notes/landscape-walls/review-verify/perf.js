const B = 'http://127.0.0.1:9806/';
const PG = { base: 'base/test.html', xvls: 'test.html' };
const ld = async (b, ns, st) => {
  await send('Page.navigate', { url: B + 'gl-helpers.html' }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: B + PG[b] + '?ns=' + ns }); await sleep(2500);
};
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const sq = { type: 'root', params: { n: 2, cut: 180 }, on: true }, sn = { type: 'sin', params: {}, on: true };
const out = [];
const DEV = globalThis.__dev || [[1440, 900, false, 'desk']];
const MESH = globalThis.__mesh || [1920];
for (const [w, h, mob, dn] of DEV) {
  await view(w, h, false, mob);
  for (const meshN of MESH) for (const c of [
    { id: 'user-sheets-play', steps: [sq, sn], h: 'im', sheets: true, play: true },
    { id: 'tan-re-orbit', steps: [{ type: 'tan', params: {}, on: true }], h: 're', sheets: false, play: false },
    { id: 'user-sheets-orbit-t0.2', steps: [sq, sn], h: 'im', sheets: true, play: false, T: 0.2 },
  ]) for (const b of ['base', 'xvls', 'base', 'xvls']) {
    await ld(b, 'vpf' + b + c.id + meshN + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: c.steps, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: c.sheets, height: c.h, meshN });
    await settle(1500); await ev('__cmwSetMain("land")'); await settle(1500);
    let r;
    if (c.play) {
      await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
      // warm one loop first
      await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(2500);
      r = await ev('await (async () => await __qa.frames(3000))()', 30000);
      await ev('__cmwMorph({ playing: false })');
    } else {
      if (c.T != null) { await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900); await ev(`__cmwMorph({ T: ${c.T}, playing: false })`); await settle(2500); }
      // warm: a short orbit first
      await ev(`await (async () => { const c0 = __cmwCam('L'); let k = 0, run = true; const spin = () => { if (!run) return; __cmwCam('L', { yaw: c0.yaw + 0.01 * (++k) }); requestAnimationFrame(spin); }; requestAnimationFrame(spin); await new Promise(r=>setTimeout(r,800)); run = false; return 1; })()`);
      r = await ev(`await (async () => { const c0 = __cmwCam('L'); let k = 0, run = true; const spin = () => { if (!run) return; __cmwCam('L', { yaw: c0.yaw + 0.01 * (++k) }); requestAnimationFrame(spin); }; requestAnimationFrame(spin); const r = await __qa.frames(2500); run = false; return r; })()`, 30000);
    }
    out.push({ dev: dn, b, meshN, id: c.id, fps: r.fps, p50: r.p50, p95: r.p95, max: r.max });
  }
}
await view(1440, 900, false, false);
return out;
