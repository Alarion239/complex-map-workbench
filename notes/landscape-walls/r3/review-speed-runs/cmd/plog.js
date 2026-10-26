// which program's first use lines up with r3's second stall (~1.7 s): GLR._lwLog (compile start +, link =, first use)
const K = 1000 + Math.floor(Math.random() * 8000);
const out = [];
for (const [shs, f] of [[false, `\\log(z^3+${K})\\sqrt{z^2-${K + 1}}`], [true, `\\sqrt{z^5+${K + 2}}\\cosh(z/4)`], [false, `\\sqrt{z^3-${K + 3}}\\tanh(z/2)`], [true, `\\log(z^4-${K + 4}z)\\sin(z/3)`]]) {
  await ld('test.html', 'rvl' + Date.now(), { shapes: [], steps: [{ type: 'custom', params: { expr: f, cut: 180 }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 }, sheets: shs, height: 'im' });
  await sleep(2500);
  await ev(GAPON);
  await ev('GLR._lwLog = []; __gap.t0 = performance.now(); __cmwSetMain("land")');
  await sleep(4500);
  const g = await ev('(() => { __gap.on = false; return __gap.gaps; })()');
  const plog = await ev('(GLR._lwLog || []).map(([n, t]) => n + "@" + Math.round(t - __gap.t0)).join(" ")');
  out.push({ shs, gaps: g.map((x) => x.join('@')).join(' '), plog });
}
return out;
