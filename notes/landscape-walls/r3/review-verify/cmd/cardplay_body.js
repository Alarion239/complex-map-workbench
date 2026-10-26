// open a fresh formula with All sheets, start the deformation 1 s after the Landscape opens, gaps over the next 8 s
const GAPON = `(() => { window.__gap = { gaps: [], last: performance.now(), t0: performance.now(), on: true, n: 0 }; const f = () => { const t = performance.now(); const d = t - __gap.last; __gap.n++; if (d > 50) __gap.gaps.push([Math.round(__gap.last - __gap.t0), Math.round(d)]); __gap.last = t; if (__gap.on) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`;
const K0 = 1000 + Math.floor(Math.random() * 8000);
const out = [];
const order = ['base.html', 'test.html', 'test.html', 'base.html', 'base.html', 'test.html'];
await view(1440, 900, false, false);
let i = 0;
for (const page of order) {
  i++;
  const f = `\\sin\\sqrt{z^2+${K0 + 7 * i}}`;
  await ld(page, 'cp' + Date.now(), { shapes: [], steps: [sq, { type: 'custom', params: { expr: f, cut: 180 }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, sheets: true, height: 'im' });
  await sleep(2500);
  await ev(GAPON);
  await ev('__gap.t0 = performance.now(); __cmwSetMain("land")');
  await sleep(1000);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 2 } }); __cmwMorph({ T: 0, playing: true }); 1');
  await sleep(8000);
  const g = await ev('(() => { __gap.on = false; return __gap; })()');
  const cards = await ev('(() => { try { return __qa.cards ? __qa.cards().length : null; } catch (e) { return String(e); } })()');
  await ev('__cmwMorph({ playing: false })');
  const mid = g.gaps.filter((x) => x[0] > 1200);
  out.push(`${page.padEnd(10)} gaps>50 after play start: ${mid.length}, longest ${mid.reduce((m, x) => Math.max(m, x[1]), 0)} [${g.gaps.map((x) => x.join('@')).join(' ')}] ${f}`);
}
return { out, logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6) };
