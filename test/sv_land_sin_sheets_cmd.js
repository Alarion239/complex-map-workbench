// The steps view's Landscape with All sheets, parked mid-glide across a sin step: with √z then sin z a frame at
// x = 1.5 draws both sheets of the covering surface (render3D.sheetsInfo.K = 2), as the frames of the √z step's glide and
// the planes at rest do. The sheets of the √z step exist only as preimages of z's points, so the carry of that frame
// starts from z's plane. A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const SHEETS = 2;   // √z has two sheets; sin z adds none
await view(1200, 800, false, false);
const ns = 'landsin' + Date.now();
await loadView('steps', ns, {
  srcView: { cx: 0, cy: 0, s: 60 }, shapes: [{ id: 's1', kind: 'disc', c: [0.3, 0.2], r: 1, ci: 0, visible: true }],
  steps: [{ type: 'root', params: { n: 2, cut: 180 }, on: true }, { type: 'custom', params: { expr: '\\sin(z)', cut: 180 }, on: true }],
  rightMode: '3d', sheets: true, height: 'im',
});
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ surf: 'land' }); 1`);
// (the frame is drawn when the sheets it drew are reported: none is reported while the principal branch stands in)
const K = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }); 1`);
  const r = await settled({ max: 90000, until: '__cmwLandSheets().drawn !== null || (__cmwLandCarry() && __cmwLandCarry().path === "inverse")' });
  return { settled: r && r.ok, K: await ev('(() => { const d = __cmwLandSheets().drawn, c = __cmwLandCarry(); return d ? d.K : (c && c.path === "inverse" ? c.layers : null); })()') };
};
for (const x of [0, 0.5, 1, 1.5, 2]) {
  info['x' + x] = await K(x);
  ok(`x = ${x}: the frame draws both sheets`, info['x' + x].K === SHEETS, info['x' + x]);
}
const lg = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', lg.length === 0, lg);
return { pass: fails.length === 0, fails, info };
