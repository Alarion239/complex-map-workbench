// Sound: the click regression for a still probe whose function changes (notes/sound/DEFORMATION.md), recorded from the
// APP. Hear F on, every cue off (the voice alone). Cases, each with the pointer still unless said: the Deformation of
// z⁵ on X's Phase plane; the same across a loop repeat (t back to 0: a new start); the pointer moving while it plays;
// the merged deformation plane of X → Y; the Landscape, at the open and across a loop repeat; z − 1 (a zero of H_t
// passing the probe); the slider scrubbed back and forth once a frame; a zero dragged round and through the probe once
// a frame. Each at 60 Hz frames (headless
// Chrome's own) and 240 Hz (test/sound_deform_inj.js), with the CPU at 1× and 6×. Writes <daemon folder>/rec_deform/
// <case>_<hz>_<cpu>x.f32 (+ .json for test/sound_clicks.py) and rec_deform/det/ (the same audio, + .json for
// notes/sound/cdp3/det.py). Then:
//   python3 test/sound_clicks.py test/<you>_cdp/rec_deform '*'      (expect TOTAL clicks 0)
//   python3 notes/sound/cdp3/det.py test/<you>_cdp/rec_deform/det '*'   (expect 0 engine hits, late-par 0)
// Each run also counts glideCuts: a Height move posted inside a swap's 0.15 s glide that ends before the glide does
// (expect 0 in every run; review snddef-5: a fresh start cut the glide at the Landscape's open to one 8 ms move).
// Delete rec_deform afterwards (about 100 MB).
const PORT = +(process.env.CMW_PORT || 8832), BASE = `http://localhost:${PORT}/test.html`;
const OUT = path.join(DIR, 'rec_deform'), OUTB = path.join(OUT, 'det');
fs.mkdirSync(OUTB, { recursive: true });
const src = fs.readFileSync(path.join(DIR, '..', 'sound_rec.js'), 'utf8') + '\n' + fs.readFileSync(path.join(DIR, '..', 'sound_deform_inj.js'), 'utf8');
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: src });
const res = { runs: [], pages: [] };
await view(1440, 900, false, false);
const ns = 'snddefclk' + Date.now();
const CHAIN = {
  pow5: [{ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }],
  zm1: [{ type: 'custom', params: { expr: 'z-1', cut: 180 }, on: true }],
  zp: [{ type: 'zp', params: { a: '1', zeros: '0.5, -1', poles: '' }, on: true }],
};
const th = 170 * Math.PI / 180, Z = [1.2 * Math.cos(th), 1.2 * Math.sin(th)];
const W = (side, re, im) => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const rest = async (p) => { await move(p[0] + 3, p[1]); await sleep(40); await move(p[0], p[1]); await sleep(120); };
async function page(chain, main, hz) {
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  const o = { v3: true, v4: true, shapes: [], steps: CHAIN[chain], nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 120 } };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `${BASE}?ns=${ns}${hz === 240 ? '&raf=240' : ''}` }); await sleep(2400);
  await ev(`__cmwSetMain('${main}')`); await sleep(1200);
  await click(5, 300); await sleep(200);
  const st = await ev(`Sound.set({ on: true, vol: 0.7, ui: true, events: true, sonify: true }, { quiet: true }); await new Promise((r) => setTimeout(r, 600)); Sound.play = () => false; Sound.turn = () => false; Sound.tick = () => false; __cmwSet('loop', false); ({ st: Sound.state(), rec: !!(window.__rec && __rec.ctx), err: window.__rec && __rec.err })`);
  // the frame rate the app gets
  const fr = await ev(`await new Promise((res) => { const t = []; const f = (x) => { t.push(performance.now()); if (t.length < 60) requestAnimationFrame(f); else res(+(1000 * 59 / (t[59] - t[0])).toFixed(1)); }; requestAnimationFrame(f); })`);
  res.pages.push({ chain, main, hz, fps: fr, engine: st.st && st.st.engine, rec: st.rec, err: st.err });
}
const startRec = () => ev(`await (async () => { for (const k in __dlog) __dlog[k].length = 0; window.__dOn = true; const f = () => { __dframe(); if (window.__dOn) requestAnimationFrame(f); }; requestAnimationFrame(f); window.__fc0 = __cmwSound().fcN; return __rec.start(); })()`);
async function stopRec(name) {
  const r = await ev(`await (async () => { window.__dOn = false; const st = await __rec.stop(); return { st, fcN: __cmwSound().fcN - __fc0, kind: __cmwSound().kind, engine: Sound.state().engine, late: __dlog.late.length, cmds: __dlog.cmds.length, frames: __dlog.ev.length }; })()`, 120000);
  const parts = [];
  for (let i = 0; i < r.st.bytes; i += 1 << 20) parts.push(Buffer.from(await ev(`__rec.chunk(${i}, ${1 << 20})`), 'base64'));
  const f = path.join(OUT, name), buf = Buffer.concat(parts);
  fs.writeFileSync(f + '.f32', buf);
  const dl = await ev(`JSON.parse(JSON.stringify(__dlog))`, 60000);
  fs.writeFileSync(f + '.json', JSON.stringify({ f0: r.st.f0, rate: r.st.rate, log: dl.ev.map((e) => [e.pn, e.now]), cues: [] }));
  fs.writeFileSync(path.join(OUTB, name + '.f32'), buf);
  fs.writeFileSync(path.join(OUTB, name + '.json'), JSON.stringify({ fs: r.st.rate, f0: r.st.f0, gaps: r.st.gaps, log: dl }));
  const hm = dl.cmds.filter((x) => x.c && 'lf' in x.c && 'dur' in x.c).map((x) => [x.c.at, x.c.dur]);
  // (a swap asks for 0.15 s; every later move inside it must end at the glide's end, not before: the moves of the
  // last frames before the end are short by nature)
  let glideCuts = 0, glides = 0;
  for (let i = 0; i < hm.length; i++) if (hm[i][1] >= 0.149) { glides++; const end = hm[i][0] + hm[i][1]; for (let j = i + 1; j < hm.length && hm[j][0] < end - 0.006; j++) if (hm[j][0] + hm[j][1] < end - 0.006) glideCuts++; }
  res.runs.push({ name, secs: +(r.st.frames / r.st.rate).toFixed(2), gaps: r.st.gaps, peak: +r.st.peak.toFixed(4), fcN: r.fcN, kind: r.kind, engine: r.engine, late: r.late, cmds: r.cmds, frames: r.frames, glides, glideCuts });
}
for (const hz of [60, 240]) {
  for (const cpu of [1, 6]) {
    const tag = `${hz}_${cpu}x`;
    const thr = () => send('Emulation.setCPUThrottlingRate', { rate: cpu });
    // z⁵ on X's Phase plane: a still pointer, a loop repeat, a moving pointer
    await page('pow5', 'phase', hz); await thr();
    await rest(await W('L', ...Z));
    await startRec(); await key('m'); await sleep(3000); await stopRec(`phasePlay_${tag}`); await key('m'); await sleep(500);
    await ev(`__cmwSet('loop', true); 1`);
    await rest(await W('L', ...Z));
    await key('m'); await sleep(1900); await startRec(); await sleep(1900); await stopRec(`loopWrap_${tag}`); await key('m'); await sleep(500);
    await ev(`__cmwSet('loop', false); 1`);
    {
      const c = await W('L', ...Z);
      await rest(c); await startRec(); await key('m');
      await ev(`await __drive({ sel: '#overlayL', path: (u) => [${c[0]} + 25 * Math.sin(2 * Math.PI * 1.5 * u), ${c[1]} + 18 * Math.sin(2 * Math.PI * 2.5 * u)], rate: ${hz === 240 ? 240 : 60}, dur: 2.8, jitter: 0.25, stalls: 0.02, seed: 7 })`, 60000);
      await stopRec(`jointMove_${tag}`); await key('m'); await sleep(500);
    }
    // the merged deformation plane (X → Y): the first play fits the plane, then a still pointer and Play again
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await ev(`__cmwSetMain('xy')`); await sleep(1200);
    await key('m'); await sleep(3400); await thr();
    await rest(await W('R', ...Z));
    await startRec(); await ev(`document.getElementById('morphPlay').click(); 1`); await sleep(3000); await stopRec(`mergedPlay_${tag}`); await key('m'); await sleep(500);
    // the Landscape: the needle on the relief
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await ev(`__cmwSetMain('land')`); await sleep(1800); await thr();
    {
      const r = await ev(`(() => { const b = document.getElementById('overlayL').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`);
      await rest([r[0] + 0.62 * r[2], r[1] + 0.5 * r[3]]);
      await startRec(); await key('m'); await sleep(3000); await stopRec(`landPlay_${tag}`); await key('m'); await sleep(500);
      // across a loop repeat (t back to 0 after the 1 s hold: the swap glide again)
      await ev(`__cmwSet('loop', true); 1`);
      await rest([r[0] + 0.62 * r[2], r[1] + 0.5 * r[3]]);
      await startRec(); await key('m'); await sleep(3800); await stopRec(`landLoop_${tag}`); await key('m'); await sleep(500);
      await ev(`__cmwSet('loop', false); 1`);
    }
    // z − 1: a zero of H_t passes the still pointer; then the slider scrubbed back and forth, once a frame
    await page('zm1', 'phase', hz); await thr();
    await rest(await W('L', 0.5, 0.003));
    await startRec(); await key('m'); await sleep(2800); await stopRec(`zeroSweep_${tag}`);
    await rest(await W('L', 0.5, 0.003));
    await startRec();
    await ev(`await (async () => { const r = document.getElementById('morphRange'), t0 = performance.now(); for (;;) { const u = (performance.now() - t0) / 2800; if (u >= 1) break; r.value = 0.5 + 0.5 * Math.cos(2 * Math.PI * 1.5 * u); r.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((res) => requestAnimationFrame(res)); } return 1; })()`, 60000);
    await sleep(150); await stopRec(`scrub_${tag}`); await key('m'); await sleep(400);
    // a zero dragged round the still pointer and through it, once a frame
    await page('zp', 'phase', hz); await thr();
    await rest(await W('L', 0.2, 0.5));
    await startRec();
    await ev(`await (async () => { const t0 = performance.now(); for (;;) { const u = (performance.now() - t0) / 2800; if (u >= 1) break; const a = 2 * Math.PI * Math.min(1, u / 0.6); const p = u < 0.6 ? [0.2 + 0.3 * Math.cos(a), 0.5 + 0.3 * Math.sin(a)] : [0.5 - 0.6 * (u - 0.6) / 0.4 * 1.5, 0.501]; __cmwSound({ zp: [1, 'zeros', 0, p[0], p[1]] }); await new Promise((res) => requestAnimationFrame(res)); } return 1; })()`, 60000);
    await sleep(150); await stopRec(`zpDrag_${tag}`);
  }
}
await send('Emulation.setCPUThrottlingRate', { rate: 1 });
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
await ev(`Sound.set({ on: false }); 1`);
res.glideCuts = res.runs.reduce((a, x) => a + x.glideCuts, 0);
res.logs = logs().filter((l) => !/404|Failed to load resource/.test(l.m)).slice(0, 20);
return res;
