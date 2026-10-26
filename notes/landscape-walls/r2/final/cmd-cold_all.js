globalThis.__runs = [
 ['base/test.html', '\\log(z^2+91)', true], ['test.html', '\\log(z^2+92)', true],
 ['test.html', '\\sqrt{z^3+93}\\cos z', true], ['base/test.html', '\\sqrt{z^3+94}\\cos z', true],
 ['base/test.html', '\\log(z^3+95)+z', true], ['test.html', '\\log(z^3+96)+z', true],
 ['test.html', '\\sqrt{z^2+97}', true], ['base/test.html', '\\sqrt{z^2+98}', true],
 ['test.html', '\\log(z^4+99)', true], ['base/test.html', '\\log(z^4+100)', true],
];
// is first on screen (the first capture matching the final picture, timed when the capture returned).
const RUNS = globalThis.__runs;
const out = [];
await view(1440, 900, false, false);
for (const [page, f, shs] of RUNS) {
  await ld(page, 'cold' + Date.now() + Math.random().toString(36).slice(2, 6), { shapes: [], steps: [cust(f)], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 }, sheets: shs, height: 'im' });
  await sleep(3000);
  await ev(`(() => { window.__gap = { gaps: [], last: performance.now(), t0: performance.now(), on: true }; const f = () => { const t = performance.now(); const d = t - __gap.last; if (d > 100) __gap.gaps.push([Math.round(__gap.last - __gap.t0), Math.round(d)]); __gap.last = t; if (__gap.on) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
  const isBase = page.includes('base');
  if (!isBase) await ev('GLR._lwLog = []; 1');
  const t0 = Date.now();
  await ev('__gap.t0 = performance.now(); __cmwSetMain("land")');
  const r = await ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width * 0.3), y: Math.round(b.top + b.height * 0.3), width: Math.round(b.width * 0.4), height: Math.round(b.height * 0.4) }; })()`);
  const frames = [];
  while (Date.now() - t0 < 7000) { const im = await img(r); frames.push({ te: Date.now() - t0, img: im }); await sleep(40); }
  const gaps = await ev('(() => { __gap.on = false; return __gap.gaps; })()');
  const plog = isBase ? null : await ev('(GLR._lwLog || []).map(([n, t]) => n + "@" + Math.round(t - __gap.t0)).join(" ")');
  const fin = frames[frames.length - 1].img;
  let drawn = null;
  for (const fr of frames) {
    let same = 0, n = 0;
    for (let i = 0; i < fin.data.length; i += fin.ch * 7) { n++; if (Math.abs(fr.img.data[i] - fin.data[i]) <= 6 && Math.abs(fr.img.data[i + 1] - fin.data[i + 1]) <= 6 && Math.abs(fr.img.data[i + 2] - fin.data[i + 2]) <= 6) same++; }
    if (same / n >= 0.9) { drawn = fr.te; break; }
  }
  out.push(`${page.padEnd(15)} sheets=${shs} first ${drawn} longest ${gaps.reduce((m, g) => Math.max(m, g[1]), 0)} gaps ${JSON.stringify(gaps)} ${plog || ''}`);
}
return { out, logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6) };
