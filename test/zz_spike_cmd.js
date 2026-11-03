// SPIKE (throwaway): glide frame cost, default and Mountain King, flag off / on
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const info = {};
const COST = "(async () => {\n  const w = (ms) => new Promise((r) => setTimeout(r, ms));\n  const N = window.__N || 20, out = {};\n  const med = (a) => { const s = [...a].sort((x, y) => x - y); return +s[Math.floor(s.length / 2)].toFixed(1); };\n  const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)].toFixed(1); };\n  const run = async (tag, x, inv, half, n = N) => {\n    window.__svInvGlide = inv; window.__svInvGlideHalf = half; window.__svInvGlideRes = null;\n    // warm: compile, first draws\n    for (let i = 0; i < 4; i++) { await __svSpikeTime(x, 1, 0, window.__CAP || 120000); await w(1500); }\n    const r = await __svSpikeTime(x + 1e-3, n, 1e-3, window.__CAP || 120000);\n    out[tag] = { x0: +(x + 1e-3).toFixed(4), x1: +r.x.toFixed(4), n: r.ms.length, med: med(r.ms), p95: p95(r.ms), cpuMed: med(r.cpu), res: inv ? window.__svInvGlideRes : '-', why: inv ? window.__svInvGlideWhy : '-' };\n  };\n  if (window.__EX != null) { __cmwExample(window.__EX); await w(3000); }\n  const D = (await __svSpike()).paneL; out.dpr = window.devicePixelRatio; out.px = [document.querySelector('#canvasL').width, document.querySelector('#canvasL').height];\n  for (const j of window.__JOBS) await run(...j);\n  window.__svInvGlide = false;\n  return out;\n})()\n";
for (const [ex, jobs, n] of [[null, "[['park0', 0, false, false], ['park1', 1, false, false], ['g1_cur', 0.3, false, false], ['g1_inv', 0.3, true, false], ['g1_invHalf', 0.3, true, true], ['g2_cur', 1.3, false, false], ['g2_inv', 1.3, true, false], ['g2_invHalf', 1.3, true, true]]", 20], [17, "[['park1', 1, false, false], ['park2', 2, false, false], ['g1_cur', 0.3, false, false], ['g1_inv', 0.3, true, false], ['g1_invHalf', 0.3, true, true], ['g1b_cur', 0.7, false, false], ['g1b_inv', 0.7, true, false], ['g2_cur', 1.3, false, false]]", 20]]) {
  await go(`${BASE}/test.html?ns=zz${Date.now()}&lang=en&view=steps`);
  await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip')` });
  await ev(`await new Promise((r) => setTimeout(r, 4000)), 1`);
  const r = await ev(`window.__EX = ${ex}; window.__N = ${n}; window.__CAP = 60000; window.__JOBS = ${jobs}; await ` + COST);
  info['ex' + ex] = r;
}
return { pass: true, fails: [], info };
