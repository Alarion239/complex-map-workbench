// cold opens, base and r3 alternating, fresh formulas; globalThis.__cv = [w,h,mobile]
const V = globalThis.__cv || [1440, 900, false];
const K = 1000 + Math.floor(Math.random() * 8000), k = (n) => K + 3 * n;
const F = [
  (i) => `\\log(z^3+${k(i)})\\sqrt{z^2-${k(i) + 1}}`,
  (i) => `\\sqrt{z^5+${k(i)}}\\cosh(z/4)`,
  (i) => `\\log(z^4-${k(i)}z)\\sin(z/3)`,
  (i) => `\\sqrt{z^3-${k(i)}}\\tanh(z/2)`,
];
const B = 'base/test.html', T = 'test.html';
const order = globalThis.__order || [B, T, T, B, B, T, T, B];
const runs = [];
let i = 0;
for (const shs of (globalThis.__shs || [false, true])) for (let j = 0; j < order.length; j++) runs.push([order[j], F[(j >> 1) % F.length](++i), shs]);
await view(V[0], V[1], false, V[2]);
const out = [];
for (const [page, f, shs] of runs) {
  await ld(page, 'rvc' + Date.now(), { shapes: [], steps: [{ type: 'custom', params: { expr: f, cut: 180 }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 }, sheets: !!shs, height: 'im' });
  await sleep(2500);
  await ev(GAPON);
  const t0 = Date.now();
  await ev('__gap.t0 = performance.now(); __cmwSetMain("land")');
  const r = await ev(RECT);
  const frames = [];
  while (Date.now() - t0 < 7000) { const im = await img(r); frames.push({ te: Date.now() - t0, img: im }); await sleep(40); }
  const g = await ev('(() => { __gap.on = false; return { gaps: __gap.gaps, n50: __gap.n50 }; })()');
  out.push({ page, sheets: shs, f, first: firstSurface(frames), longest: g.gaps.reduce((m, x) => Math.max(m, x[1]), 0), n100: g.gaps.length, n50: g.n50, gaps: g.gaps.map((x) => x.join('@')).join(' ') });
}
await view(1440, 900, false, false);
const sum = {};
for (const shs of [false, true]) for (const p of [B, T]) { const C = out.filter((c) => c.sheets === shs && c.page === p); if (!C.length) continue; sum[(shs ? 'all ' : 'prin ') + (p === B ? 'base' : 'r3')] = { runsWithGap100: C.filter((c) => c.n100).length + '/' + C.length, longest: Math.max(...C.map((c) => c.longest)), gaps100: C.reduce((m, c) => m + c.n100, 0), gaps50: C.reduce((m, c) => m + c.n50, 0), firstMs: C.map((c) => c.first).join(',') }; }
return { view: V, sum, runs: out.map((c) => `${c.page === B ? 'base' : 'r3  '} ${c.sheets ? 'ALL ' : 'prin'} first ${c.first} longest ${c.longest} n100 ${c.n100} n50 ${c.n50} [${c.gaps}] ${c.f}`), logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6) };
