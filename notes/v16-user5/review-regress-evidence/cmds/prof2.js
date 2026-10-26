const ST = { shapes: [{ id: 'd1', kind: 'disc', c: [0.3, 0.2], r: 0.6, visible: true }, { id: 'r1', kind: 'rect', a: [-2, -1.5], b: [-1, -0.5], visible: true }, { id: 'g1', kind: 'cgrid', a: [-1.5, -1.5], b: [1.5, 1.5], n: 8, visible: true }, { id: 'p1', kind: 'polygon', pts: [[1, 1], [2, 1.2], [1.6, 2]], visible: true }, { id: 'a1', kind: 'annulus', c: [-1, 1], r0: 0.3, r1: 0.7, visible: true }, { id: 'pt', kind: 'point', p: [1.5, -1], visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }], srcView: { cx: 0, cy: 0, s: 90 }, nextId: 100, pattern: 'checker' };

const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const res = {};
for (const page of ['v1521.html', 'test.html']) {
const ns = 'fxprof' + page.replace(/\W/g, '') + Date.now();
await load(ns, ST); if (page !== 'test.html') await nav(`http://localhost:9507/${page}?ns=${ns}`); await settle(1800);
await clickSel('#tools .tool[data-tool="select"]'); await settle(150);
await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 100 });
await send('Profiler.start');
const p = await ev(`__cmwW2S('L', 0.3, 0.2)`);
for (let r = 0; r < 3; r++) { await drag(p[0], p[1], p[0] + 60, p[1] - 40, 45, 16); await drag(p[0] + 60, p[1] - 40, p[0], p[1], 45, 16); }
const prof = (await send('Profiler.stop')).profile;
const byId = new Map(prof.nodes.map((n) => [n.id, n]));
const self = new Map(); const dt = prof.timeDeltas; let tot = 0;
for (let i = 0; i < prof.samples.length; i++) { const n = byId.get(prof.samples[i]); const k = n.callFrame.functionName + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); tot += dt[i] || 0; }
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => k + ' ' + (v / 1000).toFixed(1) + 'ms');
// inclusive time of functions matching construction names
const incl = new Map();
const parent = new Map(); for (const n of prof.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
for (let i = 0; i < prof.samples.length; i++) { let id = prof.samples[i]; const seen = new Set(); while (id != null) { const n = byId.get(id); const k = n.callFrame.functionName + ':' + n.callFrame.lineNumber; if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + (dt[i] || 0)); } id = parent.get(id); } }
const inc = [...incl.entries()].filter(([k]) => /cm|Constr|Construct|recompute|formOf|packShapes|reanchor|drawOverlay|cmFocusSet|dimK|graph|frame|render|drawScene|shapeRes|mesh/i.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => k + ' ' + (v / 1000).toFixed(1) + 'ms');
res[page] = { totMs: tot / 1000, top: top.slice(0, 20), inc: inc.slice(0, 16) };
}
return res;
