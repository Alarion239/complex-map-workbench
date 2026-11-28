// The steps view's Landscape with All sheets, parked mid-glide across a sin step: with √z then sin z a frame at
// x = 1.5 draws both sheets of the covering surface (render3D.sheetsInfo.K = 2), as the frames of the √z step's glide and
// the planes at rest do. The sheets of the √z step exist only as preimages of z's points, so the carry of that frame
// starts from z's plane. At x = STRETCH_X, mid-glide on the √z step, no edge of a carried sheet's cell, in the box or a
// patch, is one that cut 2's jump rule (LAND_CARRY_NRM_VS, with the frame's J and its finite floor) would flag
// (__cmwLandSheetStretch over the places read back): each cell's corners are continued from its own centre
// (LAND_CARRY_PLACE_S_TF_VS), so no sheet triangle bridges the map's cut, and LAND_SHEET_VS needs no jump flags.
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const SHEETS = 2;   // √z has two sheets; sin z adds none
const STRETCH_X = 0.5;
await view(1200, 800, false, false);
const ns = 'landsin' + Date.now();
await loadView('steps', ns, {
  srcView: { cx: 0, cy: 0, s: 60 }, shapes: [{ id: 's1', kind: 'disc', c: [0.3, 0.2], r: 1, ci: 0, visible: true }],
  steps: [{ type: 'root', params: { n: 2, cut: 180 }, on: true }, { type: 'custom', params: { expr: '\\sin(z)', cut: 180 }, on: true }],
  rightMode: '3d', sheets: true, height: 'im',
});
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ surf: 'land' }); GLR._lw = { cpDump: true }; 1`);
// (the frame is drawn when the sheets it drew are reported: none is reported while the principal branch stands in)
const K = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }); 1`);
  const r = await settled({ max: 90000, until: '__cmwLandSheets().drawn !== null' });
  return { settled: r && r.ok, K: await ev('(() => { const d = __cmwLandSheets().drawn; return d ? d.K : null; })()') };
};
for (const x of [0, 0.5, 1, 1.5, 2]) {
  info['x' + x] = await K(x);
  ok(`x = ${x}: the frame draws both sheets`, info['x' + x].K === SHEETS, info['x' + x]);
  if (x === STRETCH_X) {
    const st = info.stretch = await ev('__cmwLandSheetStretch()');
    const all = Object.values(st || {});
    ok(`x = ${x}: no edge of a carried sheet's cell, in the box or a patch, crosses a jump by cut 2's rule (each cell continued from its centre)`, !!st && !!st[0] && all.every((r) => r.J > 0 && Number.isFinite(r.w) && r.w > 0 && r.edges > 0 && r.over === 0), st);
  }
}
await ev('delete GLR._lw; GLR._cpDump = null; 1');
const lg = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', lg.length === 0, lg);
return { pass: fails.length === 0, fails, info };
