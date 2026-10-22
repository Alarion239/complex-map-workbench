// SUPERSEDED by test/mv_views_cmd.js (merged views, notes/ui-design/merged-views.md, revise U-b: Phase and Landscape
// left the left pane's switcher for the top bar, the keys changed). Kept as the record of U-b's acceptance; it fails on
// the current app by design.
// U-b (notes/ui-design/panels.md 2, 3, 8, 10): the panes' view controls, keys, saved-state migration and examples in
// the real app. A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/ub_views_cmd.js
// Prints {pass, fails, ...}; pass is true when every check holds.
const fails = [];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const vw = () => ev('__cmwView()');
const V = (ls, lp, rs) => ({ L: { surf: ls, phase: lp }, R: { surf: rs } });
const same = (v, w) => v && v.L.surf === w.L.surf && v.L.phase === w.L.phase && v.R.surf === w.R.surf;
const heads = () => ev(`({ l: [...document.querySelectorAll('#leftTabs > button')].map((b) => [b.dataset.mode, b.getAttribute('aria-checked')]),
  r: [...document.querySelectorAll('#rightTabs > button')].map((b) => [b.dataset.mode, b.getAttribute('aria-checked')]),
  ph: document.getElementById('phaseBtn').getAttribute('aria-pressed'), lt: document.getElementById('leftTitle').textContent, rt: document.getElementById('rightTitle').textContent })`);
// 1. a fresh state: X Plane, Y Plane; the heads: Plane · Sphere · Landscape and Phase on X, Plane · Sphere on Y
// (at 2400 x 1300: on a smaller page the landscape's strip folds its style control into the options popover)
await view(2400, 1300, false);
await nav('http://localhost:8793/test.html?ns=ubviews' + Date.now());
await sleep(2200);
logs();
ok('default view', same(await vw(), V('plane', false, 'plane')), await vw());
let hd = await heads();
ok('head X radios', JSON.stringify(hd.l) === JSON.stringify([['plane', 'true'], ['sphere', 'false'], ['land', 'false']]), hd.l);
ok('head Y radios', JSON.stringify(hd.r) === JSON.stringify([['plane', 'true'], ['sphere', 'false']]), hd.r);
ok('Phase off', hd.ph === 'false', hd.ph);
ok('X title', /z-plane\s*domain of F/.test(hd.lt), hd.lt);
// 2. keys by e.code: 1-3 surfaces of X, 4 Phase, Shift 1-2 surfaces of Y
await move(5, 5);
const keyTo = async (k, mods, want, name) => { await key(k, mods); await sleep(350); const v = await vw(); ok(name, same(v, want), v); };
await keyTo('2', 0, V('sphere', false, 'plane'), 'key 2: X Sphere');
await keyTo('4', 0, V('sphere', true, 'plane'), 'key 4: Phase on');
hd = await heads();
ok('X Sphere + Phase title', /z-sphere\s*phase of F/.test(hd.lt) && hd.ph === 'true', hd);
await keyTo('3', 0, V('land', true, 'plane'), 'key 3: X Landscape');
await keyTo('1', 0, V('plane', true, 'plane'), 'key 1: X Plane');
await keyTo('2', 8, V('plane', true, 'sphere'), 'Shift 2: Y Sphere');
hd = await heads();
ok('Y Sphere title', /w-sphere\s*image/.test(hd.rt), hd.rt);
await keyTo('3', 8, V('plane', true, 'sphere'), 'Shift 3 does nothing');
await keyTo('1', 8, V('plane', true, 'plane'), 'Shift 1: Y Plane');
await keyTo('4', 0, V('plane', false, 'plane'), 'key 4: Phase off');
// 3. the controls: a click on a radio and on the Phase toggle
await clickSel('#leftTabs > button[data-mode="land"]'); await sleep(300);
ok('click Landscape', same(await vw(), V('land', false, 'plane')), await vw());
await clickSel('#phaseBtn'); await sleep(300);
ok('click Phase', same(await vw(), V('land', true, 'plane')), await vw());
// P10: Landscape + Phase with the Grid style paints Tiles and keeps the setting
await ev(`(() => { const b = document.querySelector('#dcSeg > button[data-v="grid"]'); if (b) b.disabled = false; })()`);
await ev('__cmwSet("dc", "grid"); __cmwSetPhase(false); __cmwSetPhase(true); 1'); await sleep(400);
const p10 = await ev(`({ dc: __cmwState().dc, on: (document.querySelector('#dcSeg > button.on') || {}).dataset?.v, dis: [...document.querySelectorAll('#dcSeg > button')].filter((b) => b.disabled).map((b) => b.dataset.v) })`);
ok('P10: the setting is kept', p10.dc === 'grid', p10);
ok('P10: Tiles shown, the unpaintable styles unavailable', p10.on === 'enhanced' && JSON.stringify(p10.dis) === JSON.stringify(['classic', 'modulus', 'grid', 'cauchy']), p10);
await ev('__cmwSetView("L", "plane"); 1'); await sleep(300);
const p10b = await ev(`({ dc: __cmwState().dc, on: (document.querySelector('#dcSeg > button.on') || {}).dataset?.v })`);
ok('P10: back on Plane the Grid style returns', p10b.dc === 'grid' && p10b.on === 'grid', p10b);
// 4. the Key switch: in X's legend chip while Phase is on; it paints the Y plane
await ev('__cmwSet("dc", "enhanced"); __cmwSetPhase(false); __cmwSetPhase(true); 1'); await sleep(500);
const keyRow = await ev(`({ legend: !document.getElementById('leftLegend').hidden, row: !document.getElementById('wKeyRow').hidden })`);
ok('Key switch shown with Phase on', keyRow.legend && keyRow.row, keyRow);
const px = () => ev(`(() => { const c = document.getElementById('canvasR'), g = document.createElement('canvas'); g.width = c.width; g.height = c.height; const x = g.getContext('2d'); x.drawImage(c, 0, 0); const d = x.getImageData(6, 6, 1, 1).data; return [d[0], d[1], d[2]]; })()`);
const before = await px();
await clickSel('#wKeyChk'); await sleep(600);
const after = await px();
ok('Key paints Y', (await ev('__cmwState().wKey')) === true && Math.abs(before[0] - after[0]) + Math.abs(before[1] - after[1]) + Math.abs(before[2] - after[2]) > 30, { before, after });
await clickSel('#wKeyChk'); await sleep(300);
await ev('__cmwSetPhase(false); 1'); await sleep(300);
ok('Key switch hidden with Phase off', await ev(`document.getElementById('leftLegend').hidden`), null);
// 5. the old hooks: __cmwSet('rightMode', m) applies the migration table; __cmwPaneOf names the pane
await ev('__cmwSet("rightMode", "color"); 1'); await sleep(300);
ok('__cmwSet rightMode color', same(await vw(), V('plane', true, 'plane')), await vw());
await ev('__cmwSet("rightMode", "sphere"); 1'); await sleep(300);
ok('__cmwSet rightMode sphere', same(await vw(), V('plane', false, 'sphere')), await vw());
await ev('__cmwSet("sphereMode", "color"); 1'); await sleep(300);
ok('__cmwSet sphereMode color', same(await vw(), V('sphere', true, 'plane')), await vw());
await ev('__cmwSet("rightMode", "image"); 1'); await sleep(300);
ok('__cmwSet rightMode image', same(await vw(), V('plane', false, 'plane')), await vw());
ok('__cmwState().mode', (await ev('__cmwState().mode')) === 'image', await ev('__cmwState().mode'));
const pane = await ev(`['image', 'color', '3d', 'sphere'].map((m) => __cmwPaneOf(m)).join('')`);
ok('__cmwPaneOf', pane === 'RLLR', pane);
// 6. every example opens in the view it was made for (the old rightMode, migrated)
const want = { 'A formula in LaTeX': V('plane', true, 'plane'), 'A residue by integration': V('plane', true, 'plane'), 'The derivative in the chain': V('plane', true, 'plane'), 'Every sheet of the logarithm': V('land', true, 'plane') };
const exs = [];
for (let i = 0; i < 14; i++) {
  await ev(`__cmwExample(${i}); 1`); await sleep(500);
  const name = await ev(`(document.querySelector('#examplesBtn .exlabel') || {}).textContent || ''`);
  const v = await vw();
  const w = want[name] || V('plane', false, 'plane');
  exs.push([i, name, v.L.surf + (v.L.phase ? '+phase' : ''), v.R.surf]);
  ok(`example ${i} ${name}`, same(v, w), v);
  // the Plain relief of earlier builds (their default material), kept by the landscape-only landPlain: the
  // portrait's style S.dc is not rewritten (U-b review)
  if (name === 'Every sheet of the logarithm') { const st = await ev('__cmwState()'); ok('log example: the Plain relief of earlier builds, dc kept', st.landPlain === true && st.dc !== 'phase', st); }
}
// 7. old saved states open in the equivalent view (panels.md 10)
const st = { v3: true, v4: true, v5: true, shapes: [{ kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'pown', params: { n: 2 } }], nextId: 9, focus: 0 };
const loads = [
  [{ rightMode: 'color' }, V('plane', true, 'plane')],
  [{ rightMode: 'image', leftSphere: true }, V('sphere', false, 'plane')],
  [{ rightMode: '3d', material: 'plaster' }, V('land', false, 'plane')],
  [{ rightMode: 'sphere', sphereMode: 'image', spherePlane: true }, V('plane', false, 'sphere')],
  [{ rightMode: 'sphere', sphereMode: 'color' }, V('sphere', true, 'plane')],
  [{ rightMode: 'morph' }, V('plane', false, 'plane')],
];
for (const [o, w] of loads) {
  const ns = 'ubviewsload' + Date.now();
  await load(ns, Object.assign({}, st, o));
  await sleep(300);
  const v = await vw();
  ok(`saved ${JSON.stringify(o)}`, same(v, w), v);
  if (o.spherePlane) ok('saved spherePlane -> Y Equator', v.R.eq === true, v);
  // the state is written back in the new form, without the old fields
  await sleep(500);
  const saved = await ev(`(() => { const k = 'complex-map-workbench-v1:' + ${JSON.stringify(ns)}; const o = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.removeItem(k); return { v6: o.v6, legacy: ['rightMode', 'sphereMode', 'leftSphere', 'material', 'spherePlane'].filter((x) => x in o), view: o.view }; })()`);
  ok(`saved ${JSON.stringify(o)} rewritten`, saved.v6 === true && !saved.legacy.length && same(saved.view, w), saved);
}
const exc = logs().filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || ''));
ok('no exceptions', !exc.length, exc.slice(0, 5));
return { pass: !fails.length, fails, examples: exs };
