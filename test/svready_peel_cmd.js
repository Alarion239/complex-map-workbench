// svReady() counts the programs of the layered carried draw (#1157). Below 100 % opacity a glide that draws carried meshes
// also draws them through carryLayers and its variants of the carried programs: with every link held (?glhold) the
// gauge is not ready, and the instant it reads ready none of the GL canvas's programs is still compiling, so the first layered
// frame of a glide creates none. A command file for a CDP daemon:  <runner> test/svready_peel_cmd.js
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1200, 800, false, false);
const ns = 'svpl' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, exactImages: false, alpha: 0.5,
  shapes: [{ id: 's2', kind: 'disc', c: [0.3, 0.1], r: 1, ci: 0, visible: true }, { id: 's3', kind: 'disc', c: [1.4, 0], r: 0.3, ci: 1, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'custom', params: { expr: 'z+0.2*conj(z)', cut: 180 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps&glhold` });
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && typeof GLR === "object" && GLR.ok && __cmwSteps().on' });
await settled({ max: 30000, only: true, until: '__cmwSteps().ready.total > 0' });
const held = await ev('__cmwSteps().ready');
info.held = held;
ok('with the links held: not ready', held && held.ready === false, held);
// (what the GL canvas still compiles at the first instant the gauge reads ready)
await ev(`(window.__atReady = null, window.__watch = setInterval(() => { const r = __cmwSteps().ready; if (r.ready) { window.__atReady = __cmwPaneStatus('L') || {}; clearInterval(window.__watch); } }, 5), GLR.holdLinks(false), 1)`);
await settled({ max: 60000, only: true, until: 'window.__atReady !== null' });
const at = await ev('window.__atReady');
info.atReady = at;
ok('the instant it reads ready: no program of the layered draw is pending or compiling', at && !at.pending && !at.compiling, at);
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
