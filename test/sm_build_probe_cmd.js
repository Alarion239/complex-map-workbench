// One-off probe (not for merging): the SphereMesh build per glide place u for the zeta example, Inside regions, parked
// at u = .3 (cold: the page's first build), .5, .7 and .31: CPU ms, slices, the longest slice and the wall time until
// built (__cmwSphere().stats before and after each park). Reported as the fail "probe" (the job log prints only fails).
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
await go(`http://localhost:${PORT}/test.html?view=steps&ns=smb${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function"' });
await ev(`__cmwExample(${names.indexOf('Zeros of the zeta function')}); 1`); await settled({ max: 30000 });
await ev(`__cmwSteps({ scope: 'in', surf: 'plane', go: 0, now: true }); 1`); await settled({ max: 30000 });
const out = {};
for (const u of [0.3, 0.5, 0.7, 0.31]) {
  const s0 = await ev('(() => { const s = __cmwSphere().stats; return { ms: s.ms || 0, slices: s.slices || 0, built: s.built || 0, maxSlice: s.maxSlice || 0 }; })()');
  const t0 = Date.now();
  await ev(`__cmwSteps({ park: ${u} }), 1`);
  let r = null;
  for (let i = 0; i < 200; i++) { await sleep(50); r = await ev('(() => { const S = __cmwSphere(); return { built: S.stats.built || 0, jobs: S.jobs.length, ms: S.stats.ms || 0, slices: S.stats.slices || 0, maxSlice: S.stats.maxSlice || 0, nodes: S.entries.map((e) => e.nodes || e.n || 0) }; })()'); if (r.built > s0.built && !r.jobs) break; }
  out[u] = { wallMs: Date.now() - t0, cpuMs: +(r.ms - s0.ms).toFixed(1), slices: r.slices - s0.slices, built: r.built - s0.built, maxSlice: +r.maxSlice.toFixed(1), verdict: await ev("__cmwSmVerdict('SV').map((x) => x.why).join(',')") };
}
return { pass: false, fails: [{ name: 'probe', got: out }], info: out };
