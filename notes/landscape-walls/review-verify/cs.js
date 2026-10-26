const RUNS = globalThis.__RUNS;
const ld = async (page, ns, st) => {
  await send('Page.navigate', { url: 'http://127.0.0.1:9806/gl-helpers.html' }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: 'http://127.0.0.1:9806/' + page + '?ns=' + ns }); await sleep(2200);
};
const out = [];
await view(1440, 900, false, false);
for (const [page, f, H] of RUNS) {
  await ld(page, 'vcs' + Date.now(), { shapes: [], steps: [{ type: 'custom', params: { expr: f, cut: 180 }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 }, sheets: false, height: H || 'im' });
  await sleep(2500);
  await ev(`(() => { window.__gap = { max: 0, last: performance.now(), on: true, n:0, big:0 }; const f = () => { const t = performance.now(); const d=t-__gap.last; __gap.max = Math.max(__gap.max, d); if(d>100) __gap.big+=d; __gap.n++; __gap.last = t; if (__gap.on) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
  const t0 = Date.now();
  await ev('__cmwSetMain("land")');
  const r = await ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width * 0.3), y: Math.round(b.top + b.height * 0.3), width: Math.round(b.width * 0.4), height: Math.round(b.height * 0.4) }; })()`);
  const frames = [];
  while (Date.now() - t0 < 11000) { frames.push({ t: Date.now() - t0, img: await img(r) }); await sleep(60); }
  const gap = await ev('(() => { __gap.on = false; return {max:+__gap.max.toFixed(0), big:+__gap.big.toFixed(0)}; })()');
  const fin = frames[frames.length - 1].img;
  let drawn = null;
  for (const fr of frames) {
    let same = 0, n = 0;
    for (let i = 0; i < fin.data.length; i += fin.ch * 7) { n++; if (Math.abs(fr.img.data[i] - fin.data[i]) <= 6 && Math.abs(fr.img.data[i + 1] - fin.data[i + 1]) <= 6 && Math.abs(fr.img.data[i + 2] - fin.data[i + 2]) <= 6) same++; }
    if (same / n >= 0.9) { drawn = fr.t; break; }
  }
  let lit = 0, m = 0;
  for (let i = 0; i < fin.data.length; i += fin.ch * 7) { m++; const v = fin.data[i] + fin.data[i + 1] + fin.data[i + 2]; if (Math.abs(fin.data[i] - fin.data[i + 2]) > 12 || v < 600) lit++; }
  const cuts = page.includes('base') ? null : await ev('(() => { const m = GLR.landMesh(256); return m ? m.cuts : null; })()');
  out.push({ page, f, drawnMs: drawn, maxGapMs: gap.max, sumGapsOver100: gap.big, surf: +(lit / m).toFixed(2), cuts });
}
return { out, logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6) };
