const RUNS = [
 ['test.html', '\\sqrt{z^5-2z}\\cosh(z/5)', false],
 ['base/test.html', '\\sqrt{z^5-3z}\\cosh(z/6)', false],
 ['base/test.html', 'z^5/(\\cosh z+9)', false],
 ['test.html', 'z^5/(\\cosh z+11)', false],
 ['test.html', '\\sin\\sqrt{z+3}+z/7', true],
 ['base/test.html', '\\sin\\sqrt{z+5}+z/9', true],
];
const ld = async (page, ns, st) => {
  await send('Page.navigate', { url: 'http://127.0.0.1:9806/gl-helpers.html' }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: 'http://127.0.0.1:9806/' + page + '?ns=' + ns }); await sleep(2200);
};
const out = [];
await view(1440, 900, false, false);
for (const [page, f, sh] of RUNS) {
  await ld(page, 'vcs2' + Date.now(), { shapes: [], steps: [{ type: 'custom', params: { expr: f, cut: 180 }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 }, sheets: sh, height: 'im' });
  await sleep(3000);
  await ev(`(() => { window.__gap = { gaps: [], last: performance.now(), t0: performance.now(), on: true }; const f = () => { const t = performance.now(); const d=t-__gap.last; if(d>100) __gap.gaps.push([Math.round(__gap.last-__gap.t0), Math.round(d)]); __gap.last = t; if (__gap.on) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
  const t0 = Date.now();
  await ev('__gap.t0 = performance.now(); __cmwSetMain("land")');
  const tSet = Date.now() - t0;
  const r = await ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width * 0.3), y: Math.round(b.top + b.height * 0.3), width: Math.round(b.width * 0.4), height: Math.round(b.height * 0.4) }; })()`);
  const frames = [];
  while (Date.now() - t0 < 12000) { const ts = Date.now() - t0; const im = await img(r); frames.push({ ts, te: Date.now() - t0, img: im }); await sleep(50); }
  const gaps = await ev('(() => { __gap.on = false; return __gap.gaps; })()');
  const fin = frames[frames.length - 1].img;
  let drawn = null;
  for (const fr of frames) {
    let same = 0, n = 0;
    for (let i = 0; i < fin.data.length; i += fin.ch * 7) { n++; if (Math.abs(fr.img.data[i] - fin.data[i]) <= 6 && Math.abs(fr.img.data[i + 1] - fin.data[i + 1]) <= 6 && Math.abs(fr.img.data[i + 2] - fin.data[i + 2]) <= 6) same++; }
    if (same / n >= 0.9) { drawn = [fr.ts, fr.te]; break; }
  }
  const cuts = page.includes('base') ? null : await ev('(() => { const m = GLR.landMesh(); return m ? m.cuts : null; })()');
  out.push({ page, f, sheets: sh, setMainReturnMs: tSet, drawnStartEndMs: drawn, gapsOver100ms: gaps, firstCapture: [frames[0].ts, frames[0].te], cuts });
}
return { out, logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6) };
