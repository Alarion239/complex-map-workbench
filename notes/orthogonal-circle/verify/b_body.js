await view(1440, 900, false, false);
const R = {};
// ---- math-1 redo: select the rect, drag handle b across a
{
  await load(NS + 'm1b', base([{ id: 'R', kind: 'rect', a: [0, 0], b: [2, 1], ci: 0, visible: true }, pt('P', [1, 2]),
    { id: 'K', kind: 'circle', c: [0, 0], r: 1, ci: 2, visible: true, def: { op: 'touch', args: [{ s: 'R', part: 0 }, { s: 'R', h: 'a' }, { s: 'P' }], fill: 'none', nk: 'circle' } },
    { id: 'm', kind: 'point', p: [0, 0], ci: 3, visible: true, def: { op: 'meet', args: [{ s: 'K', part: 0 }, { s: 'R', part: 0 }], index: 0 } }]));
  await settle(900);
  await tool('select');
  const s1 = await W(1, 0); await click(s1[0], s1[1]); await settle(200);
  const sel = (await ST()).selected;
  const b0 = await W(2, 1), b1 = await W(2, -1);
  await mdrag(b0, b1);
  const st = await ST();
  const n2 = await CI({ names: true });
  R.m1 = { sel, R: [byId(st, 'R').a, byId(st, 'R').b], K: byId(st, 'K').cundef, m: byId(st, 'm').cundef || byId(st, 'm').p, rowK: await rowD('K'), rowm: await rowD('m'), why: (n2.find((x) => x.id === 'K') || {}).why };
  await grab();
}
// ---- user-1: the unit circle picked in the perp tool; persistence, nudge, Inspector, axis
{
  await load(NS + 'u1', base([]));
  await settle(900);
  await tool('perp');
  const u = await W(Math.cos(2.2), Math.sin(2.2));
  await click(u[0] + 2, u[1] - 2); await settle(150);
  for (const z of [[0.3, 0.2], [-0.5, 0.4]]) { const p = await W(z[0], z[1]); await click(p[0], p[1]); await settle(200); }
  await key('Escape'); await settle(100);
  let st = await ST();
  const K = last(st), Cid = K.def.args[0].s;
  R.u1_made = { C: byId(st, Cid), K: K.def };
  // reload (persisted state)
  await nav(`http://localhost:9827/test.html?ns=${NS}u1`); await settle(1500);
  st = await ST();
  R.u1_reload = { fixed: byId(st, Cid) && byId(st, Cid).fixed, row: await rowD(Cid) };
  // select it via its row, then arrow keys
  await tool('select');
  await clickSel(`.shape[data-id="${Cid}"]`); await settle(200);
  R.u1_sel = (await ST()).selected;
  await key('ArrowRight'); await settle(150); await key('ArrowUp'); await settle(150);
  st = await ST();
  R.u1_arrow = { c: byId(st, Cid).c, r: byId(st, Cid).r };
  R.u1_insp = await ev(`(() => { const ins = document.querySelector('#inspector, .inspector, [data-inspector]'); return ins ? ins.innerText.slice(0, 400) : null; })()`);
  R.u1_inputs = await ev(`[...document.querySelectorAll('#inspector input, .inspector input')].filter((e) => e.getClientRects().length).map((e) => e.name || e.id || e.getAttribute('aria-label') || e.className).slice(0, 12)`);
  // the real axis
  await tool('perp');
  const ax = await W(1.3, 0); await click(ax[0], ax[1] + 1); await settle(150);
  R.u1_axisdraft = (await CI()).draft;
  for (const z of [[0.3, 0.5], [-0.4, 0.9]]) { const p = await W(z[0], z[1]); await click(p[0], p[1]); await settle(200); }
  await key('Escape'); await settle(100);
  st = await ST();
  const K2 = last(st), Aid = K2.def && K2.def.args[0].s;
  R.u1_axis = { A: byId(st, Aid), row: await rowD(Aid), Krow: await rowD(K2.id) };
  // multi-select: Cmd+A then drag a free point
  await tool('select');
  await key('a', 4); await settle(200);
  R.u1_selall = (await ST()).selected;
  const p0 = await W(0.3, 0.2), p1 = await W(0.6, 0.6);
  await mdrag(p0, p1);
  st = await ST();
  R.u1_afterGroup = { C: byId(st, Cid).c, A: byId(st, Aid) && [byId(st, Aid).a, byId(st, Aid).b] };
  await grab();
}
// ---- user-2 / user-13 RU rows; delete the touching point
{
  await load(NS + 'u2', base([{ id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }, pt('P', [2, 0.4]),
    { id: 'L1', kind: 'line', a: [0, 0], b: [1, 0], ci: 2, visible: true, def: { op: 'tangent', args: [{ s: 'C', part: 0 }, { s: 'P' }], index: 0 } },
    { id: 'L2', kind: 'line', a: [0, 0], b: [1, 0], ci: 2, visible: true, def: { op: 'tangent', args: [{ s: 'C', part: 0 }, { s: 'P' }], index: 1 } },
    { id: 'm1', kind: 'point', p: [0, 0], ci: 3, visible: true, def: { op: 'meet', args: [{ s: 'L1', part: 0 }, { s: 'C', part: 0 }], index: 0 } },
    { id: 'D', kind: 'disc', c: [-2, 0], r: 0.8, ci: 4, visible: true }, pt('a', [-1.5, 0.5]), pt('b', [-2.5, 1]),
    { id: 'kd', kind: 'circle', c: [0, 0], r: 1, ci: 2, visible: true, def: { op: 'perp', args: [{ s: 'D', part: 0 }, { s: 'a' }, { s: 'b' }], fill: 'none', nk: 'circle' } }]));
  await nav(`http://localhost:9827/test.html?ns=${NS}u2&lang=ru`); await settle(1500);
  R.u2_lang = await ev(`document.documentElement.lang`);
  R.u2_rows = { L1: await rowD('L1'), L2: await rowD('L2'), kd: await rowD('kd') };
  const n = await CI({ names: true });
  R.u2_insp = { L1: (n.find((x) => x.id === 'L1') || {}).def, L2: (n.find((x) => x.id === 'L2') || {}).def };
  await grab();
}
// ---- user-7 / user-8: tiles and chips EN, RU
{
  await nav(`http://localhost:9827/test.html?ns=${NS}u7`); await settle(1500);
  R.u7 = await ev(`[...document.querySelectorAll('#constructTools .tool')].map((b) => { const r = b.getBoundingClientRect(); const l = b.querySelector('.lbl, span:last-child') || b; const lr = l.getBoundingClientRect(); return { t: b.dataset.tool, txt: b.textContent.trim(), title: b.title || b.getAttribute('aria-label'), h: Math.round(lr.height), w: Math.round(r.width) }; })`);
  await tool('perp');
  R.u8_en = await ev(`(document.querySelector('#draftChipL') || {}).textContent || ''`);
  await key('Escape'); await settle(100);
  await nav(`http://localhost:9827/test.html?ns=${NS}u7&lang=ru`); await settle(1500);
  R.u7ru = await ev(`[...document.querySelectorAll('#constructTools .tool')].map((b) => ({ t: b.dataset.tool, txt: b.textContent.trim() }))`);
  await tool('perp');
  R.u8_ru = await ev(`(document.querySelector('#draftChipL') || {}).textContent || ''`);
  R.u8_ru_shy = /\u00ad/.test(R.u8_ru);
  await key('Escape');
}
return { R, errs };
