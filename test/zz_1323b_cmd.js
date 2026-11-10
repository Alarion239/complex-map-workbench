// The steps view's rest frame is the exact pass's whatever a saved exactImages (an internal switch, no option in the page) says,
// and nothing else changes with it:
// - at rest on a plane past the colour plane, the frame with the switch off is the frame with it on (the exact pass's);
// - a glide frame under the switch off is the same as under the switch on, drawn by the inverse pass ('inverse');
// - the classic view still takes the switch: with it off a region is drawn forward ('exact images off'), with it on by the
//   inverse pass.
// A control: the measure tells two different frames apart (plane 0's rest frame against plane 1's).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { lpx } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));

const START_WAIT = 30000;
await view(1440, 900, false, false);
const { hold, grab, compare, refOf } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));


const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const names = K.exampleNames();
const pick = (re) => names.findIndex((n) => re.test(n));
const MODE = process.env.CMW_MODE || 'p95';
const cases = [
  { name: 'log z', st: { shapes: [{ id: 's1', kind: 'disc', c: [0.5, 0.5], r: 1.5, ci: 0, visible: true }], steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }] }, b: 1 },
  { name: 'log annulus', st: { shapes: [{ id: 'a1', kind: 'annulus', c: [0, 0], r: 1, r2: 3, visible: true }], steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }] }, b: 1 },
  { name: 'cubic', st: { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 2.5, ci: 0, visible: true }], steps: [{ type: 'custom', params: { expr: '(z^3-1)/(z^3+1)', cut: 180 }, on: true }] }, b: 1 },
  { name: 'MK b2', ex: pick(/Mountain King/), b: 2 },
  { name: 'Newton b1', ex: pick(/Newton.*z/i), b: 1 },
];
const goTo = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 90000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
const p95 = async (n = 30) => { const xs = []; for (let i = 0; i < n; i++) { const r = await ev('__cmwTime(1).left'); if (typeof r === 'number') xs.push(r); } xs.sort((a, b) => a - b); return xs.length ? `${xs[Math.floor(0.5 * xs.length)]}/${xs[Math.min(xs.length - 1, Math.floor(0.95 * xs.length))]}` : 'n/a'; };
const members = (pts) => ev(`(() => { try { const m = __cmwLandMembers(${JSON.stringify(pts)}); return m ? m.map((a) => a.length).join(',') : 'null'; } catch (e) { return 'err ' + e.message; } })()`);
const wind = (w) => ev(`(() => { try { const q = __cmwLandWind(${JSON.stringify(w)}); return q ? q.map((x) => 'N' + x.N + 'P' + x.P + ':' + x.status).join(' ') : 'null'; } catch (e) { return 'err ' + e.message; } })()`);
const PTS = [[0.5, 0.5], [1, 0], [-1, 1], [2, -1], [0.2, 0.2]];
const ONLY = (process.env.CMW_CASES || '').split(',').filter(Boolean);
for (const c of cases) {
  if (ONLY.length && !ONLY.includes(c.name)) continue;
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  const ns = 'zz1323' + Date.now();
  if (c.st) {
    const st = Object.assign({ v3: true, v4: true, v5: true, v6: true, exactImages: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } }, c.st);
    await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  }
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvX === "function" && !!window.GLR' });
  if (c.ex != null) { await ev(`__cmwExample(${c.ex}); 1`); await settled({ max: 60000 }); }
  await ev(`__cmwSet('alpha', 1), 1`);
  const line = [];
  for (const surf of ['plane', 'sphere', 'land']) {
    await ev(`__cmwSteps({ surf: ${JSON.stringify(surf)}, scope: 'in' }), 1`); await settled({ max: 30000 });
    await goTo(c.b - 1);
    await goTo(c.b); await settled({ max: 90000, until: `__cmwSteps().ready && __cmwSteps().ready.ready` }); await settled({ max: 30000 });
    const parts = [`rest p50/p95 ${await p95()}`];
    if (MODE === 'members' && surf === 'land') parts.push(`members@rest [${await members(PTS)}] wind ${await wind([0.5, 0.5])}`);
    for (const u of [1e-4, 0.002, 0.5, 0.998, 0.9999]) {
      const h = await hold(c.b - 1 + u);
      const gp = await ev(`(() => { const g = __cmwSteps().glide || {}; let s = (g.path || '?'); if (${JSON.stringify(surf)} === 'sphere') { try { s += '/globe:' + __cmwSvGlobe(0.5, 0.5).path; } catch (e) {} } return s; })()`);
      const row = [`u${u}: ${gp}${h.ok ? '' : ' NOTHELD'}`];
      if (u === 0.5 || MODE === 'members') row.push(`p50/p95 ${await p95(20)}`);
      if (MODE === 'members' && surf === 'land') row.push(`members [${await members(PTS)}] wind ${await wind([0.5, 0.5])}`);
      parts.push(row.join(' '));
      await ev('window.__svScrubUp(), 1'); await goTo(c.b - 1);
    }
    line.push(`${surf}: ` + parts.join(' ; '));
  }
  info[c.name] = line.join(' || ');
}
fs.writeFileSync('/tmp/step0_' + MODE + '_dpr' + (process.env.CMW_DPR || 1) + '.json', JSON.stringify(info, null, 1));
ok('INFO', false, Object.keys(info).join(','));
return { pass: false, fails, info };
