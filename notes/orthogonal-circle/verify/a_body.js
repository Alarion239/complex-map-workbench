await view(1440, 900, false, false);
const R = {};
const perpS = (id, c, a, b, fill, part) => ({ id, kind: fill === 'in' ? 'disc' : 'circle', c: [0, 0], r: 1, ci: 2, visible: true, def: { op: 'perp', args: [{ s: c, part: part || 0 }, { s: a }, { s: b }], fill: fill || 'none', nk: 'circle' } });
// ---- math-1: rect corner as T (saved), drag b across a
{
  await load(NS + 'm1', base([{ id: 'R', kind: 'rect', a: [0, 0], b: [2, 1], ci: 0, visible: true }, pt('P', [1, 2]),
    { id: 'K', kind: 'circle', c: [0, 0], r: 1, ci: 2, visible: true, def: { op: 'touch', args: [{ s: 'R', part: 0 }, { s: 'R', h: 'a' }, { s: 'P' }], fill: 'none', nk: 'circle' } },
    { id: 'm', kind: 'point', p: [0, 0], ci: 3, visible: true, def: { op: 'meet', args: [{ s: 'K', part: 0 }, { s: 'R', part: 0 }], index: 0 } }]));
  await settle(900);
  let st = await ST(); const nm = await names();
  R.m1_before = { K: byId(st, 'K').cundef || byId(st, 'K').c, m: byId(st, 'm').p, mund: byId(st, 'm').cundef, rowK: await rowD('K'), rowm: await rowD('m') };
  await tool('select');
  const b0 = await W(2, 1), b1 = await W(2, -1);
  await mdrag(b0, b1);
  st = await ST();
  const n2 = await CI({ names: true });
  R.m1_after = { R: [byId(st, 'R').a, byId(st, 'R').b], K: byId(st, 'K').cundef, m: byId(st, 'm').cundef || byId(st, 'm').p, rowK: await rowD('K'), rowm: await rowD('m'), why: (n2.find((x) => x.id === 'K') || {}).why };
  await grab();
}
// ---- math-1 via UI: pick a rect side, click its corner -> P (not T)
{
  await load(NS + 'm1u', base([{ id: 'R', kind: 'rect', a: [0, 0], b: [2, 1], ci: 0, visible: true }]));
  await settle(900);
  await tool('touch');
  const s = await W(1, 0); await click(s[0], s[1]); await settle(150);
  const c = await W(0, 0); await click(c[0], c[1]); await settle(200);
  R.m1_ui = { draft: (await CI()).draft, chip: await chipT() };
  await key('Escape'); await settle(100);
  await grab();
}
// ---- math-2: Use complement on a touching circle, perp on it (real row-menu click)
{
  await load(NS + 'm2', base([{ id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true },
    { id: 'T', kind: 'point', p: [1, 0], t: 0.1, ci: 1, visible: true, def: { op: 'glider', args: [{ s: 'C', part: 0 }] } }, pt('P', [2, 0.5]),
    { id: 'K', kind: 'circle', c: [0, 0], r: 1, ci: 2, visible: true, def: { op: 'touch', args: [{ s: 'C', part: 0 }, { s: 'T' }, { s: 'P' }], fill: 'none', nk: 'circle' } },
    pt('a', [1.5, -0.3]), pt('b', [0.4, 1.7]), perpS('Q', 'K', 'a', 'b', 'in'),
    { id: 'g', kind: 'point', p: [0, 0], t: 0.3, ci: 1, visible: true, def: { op: 'glider', args: [{ s: 'Q', part: 0 }] } }]));
  await settle(900);
  let st = await ST();
  const before = { QA: byId(st, 'Q').A, g: byId(st, 'g').p, rowQ: await rowD('Q') };
  // make K a region first so Use complement exists
  await clickSel(`.shape[data-id="K"] .icon-btn.more`); await settle(250);
  R.m2_menu1 = await menuItems();
  if (!R.m2_menu1.some((x) => /Use complement/.test(x))) { await menuClick('Region'); await settle(300); await clickSel(`.shape[data-id="K"] .icon-btn.more`); await settle(250); R.m2_menu2 = await menuItems(); }
  R.m2_clicked = await menuClick('Use complement'); await settle(300);
  st = await ST();
  R.m2 = { before, after: { QA: byId(st, 'Q').A, g: byId(st, 'g').p, rowQ: await rowD('Q'), Kflip: byId(st, 'K').def.flip, Kcomp: byId(st, 'K').complement } };
  await grab();
}
// ---- math-3: decimal pencils (unit circle, free) and line y = 2x, real axis
{
  const pairs = [[[0.2, 0], [5, 0]], [[0.1, 0], [10, 0]], [[0.4, 0], [2.5, 0]], [[0.1, 0.2], [2, 4]], [[1.3, 0.9], [0.52, 0.36]], [[0.5, 0], [2, 0]], [[0.2, 0], [5.1, 0]]];
  const L2 = [[[-0.1, 0.3], [0.3, 0.1]], [[0.5, 0], [-0.3, 0.4]], [[0.7, -0.1], [-0.5, 0.5]], [[0, 0.5], [0.4, 0.3]], [[-0.5, 1.5], [1.5, 0.5]], [[0.5, 0.1], [-0.3, 0.5]]];
  const sh = [{ id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 'L', kind: 'line', a: [0, 0], b: [1, 2], ci: 0, visible: true }, { id: 'X', kind: 'line', a: [0, 0], b: [1, 0], ci: 0, visible: true },
    { id: 'C3', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'u0' }, { s: 'u1' }, { s: 'u2' }] } }, pt('u0', [0, 0]), pt('u1', [1, 0]), pt('u2', [0, 1])];
  pairs.forEach(([p, q], i) => sh.push(pt('cp' + i, p), pt('cq' + i, q), perpS('ck' + i, 'C', 'cp' + i, 'cq' + i)));
  L2.forEach(([p, q], i) => sh.push(pt('lp' + i, p), pt('lq' + i, q), perpS('lk' + i, 'L', 'lp' + i, 'lq' + i)));
  sh.push(pt('xp', [0.1, 0.2]), pt('xq', [0.1, -0.2]), perpS('xk', 'X', 'xp', 'xq'));
  // circle3 C (c = 0.5+0.5i, r^2 = 0.5): decimal mirror pairs P, c + 0.5/(conj(P - c))
  const c3p = [[[0.6, 0.5], [5.5, 0.5]], [[0.5, 0.6], [0.5, 5.5]], [[0.7, 0.5], [3, 0.5]], [[0.9, 0.5], [1.75, 0.5]], [[0.6, 0.6], [3, 3]]];
  c3p.forEach(([p, q], i) => sh.push(pt('tp' + i, p), pt('tq' + i, q), perpS('tk' + i, 'C3', 'tp' + i, 'tq' + i)));
  await load(NS + 'm3', base(sh));
  await settle(1200);
  const st = await ST();
  const out = (id) => { const s = byId(st, id); return s.cundef ? 'undef:' + s.cundef.code : s.kind + (s.r ? ' r=' + s.r.toPrecision(4) : ''); };
  R.m3 = { circle: pairs.map((_, i) => out('ck' + i)), line2x: L2.map((_, i) => out('lk' + i)), realaxis: out('xk'), circle3: c3p.map((_, i) => out('tk' + i)), rowck0: await rowD('ck0') };
  await grab();
}
// ---- math-4: line C y = 2x, P, Q on a decimal perpendicular; Region; far meet
{
  await load(NS + 'm4', base([{ id: 'L', kind: 'line', a: [0, 0], b: [1, 2], ci: 0, visible: true }, pt('P', [-0.5, 0.3]), pt('Q', [-0.3, 0.2]), perpS('K', 'L', 'P', 'Q', 'in'),
    { id: 'm0', kind: 'point', p: [0, 0], ci: 3, visible: true, def: { op: 'meet', args: [{ s: 'K', part: 0 }, { s: 'L', part: 0 }], index: 0 } },
    { id: 'm1', kind: 'point', p: [0, 0], ci: 3, visible: true, def: { op: 'meet', args: [{ s: 'K', part: 0 }, { s: 'L', part: 0 }], index: 1 } }]));
  await settle(900);
  const st = await ST();
  R.m4 = { K: { kind: byId(st, 'K').kind, A: byId(st, 'K').A, und: byId(st, 'K').cundef }, row: await rowD('K'), m0: byId(st, 'm0').cundef || byId(st, 'm0').p, m0inf: byId(st, 'm0').inf, m1: byId(st, 'm1').cundef || byId(st, 'm1').p, m1inf: byId(st, 'm1').inf };
  await grab();
}
// ---- math-5: Use complement keeps meets: tangent line x another line; perp-as-line x line; perp circle x line; redo
{
  await load(NS + 'm5', base([{ id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }, pt('P', [2, 0.5]),
    { id: 'Tg', kind: 'line', a: [0, 0], b: [1, 0], ci: 2, visible: true, def: { op: 'tangent', args: [{ s: 'C', part: 0 }, { s: 'P' }], index: 0 } },
    { id: 'M', kind: 'line', a: [-3, -1.5], b: [3, -1.2], ci: 4, visible: true },
    { id: 'x1', kind: 'point', p: [0, 0], ci: 3, visible: true, def: { op: 'meet', args: [{ s: 'Tg', part: 0 }, { s: 'M', part: 0 }], index: 0 } },
    pt('a', [0.5, 0.5]), pt('b', [0.8, 0.8]), perpS('KL', 'C', 'a', 'b'),
    { id: 'x2', kind: 'point', p: [0, 0], ci: 3, visible: true, def: { op: 'meet', args: [{ s: 'KL', part: 0 }, { s: 'M', part: 0 }], index: 0 } },
    pt('c', [0.3, 0.2]), pt('d', [-0.5, 0.4]), perpS('KC', 'C', 'c', 'd'),
    { id: 'x3', kind: 'point', p: [0, 0], ci: 3, visible: true, def: { op: 'meet', args: [{ s: 'M', part: 0 }, { s: 'KC', part: 0 }], index: 1 } }]));
  await settle(900);
  let st = await ST();
  const snap = (st) => ['x1', 'x2', 'x3'].map((id) => ({ id, p: byId(st, id).cundef ? 'undef:' + byId(st, id).cundef.code : byId(st, id).p, inf: byId(st, id).inf, i: byId(st, id).def.index }));
  R.m5_0 = { s: snap(st), kinds: [byId(st, 'Tg').kind, byId(st, 'KL').kind, byId(st, 'KC').kind] };
  for (const id of ['Tg', 'KL', 'KC']) { await ev(`Construct.api.cm.setDef('${id}', { flip: ${!byId(st, id).def.flip} })`); await settle(200); }
  st = await ST(); R.m5_1 = snap(st);
  await key('z', 4); await settle(200); await key('z', 4); await settle(200); await key('z', 4); await settle(200);
  st = await ST(); R.m5_undo = snap(st);
  await key('z', 4 | 8); await settle(200); await key('z', 4 | 8); await settle(200); await key('z', 4 | 8); await settle(200);
  st = await ST(); R.m5_redo = snap(st);
  await grab();
}
return { R, errs };
