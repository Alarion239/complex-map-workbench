const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1280, 800, false, false);
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const out = {};
for (const ex of ['Zeros of the zeta function', 'In the Hall of the Mountain King']) {
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=pp${Date.now()}`);
  await settled({ max: 30000, until: 'typeof __cmwExample === "function"' });
  await ev(`__cmwExample(${names.indexOf(ex)}); 1`); await settled({ max: 60000 });
  await ev(`__cmwSteps({ go: 1 }); 1`); await settled({ max: 60000, until: '!__cmwSteps().moving' });
  await ev(`__cmwSteps({ go: 0 }); 1`); await settled({ max: 60000, until: '!__cmwSteps().moving' });
  await ev(`__cmwSteps({ scope: 'all', go: 0, now: true }); 1`); await settled({ max: 60000 });
  await ev(`(() => { window.__lt = []; window.__ltObs = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }); window.__ltObs.observe({ entryTypes: ['longtask'] }); window.__sm0 = Object.assign({}, __cmwSphere().stats); window.__fixT = []; return 1; })()`);
  const r = await ev(`(() => { const ps = document.querySelectorAll('.sv-plane'), a = ps[0].getBoundingClientRect(), z = ps[ps.length - 1].getBoundingClientRect(); return { x0: a.left + a.width / 2, x1: z.left + z.width / 2, y: a.top + a.height / 2 }; })()`);
  const tS = await ev('performance.now()');
  await drag(r.x0, r.y, r.x1, r.y, 40, 16);
  const tE = await ev('performance.now()');
  await settled({ max: 60000 }); await sleep(3000);
  const res = await ev(`(() => { const s = __cmwSphere(); return { lt: window.__lt, sm: { slices: s.stats.slices - __sm0.slices, ms: +(s.stats.ms - __sm0.ms).toFixed(1), maxSlice: +s.stats.maxSlice.toFixed(1), long: (s.stats.long || []).slice(-8) }, entries: s.entries.map((e) => [e.slot, e.why, e.n, e.ms]), jobs: s.jobs.length, steps: (() => { const q = __cmwSteps(); return { x: q.x, T: q.T, scope: q.scope }; })() }; })()`);
  res.scrub = [Math.round(tS), Math.round(tE)];
  out[ex] = res;
}
return out;
