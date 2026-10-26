// which build logs the WebGL texture warnings? the cardplay flow, logs per page and per phase
const GAPON = `(() => { window.__gap = { gaps: [], last: performance.now(), t0: performance.now(), on: true, n: 0 }; const f = () => { const t = performance.now(); const d = t - __gap.last; __gap.n++; if (d > 50) __gap.gaps.push([Math.round(__gap.last - __gap.t0), Math.round(d)]); __gap.last = t; if (__gap.on) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`;
const K0 = 1000 + Math.floor(Math.random() * 8000);
const out = [];
await view(1440, 900, false, false);
let i = 0;
logs();
for (const page of ['test.html', 'base.html', 'test.html', 'base.html']) {
  i++;
  const f = `\\sin\\sqrt{z^2+${K0 + 7 * i}}`;
  await ld(page, 'cw' + Date.now(), { shapes: [], steps: [sq, { type: 'custom', params: { expr: f, cut: 180 }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, sheets: true, height: 'im' });
  await sleep(2500);
  const L0 = logs().filter((l) => !/404|favicon/.test(l.m)).length;
  await ev(GAPON);
  await ev('__gap.t0 = performance.now(); __cmwSetMain("land")');
  await sleep(1000);
  const L1 = logs().filter((l) => !/404|favicon/.test(l.m)).map((l) => l.m.slice(0, 90));
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 2 } }); __cmwMorph({ T: 0, playing: true }); 1');
  await sleep(1500);
  const L2 = logs().filter((l) => !/404|favicon/.test(l.m)).map((l) => l.m.slice(0, 90));
  await sleep(6500);
  const L3 = logs().filter((l) => !/404|favicon/.test(l.m)).map((l) => l.m.slice(0, 90));
  const g = await ev('(() => { __gap.on = false; return __gap; })()');
  await ev('__cmwMorph({ playing: false })'); await settle(1500);
  const L4 = logs().filter((l) => !/404|favicon/.test(l.m)).map((l) => l.m.slice(0, 90));
  out.push({ page, f, beforeOpen: L0, open1s: [L1.length, L1[0]], play1500: [L2.length, L2[0]], play8s: [L3.length, L3[0]], stop: [L4.length, L4[0]], gaps: g.gaps.map((x) => x.join('@')).join(' ') });
}
return out;
