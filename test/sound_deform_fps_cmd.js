// Frames while the Deformation plays with the pointer still on X's Phase plane, Hear F off and on (BUDGET60: ≥ 55 fps,
// work ≤ 14 ms a frame, jank ≤ 20 ms), for z⁵ and for the heavy chain of sound_cmd.js (erf, tan, log, a d/dz), and at
// a 6× CPU throttle. Also the sound's own time a frame: Sound.pathStep, Calc.argStep and Calc.orderAt, timed while it
// plays (the per-event deadline is 3 ms). Main-thread work a frame: the time from the rAF callback to the next task
// (a MessageChannel message posted in the callback), i.e. the frame's scripts after ours.
//   test/<you>_cdp/q.sh test/sound_deform_fps_cmd.js
const PORT = +(process.env.CMW_PORT || 8832), BASE = `http://localhost:${PORT}/test.html`;
const ns = 'snddeffps' + Date.now();
const loadHere = async (st) => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 120 } }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `${BASE}?ns=${ns}` }); await sleep(2400);
};
const CH = {
  pow5: [{ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }],
  heavy: [{ type: 'custom', params: { expr: 'erf(z^2)*erf(1/(z+0.3))', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'erf(z)+erf(2z)+tan(z)*log(z+2)', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'z^5-z', cut: 180 }, on: true }],
};
const out = {};
await view(1440, 900, false, false);
for (const [name, steps] of Object.entries(CH)) {
  await loadHere({ steps });
  await ev(`__cmwSetMain('phase')`); await sleep(1500);
  await click(5, 300); await sleep(200);
  await ev(`__cmwSet('loop', true); 1`);
  const p = await ev(`__cmwW2S('L', -0.7, 0.45)`);
  for (const cpu of [1, 6]) {
    await send('Emulation.setCPUThrottlingRate', { rate: cpu });
    for (const on of [false, true]) {
      await ev(`Sound.set({ on: true, sonify: ${on} }, { quiet: true }); 1`);
      await move(p[0] + 3, p[1]); await sleep(40); await move(p[0], p[1]); await sleep(200);
      await key('m'); await sleep(600);
      const r = await ev(`await (async () => {
        const A = Calc.argStep, O = Calc.orderAt, PS = Sound.pathStep; let tr = 0, calls = 0;
        const wrap = (f) => function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { tr += performance.now() - t; calls++; } };
        Sound.pathStep = wrap(PS); Calc.orderAt = wrap(O);
        const per = [], work = [], iv = [], mc = new MessageChannel(); let tA = 0, last = 0;
        mc.port1.onmessage = () => work.push(performance.now() - tA);
        const t0 = performance.now(), fc0 = __cmwSound().fcN;
        await new Promise((res) => { const f = (ts) => { const now = performance.now(); if (last) iv.push(now - last); last = now; per.push(tr); tr = 0; tA = now; mc.port2.postMessage(0); if (now - t0 < 4000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
        Sound.pathStep = PS; Calc.orderAt = O;
        const q = (a, k) => { const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(k * s.length))].toFixed(2); };
        return { fps: +(1000 * iv.length / iv.reduce((s, x) => s + x, 0)).toFixed(1), p95: q(iv, 0.95), max: q(iv, 1), workP95: q(work, 0.95), workMax: q(work, 1), soundP95: q(per, 0.95), soundMax: q(per, 1), evals: __cmwSound().fcN - fc0 };
      })()`, 60000);
      out[`${name}_${cpu}x_${on ? 'on' : 'off'}`] = r;
      await key('m'); await sleep(400);
    }
  }
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
}
await ev(`Sound.set({ on: false }); 1`);
return out;
